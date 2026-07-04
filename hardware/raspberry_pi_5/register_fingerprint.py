#!/usr/bin/env python3
"""
Sistem Pendaftaran Fingerprint AS608 - Raspberry Pi 5
Mirip dengan ESP32 Adafruit_Fingerprint code
"""

import argparse
import serial
import time
import sys

# Constant definitions
FINGERPRINT_OK = 0x00
FINGERPRINT_NOFINGER = 0x02

class AS608:
    """AS608 Fingerprint Sensor"""
    
    def __init__(self, port='/dev/ttyAMA0', baudrate=57600):
        self.port = port
        self.baudrate = baudrate
        self.ser = None
        
    def begin(self, baudrate):
        """Initialize serial connection"""
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=1
            )
            return True
        except:
            return False
    
    def verifyPassword(self):
        """Verify sensor password"""
        try:
            # Build command: EF 01 FF FF FF FF 01 00 03 13 00 00 00 00 checksum 0D 0A
            cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x13, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x0D, 0x0A])
            self.ser.write(cmd)
            self.ser.flush()
            
            time.sleep(0.2)
            response = self.ser.read(12)
            
            return len(response) > 0
        except:
            return False
    
    def getImage(self):
        """Get finger image"""
        try:
            # Command: EF 01 FF FF FF FF 01 00 03 01 00 04 0D 0A
            cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x01, 0x00, 0x04, 0x0D, 0x0A])
            self.ser.write(cmd)
            self.ser.flush()
            
            time.sleep(0.1)
            response = self.ser.read(12)
            
            if len(response) > 9:
                status = response[9]
                return status
            return FINGERPRINT_NOFINGER
        except:
            return FINGERPRINT_NOFINGER
    
    def image2Tz(self, slot):
        """Convert image to template"""
        try:
            # Command: EF 01 FF FF FF FF 01 00 04 02 slot checksum 0D 0A
            if slot == 1:
                cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x04, 0x02, 0x01, 0x00, 0x07, 0x0D, 0x0A])
            else:
                cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x04, 0x02, 0x02, 0x00, 0x08, 0x0D, 0x0A])
            
            self.ser.write(cmd)
            self.ser.flush()
            
            time.sleep(0.2)
            response = self.ser.read(12)
            
            return len(response) > 0 and response[9] == FINGERPRINT_OK
        except:
            return False
    
    def createModel(self):
        """Create fingerprint model"""
        try:
            # Command: EF 01 FF FF FF FF 01 00 03 05 00 08 0D 0A
            cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x05, 0x00, 0x08, 0x0D, 0x0A])
            self.ser.write(cmd)
            self.ser.flush()
            
            time.sleep(0.2)
            response = self.ser.read(12)
            
            return len(response) > 0 and response[9] == FINGERPRINT_OK
        except:
            return False
    
    def storeModel(self, fid):
        """Store fingerprint model"""
        try:
            # Command: EF 01 FF FF FF FF 01 00 06 06 00 fid checksum 0D 0A
            fid_high = (fid >> 8) & 0xFF
            fid_low = fid & 0xFF
            
            checksum = 0x01 + 0x06 + 0x06 + fid_high + fid_low
            
            cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x06, 0x06, 0x00, fid_low, (checksum >> 8), (checksum & 0xFF), 0x0D, 0x0A])
            self.ser.write(cmd)
            self.ser.flush()
            
            time.sleep(0.2)
            response = self.ser.read(12)
            
            return len(response) > 0 and response[9] == FINGERPRINT_OK
        except:
            return False

def getFingerprintEnroll(finger, fid):
    """Enroll fingerprint - mirip ESP32 getFingerprintEnroll()"""
    
    p = -1
    
    # Step 1: Get first image
    print("Tempelkan jari...")
    while p != FINGERPRINT_OK:
        p = finger.getImage()
        
        if p == FINGERPRINT_OK:
            print("Gambar berhasil diambil")
        elif p == FINGERPRINT_NOFINGER:
            time.sleep(0.1)
        else:
            return False
    
    # Step 2: Convert image to slot 1
    p = finger.image2Tz(1)
    if p != True:
        return False
    
    # Step 3: Wait for finger removal
    print("Angkat jari...")
    time.sleep(2)
    
    while finger.getImage() != FINGERPRINT_NOFINGER:
        time.sleep(0.1)
    
    # Step 4: Get second image
    print("Tempelkan jari yang sama lagi...")
    p = -1
    while p != FINGERPRINT_OK:
        p = finger.getImage()
        
        if p == FINGERPRINT_OK:
            print("Gambar kedua berhasil diambil")
        elif p == FINGERPRINT_NOFINGER:
            time.sleep(0.1)
        else:
            return False
    
    # Step 5: Convert image to slot 2
    p = finger.image2Tz(2)
    if p != True:
        return False
    
    # Step 6: Create model
    p = finger.createModel()
    if p != True:
        print("Sidik jari tidak cocok")
        return False
    
    # Step 7: Store model
    p = finger.storeModel(fid)
    if p == True:
        print("Sidik jari berhasil disimpan")
        return True
    
    return False

def setup(port: str = '/dev/ttyUSB0', baudrate: int = 57600):
    """Setup - mirip ESP32 setup()"""
    
    print("\nSistem Pendaftaran Fingerprint AS608")
    
    finger = AS608(port=port, baudrate=baudrate)
    
    print(f"Initializing sensor on {port} @ {baudrate}...", end=" ")
    if not finger.begin(baudrate):
        print("❌")
        print("Sensor fingerprint tidak ditemukan!")
        return None
    print("✅")
    
    print("Verifying sensor...", end=" ")
    if finger.verifyPassword():
        print("✅")
        print("Sensor fingerprint ditemukan!")
        return finger
    else:
        print("❌")
        print("Sensor fingerprint tidak ditemukan!")
        return None

def loop(finger):
    """Main loop - mirip ESP32 loop()"""
    
    while True:
        print("\nMasukkan ID fingerprint (1-127) atau 'q' untuk keluar:")
        
        try:
            id_input = input("> ").strip()
            
            if id_input.lower() == 'q':
                print("Program selesai.")
                break
            
            id_num = int(id_input)
            
            if id_num < 1 or id_num > 127:
                print("ID tidak valid!")
                continue
            
            print(f"Mendaftarkan sidik jari pada ID {id_num}")
            
            if getFingerprintEnroll(finger, id_num):
                print("Pendaftaran berhasil!")
            else:
                print("Pendaftaran gagal!")
            
            time.sleep(3)
            
        except ValueError:
            print("Input tidak valid!")
        except KeyboardInterrupt:
            print("\n\nProgram dihentikan.")
            break

def main():
    """Main program"""
    
    parser = argparse.ArgumentParser(description='USB/TTL Fingerprint enrollment utility')
    parser.add_argument('--port', default='/dev/ttyUSB0', help='Fingerprint serial port to use')
    parser.add_argument('--baud', type=int, default=57600, help='Fingerprint baud rate')
    args = parser.parse_args()

    print("=" * 50)
    print("  SISTEM PENDAFTARAN FINGERPRINT AS608")
    print("  Raspberry Pi 5")
    print("=" * 50)
    print(f"Using serial port {args.port} at {args.baud} baud")
    
    finger = setup(port=args.port, baudrate=args.baud)
    
    if finger is None:
        sys.exit(1)
    
    loop(finger)

if __name__ == "__main__":
    main()
