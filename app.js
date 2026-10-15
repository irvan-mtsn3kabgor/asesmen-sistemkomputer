/*
  Sistem Komputer Assessment SPA
  Frontend: GitHub Pages / static hosting
  Backend: Google Apps Script Web App (see Code.gs)
*/

const CONFIG = {
  GAS_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
  QUESTION_TIME_SECONDS: 40,
  QUESTIONS_PER_LEVEL: {1:15, 2:10, 3:5},
  TOTAL_QUESTIONS: 30,
  DASHBOARD_POLL_MS: 8000,
  TEACHER_SESSION_MINUTES: 45,
  INACTIVITY_MINUTES: 3,
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
  questionDeadline: null,
  phase: "home",
  answerLocked: false,
  matchState: null,
  teacherKey: null,
  teacherPoll: null,
  teacherClassFilter: "ALL",
  teacherNameFilter: "",
  teacherScoreFilter: "ALL",
  teacherSortColumn: "updatedAt",
  teacherSortDirection: "desc",
};


// Cadangan sesi pada perangkat yang sama, termasuk urutan acak dan batas waktu.
const SESSION_STORAGE_KEY = "mts7_asesmen_active_v1";
function persistStudentSession() {
  if (!state.student || !state.sessionId || state.phase === "home") return;
  try {
    const snapshot = {
      version: 1, savedAt: Date.now(), student: state.student, sessionId: state.sessionId,
      startedAt: state.startedAt, finishedAt: state.finishedAt, level: state.level,
      questionIndex: state.questionIndex, currentQuestions: state.currentQuestions,
      selectedByLevel: state.selectedByLevel, responses: state.responses, theta: state.theta,
      questionDeadline: state.questionDeadline, phase: state.phase,
      selectedAnswer: state.selectedAnswer, matchState: state.matchState
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) { console.warn("Penyimpanan lokal tidak tersedia", err); }
}
function clearStudentSession() {
  try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch (_) {}
}
function restoreStudentSession() {
  let snapshot;
  try { snapshot = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null"); }
  catch (_) { clearStudentSession(); return false; }
  if (!snapshot || snapshot.version !== 1 || !snapshot.student?.name ||
      !snapshot.sessionId || !Array.isArray(snapshot.currentQuestions) ||
      !Array.isArray(snapshot.responses) || ![1,2,3].includes(snapshot.level)) return false;
  Object.assign(state, {
    student: snapshot.student, sessionId: snapshot.sessionId, startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt, level: snapshot.level,
    questionIndex: snapshot.questionIndex, currentQuestions: snapshot.currentQuestions,
    selectedByLevel: snapshot.selectedByLevel || {}, responses: snapshot.responses,
    theta: snapshot.theta || 0, questionDeadline: snapshot.questionDeadline,
    phase: snapshot.phase || "question", selectedAnswer: snapshot.selectedAnswer ?? null,
    matchState: snapshot.matchState || null, answerLocked: false
  });
  teacherEntryBtn.classList.add("hidden");
  if (state.phase === "finished") {
    renderResult(thetaToScore(state.theta));
  } else if (state.phase === "result_ready") {
    renderCompletionDialog();
  } else if (state.phase === "advancing") {
    advanceAfterAnswer();
  } else if (state.phase === "transition") {
    completeLevel();
  } else {
    renderAssessment(true);
  }
  return true;
}
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
    mcq("L1-08", -0.9, "memory", "Siapa yang termasuk brainware dalam penggunaan komputer?", ["Orang yang menjalankan komputer", "Alat untuk mencetak", "Program pengolah kata", "Alat penyimpan data"], 0),
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
    mcq("L1-15", -0.2, "memory", "Ketika siswa menyimpan tugas ke dalam flashdisk, flashdisk berfungsi sebagai ...", ["Penyimpanan", "Perangkat proses", "Perangkat output", "Brainware"], 0),
  ],
  2: [
    mcq("L2-01", -0.4, "cpu", "Urutan sederhana proses komputer yang paling tepat adalah ...", ["Input  ->  Proses  ->  Output", "Output  ->  Input  ->  Proses", "Proses  ->  Output  ->  Input", "Input  ->  Output  ->  Proses"], 0),
    tf("L2-02", -0.3, "memory", "Guru yang menjalankan aplikasi presentasi termasuk brainware.", true),
    mcq("L2-03", -0.2, "storage", "Perbedaan yang tepat antara monitor dan SSD adalah ...", ["Monitor menampilkan hasil, SSD menyimpan data", "Monitor adalah perangkat input, SSD output", "Monitor dan SSD hanya menerima suara", "Monitor dan SSD adalah aplikasi"], 0),
    match("L2-04", 0.0, "io", "Pasangkan kegiatan dengan perangkat yang paling sesuai.", [
      ["Merekam suara", "Mikrofon"], ["Mencetak tugas", "Printer"], ["Memindai foto", "Scanner"]
    ]),
    mcq("L2-05", 0.1, "os", "Mengapa sistem operasi diperlukan?", ["Agar perangkat keras dan aplikasi dapat dikelola dan digunakan", "Agar keyboard berubah menjadi monitor", "Agar listrik menjadi data", "Agar semua file otomatis tersimpan di internet"], 0),
    tf("L2-06", 0.2, "cpu", "CPU hanya berfungsi menyimpan file dalam jangka panjang.", false),
    mcq("L2-07", 0.3, "binary", "Ketika siswa menekan keyboard, tahap yang terjadi pertama adalah ...", ["Input", "Proses", "Output", "Storage"], 0),
    match("L2-08", 0.4, "hardware", "Pasangkan komponen dengan peran umumnya.", [
      ["CPU", "Memproses instruksi"], ["Monitor", "Menampilkan hasil pengolahan"], ["SSD", "Menyimpan file untuk digunakan kembali"]
    ]),
    mcq("L2-09", 0.5, "io", "Seseorang melakukan video call. Kombinasi perangkat yang paling diperlukan untuk memasukkan suara dan gambar adalah ...", ["Mikrofon dan webcam", "Speaker dan printer", "Monitor dan proyektor", "SSD dan flashdisk"], 0),
    tf("L2-10", 0.6, "os", "Tanpa sistem operasi, penggunaan aplikasi umum pada komputer menjadi jauh lebih sulit karena sumber daya perangkat tidak terkelola dengan baik.", true),
    mcq("L2-11", 0.7, "storage", "Agar video tugas bisa dibuka lagi besok, di mana sebaiknya disimpan?", ["SSD atau hard disk", "Monitor", "Speaker", "Mikrofon"], 0),
    match("L2-12", 0.8, "io", "Pasangkan arah aliran data dengan contoh.", [
      ["Input", "Mengetik lewat keyboard"], ["Proses", "CPU menghitung"], ["Output", "Hasil tampil di monitor"]
    ]),
    mcq("L2-13", 0.9, "memory", "Siswa ingin memindahkan tugas ke komputer lain. Perangkat apa yang paling mudah dibawa?", ["Flashdisk", "Monitor", "Printer", "Speaker"], 0),
    tf("L2-14", 1.0, "binary", "File yang sudah disimpan dapat dibuka dan digunakan kembali.", true),
    mcq("L2-15", 1.1, "hardware", "Perangkat yang paling tepat dikelompokkan sebagai input sekaligus output pada situasi tertentu adalah ...", ["Layar sentuh", "Printer biasa", "Mikrofon", "Speaker"], 0),
  ],
  3: [
    mcq("L3-01", 0.6, "cpu", "Saat aplikasi terasa lambat ketika banyak proses berjalan bersamaan, komponen yang paling terkait dengan pelaksanaan instruksi adalah ...", ["CPU", "Speaker", "Scanner", "Proyektor"], 0),
    tf("L3-02", 0.7, "memory", "Perangkat keras, perangkat lunak, dan brainware saling bekerja sama agar komputer berguna.", true),
    match("L3-03", 0.8, "hardware", "Pasangkan gejala dengan komponen yang paling mungkin terkait.", [
      ["File disimpan agar bisa dibuka besok", "SSD/HDD"], ["Gambar tampil pada layar", "Monitor"], ["Data diolah menurut perintah", "CPU"]
    ]),
    mcq("L3-04", 0.9, "binary", "Seorang siswa mengetik, lalu hasilnya muncul di layar. Perangkat yang digunakan untuk memasukkan data ialah ...", ["Keyboard", "Monitor", "Speaker", "Printer"], 0),
    mcq("L3-05", 1.0, "os", "Manakah contoh peran sistem operasi yang paling tepat?", ["Mengatur penggunaan memori dan perangkat oleh beberapa aplikasi", "Mengubah speaker menjadi keyboard", "Menambah kapasitas fisik SSD tanpa perangkat baru", "Mencetak semua file tanpa perintah"], 0),
    tf("L3-06", 1.1, "storage", "Jika ruang penyimpanan komputer penuh, file baru mungkin tidak dapat disimpan.", true),
    mcq("L3-07", 1.2, "io", "Seorang siswa ingin merekam presentasi lengkap dengan suara dan wajah. Perangkat input yang paling relevan adalah ...", ["Webcam dan mikrofon", "Monitor dan speaker", "Printer dan SSD", "Proyektor dan speaker"], 0),
    match("L3-08", 1.3, "network", "Pasangkan kegiatan pada sistem komputer dengan tahap yang sesuai.", [
      ["Mengetik huruf", "Input"], ["CPU mengolah teks", "Proses"], ["Menyimpan dokumen", "Storage"]
    ]),
    mcq("L3-09", 1.4, "cpu", "Mengapa keyboard tidak dapat menggantikan fungsi monitor dalam alur kerja komputer?", ["Keyboard memasukkan data, sedangkan monitor menampilkan hasil", "Keyboard dan monitor selalu melakukan tugas sama", "Keyboard menyimpan file sedangkan monitor memproses data", "Monitor adalah brainware dan keyboard adalah software"], 0),
    tf("L3-10", 1.5, "os", "Sistem operasi dapat membantu mengatur agar beberapa program berbagi sumber daya komputer secara terkontrol.", true),
    mcq("L3-11", 1.6, "memory", "Seorang siswa mengetik laporan dan mencetaknya. Apa peran printer pada alur tersebut?", ["Mengeluarkan hasil pengolahan dalam bentuk cetakan", "Mengubah tulisan menjadi perintah input", "Menyimpan semua dokumen sebagai file", "Menjadi manusia pengguna komputer"], 0),
    match("L3-12", 1.7, "binary", "Pasangkan unsur sistem komputer dengan contoh yang tepat.", [
      ["Hardware", "Printer"], ["Software", "Aplikasi pengolah kata"], ["Brainware", "Siswa pengguna komputer"]
    ]),
    mcq("L3-13", 1.8, "storage", "Urutan yang benar dari menulis dokumen hingga menyimpannya adalah ...", ["Input lewat keyboard  ->  proses CPU  ->  tampil di monitor  ->  simpan ke SSD", "Monitor  ->  printer  ->  input keyboard  ->  hapus", "Speaker  ->  CPU  ->  keyboard  ->  monitor", "SSD  ->  speaker  ->  mouse  ->  printer"], 0),
    tf("L3-14", 1.9, "io", "Layar sentuh dapat berperan sebagai output sekaligus input karena menampilkan informasi dan menerima sentuhan.", true),
    mcq("L3-15", 2.0, "hardware", "Komputer tidak dapat menyimpan tugas baru karena penyimpanannya penuh. Apa tindakan paling tepat?", ["Mengosongkan ruang penyimpanan atau memakai media simpan lain", "Mengganti speaker", "Melepas monitor", "Menekan keyboard berulang kali"], 0),
  ],
};


