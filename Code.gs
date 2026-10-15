/**
 * Google Apps Script backend for Sistem Komputer Assessment.
 * Deploy as Web App: Execute as Me, Who has access: Anyone.
 *
 * Script Properties required:
 *   SPREADSHEET_ID = your Google Sheet ID
 *   TEACHER_KEY    = a strong password/key for dashboard access
 */

const SHEET_NAME = 'Results';
const INACTIVITY_MINUTES = 3;
const MAX_SESSION_MINUTES = 45;
const HEADERS = [
  'sessionId','name','className','status','level','questionNumber','answered','correct',
  'theta','score','elapsedSeconds','startedAt','updatedAt','finishedAt','responsesJson'
];

function doGet() {
  return jsonOutput({ ok: true, service: 'Sistem Komputer Assessment API' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'upsertProgress') return upsertProgress(body);
    if (body.action === 'getResults') return getResults(body);
    return jsonOutput({ ok:false, error:'Unknown action' });
  } catch (err) {
    return jsonOutput({ ok:false, error:String(err) });
  }
}

function getSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertProgress(data) {
  const sheet = getSheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sessionId = sanitize(data.sessionId, 120);
    if (!sessionId) return jsonOutput({ok:false,error:'sessionId required'});

    const now = new Date();
    const rowValues = [[
      sessionId,
      sanitize(data.name, 80),
      sanitize(data.className, 20),
      sanitize(data.status, 20),
      num(data.level),
      num(data.questionNumber),
      num(data.answered),
      num(data.correct),
      num(data.theta),
      num(data.score),
      num(data.elapsedSeconds),
      sanitize(data.startedAt, 60),
      now.toISOString(),
      sanitize(data.finishedAt, 60),
      JSON.stringify(Array.isArray(data.responses) ? data.responses : [])
    ]];

    const lastRow = sheet.getLastRow();
    let targetRow = -1;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2,1,lastRow-1,1).getValues().flat();
      const idx = ids.indexOf(sessionId);
      if (idx >= 0) targetRow = idx + 2;
    }
    if (targetRow > 0) {
      const prior = sheet.getRange(targetRow,1,1,HEADERS.length).getValues()[0];
      // Terminal sessions cannot be reopened by delayed frontend requests.
      if (prior[3] === "finished" || prior[3] === "auto_finished") return jsonOutput({ok:true,ignored:true});
      // Do not reopen expired sessions even before a teacher opens the dashboard.
      if (isExpired(prior, now)) {
        finishRowAutomatically(sheet, targetRow, prior, now);
        return jsonOutput({ok:true,ignored:true,autoFinished:true});
      }
      if (Number(prior[6] || 0) > Number(data.answered || 0)) return jsonOutput({ok:true,ignored:true});
      sheet.getRange(targetRow,1,1,HEADERS.length).setValues(rowValues);
    }
    else sheet.appendRow(rowValues[0]);

    return jsonOutput({ok:true});
  } finally {
    lock.releaseLock();
  }
}

function getResults(data) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('TEACHER_KEY');
  if (!expected) return jsonOutput({ok:false,error:'TEACHER_KEY belum diatur.'});
  if (String(data.teacherKey || '') !== expected) return jsonOutput({ok:false,error:'Unauthorized'});

  const sheet = getSheet();
  closeExpiredSessions(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ok:true,rows:[]});
  const headers = values[0];
  const rows = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    // Jawaban detail diperlukan untuk analisis butir pada dashboard guru.
    return obj;
  });
  return jsonOutput({ok:true,rows:rows});
}

// Timestamp freshness is based on backend receipt time, not the client's clock.
function dateMillis(value) {
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
}
function isExpired(row, now) {
  if (row[3] !== 'in_progress') return false;
  const last = dateMillis(row[12]);
  const start = dateMillis(row[11]);
  return (last && now.getTime() - last >= INACTIVITY_MINUTES * 60000) ||
         (start && now.getTime() - start >= MAX_SESSION_MINUTES * 60000);
}
function finishRowAutomatically(sheet, rowNumber, row, now) {
  const elapsed = dateMillis(row[11]) ? Math.max(Number(row[10]) || 0, Math.round((now.getTime() - dateMillis(row[11])) / 1000)) : Number(row[10]) || 0;
  // Preserve the last score and number of responses: unanswered questions get no credit.
  sheet.getRange(rowNumber, 4).setValue('auto_finished');
  sheet.getRange(rowNumber, 11).setValue(elapsed);
  sheet.getRange(rowNumber, 13, 1, 2).setValues([[now.toISOString(), now.toISOString()]]);
}
function closeExpiredSessions(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const n = sheet.getLastRow() - 1;
    if (n <= 0) return;
    const rows = sheet.getRange(2, 1, n, HEADERS.length).getValues();
    const now = new Date();
    rows.forEach((row, i) => { if (isExpired(row, now)) finishRowAutomatically(sheet, i + 2, row, now); });
  } finally { lock.releaseLock(); }
}
function sanitize(value, maxLen) {
  const s = String(value == null ? '' : value).trim();
  return /^[=+@\-]/.test(s) ? "\'" + s.slice(0, maxLen || 500) : s.slice(0, maxLen || 500);
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
