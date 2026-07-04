from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception:  # pragma: no cover - optional dependency
    firebase_admin = None
    credentials = None
    firestore = None


@dataclass
class StudentRecord:
    id: str
    nim: str
    name: str
    email: str
    prodi: str
    fingerprint_mode: str
    fingerprint_status: str
    fingerprint_id: str


class StudentRegistry:
    def __init__(
        self,
        service_account_path: Optional[str] = None,
        collection_name: str = 'student_email_settings',
    ):
        self.collection_name = collection_name
        self._client = None

        if firebase_admin is None or credentials is None or firestore is None:
            return

        account_path = Path(service_account_path) if service_account_path else Path(__file__).with_name('serviceAccountKey.json')
        if not account_path.exists():
            return

        if not firebase_admin._apps:
            cred = credentials.Certificate(str(account_path))
            firebase_admin.initialize_app(cred)

        self._client = firestore.client()

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def list_by_nim(self, nim: str) -> List[StudentRecord]:
        if not self.enabled:
            return []

        records: List[StudentRecord] = []
        snapshot = self._client.collection(self.collection_name).where('nim', '==', str(nim).strip()).stream()
        for doc in snapshot:
            data = doc.to_dict() or {}
            records.append(
                StudentRecord(
                    id=doc.id,
                    nim=str(data.get('nim', '')).strip(),
                    name=str(data.get('name', '')).strip(),
                    email=str(data.get('email', '')).strip(),
                    prodi=str(data.get('prodi', '')).strip(),
                    fingerprint_mode=str(data.get('fingerprintMode', 'register')).strip(),
                    fingerprint_status=str(data.get('fingerprintStatus', 'unknown')).strip(),
                    fingerprint_id=str(data.get('fingerprintId', '')).strip(),
                )
            )
        return records

    def update_fingerprint_status(self, nim: str, fingerprint_id: Optional[int], status: str, fingerprint_mode: str = 'register') -> int:
        if not self.enabled:
            return 0

        update_data: Dict[str, Any] = {
            'fingerprintMode': fingerprint_mode,
            'fingerprintStatus': status,
        }
        if fingerprint_id is not None:
            update_data['fingerprintId'] = str(fingerprint_id)

        updated_count = 0
        snapshot = self._client.collection(self.collection_name).where('nim', '==', str(nim).strip()).stream()
        for doc in snapshot:
            doc.reference.update(update_data)
            updated_count += 1

        return updated_count

    def get_first_by_nim(self, nim: str) -> Optional[StudentRecord]:
        records = self.list_by_nim(nim)
        return records[0] if records else None