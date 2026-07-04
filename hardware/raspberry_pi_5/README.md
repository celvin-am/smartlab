# Raspberry Pi 5 Hardware Controller

Folder ini disiapkan untuk Raspberry Pi 5 sebagai main controller pada proyek Smart Lab Access.

## Komponen yang dihubungkan

- Fingerprint AS608
  - VCC: 5V
  - GND: GND
  - TX: GPIO14
  - RX: GPIO15
- Buzzer
  - GND: GND
  - VCC: GPIO18
- Relay
  - GND: GND
  - VCC: 5V
  - IN1: GPIO22
- LCD with I2C
  - SDA: GPIO2
  - SCL: GPIO3
  - VCC: 5V
  - GND: GND

## Struktur folder

- `main.py` - program utama controller Raspberry Pi 5
- `config.py` - konfigurasi pin dan parameter sistem
- `devices.py` - wrapper perangkat: relay, buzzer, LCD
- `fingerprint_service.py` - layanan fingerprint AS608
- `website_bridge.py` - penghubung opsional ke website/backend
- `requirements.txt` - dependency Python

## Cara pakai di Raspberry Pi 5

### Alur register fingerprint dari website (Rekomendasi)

**Alur ini memungkinkan admin registrasi fingerprint langsung dari website tanpa perlu SSH manual.**

#### Flow Diagram:

```
Website (Email Settings)          Raspberry Pi (Server Mode)       Firestore
    |                                    |                             |
    | 1. Admin input data                |                             |
    | (Nama, NIM, Email)                 |                             |
    |                                    |                             |
    | 2. Admin click "Mulai Registrasi"  |                             |
    |------>  POST /api/fingerprint/register                           |
    |                                    |                             |
    |                                    | 3. Start enrollment         |
    |                                    | (tunggu jari ditempel)      |
    |                                    |                             |
    |                                    | 4. Jari ditempel & scan     |
    |                                    |                             |
    |                                    | 5. Update Firestore        |
    |                                    |----> fingerprintStatus: OK  |
    |                                    |     fingerprintId: xxxxx    |
    |                                    |                             |
    | <-----  Response (success)         |                             |
    |                                    |                             |
    | 6. Update display status            |                             |
    |    "Fingerprint terdaftar"          |                             |
    |    "Fingerprint ID: xxxxx"          |                             |
```

#### Step-by-step dari website:

**Step 1: Setup Raspberry Pi Server**

Di Raspberry Pi, jalankan:
```bash
cd ~/labaccess_controller
python main.py --mode server --port 5000 --service-account serviceAccountKey.json
```

Jika port 5000 sudah dipakai, ganti dengan port lain:
```bash
python main.py --mode server --port 5001 --service-account serviceAccountKey.json
```

Catat IP Raspberry Pi dan port (contoh: `10.85.28.30:5000` atau `10.85.28.30:5001`)

**Step 2: Update website untuk connect ke Raspberry Pi**

Di file React/Vue/JavaScript website, tambahkan config untuk Raspberry Pi endpoint:

```javascript
// config/rpiConfig.js atau sejenisnya
export const RPI_ENDPOINT = 'http://10.85.28.30:5000';  // Ganti dengan IP dan port Anda
```

**Step 3: Admin buka halaman "Email Setting"**

- Isi form: Nama, NIM, Program Studi, Email
- Klik tombol **"Mulai Registrasi"** atau **"Start Fingerprint"**

**Step 4: Website kirim request ke Raspberry Pi**

Website kirim HTTP POST ke endpoint Raspberry Pi:

```
POST http://10.85.28.30:5000/api/fingerprint/register
Content-Type: application/json

{
  "student_nim": "22507334002",
  "student_name": "Nabila",
  "student_email": "nabiladini.2022@student.uny.ac.id"
}
```

**Step 5: Raspberry Pi mulai proses enrollment**

- LCD akan menampilkan "Mode Register"
- Buzzer berbunyi (jika hardware terpasang)
- System siap untuk scan fingerprint

**Step 6: Admin/Siswa menempel jari ke sensor AS608**

