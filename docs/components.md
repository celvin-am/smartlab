# Rekomendasi Komponen (hemat biaya)

Catatan: harga indikatif — cari pemasok lokal atau toko online.

1. Box1 (luar):
- ESP32 DEVKIT (WiFi) - 1x (controller) ~ Rp 70.000 - 150.000
- MFRC522 RFID reader module (bekerja dengan 13.56MHz KTM jika kompatibel) - 1x ~ Rp 30.000 - 60.000
- Keypad 4x4 matrix - 1x ~ Rp 15.000 - 40.000
- 16x2 I2C LCD (atau OLED 0.96") - 1x ~ Rp 30.000
- Antenna (jika perlu eksternal) - tergantung reader

2. Box2 (dalam):
- ESP32-CAM (AI-Thinker) - 1x ~ Rp 70.000 - 150.000
- ESP32 DEVKIT / tambahan controller untuk keypad/LCD (jika ESP32-CAM tidak praktis untuk banyak IO)
- Keypad 4x4
- Layar TFT kecil (untuk menampilkan view kamera + bounding box) — alternatif: gunakan monitor via web/stream
- Buzzer kecil

3. Door lock box:
- Electromagnetic lock (12V) + power supply 12V
- Relay module (5V) atau MOSFET driver untuk mengendalikan lock
- ESP32/ESP8266 untuk menerima perintah open/close
- RFID reader untuk exit (opsional)

4. Server / Infrastructure:
- Raspberry Pi 4 (optional) atau PC/laptop untuk menjalankan Flask server
- Firebase project (Realtimedb atau Firestore) - gratis tier cukup untuk prototyping

5. Lain-lain:
- Kabel jumper, breadboard/PCB, enclosure
- Power supplies 5V untuk ESP32 dan 12V untuk lock

Catatan kompatibilitas RFID KTM:
- KTM kampus biasanya card ISO14443 (MIFARE). Periksa jenis card dan pastikan reader mendukungnya (MFRC522 biasanya mendukung MIFARE Classic).

Saran penghematan:
- Gunakan 1 ESP32-CAM sebagai Box2 dan gunakan display small (TFT) jika perlu.
- Jika ingin lebih stabil, gunakan Raspberry Pi Camera dan jalankan recognition lokal di Pi (lebih kuat untuk ML).
