Server Recognition

1. Install dependencies (disarankan di virtualenv):
   pip install -r requirements.txt

2. Letakkan `serviceAccountKey.json` di folder ini dan set `FIREBASE_DB_URL` di `app.py`.

3. Siapkan folder `models/` berisi template images (.jpg) bernama <part_id>.jpg (misal: resistor_1.jpg)

4. Jalankan:
   python app.py

Endpoints:
- POST /api/rfid_event  -> JSON {box, action, uid}
- POST /api/recognize   -> multipart form-data field 'image' (jpeg)

Catatan: Ini prototype sederhana. Untuk produksi, tambahkan autentikasi, rate limiting, validasi data, dan gunakan model ML jika perlu.