- Tempel jari ke sensor 2-3 kali
- Tunggu hingga template tersimpan
- Buzzer akan berbunyi lagi (konfirmasi)

**Step 7: Status otomatis update di Firestore**

Raspberry Pi akan update Firestore collection `student_email_settings`:
```json
{
  "nim": "22507334002",
  "fingerprintStatus": "registered",
  "fingerprintId": "12345",
  "fingerprintMode": "register"
}
```

**Step 8: Website auto-update display**

Website menampilkan:
- Status: **"Fingerprint terdaftar"** ✅
- Fingerprint ID: **12345**
- Mode: **Verify Fingerprint** (sekarang bisa dipakai untuk akses pintu)

#### Contoh implementasi di React/Vue:

```javascript
async function handleStartFingerprintRegistration(studentNim, studentName, studentEmail) {
  try {
    const response = await fetch('http://10.85.28.30:5000/api/fingerprint/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        student_nim: studentNim,
        student_name: studentName,
        student_email: studentEmail,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Fingerprint registered:', result.fingerprint_id);
      // Update UI status
      showNotification('Fingerprint berhasil terdaftar!', 'success');
      // Refresh data dari Firestore
      refreshStudentData();
    } else {
      showNotification('Error: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Request failed:', error);
    showNotification('Gagal connect ke Raspberry Pi', 'error');
  }
}
```

#### Troubleshooting:

- **"Connection refused"** → Pastikan Raspberry Pi server masih running dan IP/port benar
- **"Address already in use"** → Ganti port: `--port 5001` atau `--port 5002`
- **Firestore tidak terupdate** → Pastikan `serviceAccountKey.json` ada dan Firebase Admin credentials valid
- **Fingerprint tidak terdeteksi** → Pastikan AS608 sensor tersambung dengan benar ke GPIO14 & GPIO15

### Alur register fingerprint manual (Legacy - Optional)

**Cara ini masih bisa digunakan jika Anda ingin trigger registration via SSH.**

1. Buka **Firebase Console**.
2. Masuk ke **Project Settings**.
3. Buka tab **Service accounts**.
4. Klik **Generate new private key**.
5. Simpan file JSON itu dengan nama `serviceAccountKey.json`.
6. Copy file itu ke folder Raspberry Pi `~/labaccess_controller/`.

```powershell
# Dari Windows PowerShell, copy file ke Raspberry Pi:
scp "C:\Users\Hp\Downloads\serviceAccountKey.json" nabila@10.85.28.30:~/labaccess_controller/
```

### Perintah manual register fingerprint (jika dijalankan via SSH)

```bash
cd ~/labaccess_controller
python main.py --mode register --student-nim 22507334002 --student-name "Nabila" --student-email "nabiladini.2022@student.uny.ac.id" --service-account serviceAccountKey.json
```

### Startup Raspberry Pi di verify mode (default access control)

Jalankan di startup atau via systemd service:

```bash
cd ~/labaccess_controller
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py  # Default mode adalah verify
```

Untuk setup systemd service agar auto-start saat boot Raspberry Pi:

```bash
sudo nano /etc/systemd/system/labaccess.service
```

Isi dengan:

