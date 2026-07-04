#!/usr/bin/env python3
"""
Auto-detect USB to TTL adapter di Raspberry Pi
"""

import os
import subprocess
import serial
import time
import sys

def find_usb_ports():
    """Find all USB serial ports"""
    ports = []
    
    # Check /dev/ttyUSB*
    result = subprocess.run("ls /dev/ttyUSB* 2>/dev/null", shell=True, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().split('\n'):
            if line:
                ports.append(line.strip())
    
    # Check /dev/ttyACM*
    result = subprocess.run("ls /dev/ttyACM* 2>/dev/null", shell=True, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().split('\n'):
            if line:
                ports.append(line.strip())
    
    return ports

def test_sensor_on_port(port, baudrate=57600):
    """Test AS608 sensor on specific port"""
    try:
        print(f"  Testing {port}...", end=" ", flush=True)
        
        ser = serial.Serial(port, baudrate, timeout=1)
        time.sleep(0.3)
        
        # Send verify password command
        cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x13, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x0D, 0x0A])
        
        ser.write(cmd)
        ser.flush()
        time.sleep(0.3)
        
        response = ser.read(100)
        ser.close()
        
        if len(response) > 0 and len(response) > 9 and response[9] == 0x00:
            print("✅ SENSOR FOUND!")
            return True
        else:
            print("❌")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def get_sensor_info(port):
    """Get template count and system info"""
    try:
        ser = serial.Serial(port, 57600, timeout=1)
        
        # Get template count
        cmd = bytes([0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x1D, 0x00, 0x1E, 0x0D, 0x0A])
        ser.write(cmd)
        ser.flush()
        time.sleep(0.3)
        
        response = ser.read(100)
        
        if len(response) > 12:
            template_count = (response[10] << 8) | response[11]
            return template_count
        
        ser.close()
        return None
        
    except:
        return None

def main():
    print("\n" + "=" * 60)
    print("  USB to TTL Adapter Auto-Detection")
    print("  Raspberry Pi")
    print("=" * 60)
    
    print("\n[STEP 1] Scanning for USB serial ports...")
    ports = find_usb_ports()
    
    if not ports:
        print("  ⚠️  No USB serial ports found!")
        print("\n  Checklist:")
        print("  - [ ] USB adapter plugged in?")
        print("  - [ ] Adapter connected to Raspberry Pi USB port?")
        print("  - [ ] Try: lsusb (to see USB devices)")
        print("  - [ ] Try: ls /dev/ttyUSB* (to see ports)")
        return None
    
    print(f"  ✅ Found {len(ports)} port(s):")
    for p in ports:
        print(f"     - {p}")
    
    print("\n[STEP 2] Testing for AS608 sensor...")
    
    working_port = None
    for port in ports:
        if test_sensor_on_port(port):
            working_port = port
            break
    
    if not working_port:
        print("\n  ❌ Sensor not found on any port!")
        print("\n  Troubleshooting:")
        print("  - Check wiring (TX/RX/GND/VCC)")
        print("  - Try reverse TX/RX pins")
        print("  - Check power (5V?)")
        return None
    
    print(f"\n[STEP 3] Getting sensor info...")
    
    template_count = get_sensor_info(working_port)
    
    print(f"\n" + "=" * 60)
    print(f"  ✅ SUCCESS!")
    print(f"=" * 60)
    print(f"\n  Port: {working_port}")
    print(f"  Baudrate: 57600")
    if template_count is not None:
        print(f"  Templates stored: {template_count}")
    print(f"\n  Sensor: AS608 WORKING ✅")
    
    print(f"\n[STEP 4] Next steps:")
    print(f"""
  1. Update register_fingerprint.py:
     
     Cari baris:
     finger = AS608(port='/dev/ttyAMA0', baudrate=57600)
     
     Ubah menjadi:
     finger = AS608(port='{working_port}', baudrate=57600)
  
  2. Jalankan program:
     python register_fingerprint.py
  
  3. Input fingerprint ID dan tempel jari 2x
    """)
    
    return working_port

if __name__ == "__main__":
    port = main()
    
    if port:
        print(f"\n✅ Port terdeteksi: {port}")
    else:
        print(f"\n❌ Tidak bisa deteksi sensor")
        sys.exit(1)
