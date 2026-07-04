# 📋 Panduan Setup Raspberry Pi 5 - Smart Lab Access

Berikut adalah step-by-step lengkap untuk setup Raspberry Pi 5 dengan hardware controller.

---

## **STEP 1: Setup Raspberry Pi OS & Python**

### 1.1 Pastikan OS sudah terinstall
- Raspberry Pi 5 harus sudah terinstall **Raspberry Pi OS 64-bit** (recommended)
- Jika belum, download dari https://www.raspberrypi.com/software/ dan flash ke SD Card

### 1.2 Update system
SSH ke Raspberry Pi atau buka terminal di desktop:
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Install Python 3 & pip
```bash
sudo apt install -y python3 python3-pip python3-dev git
```

Verifikasi versi:
```bash
python3 --version
pip3 --version
```

---

## **STEP 2: Copy File ke Raspberry Pi**

Pilih salah satu metode di bawah:

### **Opsi A: Via SCP (Copy file dari Windows)**

Di **PowerShell Windows** (di folder project Anda):
```powershell
scp -r "hardware\raspberry_pi_5" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
```

Ganti `<IP_RASPBERRY_PI>` dengan IP address Raspberry Pi Anda (contoh: `192.168.1.100`)

Jika minta password, default adalah `raspberry`

### **File yang perlu dicopy**

Kalau Anda mau copy satu per satu, file yang dipindahkan ke Raspberry Pi adalah:

```text
hardware/raspberry_pi_5/config.py
hardware/raspberry_pi_5/devices.py
hardware/raspberry_pi_5/fingerprint_service.py
hardware/raspberry_pi_5/main.py
hardware/raspberry_pi_5/website_bridge.py
hardware/raspberry_pi_5/requirements.txt
hardware/raspberry_pi_5/README.md
hardware/raspberry_pi_5/SETUP_GUIDE.md
```

### **Syntax SCP per file**

Di PowerShell Windows, jalankan seperti ini:

```powershell
scp "hardware\raspberry_pi_5\config.py" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\devices.py" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\fingerprint_service.py" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\main.py" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\website_bridge.py" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\requirements.txt" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\README.md" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
scp "hardware\raspberry_pi_5\SETUP_GUIDE.md" pi@<IP_RASPBERRY_PI>:~/labaccess_controller/
```

Kalau folder tujuan belum ada di Raspberry Pi, buat dulu:

```powershell
ssh pi@<IP_RASPBERRY_PI> "mkdir -p ~/labaccess_controller"
```

### **Opsi B: Via SSH git clone**

Di **Raspberry Pi terminal**:
```bash
# Jika project sudah di GitHub
git clone https://github.com/<your-username>/<repo-name>.git ~/labaccess_project
cd ~/labaccess_project/hardware/raspberry_pi_5

# ATAU manual: buat folder dan copy file satu-satu
mkdir -p ~/labaccess_controller
cd ~/labaccess_controller
```

### **Cara cek file sudah berhasil dicopy di Raspberry Pi**

Login ke Raspberry Pi lalu cek folder tujuan:

```bash
cd ~/labaccess_controller
ls -l
```

Kalau file sudah masuk, Anda akan lihat nama file seperti `main.py`, `config.py`, dan lainnya.

Kalau mau cek lebih detail:

```bash
find ~/labaccess_controller -maxdepth 1 -type f -print
```

Kalau ingin pastikan isi file sudah benar, buka salah satu file:

```bash
sed -n '1,20p' ~/labaccess_controller/main.py
```

---

## **STEP 3: Install Dependencies**

Di **Raspberry Pi**, masuk ke folder controller:

```bash
cd ~/labaccess_controller

# Install system packages untuk I2C
sudo apt install -y i2c-tools libi2c-dev python3-smbus

# Install Python packages
pip install -r requirements.txt
```

**Packages yang diinstall:**
- `gpiozero` - GPIO control (Buzzer, Relay)
- `smbus2` - I2C LCD communication
- `pyserial` - Serial Fingerprint AS608
- `requests` - HTTP calls ke website

---

## **STEP 4: Enable Serial & I2C Interface**

Hardware controller perlu serial dan I2C interface aktif:

```bash
sudo raspi-config
```

Navigasi dengan arrow keys, enter untuk select:
1. **Interfacing Options** → **Serial Port**
   - Disable Serial login: **No**
   - Enable Serial hardware: **Yes**

2. **Interfacing Options** → **I2C**
   - Enable I2C: **Yes**

3. Finish dan **Reboot**:
```bash
sudo reboot
```

---

## **STEP 5: Hardware Connection - Double Check ✓**

Pastikan semua koneksi benar sebelum jalankan program:

