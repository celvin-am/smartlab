from __future__ import annotations

import time
import logging
import threading
from dataclasses import dataclass
from typing import Optional

# Setup logging agar bisa dipantau lewat systemd journal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LabAccessDevice")

try:
    from gpiozero import Buzzer, OutputDevice
except Exception:
    Buzzer = None
    OutputDevice = None

try:
    from RPLCD.i2c import CharLCD
except Exception:
    CharLCD = None

class RelayDoorLock:
    def __init__(self, pin: int, active_high: bool = True, invert_logic: bool = False):
        self.pin = pin
        self.active_high = active_high
        self.invert_logic = invert_logic
        self._device = None
        if OutputDevice is not None:
            try:
                self._device = OutputDevice(pin, active_high=active_high, initial_value=False)
                logger.info(f"[Relay] Initialized on pin {pin}")
            except Exception as exc:
                logger.error(f"[Relay] GPIO initialization failed: {exc}")

    def open(self):
        if self._device:
            if self.invert_logic:
                self._device.off()
            else:
                self._device.on()

    def close(self):
        if self._device:
            if self.invert_logic:
                self._device.on()
            else:
                self._device.off()

    def pulse(self, seconds: float):
        self.open()
        time.sleep(seconds)
        self.close()


class StatusBuzzer:
    def __init__(self, pin: int):
        self.pin = pin
        self._device = None
        if Buzzer is not None:
            try:
                self._device = Buzzer(pin)
                logger.info(f"[Buzzer] Initialized on pin {pin}")
            except Exception as exc:
                logger.error(f"[Buzzer] GPIO initialization failed: {exc}")

    def _beep(self, duration: float, repeat: int = 1, pause: float = 0.1):
        if not self._device:
            return

        for index in range(repeat):
            self._device.on()
            time.sleep(duration)
            self._device.off()
            if index < repeat - 1:
                time.sleep(pause)

    def success(self):
        self._beep(duration=0.15, repeat=2, pause=0.1)

    def failure(self):
        self._beep(duration=1.0, repeat=1)


class I2CLcdDisplay:
    def __init__(self, sda_pin: int, scl_pin: int, address: int = 0x27):
        self.sda_pin = sda_pin
        self.scl_pin = scl_pin
        self.address = address
        self._device = None
        self._lock = threading.Lock()

        if CharLCD is not None:
            try:
                logger.info(f"[LCD] Attempting to initialize at address {hex(address)}")
                self._device = CharLCD(
                    i2c_expander='PCF8574',
                    address=self.address,
                    port=1,
                    cols=16,
                    rows=2,
                    charmap='A00',
                    auto_linebreaks=True,
                )
                logger.info("[LCD] Initialization successful")
            except Exception as exc:
                logger.error(f"[LCD] Failed to initialize RPLCD: {exc}")
                self._device = None
        else:
            logger.warning("[LCD] RPLCD library not installed")

    def _format_line(self, text: str, width: int = 16) -> str:
        return text.ljust(width)[:width]

    def clear(self):
        if self._device:
            try:
                self._device.clear()
            except Exception as exc:
                logger.error(f"[LCD] clear failed: {exc}")

    def show_message(self, line1: str, line2: str = ""):
        with self._lock:
            logger.info(f"[LCD] Displaying: '{line1}' | '{line2}'")
            if self._device:
                try:
                    self._device.clear()
                    time.sleep(0.08)
                    self._device.cursor_pos = (0, 0)
                    self._device.write_string(self._format_line(line1))
                    time.sleep(0.04)
                    self._device.cursor_pos = (1, 0)
                    self._device.write_string(self._format_line(line2))
                    time.sleep(0.04)
                except Exception as exc:
                    logger.error(f"[LCD] write failed: {exc}")
            else:
                print(f"[LCD Mock] {line1} | {line2}")

    def show_ready(self):
        self.show_message("Smart Lab Access", "Tempelkan jari")

    def show_open(self):
        self.show_message("Pintu terbuka", "Silakan masuk")

    def show_locked(self):
        self.show_message("Pintu terkunci", "Proses selesai")

    def show_denied(self):
        self.show_message("Gagal Akses", "Tidak terdaftar")

    def close(self):
        if self._device:
            try:
                self._device.close()
            except Exception as exc:
                logger.error(f"[LCD] close failed: {exc}")


@dataclass
class DeviceBundle:
    relay: RelayDoorLock
    buzzer: StatusBuzzer
    lcd: I2CLcdDisplay