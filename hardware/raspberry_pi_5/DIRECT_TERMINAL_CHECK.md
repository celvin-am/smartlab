# DIRECT TERMINAL - Check Fingerprint via USB to TTL

## Setup (Langsung di Raspberry Pi dengan LCD HDMI 7")

### Step 1: Copy Script ke Raspberry Pi

Di laptop, copy script ke Raspberry Pi:

```powershell
scp "c:\Users\Hp\Downloads\22507334002_Nabila Dini Artha\Proposal\LabAccess\hardware\raspberry_pi_5\quick_check_fingerprint.py" nabila@10.85.28.30:~/labaccess_controller/
```

---

### Step 2: Boot Raspberry Pi dengan LCD HDMI

1. **Plug HDMI 7" LCD ke Raspberry Pi**
2. **Plug mouse USB ke Raspberry Pi**
3. **Power on Raspberry Pi**
4. **Wait 30 detik untuk boot**

---

### Step 3: Open Terminal di Raspberry Pi

1. **Desktop akan muncul dengan monitor 7"**
2. **Right-click → Terminal** (atau Ctrl+Alt+T)
3. **Terminal akan terbuka**

---

### Step 4: Navigate & Run Test

Di terminal, ketik:

```bash
cd ~/labaccess_controller
source .venv/bin/activate
python quick_check_fingerprint.py
```

---

## Expected Output

```
============================================================
  FINGERPRINT SENSOR QUICK CHECK
  Raspberry Pi 5 - USB to TTL
============================================================

Port: /dev/ttyUSB0
Baudrate: 57600

============================================================
  FINGERPRINT SENSOR CONNECTION CHECK
  Raspberry Pi 5 Terminal
============================================================

[1/4] Checking port existence... ✅
[2/4] Clearing buffers... ✅
[3/4] Sending verification command... ✅
[4/4] Waiting for response... ✅

------------------------------------------------------------
  RESPONSE DETAILS:
------------------------------------------------------------
  Bytes received: 12
  Hex dump: EF01FFFFFFFFFF010003130000
  Header: ✅ Valid (EF 01)
  Status: 0x00 (OK - Password verified)

============================================================
  ✅ SENSOR CONNECTED AND RESPONDING!
============================================================

============================================================
  GET TEMPLATE COUNT
============================================================

Sending get template count command... ✅
Template count: 5
Response hex: EF01FFFFFFFFFF0100031D0005...

✅ Fingerprints stored: 5

------------------------------------------------------------
Next steps:
  1. Run register_fingerprint.py to add new fingerprint
  2. Update register_fingerprint.py with port: /dev/ttyUSB0
  3. Test verify mode in main.py
------------------------------------------------------------
```

---

## ✅ Jika Berhasil (SENSOR TERHUBUNG)

Output akan show:
- ✅ Port found
- ✅ Response received
- ✅ Status 0x00 (OK)
- ✅ Template count

**Berarti sensor WORKING!** 🎉

Next: Jalankan `register_fingerprint.py` untuk register fingerprint baru

---

## ❌ Jika Gagal (SENSOR TIDAK RESPOND)

Output akan show:
- ❌ No response from sensor
- ❌ Port tidak ditemukan

**Troubleshooting:**

1. **Cek port ada tidak:**
   ```bash
   ls -la /dev/ttyUSB*
   ```
   
   Harus show: `/dev/ttyUSB0`
   
   Jika tidak ada, USB adapter mungkin:
   - Tidak dikenal (install driver)
   - Belum di-plug
   - Rusak

2. **Cek wiring fisik:**
   ```
   USB Adapter GND  → Sensor GND
   USB Adapter VCC  → Sensor VCC (5V!)
   USB Adapter TX   → Sensor RX
   USB Adapter RX   → Sensor TX
   ```

3. **Cek power dengan multimeter:**
   - VCC to GND: ~5V DC (harus ada!)
   - GND to GND: 0V (continuity)

4. **Coba reverse TX/RX pins** jika wiring terlihat benar tapi masih gagal

---

## Next Steps (Setelah Berhasil)

### Register Fingerprint Baru

Edit register_fingerprint.py untuk update port:

```bash
nano ~/labaccess_controller/register_fingerprint.py
```

Find:
```python
finger = AS608(port='/dev/ttyAMA0', baudrate=57600)
```

Replace:
```python
finger = AS608(port='/dev/ttyUSB0', baudrate=57600)
```

Save (Ctrl+X, Y, Enter)

Run:
```bash
python register_fingerprint.py
```

Masukkan ID (1-127), tempel jari 2x → ✅ Saved!

---

## Tips untuk LCD HDMI 7"

- **Mouse berat/lambat:** Coba USB mouse lain, bukan touchpad
- **Layar kecil:** Zoom terminal dengan Ctrl++ atau Ctrl+Mouse wheel
- **Keyboard:** Gunakan SSH dari laptop jika lebih nyaman (tapi LCD tetap aktif)
- **Screenshot:** PrtScn di terminal untuk capture output

---

## File References

- `quick_check_fingerprint.py` - Quick test script (ini yang dijalankan)
- `register_fingerprint.py` - Program untuk register fingerprint
- `USB_ADAPTER_RASPBERRY_PI.md` - Detailed setup guide

---

Ready? Run `python quick_check_fingerprint.py` di terminal Raspberry Pi! 🚀
