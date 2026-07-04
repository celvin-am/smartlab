Testing server & full flow

1) Install dependencies
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt

2) Configure Firebase admin
   - Letakkan `serviceAccountKey.json` di folder server/recognition/
   - Edit `app.py` dan set `FIREBASE_DB_URL` sesuai database Realtime Database Anda
   - Edit `DOOR_CONTROLLER_URL` dengan alamat controller pintu Anda (misal 'http://192.168.1.50')

3) Tambah sample templates
   - Taruh beberapa gambar di `models/`

4) Jalankan server
   python app.py

5) Simulasi borrow flow
   - Start borrow (Box1):
     curl -X POST http://localhost:5000/api/rfid_event -H "Content-Type: application/json" -d "{\"box\":\"box1\",\"action\":\"borrow_start\",\"uid\":\"UID123\"}"
     -> respon akan mengandung session_key

   - Tambah part ke session (contoh):
     curl -X POST http://localhost:5000/api/session/add_part -H "Content-Type: application/json" -d "{\"session_key\":\"<SESSION_KEY>\",\"part_id\":\"resistor_1\",\"qty\":1}"

   - Finalize borrow (buka pintu):
     curl -X POST http://localhost:5000/api/session/finalize_borrow -H "Content-Type: application/json" -d "{\"session_key\":\"<SESSION_KEY>\",\"name\":\"Nama\",\"nim\":\"12345\"}"

6) Simulasi return flow
   - From Box1: POST rfid_event with action 'return_start' to get loans list
   - In Box2: scan and then call /api/session/finalize_return with loan_key

7) Verify
   - Check Firebase Realtime Database -> /sessions and /loans
   - Open web/index.html to see real-time loans table (ensure web/firebase-config.js has correct config)

Notes & limitations
- This testing flow uses simple HTTP requests. In real device flow, ESP32 firmware will call the endpoints.
- Finalize return currently marks loan returned on call; for production, match returned parts against recorded parts.
- Door controller must implement /open endpoint that returns HTTP 200 for success.