| Komponen | Raspberry Pi Pin | Komponen Pin | Fungsi |
|---|---|---|---|
| **AS608 Fingerprint** | GPIO17 | RX | Serial TX |
| | GPIO16 | TX | Serial RX |
| | 5V | VCC | Power |
| | GND | GND | Ground |
| **Buzzer** | GPIO18 | VCC | Signal |
| | GND | GND | Ground |
| **Relay** | GPIO22 | IN1 | Signal |
| | 5V | VCC | Power |
| | GND | GND | Ground |
| **LCD I2C** | GPIO2 (SDA) | SDA | Data |
| | GPIO3 (SCL) | SCL | Clock |
| | 5V | VCC | Power |
| | GND | GND | Ground |

### Catatan Pin:
- GPIO2 = Pin 3, GPIO3 = Pin 5, GPIO16 = Pin 36, GPIO17 = Pin 11, GPIO18 = Pin 12, GPIO22 = Pin 15
- 5V Power = Pin 2 atau 4
- GND = Pin 6, 9, 14, 20, 25, 30, 34, 39

---

## **STEP 6: Test Hardware (Sangat Penting!)**

Sebelum jalankan `main.py`, test masing-masing komponen:

### 6.1 Test Buzzer GPIO18
```bash
python3 -c "
from gpiozero import Buzzer
import time
b = Buzzer(18)
print('Buzzer ON...')
b.on()
time.sleep(1)
b.off()
print('Buzzer OFF')
"
```
**Expected:** Buzzer berbunyi selama 1 detik

### 6.2 Test I2C LCD
```bash
sudo i2cdetect -y 1
```
**Expected:** Output menunjukkan LCD address (biasanya `0x27` atau `0x3f`)

Contoh output:
```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:                         -- -- -- -- -- -- -- --
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
20: -- -- -- -- -- -- -- 27 -- -- -- -- -- -- -- --
30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
```

### 6.3 Test Serial Fingerprint
```bash
python3 -c "
import serial
s = serial.Serial('/dev/ttyAMA0', 57600, timeout=1)
print(f'Serial port open: {s.is_open}')
s.close()
"
```
**Expected:** Print `Serial port open: True`

### 6.4 Test Relay GPIO22
```bash
python3 -c "
from gpiozero import DigitalOutputDevice
import time
relay = DigitalOutputDevice(22)
print('Relay ON...')
relay.on()
time.sleep(2)
relay.off()
print('Relay OFF')
"
```
**Expected:** Relay relay aktif (terdengar klik) selama 2 detik

---

## **STEP 7: Run Controller**

Semua test passed? Jalankan controller:

```bash
cd ~/labaccess_controller
python3 main.py
```

**Expected output:**
```
Starting Lab Access Controller...
Initializing devices...
Buzzer: Short beep (startup signal)
LCD: Display "System Ready"
Fingerprint: Waiting for scan...
```

Program akan looping, menunggu fingerprint scan.

**Untuk stop:** Ctrl+C

---

## **STEP 8: Troubleshooting**

| Problem | Solution |
|---|---|
| `FileNotFoundError: No module named 'gpiozero'` | Jalankan: `pip install -r requirements.txt` |
| `PermissionError: Cannot access /dev/ttyAMA0` | Jalankan: `sudo usermod -a -G dialout pi` dan reboot |
| `I2C device not found` | Cek kabel, jalankan `sudo i2cdetect -y 1`, pastikan I2C enabled di raspi-config |
| Buzzer tidak bunyi | Cek GPIO18 pin connection, test dengan `gpio -g mode 18 out; gpio -g write 18 1` |
| LCD blank | Cek I2C address, update di `config.py` line: `LCD_I2C_ADDRESS = 0x27` |

---

## **STEP 9 (Optional): Auto-run on Boot**

Agar program jalan otomatis saat Raspberry Pi startup:

```bash
sudo nano /etc/systemd/system/labaccess.service
```

Paste code di bawah:
```ini
[Unit]
Description=Lab Access Controller
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/labaccess_controller
ExecStart=/usr/bin/python3 /home/pi/labaccess_controller/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save: Ctrl+X, ketik `Y`, enter

Enable service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable labaccess.service
sudo systemctl start labaccess.service
```

Cek status:
```bash
sudo systemctl status labaccess.service
```

Stop service (jika perlu):
```bash
sudo systemctl stop labaccess.service
```

---

## **Next Steps**

1. **Enrollment Fingerprint:** Hubungi hardware bridge untuk register fingerprint mahasiswa
2. **Website Integration:** Pastikan website backend menerima akses events dari Raspberry Pi
3. **Monitor logs:** `sudo journalctl -u labaccess.service -f` untuk live logs

---

## **Support**

Jika ada error, baca file logs atau cek di main.py source code.

Good luck! 🚀
