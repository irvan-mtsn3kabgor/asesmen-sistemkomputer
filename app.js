/*
  Sistem Komputer Assessment SPA
  Frontend: GitHub Pages / static hosting
  Backend: Google Apps Script Web App (see Code.gs)
*/

const CONFIG = {
  GAS_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
  QUESTION_TIME_SECONDS: 40,
  QUESTIONS_PER_LEVEL: 5,
  DASHBOARD_POLL_MS: 8000,
  TEACHER_SESSION_MINUTES: 45,
};

const app = document.getElementById("app");
const teacherEntryBtn = document.getElementById("teacherEntryBtn");
const toast = document.getElementById("toast");

const state = {
  student: null,
  sessionId: null,
  startedAt: null,
  finishedAt: null,
  level: 1,
  questionIndex: 0,
  currentQuestions: [],
  selectedByLevel: {},
  responses: [],
  theta: 0,
  timerId: null,
  timeLeft: CONFIG.QUESTION_TIME_SECONDS,
  answerLocked: false,
  matchState: null,
  teacherKey: null,
  teacherPoll: null,
};

const ILLUSTRATIONS = {
  hardware: { icon: "🖥️", text: "Perangkat keras adalah bagian komputer yang dapat dilihat atau disentuh." },
  cpu: { icon: "🧠", text: "CPU memproses instruksi dan mengatur berbagai kegiatan utama komputer." },
  memory: { icon: "🧩", text: "Memori menyimpan data sementara atau permanen sesuai jenisnya." },
  storage: { icon: "💾", text: "Media penyimpanan menyimpan data agar dapat digunakan kembali." },
  io: { icon: "⌨️", text: "Perangkat input dan output membantu manusia berinteraksi dengan komputer." },
  os: { icon: "⚙️", text: "Sistem operasi mengelola perangkat keras dan menjadi penghubung dengan aplikasi." },
  binary: { icon: "0️⃣1️⃣", text: "Komputer merepresentasikan data menggunakan keadaan digital, misalnya 0 dan 1." },
  network: { icon: "🌐", text: "Perangkat jaringan membantu komputer bertukar data dengan perangkat lain." },
};

