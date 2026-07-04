from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional, Protocol, Tuple

import serial

try:
    from pyfingerprint.pyfingerprint import PyFingerprint
except Exception:  # pragma: no cover - optional hardware dependency
    PyFingerprint = None

try:
    import adafruit_fingerprint
except Exception:  # pragma: no cover - optional hardware dependency
    adafruit_fingerprint = None


@dataclass
class FingerprintMatch:
    is_verified: bool
    enrolled_id: Optional[int] = None
    confidence: Optional[int] = None


class FingerprintReader(Protocol):
    def enroll(self, student_id: str) -> int: ...
    def verify(self) -> FingerprintMatch: ...


class AS608FingerprintService:
    def __init__(
        self,
        serial_port: str = "/dev/serial0",
        baudrate: int = 57600,
        address: int = 0xFFFFFFFF,
        password: int = 0x00000000,
    ):
        self.serial_port = serial_port
        self.baudrate = baudrate
        self.address = address
        self.password = password
        self._sensor = None
        self._init_error: Optional[Exception] = None
        self._impl: Optional[str] = None

        # Prefer adafruit_fingerprint (works well over pyserial/UART), fallback to pyfingerprint
        if adafruit_fingerprint is not None:
            try:
                print(f"[FP] Initializing AS608 (adafruit) on {self.serial_port} @ {self.baudrate} baud...")
                uart = serial.Serial(self.serial_port, self.baudrate, timeout=1)
                sensor = adafruit_fingerprint.Adafruit_Fingerprint(uart)
                # Some adafruit modules don't provide a separate verify call; try a simple read
                self._sensor = sensor
                self._impl = 'adafruit'
                print(f"[FP] AS608 (adafruit) initialized on {self.serial_port} @ {self.baudrate}")
            except Exception as exc:  # pragma: no cover - hardware specific
                self._init_error = exc
                print(f"[FP] adafruit initialization failed: {exc}")

        elif PyFingerprint is not None:
            try:
                print(f"[FP] Initializing AS608 (pyfingerprint) on {self.serial_port} @ {self.baudrate} baud...")
                sensor = PyFingerprint(self.serial_port, self.baudrate, self.address, self.password)
                print(f"[FP] Verifying AS608 password...")
                if not sensor.verifyPassword():
                    raise RuntimeError('AS608 fingerprint password verification failed')
                self._sensor = sensor
                self._impl = 'pyfingerprint'
                print(f"[FP] AS608 ready on {self.serial_port} @ {self.baudrate}")
            except Exception as exc:  # pragma: no cover - hardware specific
                self._init_error = exc
                print(f"[FP] pyfingerprint initialization failed: {exc}")
                print(f"[FP] Troubleshooting:")
                print(f"[FP]   - Check if serial port {self.serial_port} is correct")
                print(f"[FP]   - Verify GPIO14 (TX) and GPIO15 (RX) are configured as UART")
                print(f"[FP]   - Try: ls -l /dev/serial* or /dev/ttyAMA* or /dev/ttyS*")
                print(f"[FP]   - Baud rate: {self.baudrate}")
        else:
            self._init_error = RuntimeError(
                'No supported fingerprint library installed. Install adafruit-circuitpython-fingerprint or pyfingerprint.'
            )
            print(f"[FP] no fingerprint library available")

    @property
    def ready(self) -> bool:
        return self._sensor is not None

    def _require_sensor(self) -> PyFingerprint:
        if self._sensor is None:
            raise RuntimeError(str(self._init_error or 'Fingerprint sensor not initialized'))
        return self._sensor

    def _wait_for_finger(self, message: str) -> None:
        sensor = self._require_sensor()
        print(message)
        while True:
            try:
                if sensor.readImage():
                    return
            except Exception as exc:  # pragma: no cover - hardware specific
                raise RuntimeError(f'Failed to read fingerprint image: {exc}') from exc
            time.sleep(0.2)

    def _convert_current_image(self, buffer_number: int) -> None:
        sensor = self._require_sensor()
        try:
            sensor.convertImage(buffer_number)
        except Exception as exc:  # pragma: no cover - hardware specific
            raise RuntimeError(f'Failed to convert fingerprint image: {exc}') from exc

    def _search_template(self) -> Tuple[int, int]:
        sensor = self._require_sensor()
        try:
            result = sensor.searchTemplate()
            if isinstance(result, tuple):
                if len(result) == 2:
                    return int(result[0]), int(result[1])
                if len(result) >= 1:
                    return int(result[0]), 0
            return int(result), 0
        except Exception as exc:  # pragma: no cover - hardware specific
            raise RuntimeError(f'Failed to search fingerprint template: {exc}') from exc

    def enroll(self, student_id: str) -> int:
        print(f"[FP] enroll started for student_id={student_id}")

        if self._impl == 'adafruit':
            sensor = self._require_sensor()
            # Follow adafruit enrollment flow
            try:
                # read templates is optional for adafruit; attempt to create at next free slot
                # Step 1: wait for finger
                print('[FP] letakkan jari pertama untuk pendaftaran...')
                while sensor.get_image() != adafruit_fingerprint.OK:
                    time.sleep(0.1)

                print('[FP] membaca jari pertama...')
                if sensor.image_2_tz(1) != adafruit_fingerprint.OK:
                    raise RuntimeError('Gagal membaca jari pertama')

                print('[FP] angkat jari, lalu tempelkan ulang untuk konfirmasi...')
                while sensor.get_image() != adafruit_fingerprint.OK:
                    time.sleep(0.1)

                print('[FP] membaca jari kedua...')
                if sensor.image_2_tz(2) != adafruit_fingerprint.OK:
                    raise RuntimeError('Gagal membaca jari kedua')

                print('[FP] membuat model...')
                if sensor.create_model() != adafruit_fingerprint.OK:
                    raise RuntimeError('Gagal membuat model sidik jari')

                # find next available id
                if sensor.read_templates() != adafruit_fingerprint.OK:
                    # If read_templates fails, attempt to store at 1
                    location = 1
                else:
                    used = set(sensor.templates)
                    location = None
                    for loc in range(1, sensor.library_size + 1):
                        if loc not in used:
                            location = loc
                            break
                    if location is None:
                        raise RuntimeError('Tidak ada slot kosong untuk menyimpan template')

                print(f'[FP] menyimpan model ke ID {location}...')
                if sensor.store_model(location) != adafruit_fingerprint.OK:
                    raise RuntimeError('Gagal menyimpan sidik jari ke memori')

                app_id = location - 1
                print(f"[FP] enroll success -> fingerprint_id={app_id} (sensor slot={location})")
                return int(app_id)
            except Exception as exc:
                raise RuntimeError(f'Enroll failed (adafruit): {exc}') from exc

        # Fallback to pyfingerprint implementation
        sensor = self._require_sensor()
        print(f"[FP] enroll started using pyfingerprint for student_id={student_id}")

        self._wait_for_finger('[FP] letakkan jari pertama untuk pendaftaran...')
        self._convert_current_image(0x01)

        position_number, accuracy = self._search_template()
        if position_number >= 0:
            raise RuntimeError(f'Fingerprint sudah terdaftar di slot {position_number} (accuracy={accuracy})')

        print('[FP] angkat jari, lalu tempelkan ulang untuk konfirmasi...')
        while True:
            try:
                if not sensor.readImage():
                    break
            except Exception as exc:  # pragma: no cover - hardware specific
                raise RuntimeError(f'Failed while waiting finger removal: {exc}') from exc
            time.sleep(0.2)

        self._wait_for_finger('[FP] tempelkan jari yang sama sekali lagi...')
        self._convert_current_image(0x02)

        try:
            sensor.createTemplate()
            stored_position = sensor.storeTemplate()
        except Exception as exc:  # pragma: no cover - hardware specific
            raise RuntimeError(f'Failed to store fingerprint template: {exc}') from exc

        app_id = stored_position - 1
        print(f"[FP] enroll success -> fingerprint_id={app_id} (sensor slot={stored_position})")
        return int(app_id)

    def delete_template(self, template_id: int) -> bool:
        sensor = self._require_sensor()
        if template_id < 0:
            raise ValueError('template_id must be >= 0')

        try:
            target_slot = template_id + 1
            if self._impl == 'adafruit':
                result = sensor.delete_template(target_slot)
                if result != adafruit_fingerprint.OK:
                    raise RuntimeError(f'Failed to delete template {template_id}')
                print(f'[FP] delete_template success -> fingerprint_id={template_id}')
                return True

            if hasattr(sensor, 'deleteTemplate'):
                result = sensor.deleteTemplate(target_slot)
                if result not in (None, 0, True):
                    raise RuntimeError(f'Failed to delete template {template_id} (slot {target_slot}): {result}')
                print(f'[FP] delete_template success -> fingerprint_id={template_id} (slot {target_slot})')
                return True

            raise RuntimeError('Fingerprint template deletion not supported')
        except Exception as exc:
            raise RuntimeError(f'Delete template failed: {exc}') from exc

    def clear_templates(self) -> bool:
        sensor = self._require_sensor()
        try:
            if self._impl == 'adafruit':
                result = sensor.empty_library()
                if result != adafruit_fingerprint.OK:
                    raise RuntimeError('Failed to clear fingerprint library')
                print('[FP] clear_templates success')
                return True

            if hasattr(sensor, 'clearDatabase'):
                sensor.clearDatabase()
                print('[FP] clear_templates success')
                return True

            if hasattr(sensor, 'clearLibrary'):
                sensor.clearLibrary()
                print('[FP] clear_templates success')
                return True

            raise RuntimeError('Fingerprint library reset not supported')
        except Exception as exc:
            raise RuntimeError(f'Clear templates failed: {exc}') from exc

    def verify(self) -> FingerprintMatch:
        if self._impl == 'adafruit':
            sensor = self._require_sensor()
            try:
                print('[FP] waiting for fingerprint verification...')
                while sensor.get_image() != adafruit_fingerprint.OK:
                    time.sleep(0.1)

                if sensor.image_2_tz(1) != adafruit_fingerprint.OK:
                    raise RuntimeError('Failed to convert image to template')

                if sensor.finger_search() != adafruit_fingerprint.OK:
                    print('[FP] fingerprint not recognized')
                    return FingerprintMatch(is_verified=False, enrolled_id=None, confidence=0)

                sensor_slot = int(sensor.finger_id)
                app_id = sensor_slot - 1
                print(f"[FP] fingerprint matched at slot {sensor_slot} -> app_id={app_id} (confidence={sensor.confidence})")
                return FingerprintMatch(is_verified=True, enrolled_id=app_id, confidence=int(sensor.confidence))
            except Exception as exc:
                raise RuntimeError(f'Verify failed (adafruit): {exc}') from exc

        # pyfingerprint flow
        self._require_sensor()
        self._wait_for_finger('[FP] waiting for fingerprint verification...')
        self._convert_current_image(0x01)

        position_number, accuracy = self._search_template()
        if position_number >= 0:
            app_id = position_number - 1
            print(f"[FP] fingerprint matched at slot {position_number} -> app_id={app_id} (accuracy={accuracy})")
            return FingerprintMatch(is_verified=True, enrolled_id=app_id, confidence=accuracy)

        print('[FP] fingerprint not recognized')
        return FingerprintMatch(is_verified=False, enrolled_id=None, confidence=accuracy)