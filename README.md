# Asesmen Interaktif Sistem Komputer Kelas VII MTs

SPA HTML5/CSS/JS untuk GitHub Pages, backend Google Apps Script dan Google Sheets. Berdasarkan LKPD Pertemuan 1–3: hardware, software, brainware; perangkat input, process, output, storage; serta alur kerja komputer.

## Isi
- **Level 1:** 15 soal dari bank 45.
- **Level 2:** 10 soal dari bank 30.
- **Level 3:** 5 soal dari bank 15.
- Total: **30 soal**, 90 bank soal. Butir dan urutan jawaban diacak per sesi. Karena pengambilan acak, dua sesi *dapat* kebetulan memperoleh sebagian soal yang sama, tidak ada jaminan semua soal unik lintas percobaan.
- Pilihan ganda (4 opsi, grid 2×2), benar/salah (2 opsi), matching tap ke pasangan disertai garis SVG animasi.
- 40 detik per soal, otomatis timeout dan pindah ke soal selanjutnya. Jawaban baru tersimpan saat tombol **Simpan dan Lanjut** ditekan.
- Setelah menyelesaikan level, dialog perpindahan berisi jumlah soal berikutnya. Hasil 0–100, benar/30, waktu mm:ss, rekomendasi belajar.
- Rasch/IRT 1PL **ilustratif** dengan b ditetapkan perancang, bukan parameter terkalibrasi. Nilai akhir transformasi theta, bukan persentase benar.
- Dashboard guru: skor, waktu, progres dengan polling tiap 8 detik, Excel 3 sheet (`Rekap Peserta`, `Detail Jawaban`, `Analisis Butir`). Proporsi benar dan daya pembeda 27% hanyalah statistik deskriptif, terutama kurang stabil pada sedikit respons.

## Setup GitHub Pages
1. Buat repository baru lalu upload **index.html**, **styles.css**, **app.js** ke root repository.
2. Di Settings → Pages → Build and deployment: Deploy from a branch, pilih `main` dan `/ (root)`.
3. Buka URL GitHub Pages Anda (biasanya `https://USERNAME.github.io/NAMA-REPOSITORY/`).

## Setup Google Sheets + Apps Script
1. Buat Google Spreadsheet untuk menyimpan nilai. Salin ID dari URL `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
2. Buka `Extensions → Apps Script` dari spreadsheet. Tempel isi `Code.gs`.
3. Di **Project Settings → Script properties**, buat: `SPREADSHEET_ID` = ID spreadsheet, `TEACHER_KEY` = password kuat yang hanya diketahui guru.
4. `Deploy → New deployment → Web app`: Execute as **Me**, Who has access **Anyone** (agar GitHub Pages dan HP siswa dapat mengirim data). Otorisasi dengan akun pemilik.
5. Salin URL berakhiran `/exec`, isi `CONFIG.GAS_URL` dalam `app.js`, lalu unggah file tersebut kembali ke GitHub.
6. Uji di dua perangkat: peserta mengerjakan, guru masuk dashboard dengan TEACHER_KEY, cek data Google Sheet serta file `.xlsx`.
7. Setiap pembaruan Code.gs perlu deployment versi baru melalui **Manage deployments** agar URL `/exec` memakai kode terbaru.

## Hal yang perlu diperhatikan
- Apps Script Web App dengan akses **Anyone** dapat menerima POST dari publik, termasuk data palsu. **Jangan** gunakan tanpa penguatan autentikasi, pembatasan akses, dan anti-abuse untuk ujian formal atau data sensitif. Kunci guru tidak disimpan dalam frontend, tetapi password bersama saja belum cukup untuk sistem high-stakes.
- Dashboard memakai polling, bukan real-time socket. Skor sedang berjalan adalah **estimasi sementara**, dan waktu live sesuai data update terakhir, bukan stopwatch server kontinu.
- Pengukuran waktu dan pemeriksaan jawaban dilakukan di browser; dapat dimanipulasi pengguna berpengetahuan teknis. Untuk ujian resmi, diperlukan pemeriksaan jawaban dan timer di backend serta login siswa.
- `xlsx.full.min.js` dimuat dari CDN, sehingga ekspor membutuhkan akses internet bila pustaka belum tersedia dalam cache.
- Google Sheets memiliki batas skala/kuota Apps Script. Untuk jumlah pengguna besar, gunakan backend yang dirancang untuk konkurensi.
- Halaman pengerjaan soal tidak menampilkan ilustrasi perangkat maupun ikon soal. Gambar LKPD hanya menjadi rujukan materi untuk bank soal.
