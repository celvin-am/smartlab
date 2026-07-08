from dataclasses import dataclass


@dataclass(frozen=True)
class PinConfig:
    fingerprint_tx: int = 14
    fingerprint_rx: int = 15
    buzzer: int = 18
    relay: int = 22
    lcd_sda: int = 2
    lcd_scl: int = 3


@dataclass(frozen=True)
class AppConfig:
    # Real device pins requested by the user
    pins: PinConfig = PinConfig()

    # Website / backend bridge
    firebase_project_id: str = "smartlabacces"
    firestore_collection_fingerprints: str = "fingerprints"
    firestore_collection_access_logs: str = "access_logs"

    # Runtime options
    door_open_seconds: int = 10
    buzzer_success_seconds: float = 0.2
    buzzer_fail_seconds: float = 1.0

    # Raspberry Pi serial port for AS608.
    # Default prefers GPIO UART on /dev/ttyAMA0, which is a symlink to the active UART.
    # If you use a USB-TTL adapter instead, set this to /dev/ttyAMA0.
    fingerprint_serial_port: str = "/dev/ttyAMA0"
    
    # AS608 Baud rate (default 57600)
    # If communication fails, try 9600 or 115200
    fingerprint_baudrate: int = 57600

    # Optional bridge endpoint if you prefer the Pi to talk to your website/backend.
    bridge_base_url: str = ""


APP_CONFIG = AppConfig()