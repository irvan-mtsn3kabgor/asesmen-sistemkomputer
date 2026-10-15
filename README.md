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
- Dashboard guru: filter kelas (A-G), pencarian nama (tanpa membedakan huruf besar-kecil), dan rentang skor (0–59, 60–79, 80–100); filter juga diterapkan pada metrik, ekspor Excel, dan analisis butir. Skor selama sesi masih merupakan skor sementara. Dashboard juga menampilkan skor, waktu, progres dengan polling tiap 8 detik, Excel 3 sheet (`Rekap Peserta`, `Detail Jawaban`, `Analisis Butir`). Proporsi benar dan daya pembeda 27% hanyalah statistik deskriptif, terutama kurang stabil pada sedikit respons.

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

### Efek suara tombol
Tombol **Simpan dan Lanjut** memutar bunyi konfirmasi singkat dua nada menggunakan Web Audio API, tanpa berkas audio tambahan. Bunyi tidak diputar ketika timer habis dan perpindahan berlangsung otomatis. Perangkat yang disenyapkan atau browser yang membatasi audio mungkin tidak mengeluarkan suara.


## Pengaturan efek suara (versi suara kustom)
Di halaman awal, siswa dapat memilih suara **Lembut**, **Ceria**, **Singkat**, atau **Tanpa suara**, menggeser volume dari 0 sampai 100%, dan menekan **Coba Efek Suara**. Pengaturan disimpan di localStorage browser perangkat tersebut dan diterapkan pada tombol **Simpan dan Lanjut**. Audio dibuat dengan Web Audio API tanpa file audio tambahan. Browser mungkin mensyaratkan interaksi pertama sebelum audio bisa berbunyi.


### Perbaikan karakter tampilan
- Simbol emoji pada label antarmuka diganti teks biasa untuk mencegah kotak/karakter rusak pada perangkat dengan font terbatas.
- HTML memakai UTF-8 dan aset CSS/JS memakai parameter versi agar browser mengambil pembaruan.
- Efek suara dan semua fungsi asesmen dipertahankan.
- Setelah unggah file ke GitHub Pages, lakukan refresh paksa browser jika masih melihat tampilan lama.


## Revisi suara ceria dan hasil akhir
- Panel pengaturan suara di halaman awal dihapus.
- Tombol Simpan dan Lanjut memutar suara ceria tiga nada.
- Saat hasil akhir muncul, jingle diputar otomatis (browser harus mengizinkan audio).
- Tombol Kembali ke Halaman Awal tersedia pada halaman hasil dan mereset sesi lokal untuk peserta berikutnya.


## Pembaruan filter dan penyelesaian otomatis
- Dashboard guru menyediakan filter Semua Kelas dan VII A sampai VII G. Data ringkasan dan Excel mengikuti pilihan filter.
- Saat membuka atau memperbarui dashboard, backend menutup sesi `in_progress` yang tidak mengirim pembaruan selama 3 menit atau berjalan melebihi 45 menit. Permintaan siswa yang datang setelah sesi ditutup tidak akan membuka kembali sesi tersebut.
- Status `Selesai otomatis` mempertahankan jawaban dan skor sementara terakhir yang tersimpan. Ini bukan hasil asesmen 30 soal yang lengkap, sehingga jangan disamakan dengan siswa yang menyelesaikan semua soal.
- Batas dapat disesuaikan melalui `INACTIVITY_MINUTES` dan `MAX_SESSION_MINUTES` di Code.gs.
- Wajib deploy ulang versi baru Code.gs pada Google Apps Script, tidak cukup mengganti berkas GitHub saja.


### Sort tabel guru
Klik judul **Nama** atau **Skor** untuk mengurutkan tabel. Klik kembali untuk membalik arah. Nama default A-Z dan skor default tertinggi ke terendah. Tanda panah menunjukkan arah. Sort digunakan setelah filter kelas, nama, dan rentang skor, serta urutan baris rekap Excel mengikuti tampilan.


## Pemulihan sesi saat refresh
- Sesi siswa aktif disimpan di localStorage browser yang sama. Reload membuka soal yang sama dengan opsi/jawaban sementara dan koneksi matching yang tersimpan.
- Timer menggunakan batas waktu absolut; refresh tidak menambah 40 detik. Jika waktu soal habis ketika halaman tidak aktif, jawaban dikirim sebagai timeout saat aplikasi aktif kembali.
- Setelah hasil akhir, tombol **Kembali ke Halaman Awal** menghapus cadangan sesi lokal sehingga siswa berikutnya dapat memulai asesmen baru.
- Untuk melanjutkan, gunakan browser, perangkat, dan domain yang sama; mode privat, penghapusan data situs, atau browser yang membatasi localStorage dapat menghapus kemajuan.
- Cadangan lokal tidak mengubah batas tidak aktif 3 menit dan maksimal sesi 45 menit pada backend. Jika sekolah ingin peserta dapat kembali setelah lebih dari 3 menit, sesuaikan pengaturan backend terlebih dahulu.
- Jangan gunakan reload sebagai pengganti tombol Simpan dan Lanjut, karena jawaban hanya masuk dalam perhitungan setelah disimpan atau waktu habis.


## Revisi halaman depan dan petunjuk
- Judul: ASESMEN MANDIRI MADRASAH, Mata Pelajaran Informatika, Materi Sistem Komputer.
- Tempat logo pada header: simpan gambar resmi Kemenag dengan nama `logo-kemenag.png` di folder yang sama dengan `index.html`. Jika belum ada, area logo menampilkan label `LOGO`.
- Kartu fitur halaman awal dihapus.
- Setelah memasukkan nama dan kelas, muncul petunjuk dalam dialog dan tombol lanjut dinonaktifkan selama 20 detik. Timer soal dan waktu pengerjaan baru dimulai saat siswa menekan tombol lanjut.
- Sesi yang sudah berjalan tetap memakai mekanisme pemulihan sesudah refresh.


## Alur penyelesaian asesmen (pembaruan)
Setelah siswa menyimpan jawaban soal ke-30, muncul dialog **Anda telah menyelesaikan asesmen** dengan tombol **Lihat Hasil**. Skor tidak terlihat sampai tombol ditekan. Setelah itu, grafis lingkaran skor beranimasi dari 0 menuju nilai akhir, disertai jingle hasil, waktu pengerjaan, rincian level, motivasi, dan tombol kembali ke awal. Refresh pada dialog akan memulihkan dialog tersebut. Penanda selesai dikirim ke backend saat semua jawaban telah selesai, tanpa menunggu tombol Lihat Hasil.

Perbarui `index.html`, `styles.css`, dan `app.js` di GitHub Pages. `Code.gs` tidak berubah.