// Tambahan bank soal dari LKPD Pertemuan 1-3.
QUESTION_BANK[1].push(mcq("L1-16", -1.7, "io", "Hardware adalah sebutan untuk ...", ["Bagian komputer yang dapat disentuh", "Program komputer", "Pengguna komputer", "Hasil cetakan"], 0));
QUESTION_BANK[1].push(mcq("L1-17", -1.655, "storage", "Manakah contoh software?", ["Mouse", "Keyboard", "Aplikasi menggambar", "Printer"], 2));
QUESTION_BANK[1].push(mcq("L1-18", -1.61, "cpu", "Siapa yang disebut brainware?", ["Siswa yang menggunakan komputer", "Monitor", "Aplikasi pengetikan", "Flashdisk"], 0));
QUESTION_BANK[1].push(mcq("L1-19", -1.565, "os", "Alat untuk memilih ikon di layar komputer adalah ...", ["Mouse", "Speaker", "Printer", "Hard disk"], 0));
QUESTION_BANK[1].push(mcq("L1-20", -1.52, "hardware", "Perangkat yang menghasilkan suara adalah ...", ["Mikrofon", "Speaker", "Keyboard", "Scanner"], 1));
QUESTION_BANK[1].push(mcq("L1-21", -1.475, "io", "Perangkat yang digunakan untuk mencetak dokumen adalah ...", ["CPU", "Webcam", "Printer", "Mouse"], 2));
QUESTION_BANK[1].push(mcq("L1-22", -1.43, "storage", "Contoh perangkat input untuk memasukkan suara adalah ...", ["Monitor", "Mikrofon", "Speaker", "SSD"], 1));
QUESTION_BANK[1].push(mcq("L1-23", -1.385, "cpu", "Perangkat untuk menampilkan tulisan dan gambar adalah ...", ["Keyboard", "Monitor", "Mouse", "Flashdisk"], 1));
QUESTION_BANK[1].push(mcq("L1-24", -1.34, "os", "Yang termasuk contoh brainware ialah ...", ["Guru yang mengoperasikan laptop", "Aplikasi browser", "RAM", "Kamera"], 0));
QUESTION_BANK[1].push(mcq("L1-25", -1.295, "hardware", "Program untuk membuka halaman web disebut ...", ["Browser", "Mouse", "Printer", "Speaker"], 0));
QUESTION_BANK[1].push(mcq("L1-26", -1.25, "io", "Sistem operasi Windows termasuk kategori ...", ["Brainware", "Hardware", "Software", "Storage fisik"], 2));
QUESTION_BANK[1].push(mcq("L1-27", -1.205, "storage", "Ketika menekan tombol huruf, perangkat input yang dipakai ialah ...", ["Keyboard", "Monitor", "Speaker", "Printer"], 0));
QUESTION_BANK[1].push(mcq("L1-28", -1.16, "cpu", "Mana pasangan perangkat yang sama-sama hardware?", ["Keyboard dan mouse", "Windows dan Word", "Siswa dan guru", "Browser dan permainan"], 0));
QUESTION_BANK[1].push(mcq("L1-29", -1.115, "os", "Perangkat yang menyimpan tugas agar bisa dibuka kembali adalah ...", ["Flashdisk", "Speaker", "Monitor", "Mikrofon"], 0));
QUESTION_BANK[1].push(mcq("L1-30", -1.07, "hardware", "Tahap pertama dalam alur kerja komputer disebut ...", ["Output", "Storage", "Input", "Proses"], 2));
QUESTION_BANK[1].push(mcq("L1-31", -1.025, "io", "Bagian yang memproses perintah setelah data masuk ialah ...", ["CPU", "Monitor", "Speaker", "Printer"], 0));
QUESTION_BANK[1].push(mcq("L1-32", -0.98, "storage", "Tahap menampilkan hasil pengolahan disebut ...", ["Input", "Proses", "Output", "Storage"], 2));
QUESTION_BANK[1].push(mcq("L1-33", -0.935, "cpu", "Menggunakan mouse untuk memilih gambar merupakan tahap ...", ["Input", "Output", "Storage", "Cetak"], 0));
QUESTION_BANK[1].push(mcq("L1-34", -0.89, "os", "Setelah dokumen diketik, file dapat disimpan pada ...", ["SSD", "Monitor", "Speaker", "Webcam"], 0));
QUESTION_BANK[1].push(mcq("L1-35", -0.845, "hardware", "Perangkat input untuk memasukkan foto cetak ialah ...", ["Scanner", "Speaker", "Proyektor", "Monitor"], 0));
QUESTION_BANK[1].push(mcq("L1-36", -0.8, "io", "Orang yang merawat komputer disebut ...", ["Teknisi", "Monitor", "Keyboard", "Windows"], 0));
QUESTION_BANK[1].push(mcq("L1-37", -0.755, "storage", "Aplikasi pengolah kata digunakan untuk ...", ["Membuat dan mengedit tulisan", "Memproses listrik", "Menggantikan RAM", "Menghidupkan printer tanpa komputer"], 0));
QUESTION_BANK[1].push(mcq("L1-38", -0.71, "cpu", "Yang bukan perangkat lunak adalah ...", ["Aplikasi menggambar", "Browser", "Mouse", "Permainan edukatif"], 2));
QUESTION_BANK[1].push(mcq("L1-39", -0.665, "os", "Tahapan setelah input adalah ...", ["Storage", "Proses", "Output", "Cetak"], 1));
QUESTION_BANK[1].push(mcq("L1-40", -0.62, "hardware", "Hasil ketikan terlihat pada layar. Layar berperan sebagai ...", ["Input", "Proses", "Output", "Brainware"], 2));
QUESTION_BANK[1].push(mcq("L1-41", -0.575, "io", "CPU merupakan bagian dari ...", ["Hardware", "Brainware", "Software", "Pengguna"], 0));
QUESTION_BANK[1].push(mcq("L1-42", -0.53, "storage", "Kamera komputer atau webcam berfungsi untuk ...", ["Memasukkan gambar atau video", "Mencetak kertas", "Mengeluarkan suara", "Menyimpan file jangka panjang"], 0));
QUESTION_BANK[1].push(mcq("L1-43", -0.485, "cpu", "Siswa membuat presentasi. Siswa berperan sebagai ...", ["Software", "Output", "Brainware", "Storage"], 2));
QUESTION_BANK[1].push(mcq("L1-44", -0.44, "os", "Hard disk termasuk perangkat ...", ["Penyimpanan", "Masukan suara", "Keluaran suara", "Aplikasi"], 0));
QUESTION_BANK[1].push(mcq("L1-45", -0.395, "hardware", "Salah satu manfaat komputer adalah ...", ["Membantu membuat dokumen", "Menggantikan semua guru", "Selalu bekerja tanpa listrik", "Tidak membutuhkan pengguna"], 0));
QUESTION_BANK[2].push(mcq("L2-16", -0.35, "io", "Siswa mengetik lalu melihat hasil di monitor. Urutan perannya adalah ...", ["Keyboard input, CPU proses, monitor output", "Monitor input, keyboard output, CPU storage", "CPU input, monitor proses, keyboard output", "Keyboard output, CPU input, monitor proses"], 0));
QUESTION_BANK[2].push(mcq("L2-17", -0.265, "storage", "Aplikasi pengolah kata dan Windows memiliki persamaan karena keduanya ...", ["Perangkat lunak", "Perangkat input", "Brainware", "Perangkat penyimpanan fisik"], 0));
QUESTION_BANK[2].push(mcq("L2-18", -0.18, "cpu", "Saat guru mencetak bahan ajar, printer berada pada tahap ...", ["Output", "Input", "Proses", "Brainware"], 0));
QUESTION_BANK[2].push(mcq("L2-19", -0.095, "os", "Foto dipindai lalu tampil di layar. Alat yang pertama memasukkan data ialah ...", ["Scanner", "Monitor", "Speaker", "Printer"], 0));
QUESTION_BANK[2].push(mcq("L2-20", -0.01, "hardware", "Ketika operator memperbaiki keyboard rusak, operator adalah ...", ["Brainware", "Software", "Output", "Storage"], 0));
QUESTION_BANK[2].push(mcq("L2-21", 0.075, "io", "Penyimpanan diperlukan setelah pekerjaan selesai supaya ...", ["File dapat digunakan kembali", "CPU berhenti selamanya", "Monitor berubah menjadi input", "Mouse mencetak dokumen"], 0));
QUESTION_BANK[2].push(mcq("L2-22", 0.16, "storage", "Susunan mana yang paling tepat untuk membuat dan menyimpan tugas?", ["Ketik  ->  diproses  ->  tampil  ->  simpan", "Simpan  ->  tampil  ->  ketik  ->  proses", "Cetak  ->  simpan  ->  proses  ->  ketik", "Tampil  ->  proses  ->  simpan  ->  ketik"], 0));
QUESTION_BANK[2].push(mcq("L2-23", 0.245, "cpu", "Keyboard dan mikrofon sama-sama termasuk ...", ["Input", "Output", "Storage", "Brainware"], 0));
QUESTION_BANK[2].push(mcq("L2-24", 0.33, "os", "Printer dan speaker memiliki kesamaan sebagai ...", ["Perangkat output", "Perangkat input", "Perangkat penyimpanan", "Program aplikasi"], 0));
QUESTION_BANK[2].push(mcq("L2-25", 0.415, "hardware", "Agar komputer dapat menjalankan aplikasi, sistem operasi membantu ...", ["Mengelola komputer dan aplikasi", "Mencetak tanpa perangkat", "Menghapus kebutuhan pengguna", "Menggantikan CPU"], 0));
QUESTION_BANK[2].push(mcq("L2-26", 0.5, "io", "Jika mouse digerakkan, kursor berpindah di monitor. Mouse adalah ...", ["Input dan monitor output", "Output dan monitor input", "Storage dan monitor CPU", "Brainware dan monitor software"], 0));
QUESTION_BANK[2].push(mcq("L2-27", 0.585, "storage", "Ketika tugas telah selesai diketik, perangkat yang cocok menyimpan salinannya ialah ...", ["Flashdisk", "Mikrofon", "Speaker", "Webcam"], 0));
QUESTION_BANK[2].push(mcq("L2-28", 0.67, "cpu", "Mengapa komputer memerlukan brainware?", ["Karena manusia memberi perintah dan menggunakan hasil", "Karena CPU selalu menjadi manusia", "Karena aplikasi dapat memegang mouse sendiri", "Karena hard disk dapat mengajar"], 0));
QUESTION_BANK[2].push(mcq("L2-29", 0.755, "os", "Pernyataan paling tepat tentang CPU adalah ...", ["Mengolah data sesuai instruksi", "Hanya menampilkan gambar", "Hanya menyimpan berkas permanen", "Hanya menerima bunyi"], 0));
QUESTION_BANK[2].push(mcq("L2-30", 0.84, "hardware", "Ketika siswa menggambar dengan aplikasi dan menyimpan file, aplikasi termasuk ...", ["Software", "Hardware", "Brainware", "Kabel"], 0));

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
  const count = CONFIG.QUESTIONS_PER_LEVEL[level];
  const pool = shuffle(QUESTION_BANK[level]).map(q => ({q, weight: Math.exp(-Math.abs(q.b-target)*1.0) * (.35 + Math.random())}));
  const chosen = [];
  const remaining = [...pool];
  while (chosen.length < count && remaining.length) {
    const sum = remaining.reduce((a,x)=>a+x.weight,0);
    let pick = Math.random()*sum, at=0;
    for (;at<remaining.length-1;at++) {pick-=remaining[at].weight;if(pick<=0)break;}
    chosen.push(remaining.splice(at,1)[0].q);
  }
  return shuffle(chosen).map(q => q.type === "match" ? {...q, pairs: shuffle(q.pairs)} :
    {...q, options: shuffle(q.options.map((label,original)=>({label,original}))).map(x=>x.label),
      answerText: q.options[q.answer]});
}

