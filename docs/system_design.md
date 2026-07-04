# System Design - Peminjaman Sparepart

Ringkasan alur:
1. Pengguna di luar (Box1) menekan tombol "PINJAM" pada keypad, lalu tap KTM (RFID).
   - Box1 mengirim event `borrow_start` dengan UID KTM ke server.
   - Server membuat session peminjaman sementara (dengan timestamp) dan membuka pintu via controller door.

2. Pengguna masuk, pintu menutup otomatis.

3. Di dalam, di Box2 pengguna menekan tombol "SCAN" untuk mulai meminjam/return.
   - Untuk meminjam: pengguna menekan toggle "scan item", kamera (ESP32-CAM) meng-capture gambar part,
     dikirim ke server `/api/recognize`, server mengembalikan `part_id`.
   - User memasukkan jumlah melalui keypad dan menekan "done" untuk menyimpan item.
   - Setelah semua item discan dan "finish" dipencet, server menyimpan entry peminjaman (korelasi dengan KTM) ke Firebase
     dan membuka pintu keluar.
   - Jika belum scan dan coba finish, pintu tidak dibuka.

4. Untuk pengembalian: di luar Box1 pengguna pilih "RETURN" dan tap KTM -> server menandai intent return.
   - Di dalam Box2 tekan toggle "return" lalu scan semua part. Server mencocokkan dengan record peminjaman tanggal tertentu.
   - Setelah semua barang dicatat kembali, user tap KTM untuk keluar (door controller memverifikasi semua sudah return).

Komponen utama dan komunikasi:
- Box1 (ESP32): RFID reader + keypad + small LCD -> mengirim HTTP POST ke server saat event
- Box2 (ESP32-CAM + ESP32): Camera capture -> kirim image ke server; keypad untuk kontrol scan/jumlah/finish; LCD untuk feedback
- Door controller (ESP32/ESP8266 + relay driver): menerima command open/close dari server (HTTP/MQTT) atau local RFID untuk exit
- Server (PC/RaspberryPi/Cloud): Flask app menerima image, lakukan matching terhadap dataset (15 contoh) -> return class; kelola transaksi -> tulis ke Firebase Realtime DB
- Web monitor: client JS menghubungkan ke Firebase dan menampilkan tabel peminjaman secara real-time

Keamanan & catatan:
- Gunakan jaringan WiFi kampus; perhatikan keamanan (server harus berada di jaringan yang dapat diakses ESP32 atau gunakan VPN/MQTT broker)
- Auth: saat produksi, tambahkan autentikasi untuk mencegah spoofing RFID/events
- Batasan pengenalan: model sederhana (template/ORB) cocok untuk proof-of-concept; gunakan model ML (TFLite) jika butuh akurasi tinggi
