/**
 * Google Apps Script backend for Sistem Komputer Assessment.
 * Deploy as Web App: Execute as Me, Who has access: Anyone.
 *
 * Script Properties required:
 *   SPREADSHEET_ID = your Google Sheet ID
 *   TEACHER_KEY    = a strong password/key for dashboard access
 */

const SHEET_NAME = 'Results';
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
      sanitize(data.updatedAt, 60),
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
    if (targetRow > 0) sheet.getRange(targetRow,1,1,HEADERS.length).setValues(rowValues);
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
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ok:true,rows:[]});
  const headers = values[0];
  const rows = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    delete obj.responsesJson; // keep dashboard payload small
    return obj;
  });
  return jsonOutput({ok:true,rows:rows});
}

function sanitize(value, maxLen) {
  const s = String(value == null ? '' : value).trim();
  return s.slice(0, maxLen || 500);
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
