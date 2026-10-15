# Asesmen Sistem Komputer Kelas VII MTs

Single Page Application (HTML5, CSS, JavaScript) untuk asesmen Sistem Komputer. Frontend dapat dipasang di GitHub Pages. Data hasil disimpan ke Google Sheets melalui Google Apps Script Web App.

## Fitur utama

- 3 level, masing-masing 5 soal per percobaan.
- 45 bank soal: 15 butir untuk setiap level.
- Tipe soal: pilihan ganda, benar/salah, dan matching tap-to-match dengan garis animasi.
- Soal dipilih acak dan adaptif berdasarkan performa level sebelumnya.
- Timer 40 detik per soal. Waktu habis akan otomatis berpindah ke soal berikutnya.
- Opsi jawaban 2 x 2.
- Skor akhir skala 0-100 menggunakan estimasi kemampuan IRT/Rasch 1PL sederhana.
- Nama peserta dan pilihan kelas VII A sampai VII G.
- Dashboard guru dengan polling berkala untuk melihat progres siswa yang sedang mengerjakan.
- Ekspor hasil ke `.xlsx` memakai SheetJS, dengan fallback CSV.
- Responsive untuk HP, tablet, dan PC.

## Struktur file

- `index.html` - shell SPA.
- `styles.css` - desain responsif dan animasi.
- `app.js` - bank soal, adaptive testing, IRT, timer, dashboard, ekspor Excel.
- `Code.gs` - backend Google Apps Script.

## 1. Menyiapkan Google Sheet

1. Buat Google Sheet baru, misalnya `Hasil Asesmen Sistem Komputer`.
2. Salin ID spreadsheet dari URL:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Tidak perlu membuat header manual. Script akan membuat sheet `Results` saat pertama kali digunakan.

## 2. Menyiapkan Google Apps Script

1. Buka `script.google.com` dan buat project baru.
2. Tempel isi `Code.gs` ke editor Apps Script.
3. Buka **Project Settings > Script Properties**.
4. Tambahkan:
   - `SPREADSHEET_ID` = ID Google Sheet.
   - `TEACHER_KEY` = password/kunci dashboard guru yang kuat.
5. Klik **Deploy > New deployment > Web app**.
6. Execute as: **Me**.
7. Who has access: **Anyone**.
8. Deploy lalu salin URL Web App yang berakhiran `/exec`.

## 3. Menghubungkan frontend ke Apps Script

Buka `app.js`, lalu ganti:

```js
GAS_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"
```

dengan URL Web App `/exec` dari Apps Script.

## 4. Deploy ke GitHub Pages

1. Buat repository GitHub baru.
2. Upload `index.html`, `styles.css`, dan `app.js` ke root repository.
3. Masuk ke **Settings > Pages**.
4. Source: **Deploy from a branch**.
5. Branch: `main`, folder `/root`.
6. Simpan dan buka URL GitHub Pages yang diberikan.

`Code.gs` tidak perlu disimpan di GitHub publik apabila Anda tidak ingin membagikan implementasi backend. Jangan pernah menaruh `TEACHER_KEY` di `app.js`.

## Cara adaptif bekerja

Setiap soal mempunyai parameter kesulitan `b`. Setelah siswa menjawab, aplikasi menghitung estimasi kemampuan `theta` dengan model Rasch 1PL. Untuk level berikutnya, aplikasi memilih 5 butir yang parameter kesulitannya paling dekat dengan target baru.

- Akurasi level sebelumnya >= 80%: target kesulitan dinaikkan.
- Akurasi <= 40%: target diturunkan.
- Nilai di antaranya: target dinaikkan sedikit.

Semua siswa tetap mengerjakan Level 1, 2, dan 3, tetapi komposisi soal pada Level 2 dan 3 dapat berbeda sesuai performa.

## Catatan keamanan

Dashboard menggunakan `TEACHER_KEY` yang diverifikasi di Google Apps Script. Ini cukup untuk asesmen kelas sederhana, tetapi bukan pengganti autentikasi sekolah yang sebenarnya. Untuk data yang lebih sensitif, sebaiknya gunakan autentikasi Google Workspace, Firebase Authentication, atau backend dengan sistem akun guru.

## Pengembangan lanjutan yang disarankan

- Tambahkan identitas madrasah/logo di halaman awal.
- Tambahkan filter dashboard berdasarkan kelas dan tanggal.
- Tambahkan analisis butir soal: tingkat kesulitan empiris, persentase benar, dan rata-rata waktu per butir.
- Tambahkan sesi/ujian dengan kode asesmen agar guru dapat membuka dan menutup asesmen.
- Tambahkan Google Workspace authentication apabila dipakai pada skala sekolah.