function renderHome() {
  clearTimer();
  stopTeacherPolling();
  teacherEntryBtn.classList.remove("hidden");
  app.innerHTML = `
    <section class="hero hero-simple">
      <div class="card hero-copy">
        <span class="badge">Asesmen Informatika Kelas VII MTs</span>
        <h1>ASESMEN MANDIRI MADRASAH</h1>
        <div class="subject-summary">
          <p><strong>Mata Pelajaran :</strong> Informatika</p>
          <p><strong>Materi :</strong> Sistem Komputer</p>
        </div>
        <form id="startForm">
          <div class="form-grid">
            <div class="field">
              <label for="studentName">Nama Peserta</label>
              <input class="input" id="studentName" maxlength="60" autocomplete="name" placeholder="Masukkan nama lengkap" required />
            </div>
            <div class="field">
              <label for="studentClass">Kelas</label>
              <select class="select" id="studentClass" required>
                <option value="">Pilih kelas</option>
                ${["A","B","C","D","E","F","G"].map(c => `<option value="VII ${c}">VII ${c}</option>`).join("")}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-wide" style="margin-top:20px" type="submit">Baca Petunjuk Pengerjaan</button>
        </form>
      </div>
    </section>`;
  document.getElementById("startForm").addEventListener("submit", showInstructions);
}

