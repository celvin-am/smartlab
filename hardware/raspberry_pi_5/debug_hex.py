#!/usr/bin/env python3
"""
Deep hex debugging - lihat exactly apa yang dikirim dan diterima
"""
import serial
import time
import sys

def hex_dump(data, label=""):
    """Print hex dump with nice formatting"""
    hex_str = " ".join(f"{b:02X}" for b in data)
    ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in data)
    print(f"  {label:20} HEX: {hex_str}")
    print(f"  {'':20} ASCII: {ascii_str}")

def test_send_receive():
    """Test raw send/receive dengan hex dump"""
    
    print("\n" + "=" * 70)
    print("  AS608 HEX DEBUG - See Exactly What's Sent/Received")
    print("=" * 70)
    
    port = '/dev/ttyAMA0'
    baudrate = 57600
    
    try:
        print(f"\n1. Opening {port} at {baudrate} baud...")
        ser = serial.Serial(port, baudrate, timeout=1)
        print("   ✅ Opened")
        
        # Clear buffers
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Build AS608 Verify Password command
        # Header: EF 01
        # Address: FF FF FF FF
        # Type: 01 (command)
        # Length: 00 03 (3 bytes: cmd + password + checksum)
        # Cmd: 13 (verify password)
        # Data: 00 00 00 00 (password)
        # Checksum: calculated
        # End: 0D 0A
        
        cmd = 0x13  # Verify password command
        data = bytes([0x00, 0x00, 0x00, 0x00])  # Default password
        
        # Build packet
        packet = bytes([0xEF, 0x01])  # Header
        packet += bytes([0xFF, 0xFF, 0xFF, 0xFF])  # Address
        packet += bytes([0x01])  # Type (command)
        
        data_len = 2 + len(data)  # cmd (1) + data (4) = 5, but wait...
        # Actually: data_len includes cmd + data
        data_len = 1 + len(data) + 1  # cmd + data + checksum indicator? No...
        # Let me recalculate: data_len is just cmd + data
        data_len = 1 + len(data)  # cmd (1) + password (4) = 5
        
        packet += bytes([(data_len >> 8), (data_len & 0xFF)])  # Length: 00 05
        
        content = bytes([cmd]) + data  # The actual command data
        packet += content
        
        # Checksum = sum of (type + length_h + length_l + content)
        checksum = 0x01  # type
        checksum += (data_len >> 8)
        checksum += (data_len & 0xFF)
        for b in content:
            checksum += b
        
        packet += bytes([(checksum >> 8), (checksum & 0xFF)])
        packet += bytes([0x0D, 0x0A])  # End
        
        print(f"\n2. Building AS608 Verify Password packet...")
        hex_dump(packet, "Full Packet:")
        
        print(f"\n3. Sending packet ({len(packet)} bytes)...")
        ser.write(packet)
        ser.flush()
        print("   ✅ Sent")
        
        print(f"\n4. Waiting for response (timeout 1 sec)...")
        time.sleep(0.5)
        
        response = b""
        while True:
            chunk = ser.read(1)
            if not chunk:
                break
            response += chunk
        
        if response:
            print(f"   ✅ Received {len(response)} bytes:")
            hex_dump(response, "Response:")
            
            # Analyze response
            print(f"\n5. Analyzing response...")
            if len(response) >= 2:
                if response[0] == 0xEF and response[1] == 0x01:
                    print("   ✅ Valid AS608 header (EF 01)")
                    if len(response) >= 10:
                        status = response[9]
                        print(f"   Status byte: 0x{status:02X}")
                        if status == 0x00:
                            print("   ✅ SENSOR RESPONDED CORRECTLY!")
                        else:
                            print(f"   ❌ Status error: 0x{status:02X}")
                else:
                    print(f"   ❌ Invalid header: {response[0:2].hex()}")
        else:
            print("   ❌ NO RESPONSE received")
            print("\n   This means sensor is NOT responding to commands")
            print("   Possibilities:")
            print("   1. Sensor not powered")
            print("   2. TX/RX wires reversed")
            print("   3. Sensor not connected to this port")
            print("   4. Baud rate mismatch")
        
        ser.close()
        
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_echo_debug():
    """Test with echo - send data and see if anything comes back"""
    print("\n" + "=" * 70)
    print("  ECHO TEST - Send simple bytes and monitor")
    print("=" * 70)
    
    port = '/dev/ttyAMA0'
    baudrate = 57600
    
    try:
        ser = serial.Serial(port, baudrate, timeout=0.5)
        
        # Try different simple patterns
        test_patterns = [
            (b'\xEF\x01', "AS608 header only"),
            (b'\xFF\xFF\xFF\xFF', "AS608 address"),
            (b'\x00\x00\x00\x00', "Null bytes"),
        ]
        
        for pattern, description in test_patterns:
            print(f"\n  Sending: {description}")
            hex_dump(pattern, "Pattern:")
            
            ser.reset_input_buffer()
            ser.write(pattern)
            ser.flush()
            
            time.sleep(0.2)
            response = ser.read(100)
            
            if response:
                print(f"  Response received ({len(response)} bytes):")
                hex_dump(response, "Echo:")
            else:
                print(f"  No response")
        
        ser.close()
        
    except Exception as e:
        print(f"  Error: {e}")

def verify_gpio_assignment():
    """Verify which GPIO pins are actually used by /dev/ttyAMA0"""
    import os
    
    print("\n" + "=" * 70)
    print("  GPIO ASSIGNMENT CHECK")
    print("=" * 70)
    
    result = os.popen("grep -r 'ttyAMA0' /sys/class/tty/ 2>/dev/null || echo 'Not found'").read()
    print(f"\n  ttyAMA0 in /sys/class/tty/:")
    print(f"  {result}")
    
    result = os.popen("ls -la /dev/ttyAMA0").read()
    print(f"\n  Device node info:")
    print(f"  {result}")
    
    result = os.popen("cat /proc/device-tree/serial@1f00030000/status 2>/dev/null || echo 'N/A'").read()
    print(f"\n  Serial device tree status:")
    print(f"  {result}")

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  AS608 DEEP DEBUGGING")
    print("=" * 70)
    
    # Test GPIO assignment
    verify_gpio_assignment()
    
    # Test send/receive with hex dump
    test_send_receive()
    
    # Test echo patterns
    test_echo_debug()
    
    print("\n" + "=" * 70)
    print("  RECOMMENDATIONS")
    print("=" * 70)
    print("""
  If no response at all:
  1. Check physical wiring again:
     Raspberry Pi          AS608 Sensor
     GPIO14 (TX)    →      RX
     GPIO15 (RX)    →      TX
     5V             →      VCC
     GND            →      GND
  
  2. Check with multimeter:
     VCC to GND: Should be ~5V DC
     GND to GND: Should be 0V (continuity)
  
  3. Try reversing TX/RX if wiring looks wrong
  
  4. Check if sensor is ACTUALLY connected to Raspberry Pi
     (not still connected to ESP32)
    """)
    print("=" * 70 + "\n")
