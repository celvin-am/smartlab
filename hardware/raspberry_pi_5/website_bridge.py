from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, Optional

try:
    import requests
except Exception:  # pragma: no cover - optional dependency
    requests = None


class WebsiteBridge:
    """Optional bridge to your website/backend.

    Use this class if you want the Raspberry Pi 5 to send verification events,
    access logs, or enrollment results to the website layer.
    """

    def __init__(self, base_url: str = ""):
        self.base_url = base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.base_url) and requests is not None

    def send_event(self, path: str, payload: Dict[str, Any]) -> bool:
        if not self.enabled:
            print(f"[Bridge] disabled: {path} -> {payload}")
            return False

        response = requests.post(f"{self.base_url}/{path.lstrip('/')}", json=payload, timeout=10)
        response.raise_for_status()
        return True

    def report_access(self, student_id: str, verified: bool, action: str, note: str = "") -> bool:
        payload = {
            "student_id": student_id,
            "verified": verified,
            "action": action,
            "note": note,
        }
        return self.send_event("api/rpi/access-event", payload)

    def request_fingerprint_registration(self, student_id: str, nim: str = "", name: str = "") -> bool:
        payload = {
            "student_id": student_id,
            "nim": nim,
            "name": name,
            "mode": "register",
        }
        return self.send_event("api/rpi/fingerprint-event", payload)

    def report_fingerprint_verified(self, student_id: str, fingerprint_id: str, verified: bool = True) -> bool:
        payload = {
            "student_id": student_id,
            "fingerprint_id": fingerprint_id,
            "verified": verified,
            "mode": "verify",
        }
        return self.send_event("api/rpi/fingerprint-event", payload)