let instructionInterval = null;
function showInstructions(e) {
  e.preventDefault();
  const name = document.getElementById("studentName").value.trim();
  const cls = document.getElementById("studentClass").value;
  if (!name || !cls) return;
  const existing = document.getElementById("instructionOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "instruction-overlay";
  overlay.id = "instructionOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "instructionTitle");
  overlay.innerHTML = `<div class="instruction-card card">
    <span class="badge">Sebelum Memulai</span>
    <h2 id="instructionTitle">Petunjuk Pengerjaan</h2>
    <p class="instruction-greeting">Baca petunjuk berikut dengan teliti, ${escapeHtml(name)}.</p>
    <ol class="instruction-list">
      <li>Asesmen terdiri dari <strong>3 level</strong>, dengan total <strong>30 soal</strong>: Level 1 sebanyak 15 soal, Level 2 sebanyak 10 soal, dan Level 3 sebanyak 5 soal.</li>
      <li>Setiap soal memiliki waktu maksimal <strong>40 detik</strong>. Jika waktu habis, aplikasi otomatis beralih ke soal berikutnya.</li>
      <li>Untuk menjawab, ketuk pilihan yang menurutmu benar. Pada soal menjodohkan, ketuk dua pasangan yang sesuai.</li>
      <li>Tekan <strong>Simpan dan Lanjut</strong> untuk menyimpan jawaban dan melanjutkan ke soal berikutnya.</li>
      <li>Kerjakan sendiri dengan jujur. Bila halaman tidak sengaja dimuat ulang, asesmen bisa dilanjutkan pada perangkat dan browser yang sama.</li>
      <li>Setelah selesai, nilai dan total waktu pengerjaan akan ditampilkan.</li>
    </ol>
    <button class="btn btn-primary btn-wide" id="instructionsContinue" type="button" disabled>Lanjutkan (20 detik)</button>
    <p class="instruction-hint" id="instructionHint">Tombol aktif setelah waktu membaca selesai.</p>
  </div>`;
  document.body.appendChild(overlay);
  const next = overlay.querySelector("#instructionsContinue");
  next.focus();
  const deadline = Date.now() + 20000;
  if (instructionInterval) clearInterval(instructionInterval);
  instructionInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (!overlay.isConnected) { clearInterval(instructionInterval); instructionInterval = null; return; }
    next.textContent = remaining ? `Lanjutkan (${remaining} detik)` : "Lanjutkan ke Asesmen";
    if (!remaining) {
      clearInterval(instructionInterval); instructionInterval = null;
      next.disabled = false;
      overlay.querySelector("#instructionHint").textContent = "Petunjuk selesai dibaca. Silakan mulai asesmen.";
    }
  }, 200);
  next.addEventListener("click", () => {
    if (next.disabled || Date.now() < deadline) return;
    if (instructionInterval) { clearInterval(instructionInterval); instructionInterval = null; }
    overlay.remove();
    beginAssessment(name, cls);
  }, {once:true});
}

