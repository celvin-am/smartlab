# Sistem Peminjaman Sparepart Laboratorium (Skeleton Project)

Repositori ini berisi kode dasar (skeleton) untuk tugas akhir: sistem peminjaman sparepart di gudang kampus.

Isi:
- `docs/` : desain sistem dan daftar komponen
- `firmware/` : contoh sketsa Arduino/ESP32 untuk Box1, Box2 (ESP32-CAM) dan Door controller
- `server/recognition/` : Flask server sederhana untuk menerima gambar dari ESP32-CAM, mengenali part (template matching/ORB), dan menulis transaksi ke Firebase
- `web/` : web monitor sederhana yang mengambil data dari Firebase Realtime Database

Tujuan:
- Berikan pondasi kerja yang bisa Anda kembangkan
- Gunakan Firebase Realtime Database untuk menyimpan data peminjaman
- ESP32/ESP32-CAM mengirim event ke server, server menyinkronkan ke Firebase

Langkah cepat (overview):
1. Siapkan Firebase project dan download `serviceAccountKey.json` (untuk server)
2. Isi konfigurasi Firebase di `web/firebase-config.js` dan `server/recognition/app.py`
3. Install dependency server: lihat `server/recognition/requirements.txt`
4. Jalankan server recognition lalu upload model template images ke `server/recognition/models/`
5. Flash firmware ESP32 sesuai pin yang Anda pilih

Catatan: ini adalah implementasi dasar dan banyak bagian perlu penyesuaian (pin wiring, endpoint security, autentikasi). Lihat `docs/` untuk rekomendasi komponen dan desain sistem.
"# lab-access-system" 