// difficulty b roughly follows Rasch 1PL scale. Higher = harder.
// Each level contains 15 bank questions. 45 total.
const QUESTION_BANK = {
  1: [
    mcq("L1-01", -1.8, "hardware", "Manakah yang termasuk perangkat keras komputer?", ["Keyboard", "Windows", "Google Chrome", "Microsoft Word"], 0),
    tf("L1-02", -1.6, "cpu", "CPU sering disebut sebagai bagian yang memproses instruksi utama komputer.", true),
    mcq("L1-03", -1.5, "io", "Perangkat yang digunakan untuk memasukkan teks ke komputer adalah ...", ["Monitor", "Keyboard", "Speaker", "Proyektor"], 1),
    mcq("L1-04", -1.4, "io", "Manakah yang termasuk perangkat output?", ["Mouse", "Scanner", "Monitor", "Mikrofon"], 2),
    match("L1-05", -1.2, "hardware", "Pasangkan perangkat dengan kelompok yang tepat.", [
      ["Keyboard", "Input"], ["Monitor", "Output"], ["SSD", "Penyimpanan"]
    ]),
    tf("L1-06", -1.1, "storage", "SSD dapat digunakan untuk menyimpan file.", true),
    mcq("L1-07", -1.0, "os", "Sistem operasi adalah ...", ["Perangkat lunak yang mengelola kerja komputer", "Kabel penghubung monitor", "Perangkat untuk mencetak", "Jenis memori sementara"], 0),
    mcq("L1-08", -0.9, "memory", "RAM digunakan terutama untuk ...", ["menyimpan data sementara saat program berjalan", "mencetak dokumen", "menghubungkan internet", "menampilkan gambar ke layar"], 0),
    match("L1-09", -0.8, "io", "Pasangkan perangkat dengan fungsinya.", [
      ["Mouse", "Menggerakkan pointer"], ["Speaker", "Mengeluarkan suara"], ["Scanner", "Memasukkan gambar/dokumen"]
    ]),
    tf("L1-10", -0.7, "hardware", "Monitor merupakan perangkat input.", false),
    mcq("L1-11", -0.6, "cpu", "Komponen yang melakukan banyak proses perhitungan dan instruksi adalah ...", ["CPU", "Mouse", "Speaker", "Flashdisk"], 0),
    mcq("L1-12", -0.5, "storage", "Perangkat berikut yang cocok untuk menyimpan file dan mudah dibawa adalah ...", ["Flashdisk", "Monitor", "Keyboard", "Webcam"], 0),
    tf("L1-13", -0.4, "os", "Aplikasi dan sistem operasi sama-sama termasuk perangkat lunak.", true),
    match("L1-14", -0.3, "hardware", "Pasangkan istilah dengan contoh yang tepat.", [
      ["Hardware", "Keyboard"], ["Software", "Aplikasi presentasi"], ["Pengguna", "Orang yang mengoperasikan komputer"]
    ]),
    mcq("L1-15", -0.2, "memory", "Saat banyak aplikasi dibuka, komponen yang paling langsung dipakai untuk menyimpan data kerja sementara adalah ...", ["RAM", "Printer", "Speaker", "Scanner"], 0),
  ],
  2: [
    mcq("L2-01", -0.4, "cpu", "Urutan sederhana proses komputer yang paling tepat adalah ...", ["Input → Proses → Output", "Output → Input → Proses", "Proses → Output → Input", "Input → Output → Proses"], 0),
    tf("L2-02", -0.3, "memory", "RAM bersifat sementara sehingga data kerja dapat hilang ketika komputer dimatikan.", true),
    mcq("L2-03", -0.2, "storage", "Perbedaan paling tepat antara RAM dan SSD adalah ...", ["RAM menyimpan sementara, SSD menyimpan lebih permanen", "RAM untuk suara, SSD untuk gambar", "RAM adalah perangkat input, SSD perangkat output", "RAM dan SSD selalu memiliki fungsi yang sama"], 0),
    match("L2-04", 0.0, "io", "Pasangkan kegiatan dengan perangkat yang paling sesuai.", [
      ["Merekam suara", "Mikrofon"], ["Mencetak tugas", "Printer"], ["Memindai foto", "Scanner"]
    ]),
    mcq("L2-05", 0.1, "os", "Mengapa sistem operasi diperlukan?", ["Agar perangkat keras dan aplikasi dapat dikelola dan digunakan", "Agar keyboard berubah menjadi monitor", "Agar listrik menjadi data", "Agar semua file otomatis tersimpan di internet"], 0),
    tf("L2-06", 0.2, "cpu", "CPU hanya berfungsi menyimpan file dalam jangka panjang.", false),
    mcq("L2-07", 0.3, "binary", "Komputer digital pada dasarnya mengolah keadaan yang dapat direpresentasikan sebagai ...", ["0 dan 1", "A sampai Z saja", "warna merah dan biru saja", "angka 1 sampai 9 saja"], 0),
    match("L2-08", 0.4, "hardware", "Pasangkan komponen dengan peran umumnya.", [
      ["CPU", "Memproses instruksi"], ["RAM", "Menyimpan data kerja sementara"], ["SSD", "Menyimpan file jangka panjang"]
    ]),
    mcq("L2-09", 0.5, "io", "Seseorang melakukan video call. Kombinasi perangkat yang paling diperlukan untuk memasukkan suara dan gambar adalah ...", ["Mikrofon dan webcam", "Speaker dan printer", "Monitor dan proyektor", "SSD dan flashdisk"], 0),
    tf("L2-10", 0.6, "os", "Tanpa sistem operasi, penggunaan aplikasi umum pada komputer menjadi jauh lebih sulit karena sumber daya perangkat tidak terkelola dengan baik.", true),
    mcq("L2-11", 0.7, "storage", "Jika ingin menyimpan video besar agar tetap tersedia setelah komputer dimatikan, pilihan yang paling tepat adalah ...", ["SSD/HDD", "RAM", "cache sementara saja", "register CPU"], 0),
    match("L2-12", 0.8, "io", "Pasangkan arah aliran data dengan contoh.", [
      ["Input", "Mengetik lewat keyboard"], ["Proses", "CPU menghitung"], ["Output", "Hasil tampil di monitor"]
    ]),
    mcq("L2-13", 0.9, "memory", "Ketika RAM hampir penuh, dampak yang paling mungkin dirasakan pengguna adalah ...", ["Komputer dapat melambat saat berpindah aplikasi", "Monitor otomatis menjadi lebih besar", "Keyboard kehilangan semua tombol", "Printer selalu mencetak lebih cepat"], 0),
    tf("L2-14", 1.0, "binary", "Satu bit hanya memiliki dua kemungkinan nilai dasar.", true),
    mcq("L2-15", 1.1, "hardware", "Perangkat yang paling tepat dikelompokkan sebagai input sekaligus output pada situasi tertentu adalah ...", ["Layar sentuh", "Printer biasa", "Mikrofon", "Speaker"], 0),
  ],
  3: [
    mcq("L3-01", 0.6, "cpu", "Saat aplikasi terasa lambat ketika banyak proses berjalan bersamaan, komponen yang paling terkait dengan pelaksanaan instruksi adalah ...", ["CPU", "Speaker", "Scanner", "Proyektor"], 0),
    tf("L3-02", 0.7, "memory", "Menambah kapasitas RAM dapat membantu ketika komputer sering kehabisan ruang kerja sementara, tetapi tidak otomatis memperbesar kapasitas penyimpanan file jangka panjang.", true),
    match("L3-03", 0.8, "hardware", "Pasangkan gejala dengan komponen yang paling mungkin terkait.", [
      ["File tidak cukup ruang tersimpan", "SSD/HDD"], ["Aplikasi sering kekurangan memori", "RAM"], ["Instruksi komputasi berat lambat", "CPU"]
    ]),
    mcq("L3-04", 0.9, "binary", "Jika sebuah sakelar digital hanya memiliki keadaan mati atau menyala, representasi paling sederhana adalah ...", ["0 dan 1", "A dan B", "1 sampai 10", "merah, hijau, biru"], 0),
    mcq("L3-05", 1.0, "os", "Manakah contoh peran sistem operasi yang paling tepat?", ["Mengatur penggunaan memori dan perangkat oleh beberapa aplikasi", "Mengubah speaker menjadi keyboard", "Menambah kapasitas fisik SSD tanpa perangkat baru", "Mencetak semua file tanpa perintah"], 0),
    tf("L3-06", 1.1, "storage", "Penyimpanan internal yang penuh dapat menghambat penyimpanan file baru walaupun RAM masih tersedia.", true),
    mcq("L3-07", 1.2, "io", "Seorang siswa ingin merekam presentasi lengkap dengan suara dan wajah. Perangkat input yang paling relevan adalah ...", ["Webcam dan mikrofon", "Monitor dan speaker", "Printer dan SSD", "Proyektor dan speaker"], 0),
    match("L3-08", 1.3, "network", "Pasangkan perangkat/kegiatan dengan fungsi yang paling sesuai.", [
      ["Router", "Mengarahkan lalu lintas jaringan"], ["NIC/Wi-Fi adapter", "Menghubungkan komputer ke jaringan"], ["Browser", "Mengakses layanan web"]
    ]),
    mcq("L3-09", 1.4, "cpu", "Mengapa clock CPU saja tidak selalu cukup untuk menentukan komputer mana yang lebih cepat?", ["Kinerja juga dipengaruhi arsitektur, jumlah inti, memori, dan beban kerja", "Karena clock hanya mengatur warna layar", "Karena CPU tidak memproses instruksi", "Karena semua CPU selalu sama cepat"], 0),
    tf("L3-10", 1.5, "os", "Sistem operasi dapat membantu mengatur agar beberapa program berbagi sumber daya komputer secara terkontrol.", true),
    mcq("L3-11", 1.6, "memory", "Dalam alur kerja komputer, cache CPU umumnya digunakan untuk ...", ["menyediakan akses sangat cepat ke data/instruksi yang sering dibutuhkan CPU", "menyimpan semua dokumen pengguna secara permanen", "menggantikan fungsi monitor", "menghubungkan printer ke listrik"], 0),
    match("L3-12", 1.7, "binary", "Pasangkan istilah dengan arti sederhananya.", [
      ["Bit", "Unit data dengan dua keadaan"], ["Byte", "Kelompok beberapa bit"], ["Binary", "Sistem representasi berbasis dua keadaan"]
    ]),
    mcq("L3-13", 1.8, "storage", "Untuk membuka aplikasi yang tersimpan di SSD, secara sederhana data/instruksi biasanya perlu dimuat ke ... sebelum diproses CPU.", ["RAM", "Speaker", "Printer", "Mouse"], 0),
    tf("L3-14", 1.9, "io", "Layar sentuh dapat berperan sebagai output sekaligus input karena menampilkan informasi dan menerima sentuhan.", true),
    mcq("L3-15", 2.0, "hardware", "Sebuah komputer dapat menyala tetapi aplikasi sering berhenti karena ruang kerja sementara sangat terbatas. Komponen yang paling logis diperiksa lebih dahulu adalah ...", ["RAM", "Speaker", "Webcam", "Printer"], 0),
  ],
};