function beginAssessment(name, cls) {
  clearStudentSession();
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
  state.phase = "question";
  state.questionDeadline = Date.now() + CONFIG.QUESTION_TIME_SECONDS * 1000;
  persistStudentSession();
  sendProgress("in_progress");
  renderAssessment(true);
}

function renderAssessment(resuming = false) {
  const q=state.currentQuestions[state.questionIndex];
  if(!q)return completeLevel();
  state.answerLocked=false;
  if (!resuming || !state.questionDeadline) {
    state.questionDeadline = Date.now() + CONFIG.QUESTION_TIME_SECONDS * 1000;
    state.selectedAnswer = null;
    state.matchState = q.type === 'match' ? prepareMatchState(q) : null;
  }
  state.phase = "question";
  state.timeLeft = Math.max(0, (state.questionDeadline - Date.now()) / 1000);
  if (q.type === 'match' && !state.matchState) state.matchState = prepareMatchState(q);
  persistStudentSession();
  const count=CONFIG.QUESTIONS_PER_LEVEL[state.level];
  app.innerHTML=`<section class="card focused-question">
    <div class="focus-meta"><span class="meta-pill"> Level ${state.level}</span><span class="meta-pill">Soal ${state.questionIndex+1} dari ${count}</span><span class="meta-pill">${escapeHtml(state.student.name)}  -  ${escapeHtml(state.student.className)}</span></div>
    <div class="progress-dots" aria-label="Navigasi soal pada level ini">${Array.from({length:count},(_,i)=>`<span title="Soal ${i+1}" class="progress-dot ${i<state.questionIndex?'done':i===state.questionIndex?'active':''}">${i+1}</span>`).join('')}</div>
    <h1 class="focus-title">${escapeHtml(q.text)}</h1>
    ${questionInteractionHtml(q)}
    <div class="timer-wrap focused-timer"><div class="timer-row"><span> Waktu menjawab</span><strong id="timerText">00:40</strong></div><div class="timer-track"><div id="timerBar" class="timer-bar" style="width:100%"></div></div></div>
    <button id="saveNext" type="button" class="btn btn-primary btn-wide save-btn" disabled>Simpan dan Lanjut  -> </button>
  </section>`;
  bindQuestionEvents(q);
  document.getElementById('saveNext').addEventListener('click',()=>submitAnswer(q.type==='match'?[...state.matchState.links]:state.selectedAnswer,q));
  if (resuming) {
    if (q.type === 'match') updateMatchUI();
    else if (state.selectedAnswer !== null && state.selectedAnswer !== undefined) {
      document.querySelectorAll('.option').forEach(btn => btn.classList.toggle('selected', Number(btn.dataset.answer) === state.selectedAnswer));
      document.getElementById('saveNext').disabled = false;
    }
  }
  startTimer(q);
  requestAnimationFrame(()=>{if(q.type==='match')redrawMatchLines()});
}
function questionInteractionHtml(q){
 if(q.type!=='match')return `<div class="options-grid">${q.options.map((opt,i)=>`<button type="button" class="option" data-answer="${i}"><span class="opt-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(opt)}</span></button>`).join('')}</div>`;
 return `<p class="match-instruction">Pilih satu kotak kiri, lalu pasangkan dengan kotak kanan. Garis akan terhubung otomatis.</p><div id="matchArea" class="match-area"><svg id="matchSvg" class="match-svg"></svg><div class="match-col">${state.matchState.left.map((x,i)=>`<button type="button" class="match-item match-left" data-left="${i}">${escapeHtml(x.label)}</button>`).join('')}</div><div class="match-col">${state.matchState.right.map((x,i)=>`<button type="button" class="match-item match-right" data-right="${i}">${escapeHtml(x.label)}</button>`).join('')}</div></div>`;
}

function prepareMatchState(q) {
  const left = q.pairs.map((p, idx) => ({ label: p[0], pairId: idx }));
  const right = shuffle(q.pairs.map((p, idx) => ({ label: p[1], pairId: idx })));
  return { left, right, activeLeft: null, links: [] };
}

function bindQuestionEvents(q){
 if(q.type!=='match'){
  document.querySelectorAll('.option').forEach(btn=>btn.addEventListener('click',()=>{
   if(state.answerLocked)return;
   state.selectedAnswer=Number(btn.dataset.answer);
   persistStudentSession();
   document.querySelectorAll('.option').forEach(x=>x.classList.toggle('selected',x===btn));
   document.getElementById('saveNext').disabled=false;
  }));
  return;
 }
 document.querySelectorAll('.match-left').forEach(btn=>btn.addEventListener('click',()=>{
   if(state.answerLocked)return;
   const idx=Number(btn.dataset.left);
   state.matchState.links=state.matchState.links.filter(l=>l.left!==idx);
   state.matchState.activeLeft=idx;
   document.querySelectorAll('.match-left').forEach(b=>b.classList.toggle('active',b===btn));
   updateMatchUI();
   persistStudentSession();
 }));
 document.querySelectorAll('.match-right').forEach(btn=>btn.addEventListener('click',()=>{
   if(state.answerLocked || state.matchState.activeLeft===null)return;
   const right=Number(btn.dataset.right);
   state.matchState.links=state.matchState.links.filter(l=>l.left!==state.matchState.activeLeft && l.right!==right);
   state.matchState.links.push({left:state.matchState.activeLeft,right});
   state.matchState.activeLeft=null;
   document.querySelectorAll('.match-left').forEach(b=>b.classList.remove('active'));
   updateMatchUI();
   persistStudentSession();
 }));
 window.addEventListener('resize',redrawMatchLines,{once:true});
}

