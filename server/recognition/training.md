Training images (simple workflow)

Untuk proof-of-concept ORB matching, siapkan 15 sample images per part dengan variasi sudut/pencahayaan jika memungkinkan.

Direktori: `server/recognition/models/`
- Nama file gunakan `partid.jpg` atau `partid_1.jpg`, namun app menganggap nama file sebelum ekstensi sebagai `part_id`.

Contoh struktur:
- models/resistor_1.jpg
- models/resistor_2.jpg
- models/capacitor_1.jpg
- ...

Rekomendasi:
1. Ambil gambar di latar polos (flat background) agar fitur fokus pada part.
2. Crop tight ke benda. ORB sensitif terhadap rotasi/scale — ambil beberapa sudut.
3. Jika ORB hasilnya jelek, pertimbangkan model ML: ambil 50-200 contoh per kelas dan latih classifier (MobileNet + fine-tune) atau gunakan detektor YOLO jika perlu bounding box.

Cara menambah template:
- Simpan file di `server/recognition/models/`
- Restart `app.py` agar template dimuat ulang.

Notes:
- ORB/feature matching cocok untuk barang dengan tekstur/fitur unik. Untuk barang kecil/minimal tekstur, ORB sulit.
- Untuk produksi di edge, pertimbangkan TFLite model yang dijalankan di Raspberry Pi atau di ESP jika model ringan.