function mcq(id, b, illustration, text, options, answer) {
  return { id, type: "mcq", b, illustration, text, options, answer };
}
function tf(id, b, illustration, text, answer) {
  return { id, type: "tf", b, illustration, text, options: ["Benar", "Salah"], answer: answer ? 0 : 1 };
}
function match(id, b, illustration, text, pairs) {
  return { id, type: "match", b, illustration, text, pairs };
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function formatTime(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2,"0")}:${String(sec % 60).padStart(2,"0")}`;
}
function elapsedSeconds() {
  return state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
}
function escapeHtml(s = "") {
  return String(s).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function raschProbability(theta, b) {
  return 1 / (1 + Math.exp(-(theta - b)));
}
function estimateTheta(responses) {
  if (!responses.length) return 0;
  let theta = 0;
  for (let step = 0; step < 10; step++) {
    let scoreDiff = 0;
    let info = 0;
    for (const r of responses) {
      const p = raschProbability(theta, r.b);
      scoreDiff += r.correct - p;
      info += p * (1 - p);
    }
    if (info < 0.05) break;
    theta += scoreDiff / info;
    theta = clamp(theta, -3, 3);
  }
  return theta;
}
function thetaToScore(theta) {
  return Math.round(100 / (1 + Math.exp(-1.25 * theta)));
}
function levelAccuracy(level) {
  const rs = state.responses.filter(r => r.level === level);
  if (!rs.length) return 0;
  return rs.reduce((s,r) => s + r.correct, 0) / rs.length;
}
function adaptiveTarget(level) {
  if (level === 1) return -1.0;
  const prevAcc = levelAccuracy(level - 1);
  const prevTheta = estimateTheta(state.responses.filter(r => r.level <= level - 1));
  let shift = 0;
  if (prevAcc >= .8) shift = .55;
  else if (prevAcc <= .4) shift = -.45;
  else shift = .10;
  const base = level === 2 ? .35 : 1.25;
  return clamp(base + shift + prevTheta * .18, -1.8, 2.0);
}
function selectQuestions(level) {
  const target = adaptiveTarget(level);
  const pool = QUESTION_BANK[level].map(q => ({ q, d: Math.abs(q.b - target) + Math.random() * .3 }));
  pool.sort((a,b) => a.d - b.d);
  const candidate = pool.slice(0, 10).map(x => x.q);
  const typeBuckets = {
    mcq: shuffle(candidate.filter(q => q.type === "mcq")),
    tf: shuffle(candidate.filter(q => q.type === "tf")),
    match: shuffle(candidate.filter(q => q.type === "match")),
  };
  const chosen = [];
  if (typeBuckets.match.length) chosen.push(typeBuckets.match.pop());
  if (typeBuckets.tf.length) chosen.push(typeBuckets.tf.pop());
  while (chosen.length < CONFIG.QUESTIONS_PER_LEVEL) {
    const remain = candidate.filter(q => !chosen.some(c => c.id === q.id));
    if (!remain.length) break;
    chosen.push(shuffle(remain)[0]);
  }
  return shuffle(chosen);
}

function renderHome() {
  clearTimer();
  stopTeacherPolling();
  teacherEntryBtn.classList.remove("hidden");
  app.innerHTML = `
    <section class="hero">
      <div class="card hero-copy">
        <span class="badge">✨ 3 level • 15 soal per sesi</span>
        <h1>Asesmen Sistem Komputer</h1>
        <p class="lead">Uji pemahaman tentang perangkat keras, perangkat lunak, input-output, CPU, memori, penyimpanan, dan cara kerja komputer melalui soal interaktif.</p>
        <div class="feature-pills">
          <span>⏱️ 40 detik/soal</span>
          <span>🎯 Soal adaptif</span>
          <span>🔀 Bank soal acak</span>
          <span>🧩 Matching interaktif</span>
        </div>
        <form id="startForm">
          <div class="form-grid">
            <div class="field">
              <label for="studentName">Nama Peserta</label>
              <input class="input" id="studentName" maxlength="60" autocomplete="name" placeholder="Contoh: Aisyah Putri" required />
            </div>
            <div class="field">
              <label for="studentClass">Kelas</label>
              <select class="select" id="studentClass" required>
                <option value="">Pilih kelas</option>
                ${["A","B","C","D","E","F","G"].map(c => `<option value="VII ${c}">VII ${c}</option>`).join("")}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-wide" style="margin-top:16px" type="submit">Mulai Asesmen 🚀</button>
        </form>
      </div>
      <div class="card hero-visual" aria-hidden="true">
        <svg class="device-illustration" viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg">
          <rect x="74" y="48" width="312" height="202" rx="22" fill="#ffffff"/>
          <rect x="92" y="67" width="276" height="162" rx="14" fill="#eff0ff"/>
          <rect x="191" y="251" width="78" height="34" rx="8" fill="#dddfff"/>
          <rect x="158" y="282" width="145" height="16" rx="8" fill="#ffffff"/>
          <circle cx="230" cy="149" r="56" fill="#5b5bd6"/>
          <path d="M204 150h52M230 124v52" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
          <rect x="25" y="114" width="66" height="88" rx="16" fill="#fff" opacity=".92"/>
          <circle cx="58" cy="139" r="12" fill="#14b8a6"/>
          <rect x="42" y="161" width="32" height="8" rx="4" fill="#dfe2f4"/>
          <rect x="42" y="177" width="24" height="8" rx="4" fill="#dfe2f4"/>
          <rect x="372" y="118" width="64" height="78" rx="16" fill="#fff" opacity=".92"/>
          <rect x="389" y="138" width="30" height="30" rx="8" fill="#f59e0b"/>
          <path d="M397 153h14" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
        </svg>
      </div>
    </section>`;
  document.getElementById("startForm").addEventListener("submit", startAssessment);
}

async function startAssessment(e) {
  e.preventDefault();
  const name = document.getElementById("studentName").value.trim();
  const cls = document.getElementById("studentClass").value;
  if (!name || !cls) return;
  state.student = { name, className: cls };
  state.sessionId = uid();
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.level = 1;
  state.questionIndex = 0;
  state.responses = [];
  state.theta = 0;
  state.selectedByLevel = {};
  state.currentQuestions = selectQuestions(1);
  state.selectedByLevel[1] = state.currentQuestions.map(q => q.id);
  teacherEntryBtn.classList.add("hidden");
  await sendProgress("in_progress");
  renderAssessment();
}

function renderAssessment() {
  const q = state.currentQuestions[state.questionIndex];
  if (!q) return completeLevel();
  state.answerLocked = false;
  state.timeLeft = CONFIG.QUESTION_TIME_SECONDS;
  state.matchState = q.type === "match" ? prepareMatchState(q) : null;

  app.innerHTML = `
    <section class="assessment-layout">
      <aside class="card nav-panel">
        <div class="student-chip">
          <strong>${escapeHtml(state.student.name)}</strong>
          <span>${escapeHtml(state.student.className)}</span>
        </div>
        ${[1,2,3].map(level => {
          const started = level < state.level || level === state.level;
          return `<div class="level-title">Level ${level}</div>
            <div class="question-nav">${Array.from({length:5},(_,i) => {
              const globalAnswered = state.responses.filter(r => r.level === level).length;
              const active = level === state.level && i === state.questionIndex;
              const done = i < globalAnswered;
              return `<div class="qdot ${active ? "active" : done ? "done" : started ? "" : "locked"}">${i+1}</div>`;
            }).join("")}</div>`;
        }).join("")}
      </aside>

      <section class="card question-card">
        <div class="question-head">
          <div class="question-meta">
            <span class="meta-pill">Level ${state.level}</span>
            <span class="meta-pill">Soal ${state.questionIndex + 1}/5</span>
            <span class="meta-pill">${q.type === "mcq" ? "Pilihan Ganda" : q.type === "tf" ? "Benar / Salah" : "Menjodohkan"}</span>
            <span class="meta-pill difficulty">Adaptif</span>
          </div>
          <span class="meta-pill">🧠 ${state.responses.length + 1}/15</span>
        </div>
        <div class="question-body">
          ${illustrationHtml(q.illustration)}
          <h2 class="question-title">${escapeHtml(q.text)}</h2>
          ${questionInteractionHtml(q)}
        </div>
        <div class="timer-wrap">
          <div class="timer-row"><span>Waktu menjawab</span><strong id="timerText">00:40</strong></div>
          <div class="timer-track"><div id="timerBar" class="timer-bar"></div></div>
        </div>
      </section>
    </section>`;

  bindQuestionEvents(q);
  startTimer(q);
  requestAnimationFrame(() => { if (q.type === "match") redrawMatchLines(); });
}

function illustrationHtml(key) {
  const it = ILLUSTRATIONS[key] || ILLUSTRATIONS.hardware;
  return `<div class="mini-illustration"><div class="ico">${it.icon}</div><p>${escapeHtml(it.text)}</p></div>`;
}

function questionInteractionHtml(q) {
  if (q.type === "mcq" || q.type === "tf") {
    return `<div class="options-grid">
      ${q.options.map((opt,i) => `<button class="option" data-answer="${i}" type="button"><span class="opt-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(opt)}</span></button>`).join("")}
    </div>`;
  }
  const left = state.matchState.left;
  const right = state.matchState.right;
  return `<p class="match-instruction">Tap satu item di kiri, lalu tap pasangan yang sesuai di kanan. Garis akan terbentuk otomatis.</p>
    <div id="matchArea" class="match-area">
      <svg id="matchSvg" class="match-svg"></svg>
      <div class="match-col">${left.map((x,i) => `<button type="button" class="match-item match-left" data-left="${i}">${escapeHtml(x.label)}</button>`).join("")}</div>
      <div class="match-col">${right.map((x,i) => `<button type="button" class="match-item match-right" data-right="${i}">${escapeHtml(x.label)}</button>`).join("")}</div>
    </div>
    <button id="submitMatch" class="btn btn-primary btn-wide" type="button" style="margin-top:16px" disabled>Periksa Jawaban</button>`;
}

function prepareMatchState(q) {
  const left = q.pairs.map((p, idx) => ({ label: p[0], pairId: idx }));
  const right = shuffle(q.pairs.map((p, idx) => ({ label: p[1], pairId: idx })));
  return { left, right, activeLeft: null, links: [] };
}

function bindQuestionEvents(q) {
  if (q.type === "mcq" || q.type === "tf") {
    document.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
      if (state.answerLocked) return;
      document.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      submitAnswer(Number(btn.dataset.answer), q);
    }));
    return;
  }

  document.querySelectorAll(".match-left").forEach(btn => btn.addEventListener("click", () => {
    if (state.answerLocked) return;
    const idx = Number(btn.dataset.left);
    const existing = state.matchState.links.find(l => l.left === idx);
    if (existing) state.matchState.links = state.matchState.links.filter(l => l.left !== idx);
    state.matchState.activeLeft = idx;
    document.querySelectorAll(".match-left").forEach(b => b.classList.toggle("active", Number(b.dataset.left) === idx));
    updateMatchUI();
  }));
  document.querySelectorAll(".match-right").forEach(btn => btn.addEventListener("click", () => {
    if (state.answerLocked || state.matchState.activeLeft === null) return;
    const right = Number(btn.dataset.right);
    state.matchState.links = state.matchState.links.filter(l => l.left !== state.matchState.activeLeft && l.right !== right);
    state.matchState.links.push({ left: state.matchState.activeLeft, right });
    state.matchState.activeLeft = null;
    document.querySelectorAll(".match-left").forEach(b => b.classList.remove("active"));
    updateMatchUI();
  }));
  document.getElementById("submitMatch").addEventListener("click", () => submitAnswer([...state.matchState.links], q));
  window.addEventListener("resize", redrawMatchLines, { once: true });
}

function updateMatchUI() {
  document.querySelectorAll(".match-left").forEach(btn => {
    btn.classList.toggle("matched", state.matchState.links.some(l => l.left === Number(btn.dataset.left)));
  });
  document.querySelectorAll(".match-right").forEach(btn => {
    btn.classList.toggle("matched", state.matchState.links.some(l => l.right === Number(btn.dataset.right)));
  });
  const submit = document.getElementById("submitMatch");
  if (submit) submit.disabled = state.matchState.links.length !== state.matchState.left.length;
  redrawMatchLines();
}

function redrawMatchLines() {
  const area = document.getElementById("matchArea");
  const svg = document.getElementById("matchSvg");
  if (!area || !svg || !state.matchState) return;
  const areaRect = area.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${areaRect.width} ${areaRect.height}`);
  svg.innerHTML = state.matchState.links.map(link => {
    const l = document.querySelector(`[data-left="${link.left}"]`)?.getBoundingClientRect();
    const r = document.querySelector(`[data-right="${link.right}"]`)?.getBoundingClientRect();
    if (!l || !r) return "";
    const x1 = l.right - areaRect.left;
    const y1 = l.top - areaRect.top + l.height / 2;
    const x2 = r.left - areaRect.left;
    const y2 = r.top - areaRect.top + r.height / 2;
    return `<line class="match-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }).join("");
}

function startTimer(q) {
  clearTimer();
  const started = Date.now();
  state.timerId = setInterval(() => {
    const elapsed = (Date.now() - started) / 1000;
    state.timeLeft = Math.max(0, CONFIG.QUESTION_TIME_SECONDS - elapsed);
    const text = document.getElementById("timerText");
    const bar = document.getElementById("timerBar");
    if (text) text.textContent = formatTime(state.timeLeft);
    if (bar) {
      bar.style.width = `${(state.timeLeft / CONFIG.QUESTION_TIME_SECONDS) * 100}%`;
      bar.classList.toggle("warning", state.timeLeft <= 10);
    }
    if (state.timeLeft <= 0) {
      clearTimer();
      submitAnswer(null, q, true);
    }
  }, 100);
}
function clearTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

async function submitAnswer(answer, q, timedOut = false) {
  if (state.answerLocked) return;
  state.answerLocked = true;
  clearTimer();
  const responseTime = CONFIG.QUESTION_TIME_SECONDS - state.timeLeft;
  let correct = 0;
  if (q.type === "match") {
    if (Array.isArray(answer)) {
      correct = answer.length === q.pairs.length && answer.every(link => {
        const leftPair = state.matchState.left[link.left].pairId;
        const rightPair = state.matchState.right[link.right].pairId;
        return leftPair === rightPair;
      }) ? 1 : 0;
    }
  } else {
    correct = answer === q.answer ? 1 : 0;
    if (answer !== null) {
      document.querySelectorAll(".option").forEach(btn => {
        const i = Number(btn.dataset.answer);
        if (i === q.answer) btn.classList.add("correct");
        else if (i === answer) btn.classList.add("wrong");
      });
    }
  }

  state.responses.push({
    questionId: q.id,
    type: q.type,
    level: state.level,
    b: q.b,
    correct,
    responseTime: Math.round(responseTime * 10) / 10,
    timedOut,
  });
  state.theta = estimateTheta(state.responses);
  sendProgress("in_progress");

  if (timedOut) showToast("Waktu habis. Lanjut ke soal berikutnya.");
  else showToast(correct ? "Jawaban tercatat ✓" : "Jawaban tercatat");

  setTimeout(() => {
    state.questionIndex += 1;
    if (state.questionIndex >= CONFIG.QUESTIONS_PER_LEVEL) completeLevel();
    else renderAssessment();
  }, timedOut ? 450 : 650);
}

function completeLevel() {
  clearTimer();
  if (state.level >= 3) return finishAssessment();
  const finishedLevel = state.level;
  const acc = levelAccuracy(finishedLevel);
  const nextTarget = adaptiveTarget(finishedLevel + 1);
  const message = acc >= .8
    ? "Jawabanmu kuat. Level berikutnya akan memilih soal yang cenderung lebih menantang."
    : acc <= .4
      ? "Level berikutnya akan memilih soal yang lebih bertahap agar kemampuanmu dapat diukur dengan adil."
      : "Level berikutnya akan menyesuaikan tingkat kesulitan berdasarkan hasilmu sejauh ini.";
  app.innerHTML = `<section class="card level-transition">
    <div class="level-orb">${acc >= .8 ? "🚀" : acc <= .4 ? "🧭" : "🎯"}</div>
    <span class="badge">Level ${finishedLevel} selesai</span>
    <h2 style="font-size:clamp(1.6rem,4vw,2.4rem); margin:15px 0 8px">Lanjut ke Level ${finishedLevel + 1}</h2>
    <p class="lead" style="max-width:640px;margin:0 auto 20px">${message}</p>
    <div class="feature-pills" style="justify-content:center">
      <span>Akurasi level: ${Math.round(acc*100)}%</span>
      <span>Target kesulitan: ${nextTarget.toFixed(2)}</span>
    </div>
    <button id="continueLevel" class="btn btn-primary" type="button">Lanjutkan</button>
  </section>`;
  document.getElementById("continueLevel").addEventListener("click", () => {
    state.level += 1;
    state.questionIndex = 0;
    state.currentQuestions = selectQuestions(state.level);
    state.selectedByLevel[state.level] = state.currentQuestions.map(q => q.id);
    renderAssessment();
  });
}

async function finishAssessment() {
  clearTimer();
  state.finishedAt = Date.now();
  state.theta = estimateTheta(state.responses);
  const score = thetaToScore(state.theta);
  await sendProgress("finished", score);
  renderResult(score);
}

function renderResult(score) {
  teacherEntryBtn.classList.remove("hidden");
  const totalCorrect = state.responses.reduce((s,r) => s + r.correct, 0);
  const duration = Math.round((state.finishedAt - state.startedAt)/1000);
  app.innerHTML = `<section class="result-grid">
    <div class="card score-card">
      <span class="badge">Asesmen selesai 🎉</span>
      <div class="score-ring" style="--score:${score}"><div class="score-value">${score}</div></div>
      <h2 style="margin:0">${escapeHtml(state.student.name)}</h2>
      <p style="color:var(--muted);margin:5px 0 0">${escapeHtml(state.student.className)}</p>
      <div class="stat-list">
        <div class="stat"><span>Benar</span><strong>${totalCorrect}/15</strong></div>
        <div class="stat"><span>Waktu</span><strong>${formatTime(duration)}</strong></div>
        <div class="stat"><span>IRT θ</span><strong>${state.theta.toFixed(2)}</strong></div>
        <div class="stat"><span>Skala</span><strong>0–100</strong></div>
      </div>
    </div>
    <div class="card panel">
      <h2 style="margin-top:0">Ringkasan Hasil</h2>
      <p class="lead" style="font-size:1rem">Skor dihitung menggunakan pendekatan IRT/Rasch 1PL sederhana. Setiap butir memiliki parameter kesulitan, lalu kemampuan peserta diestimasi dari pola benar-salah pada seluruh soal yang dikerjakan.</p>
      ${[1,2,3].map(l => {
        const rs = state.responses.filter(r => r.level === l);
        const correct = rs.reduce((s,r)=>s+r.correct,0);
        return `<div class="metric" style="margin-bottom:10px"><span>Level ${l}</span><strong>${correct}/5 benar</strong></div>`;
      }).join("")}
      <button id="restartBtn" class="btn btn-primary btn-wide" type="button" style="margin-top:8px">Kembali ke Halaman Awal</button>
    </div>
  </section>`;
  document.getElementById("restartBtn").addEventListener("click", renderHome);
}

async function apiPost(payload) {
  if (!CONFIG.GAS_URL || CONFIG.GAS_URL.includes("PASTE_YOUR")) return { ok:false, offline:true };
  try {
    const res = await fetch(CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable", err);
    return { ok:false, error:String(err) };
  }
}

function progressPayload(status, finalScore = null) {
  const totalCorrect = state.responses.reduce((s,r)=>s+r.correct,0);
  const score = finalScore ?? thetaToScore(estimateTheta(state.responses));
  return {
    action: "upsertProgress",
    sessionId: state.sessionId,
    name: state.student?.name || "",
    className: state.student?.className || "",
    status,
    level: state.level,
    questionNumber: Math.min(15, state.responses.length + (status === "finished" ? 0 : 1)),
    answered: state.responses.length,
    correct: totalCorrect,
    theta: Number(state.theta.toFixed(3)),
    score,
    elapsedSeconds: elapsedSeconds(),
    startedAt: new Date(state.startedAt).toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: status === "finished" ? new Date(state.finishedAt).toISOString() : "",
    responses: state.responses,
  };
}
async function sendProgress(status, finalScore = null) {
  const result = await apiPost(progressPayload(status, finalScore));
  if (result.offline) console.info("Backend URL belum dikonfigurasi. Data tetap berjalan secara lokal.");
}

teacherEntryBtn.addEventListener("click", renderTeacherLogin);

function renderTeacherLogin() {
  clearTimer();
  teacherEntryBtn.classList.add("hidden");
  app.innerHTML = `<section class="card panel" style="max-width:560px;margin:0 auto">
    <span class="badge">🔐 Area Guru</span>
    <h1 style="font-size:2rem;margin-bottom:10px">Dashboard Asesmen</h1>
    <p class="lead" style="font-size:1rem">Masukkan kunci guru yang sama dengan <code>TEACHER_KEY</code> pada Script Properties Google Apps Script.</p>
    <form id="teacherLoginForm">
      <div class="field"><label for="teacherKey">Kunci Guru</label><input id="teacherKey" class="input" type="password" autocomplete="current-password" required /></div>
      <button class="btn btn-primary btn-wide" style="margin-top:14px">Masuk Dashboard</button>
      <button id="cancelTeacher" class="btn btn-ghost btn-wide" type="button" style="margin-top:8px">Kembali</button>
    </form>
  </section>`;
  document.getElementById("cancelTeacher").addEventListener("click", renderHome);
  document.getElementById("teacherLoginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const key = document.getElementById("teacherKey").value;
    const result = await apiPost({ action:"getResults", teacherKey:key });
    if (!result.ok) {
      showToast(result.offline ? "Backend belum dikonfigurasi." : "Kunci guru salah atau server tidak dapat diakses.");
      return;
    }
    state.teacherKey = key;
    renderTeacherDashboard(result.rows || []);
    startTeacherPolling();
  });
}

function renderTeacherDashboard(rows) {
  const normalized = [...rows].sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const finished = normalized.filter(r => r.status === "finished");
  const live = normalized.filter(r => r.status !== "finished");
  const avg = finished.length ? Math.round(finished.reduce((s,r)=>s+Number(r.score||0),0)/finished.length) : 0;
  app.innerHTML = `<section class="card panel">
    <div class="toolbar">
      <div>
        <span class="badge">📊 Live Dashboard</span>
        <h2 style="margin:10px 0 0">Pemantauan Hasil Siswa</h2>
      </div>
      <div class="toolbar-actions">
        <button id="refreshDash" class="btn btn-secondary btn-small" type="button">↻ Refresh</button>
        <button id="exportExcel" class="btn btn-primary btn-small" type="button">⬇ Excel</button>
        <button id="exitTeacher" class="btn btn-ghost btn-small" type="button">Keluar</button>
      </div>
    </div>
    <div class="teacher-grid">
      <div class="metric"><span>Sedang mengerjakan</span><strong>${live.length}</strong></div>
      <div class="metric"><span>Selesai</span><strong>${finished.length}</strong></div>
      <div class="metric"><span>Rata-rata skor</span><strong>${avg}</strong></div>
      <div class="metric"><span>Total sesi</span><strong>${normalized.length}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama</th><th>Kelas</th><th>Status</th><th>Progress</th><th>Benar</th><th>IRT θ</th><th>Skor</th><th>Waktu</th><th>Update</th></tr></thead>
        <tbody>
          ${normalized.length ? normalized.map(r => `<tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.className)}</td>
            <td><span class="status ${r.status === "finished" ? "done" : "live"}">${r.status === "finished" ? "Selesai" : "Live"}</span></td>
            <td>${Number(r.answered||0)}/15</td>
            <td>${Number(r.correct||0)}</td>
            <td>${Number(r.theta||0).toFixed(2)}</td>
            <td><strong>${Number(r.score||0)}</strong></td>
            <td>${formatTime(Number(r.elapsedSeconds||0))}</td>
            <td>${formatDate(r.updatedAt)}</td>
          </tr>`).join("") : `<tr><td colspan="9" class="center" style="padding:28px;color:var(--muted)">Belum ada data asesmen.</td></tr>`}
        </tbody>
      </table>
    </div>
    <p style="color:var(--muted);font-size:.8rem;margin:10px 0 0">Dashboard memperbarui data otomatis setiap ${Math.round(CONFIG.DASHBOARD_POLL_MS/1000)} detik.</p>
  </section>`;
  document.getElementById("refreshDash").addEventListener("click", refreshTeacherDashboard);
  document.getElementById("exportExcel").addEventListener("click", () => exportExcel(normalized));
  document.getElementById("exitTeacher").addEventListener("click", () => { state.teacherKey = null; stopTeacherPolling(); renderHome(); });
}

function startTeacherPolling() {
  stopTeacherPolling();
  state.teacherPoll = setInterval(refreshTeacherDashboard, CONFIG.DASHBOARD_POLL_MS);
}
function stopTeacherPolling() {
  if (state.teacherPoll) clearInterval(state.teacherPoll);
  state.teacherPoll = null;
}
async function refreshTeacherDashboard() {
  if (!state.teacherKey) return;
  const result = await apiPost({ action:"getResults", teacherKey:state.teacherKey });
  if (result.ok) renderTeacherDashboard(result.rows || []);
}
function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("id-ID", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(d);
}
function exportExcel(rows) {
  const data = rows.map(r => ({
    "Nama": r.name,
    "Kelas": r.className,
    "Status": r.status,
    "Soal Dijawab": Number(r.answered||0),
    "Jawaban Benar": Number(r.correct||0),
    "Theta IRT": Number(r.theta||0),
    "Skor 0-100": Number(r.score||0),
    "Waktu (detik)": Number(r.elapsedSeconds||0),
    "Mulai": r.startedAt || "",
    "Selesai": r.finishedAt || "",
    "Update Terakhir": r.updatedAt || "",
  }));
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil Asesmen");
    XLSX.writeFile(wb, `hasil-asesmen-sistem-komputer-${new Date().toISOString().slice(0,10)}.xlsx`);
  } else {
    const headers = Object.keys(data[0] || {Nama:""});
    const csv = [headers, ...data.map(r => headers.map(h => r[h]))]
      .map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "hasil-asesmen.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
}

renderHome();