function updateMatchUI() {
  document.querySelectorAll(".match-left").forEach(btn => {
    btn.classList.toggle("matched", state.matchState.links.some(l => l.left === Number(btn.dataset.left)));
  });
  document.querySelectorAll(".match-right").forEach(btn => {
    btn.classList.toggle("matched", state.matchState.links.some(l => l.right === Number(btn.dataset.right)));
  });
  const submit = document.getElementById("saveNext");
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
  const tick = () => {
    state.timeLeft = Math.max(0, (state.questionDeadline - Date.now()) / 1000);
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
  };
  tick();
  if (!state.answerLocked) state.timerId = setInterval(tick, 100);
}
function clearTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// Suara ceria bawaan tanpa pengaturan pada halaman awal.
// Menggunakan Web Audio API, sehingga tidak memerlukan berkas audio tambahan.
let soundContext = null;
function playNotes(frequencies, delay, duration, gainAmount) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!soundContext) soundContext = new AudioContextClass();
    const ctx = soundContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const start = ctx.currentTime + .008;
    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + index * delay;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(gainAmount, at + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + duration + .02);
    });
  } catch (_) { /* Jika audio tidak didukung, asesmen tetap berjalan. */ }
}
function playSaveSound() {
  // Nada ceria singkat untuk jawaban tersimpan.
  playNotes([523.25, 659.25, 783.99], .095, .15, .055);
}
function playResultSound(score) {
  // Jingle akhir berbeda untuk hasil tinggi dan hasil yang perlu ditingkatkan.
  if (score >= 60) {
    playNotes([523.25, 659.25, 783.99, 1046.5], .16, .29, .065);
  } else {
    playNotes([523.25, 659.25, 783.99], .19, .27, .05);
  }
}