```ini
[Unit]
Description=Smart Lab Access Controller
After=network.target

[Service]
Type=simple
User=nabila
WorkingDirectory=/home/nabila/labaccess_controller
ExecStart=/home/nabila/labaccess_controller/.venv/bin/python main.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Kemudian:

```bash
sudo systemctl daemon-reload
sudo systemctl enable labaccess
sudo systemctl start labaccess
```

## Catatan integrasi ke website

- Website dipakai untuk registrasi identitas mahasiswa: Nama, NIM, Program Studi, dan Email.
- Fingerprint disimpan dan diverifikasi di hardware Raspberry Pi 5.
- Setelah fingerprint terverifikasi, Raspberry Pi dapat membuka relay door lock dan mengirim status ke website atau backend lewat `website_bridge.py`.
- Saat fingerprint tidak terdaftar, buzzer aktif lebih lama dan akses ditolak.
- **NEW**: Untuk registrasi fingerprint dari website, jalankan Raspberry Pi di `--mode server` dan website POST ke `/api/fingerprint/register` endpoint.

## Panduan Implementasi Website - Register vs Verify

### Flow yang Benar di Website

**Register Fingerprint Mode** = Daftar jari baru
```
1. Admin ke halaman "Email Setting"
2. Isi data: Nama, NIM, Program Studi, Email
3. Klik "+ Tambah Email" → data simpan di Firestore
4. Status awal: "Menunggu pendaftaran fingerprint"
5. Ubah dropdown Mode menjadi "Register Fingerprint"
6. Klik tombol 🔴 (Fingerprint icon) di kolom
7. Raspberry Pi tunggu jari ditempel (2-3 kali)
8. Template tersimpan → Firestore update otomatis
9. Status berubah: "✅ Fingerprint terdaftar | ID: 12345"
10. Ubah dropdown ke "Verify Fingerprint" (aktif akses pintu)
```

**Verify Fingerprint Mode** = Akses pintu pakai jari
```
1. Setelah "registered", pilih mode "Verify Fingerprint"
2. Raspberry Pi selalu "listening" di mode ini
3. Siswa tempel jari ke sensor (tanpa klik tombol website)
4. Hardware otomatis verify:
   - Jika cocok → relay buka pintu + buzzer ok
   - Jika tidak cocok → buzzer error + deny
5. Website hanya display status, tidak perlu action
```

### UI Components untuk Website

**Dropdown Mode:**
```javascript
<select value={fingerprintMode} onChange={handleModeChange}>
  <option value="">-- Pilih Mode --</option>
  <option value="register">Register Fingerprint (Daftar Jari)</option>
  <option value="verify">Verify Fingerprint (Akses Pintu)</option>
</select>
```

**Tombol Fingerprint (Register):**
```javascript
<button 
  onClick={handleStartRegister}
  disabled={fingerprintMode !== 'register' || status !== 'pending'}
  className="btn-fingerprint"
>
  🔴 Mulai Registrasi