async function submitAnswer(answer, q, timedOut = false) {
  if (state.answerLocked) return;
  state.answerLocked = true;
  if (!timedOut) playSaveSound();
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
    correct = answer !== null && q.options[answer] === q.answerText ? 1 : 0;
    if (answer !== null) {
      document.querySelectorAll(".option").forEach(btn => {
        const i = Number(btn.dataset.answer);
        // Umpan balik benar/salah tidak ditampilkan saat asesmen.
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
    response: q.type === "match" ? (Array.isArray(answer) ? answer.map(l=>`${state.matchState.left[l.left].label}  ->  ${state.matchState.right[l.right].label}`).join("; ") : "") : (answer === null ? "" : q.options[answer]),
    questionText: q.text,
    answerKey: q.type === "match" ? q.pairs.map(p=>p.join("  ->  ")).join("; ") : q.answerText,
  });
  state.theta = estimateTheta(state.responses);
  state.phase = "advancing";
  persistStudentSession();
  sendProgress("in_progress");

  showToast(timedOut ? " Waktu habis. Beralih ke soal berikutnya." : " Jawaban tersimpan");

  setTimeout(advanceAfterAnswer, timedOut ? 450 : 650);
}

function advanceAfterAnswer() {
  state.questionIndex += 1;
  state.questionDeadline = null;
  if (state.questionIndex >= CONFIG.QUESTIONS_PER_LEVEL[state.level]) completeLevel();
  else renderAssessment();
}
function completeLevel(){
 clearTimer();
 if(state.level>=3)return finishAssessment();
 state.phase = "transition";
 state.questionDeadline = null;
 persistStudentSession();
 const next=state.level+1;
 app.innerHTML=`<section class="card level-transition"><div class="level-orb"></div><span class="badge">Level ${state.level} selesai</span><h2>Siap memasuki Level ${next}?</h2><p class="lead">Di level ini kamu akan mengerjakan <strong>${CONFIG.QUESTIONS_PER_LEVEL[next]} soal</strong>. Setiap soal memiliki waktu 40 detik.</p><button id="continueLevel" class="btn btn-primary" type="button">Lanjutkan ke Level ${next}  -> </button></section>`;
 document.getElementById('continueLevel').addEventListener('click',()=>{
  state.level=next;state.questionIndex=0;
  state.currentQuestions=selectQuestions(next);
  state.selectedByLevel[next]=state.currentQuestions.map(q=>q.id);
  state.questionDeadline=null;
  renderAssessment();
 });
}

async function finishAssessment() {
  clearTimer();
  state.finishedAt = state.finishedAt || Date.now();
  state.phase = "result_ready";
  state.theta = estimateTheta(state.responses);
  const score = thetaToScore(state.theta);
  persistStudentSession();
  renderCompletionDialog();
  sendProgress("finished", score);
}

function renderCompletionDialog() {
  clearTimer();
  teacherEntryBtn.classList.add("hidden");
  app.innerHTML = `<section class="card completion-card" role="dialog" aria-modal="true" aria-labelledby="completionTitle">
    <div class="completion-symbol" aria-hidden="true">&#10003;</div>
    <span class="badge">30 soal selesai</span>
    <h1 id="completionTitle">Anda telah menyelesaikan asesmen</h1>
    <p>Seluruh jawabanmu sudah tersimpan. Tekan tombol di bawah untuk melihat hasil belajarmu.</p>
    <button id="viewResultBtn" class="btn btn-primary btn-wide" type="button">Lihat Hasil</button>
  </section>`;
  document.getElementById("viewResultBtn").addEventListener("click", () => {
    if (state.phase !== "result_ready") return;
    state.phase = "finished";
    persistStudentSession();
    const score = thetaToScore(state.theta);
    renderResult(score);
    playResultSound(score);
  });
}

function animateScore(score) {
  const ring = document.querySelector(".score-ring");
  const value = document.querySelector(".score-value");
  if (!ring || !value) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    ring.style.setProperty("--score", score);
    value.textContent = score;
    return;
  }
  const beganAt = performance.now();
  const duration = 1250;
  const draw = (now) => {
    if (!ring.isConnected || !value.isConnected) return;
    const t = Math.min(1, (now - beganAt) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(score * eased);
    ring.style.setProperty("--score", String(current));
    value.textContent = current;
    if (t < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

function renderResult(score) {
  teacherEntryBtn.classList.remove("hidden");
  const totalCorrect = state.responses.reduce((s,r) => s + r.correct, 0);
  const duration = Math.round((state.finishedAt - state.startedAt)/1000);
  app.innerHTML = `<section class="result-grid">
    <div class="card score-card">
      <span class="badge">Asesmen selesai </span>
      <div class="score-ring" style="--score:0" role="img" aria-label="Skor akhir ${score} dari 100"><div class="score-value">0</div></div>
      <h2 style="margin:0">${escapeHtml(state.student.name)}</h2>
      <p style="color:var(--muted);margin:5px 0 0">${escapeHtml(state.student.className)}</p>
      <div class="stat-list">
        <div class="stat"><span>Benar</span><strong>${totalCorrect}/30</strong></div>
        <div class="stat"><span>Waktu</span><strong>${formatTime(duration)}</strong></div>
        <div class="stat"><span>Skala</span><strong>0-100</strong></div>
      </div>
    </div>
    <div class="card panel">
      <h2 style="margin-top:0">${score>=80?"Selamat! Hasilmu sangat baik ":score>=60?"Terus tingkatkan kemampuanmu! ":"Yuk, pelajari lagi materinya "}</h2>
      <p class="lead" style="font-size:1rem">${score>=80?"Hebat! Kamu telah memahami sistem komputer dengan baik. Pertahankan semangat belajarmu!":score>=60?"Usahamu sudah terlihat. Ayo ulangi materi yang belum dikuasai dan terus berlatih!":"Tetap semangat! Pelajari kembali perangkat komputer dan cara kerjanya, lalu coba lagi dengan percaya diri."}</p>
      ${[1,2,3].map(l => {
        const rs = state.responses.filter(r => r.level === l);
        const correct = rs.reduce((s,r)=>s+r.correct,0);
        return `<div class="metric" style="margin-bottom:10px"><span>Level ${l}</span><strong>${correct}/${CONFIG.QUESTIONS_PER_LEVEL[l]} benar</strong></div>`;
      }).join("")}
      <button id="restartBtn" class="btn btn-primary btn-wide" type="button" style="margin-top:8px">Kembali ke Halaman Awal</button>
    </div>
  </section>`;
  animateScore(score);
  document.getElementById("restartBtn").addEventListener("click", () => {
    clearTimer();
    clearStudentSession();
    state.phase = "home";
    state.answerLocked = false;
    state.student = null;
    state.sessionId = null;
    state.responses = [];
    state.selectedByLevel = {};
    if (!restoreStudentSession()) renderHome();
  });
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
    questionNumber: Math.min(30, state.responses.length + (status === "finished" ? 0 : 1)),
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
    <span class="badge"> Area Guru</span>
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
    state.teacherClassFilter = "ALL";
    state.teacherNameFilter = "";
    state.teacherScoreFilter = "ALL";
    renderTeacherDashboard(result.rows || []);
    startTeacherPolling();
  });
}

function renderTeacherDashboard(rows) {
  state.dashboardRows = rows;
  const selectedClass = state.teacherClassFilter;
  const nameTerm = state.teacherNameFilter.trim().toLocaleLowerCase('id-ID');
  const scoreRange = state.teacherScoreFilter;
  const classRows = rows.filter(r => {
    if (selectedClass !== "ALL" && String(r.className) !== selectedClass) return false;
    if (nameTerm && !String(r.name || "").toLocaleLowerCase('id-ID').includes(nameTerm)) return false;
    const score = Number(r.score);
    if (scoreRange !== "ALL") {
      if (!Number.isFinite(score)) return false;
      if (scoreRange === "0-59" && !(score >= 0 && score < 60)) return false;
      if (scoreRange === "60-79" && !(score >= 60 && score < 80)) return false;
      if (scoreRange === "80-100" && !(score >= 80 && score <= 100)) return false;
    }
    return true;
  });
  const normalized = [...classRows].sort((a,b) => {
    const direction = state.teacherSortDirection === "asc" ? 1 : -1;
    if (state.teacherSortColumn === "name") {
      const diff = String(a.name || "").localeCompare(String(b.name || ""), "id-ID", { sensitivity: "base", numeric: true });
      return diff * direction || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    }
    if (state.teacherSortColumn === "score") {
      const diff = Number(a.score || 0) - Number(b.score || 0);
      return diff * direction || String(a.name || "").localeCompare(String(b.name || ""), "id-ID", { sensitivity: "base" });
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
  const sortIcon = key => state.teacherSortColumn === key ? (state.teacherSortDirection === "asc" ? "▲" : "▼") : "↕";
  const sortAria = key => state.teacherSortColumn === key ? (state.teacherSortDirection === "asc" ? "ascending" : "descending") : "none";
  const finished = normalized.filter(r => r.status === "finished" || r.status === "auto_finished");
  const live = normalized.filter(r => r.status === "in_progress");
  const avg = finished.length ? Math.round(finished.reduce((s,r)=>s+Number(r.score||0),0)/finished.length) : 0;
  app.innerHTML = `<section class="card panel">
    <div class="toolbar">
      <div>
        <span class="badge"> Live Dashboard</span>
        <h2 style="margin:10px 0 0">Pemantauan Hasil Siswa</h2>
      </div>
      <div class="toolbar-actions">
        <button id="refreshDash" class="btn btn-secondary btn-small" type="button"> Refresh</button>
        <button id="exportExcel" class="btn btn-primary btn-small" type="button"> Excel + Analisis Butir</button>
        <button id="exitTeacher" class="btn btn-ghost btn-small" type="button">Keluar</button>
      </div>
    </div>
    <div class="teacher-filter" style="margin:14px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label for="teacherClassFilter" style="font-weight:800">Filter kelas</label>
      <select id="teacherClassFilter" class="select" style="width:auto;min-width:170px">
        <option value="ALL" ${selectedClass==="ALL"?"selected":""}>Semua Kelas</option>
        ${["A","B","C","D","E","F","G"].map(c=>`<option value="VII ${c}" ${selectedClass===`VII ${c}`?"selected":""}>VII ${c}</option>`).join("")}
      </select>
      <div class="teacher-filter-field">
        <label for="teacherNameFilter">Cari nama siswa</label>
        <input id="teacherNameFilter" class="input" type="search" autocomplete="off" placeholder="Ketik nama siswa..." value="${escapeHtml(state.teacherNameFilter)}" />
      </div>
      <div class="teacher-filter-field">
        <label for="teacherScoreFilter">Rentang skor</label>
        <select id="teacherScoreFilter" class="select">
          <option value="ALL" ${scoreRange === "ALL" ? "selected" : ""}>Semua Skor</option>
          <option value="0-59" ${scoreRange === "0-59" ? "selected" : ""}>0 - 59 (Perlu belajar lagi)</option>
          <option value="60-79" ${scoreRange === "60-79" ? "selected" : ""}>60 - 79 (Cukup)</option>
          <option value="80-100" ${scoreRange === "80-100" ? "selected" : ""}>80 - 100 (Baik)</option>
        </select>
      </div>
      <button id="clearTeacherFilters" class="btn btn-ghost btn-small" type="button">Reset Filter</button>
      <span class="teacher-filter-info">Menampilkan ${normalized.length} dari ${rows.length} sesi. Ringkasan dan ekspor Excel mengikuti filter.</span>
    </div>
    <div class="teacher-grid">
      <div class="metric"><span>Sedang mengerjakan</span><strong>${live.length}</strong></div>
      <div class="metric"><span>Selesai</span><strong>${finished.length}</strong></div>
      <div class="metric"><span>Rata-rata skor</span><strong>${avg}</strong></div>
      <div class="metric"><span>Total sesi</span><strong>${normalized.length}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th aria-sort="${sortAria("name")}"><button class="table-sort" type="button" data-sort="name" aria-label="Urutkan nama siswa">Nama <span aria-hidden="true">${sortIcon("name")}</span></button></th><th>Kelas</th><th>Status</th><th>Progress</th><th>Benar</th><th>IRT theta</th><th aria-sort="${sortAria("score")}"><button class="table-sort" type="button" data-sort="score" aria-label="Urutkan skor siswa">Skor <span aria-hidden="true">${sortIcon("score")}</span></button></th><th>Waktu</th><th>Update</th></tr></thead>
        <tbody>
          ${normalized.length ? normalized.map(r => `<tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.className)}</td>
            <td><span class="status ${r.status === "finished" || r.status === "auto_finished" ? "done" : "live"}">${r.status === "auto_finished" ? "Selesai otomatis" : r.status === "finished" ? "Selesai" : "Live"}</span></td>
            <td>${Number(r.answered||0)}/30</td>
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
  document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
    const column = button.dataset.sort;
    if (state.teacherSortColumn === column) {
      state.teacherSortDirection = state.teacherSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.teacherSortColumn = column;
      state.teacherSortDirection = column === "name" ? "asc" : "desc";
    }
    renderTeacherDashboard(state.dashboardRows);
  }));
  document.getElementById("teacherClassFilter").addEventListener("change", e => { state.teacherClassFilter=e.target.value; renderTeacherDashboard(state.dashboardRows); });
  document.getElementById("teacherNameFilter").addEventListener("input", e => {
    const target = e.target;
    const cursor = target.selectionStart;
    state.teacherNameFilter = target.value;
    renderTeacherDashboard(state.dashboardRows);
    const next = document.getElementById("teacherNameFilter");
    next.focus();
    try { next.setSelectionRange(cursor, cursor); } catch (_) {}
  });
  document.getElementById("teacherScoreFilter").addEventListener("change", e => { state.teacherScoreFilter = e.target.value; renderTeacherDashboard(state.dashboardRows); });
  document.getElementById("clearTeacherFilters").addEventListener("click", () => {
    state.teacherClassFilter = "ALL"; state.teacherNameFilter = ""; state.teacherScoreFilter = "ALL";
    renderTeacherDashboard(state.dashboardRows);
  });
  document.getElementById("refreshDash").addEventListener("click", refreshTeacherDashboard);
  document.getElementById("exportExcel").addEventListener("click", () => exportExcel(normalized));
  document.getElementById("exitTeacher").addEventListener("click", () => { state.teacherClassFilter = "ALL"; state.teacherNameFilter = ""; state.teacherScoreFilter = "ALL"; state.teacherKey = null; stopTeacherPolling(); renderHome(); });
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
  if (result.ok && state.teacherKey) {
    const nameInputFocused = document.activeElement?.id === "teacherNameFilter";
    const cursor = nameInputFocused ? document.activeElement.selectionStart : null;
    renderTeacherDashboard(result.rows || []);
    if (nameInputFocused) {
      const input = document.getElementById("teacherNameFilter");
      input?.focus();
      try { if (cursor != null) input?.setSelectionRange(cursor, cursor); } catch (_) {}
    }
  }
}
function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("id-ID", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(d);
}
function exportExcel(rows){
 if(!window.XLSX){showToast('Excel belum tersedia. Pastikan koneksi internet saat membuka dashboard.');return;}
 const wb=XLSX.utils.book_new();
 const safe=(x)=>typeof x==='string' && /^[=+@\-]/.test(x) ? "'"+x : x;
 const summary=rows.map(r=>({'Nama':safe(r.name),'Kelas':safe(r.className),'Status':r.status,'Soal Dijawab':Number(r.answered||0),'Benar':Number(r.correct||0),'IRT Theta':Number(r.theta||0),'Skor 0-100':Number(r.score||0),'Waktu (mm:ss)':formatTime(Number(r.elapsedSeconds||0)),'Waktu (detik)':Number(r.elapsedSeconds||0),'Mulai':r.startedAt,'Selesai':r.finishedAt}));
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary.length?summary:[{'Nama':'Belum ada data'}]),'Rekap Peserta');
 const details=[], byItem=new Map();
 rows.forEach(r=>{
  let answers=[];try{answers=JSON.parse(r.responsesJson||'[]')}catch(e){}
  answers.forEach(a=>{
   const key=a.questionId;
   if(!byItem.has(key))byItem.set(key,{level:a.level,text:a.questionText||QUESTION_BANK[a.level]?.find(q=>q.id===key)?.text||'',b:a.b,values:[]});
   byItem.get(key).values.push({correct:Number(a.correct),score:Number(r.score||0)});
   details.push({'Nama':safe(r.name),'Kelas':safe(r.className),'ID Soal':key,'Level':a.level,'Pertanyaan':safe(a.questionText),'Jenis':a.type,'Jawaban Siswa':safe(a.response),'Kunci Jawaban':safe(a.answerKey),'Benar (1/0)':a.correct,'Waktu Jawab (detik)':a.responseTime,'Timeout':a.timedOut?'Ya':'Tidak','Kesulitan Desain b':a.b});
  });
 });
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(details.length?details:[{'ID Soal':'Belum ada jawaban'}]),'Detail Jawaban');
 const itemRows=[];
 for(const [id,x] of byItem){
  const n=x.values.length,p=x.values.reduce((a,b)=>a+b.correct,0)/n;
  const sorted=[...x.values].sort((a,b)=>b.score-a.score);
  const group=Math.max(1,Math.floor(n*.27));
  const upper=sorted.slice(0,group),lower=sorted.slice(-group);
  const discr=upper.reduce((a,b)=>a+b.correct,0)/upper.length-lower.reduce((a,b)=>a+b.correct,0)/lower.length;
  itemRows.push({'ID Soal':id,'Level':x.level,'Pertanyaan':safe(x.text),'Jumlah Respons':n,'Jumlah Benar':x.values.reduce((a,b)=>a+b.correct,0),'Proporsi Benar (p)':Number(p.toFixed(3)),'Daya Pembeda 27%':n>=8?Number(discr.toFixed(3)):'Data belum cukup','Parameter b Awal':x.b,'Catatan':n<8?'Interpretasi terbatas: respons kurang dari 8':'Analisis deskriptif; perlu kalibrasi untuk IRT formal'});
 }
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(itemRows.length?itemRows:[{'ID Soal':'Belum ada respons'}]),'Analisis Butir');
 XLSX.writeFile(wb,`asesmen-komputer-analisis-${new Date().toISOString().slice(0,10)}.xlsx`);
}

if (!restoreStudentSession()) renderHome();