</button>
```

**Status Display:**
```javascript
if (fingerprintStatus === 'pending') {
  return "⏳ Menunggu pendaftaran (pilih mode Register)";
} else if (fingerprintStatus === 'registered') {
  return `✅ Fingerprint terdaftar | ID: ${fingerprintId}`;
} else if (fingerprintStatus === 'failed') {
  return "❌ Registrasi gagal (coba ulang)";
}
```

### Implementasi Function: handleStartRegister

```javascript
async function handleStartRegister(nim, name, email) {
  // Validasi
  if (fingerprintMode !== 'register') {
    alert('Pilih mode "Register Fingerprint" dulu!');
    return;
  }

  setIsLoading(true);
  setStatusMessage('Menghubungi Raspberry Pi...');

  try {
    const response = await fetch('http://10.85.28.30:5000/api/fingerprint/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_nim: nim,
        student_name: name,
        student_email: email,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      setStatusMessage(`✅ Berhasil! Fingerprint ID: ${result.fingerprint_id}`);
      // Refresh dari Firestore
      await refreshData(nim);
      // Auto-switch ke Verify
      setFingerprintMode('verify');
    } else {
      setStatusMessage(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    setStatusMessage(`❌ Gagal connect: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
}
```

### State Flow Diagram

```
┌────────────────────────────────────────┐
│ INITIAL (Baru daftar)                  │
│ Status: pending                         │
│ Mode: [-- Pilih Mode --]                │
│ Tombol: DISABLED                        │
└────────────────────────────────────────┘
        ↓ Pilih "Register"
┌────────────────────────────────────────┐
│ READY TO REGISTER                      │
│ Status: pending                         │
│ Mode: [Register Fingerprint] ✓          │
│ Tombol: ENABLED 🔴                     │
└────────────────────────────────────────┘
        ↓ Klik tombol, tempel jari
┌────────────────────────────────────────┐
│ REGISTERING...                          │
│ Message: "Waiting for fingerprint..."   │
│ Tombol: DISABLED (loading)              │
└────────────────────────────────────────┘
        ↓ Selesai enrollment
┌────────────────────────────────────────┐
│ REGISTERED ✅                           │
│ Status: ✅ Terdaftar | ID: 12345       │
│ Mode: [Verify Fingerprint] (auto-set)   │
│ Tombol: DISABLED (done)                 │
│ Akses Pintu: AKTIF                      │
└────────────────────────────────────────┘
```

## Troubleshooting

### Cara Test Fingerprint Sensor Langsung di Raspberry Pi

**Step 1: Copy test script ke Raspberry Pi**

```powershell
# Dari Windows PowerShell
scp "c:\Users\Hp\Downloads\22507334002_Nabila Dini Artha\Proposal\LabAccess\hardware\raspberry_pi_5\test_fingerprint.py" nabila@10.85.28.30:~/labaccess_controller/
```

**Step 2: SSH ke Raspberry Pi dan jalankan test**

```bash
cd ~/labaccess_controller
source .venv/bin/activate
python test_fingerprint.py
```

**Step 3: Test script akan:**

1. ✅ Detect serial port (/dev/serial0, /dev/ttyAMA0, dll)
2. ✅ Try multiple baud rates (57600, 9600, 115200, etc)
3. ✅ Hitung templates tersimpan
4. ✅ Test scan fingerprint (tempel jari)
5. ✅ Optional: Test enrollment (daftar jari baru)

**Output yang benar:**

```
[TEST 1] Cek Serial Port
  Mencoba /dev/serial0... ✅ TERBUKA

[TEST 2] Koneksi AS608 Sensor
  ✅ PyFingerprint library loaded
  Coba baudrate 57600... ✅ OK        ← Detected baud rate
  Template count... ✅ 5 templates
  ✅ AS608 SIAP! (Baud rate: 57600)

[TEST 3] Test Scan Fingerprint
  Detect baud rate... ✅ (57600 baud)
  ⏳ Tempel jari ke sensor...
  Waiting........... ✅ TERBACA!
  ✅ COCOK! Slot: 2, Accuracy: 128
```

**Step 4: Jika baud rate tidak 57600**

Script akan display:
```
💡 UPDATE config.py:
   fingerprint_baudrate: int = 9600  ← Contoh hasil detect
```

Maka update [config.py](hardware/raspberry_pi_5/config.py):

```python
# Raspberry Pi serial port for AS608 (UART on GPIO14 TX & GPIO15 RX)
fingerprint_serial_port: str = "/dev/serial0"
fingerprint_baudrate: int = 9600  # ← Ganti sesuai hasil test
```

Sync ke Raspberry Pi:
```powershell
scp "c:\Users\Hp\Downloads\22507334002_Nabila Dini Artha\Proposal\LabAccess\hardware\raspberry_pi_5\config.py" nabila@10.85.28.30:~/labaccess_controller/
```

### Troubleshooting Jika Test Gagal

**Error: "packet do not begin with a valid header"**

Penyebab: Baud rate tidak cocok atau TX/RX terbalik

Solusi:
1. **Periksa kabel TX/RX:**
   ```
   Raspberry Pi    AS608 Sensor
   GPIO14 (TX)  →  RX
   GPIO15 (RX)  →  TX
   5V           →  VCC
   GND          →  GND
   ```

2. **Coba reverse TX/RX** (tukar GPIO14 ↔ GPIO15) jika masih gagal

3. **Pastikan GND terhubung** (sering terlewatkan!)

4. **Cek UART enable di Raspberry Pi:**
   ```bash
   cat /boot/firmware/config.txt | grep enable_uart
   ```
   Harus ada: `enable_uart=1`

   Kalau tidak ada, tambahkan:
   ```bash
   sudo nano /boot/firmware/config.txt
   # Tambah di akhir file:
   enable_uart=1
   
   # Kemudian reboot:
   sudo reboot
   ```

5. **Test dengan stty command:**
   ```bash
   stty -F /dev/serial0 57600
   ```

### Error: `gpiozero.exc.BadPinFactory: Unable to load any default pin factory!`

**Penyebab**: AS608 sensor tidak bisa berkomunikasi dengan Raspberry Pi. Serial port atau pin configuration salah.

**Solusi - Langkah 1: Cek serial port yang benar**

```bash
# List semua serial port yang tersedia
ls -l /dev/serial* /dev/ttyAMA* /dev/ttyS*

# Contoh output:
# /dev/serial0 -> ttyAMA0 (default UART0)
# /dev/ttyAMA0 (Raspberry Pi 5 UART0)
# /dev/ttyS0 (mini UART)
```

**Langkah 2: Verifikasi GPIO pin configuration**

AS608 menggunakan GPIO14 (TX) dan GPIO15 (RX) sebagai UART. Pastikan di `/boot/firmware/config.txt` ada:

```bash
sudo nano /boot/firmware/config.txt
```

Tambahkan atau pastikan ada baris berikut:

```ini
# Enable UART0 on GPIO14/GPIO15
dtoverlay=disable-bt
enable_uart=1
```

Kemudian reboot:

```bash
sudo reboot
```

**Langkah 3: Update config.py dengan serial port yang benar**

Edit `config.py` dan update `fingerprint_serial_port` sesuai hasil `ls` di atas:

```python
# Contoh untuk Raspberry Pi 5:
fingerprint_serial_port: str = "/dev/ttyAMA0"  # atau /dev/serial0
fingerprint_baudrate: int = 57600
```

**Langkah 4: Test dengan pyfingerprint langsung (optional)**

```python
from pyfingerprint.pyfingerprint import PyFingerprint

sensor = PyFingerprint('/dev/ttyAMA0', 57600)
if sensor.verifyPassword():
    print("Success!")
else:
    print("Password verification failed")
```

**Troubleshooting baud rate:**

Jika masih gagal, coba baud rate berbeda (9600, 115200):

```python
# Di config.py
fingerprint_baudrate: int = 9600  # Ganti dari 57600
```

**Langkah 5: Pastikan hardware terpasang dengan benar**

```
Raspberry Pi        AS608 Sensor
GPIO14 (TX)  ----  RX
GPIO15 (RX)  ----  TX
5V           ----  VCC
GND          ----  GND
```

**Note**: TX/RX harus cross-connected (Raspberry Pi TX ke AS608 RX, dst)

**Penyebab**: gpiozero tidak menemukan GPIO factory yang valid. Ini biasa terjadi karena:
1. Anda tidak menjalankan dengan privilege root
2. Library GPIO (`lgpio`, `RPi.GPIO`, atau `pigpio`) tidak tersedia

**Solusi untuk Raspberry Pi 5 (Recommended):**

```bash
# Install system dependencies dan lgpio library (JANGAN pip install lgpio)
sudo apt update
sudo apt install python3-lgpio liblgpio-dev

# Install Python dependencies (lgpio sudah tersedia via system)
pip install -r requirements.txt

# Jalankan server
python main.py --mode server --service-account serviceAccountKey.json
```

**NOTE**: `lgpio` sudah di-install sebagai system package via `python3-lgpio`. Jangan install ulang via pip karena akan menyebabkan build error.

**Alternatif: Jalankan dengan sudo**

```bash
sudo python main.py --mode server --service-account serviceAccountKey.json
```

**Alternatif: Gunakan mock pin factory (untuk testing, tanpa hardware)**

```bash
export GPIOZERO_PIN_FACTORY=mock
python main.py
```

### Error: `ERROR: No matching distribution found for pyfingerprint>=1.5.3`

Versi `pyfingerprint 1.5.3+` tidak tersedia di PyPI. `requirements.txt` sudah di-update menjadi `pyfingerprint==1.5`. Install ulang:

```bash
pip install -r requirements.txt --upgrade
```

## Penting

- Implementasi `fingerprint_service.py` masih berupa scaffold.
- Anda perlu menyesuaikan library AS608 yang benar-benar dipakai pada Raspberry Pi 5.
- LCD I2C juga masih berupa wrapper sederhana; sesuaikan dengan modul LCD 16x2/20x4 yang Anda gunakan.

