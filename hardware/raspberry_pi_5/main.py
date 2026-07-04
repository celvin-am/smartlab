from __future__ import annotations

import argparse
import json
import time
from functools import wraps

from config import APP_CONFIG
from devices import DeviceBundle, I2CLcdDisplay, RelayDoorLock, StatusBuzzer
from fingerprint_service import AS608FingerprintService
from student_registry import StudentRegistry
from website_bridge import WebsiteBridge

try:
    from flask import Flask, jsonify, request
except Exception:  # pragma: no cover - optional dependency
    Flask = None
    jsonify = None
    request = None


def create_devices() -> DeviceBundle:
    # Relay board uses active-low drive for the solenoid.
    # open() should energize the relay immediately, close() should de-energize it.
    relay = RelayDoorLock(APP_CONFIG.pins.relay, active_high=False, invert_logic=False)
    buzzer = StatusBuzzer(APP_CONFIG.pins.buzzer)
    lcd = I2CLcdDisplay(APP_CONFIG.pins.lcd_sda, APP_CONFIG.pins.lcd_scl)
    return DeviceBundle(relay=relay, buzzer=buzzer, lcd=lcd)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Smart Lab Access Raspberry Pi 5 controller')
    parser.add_argument('--mode', choices=['verify', 'register', 'server'], default='verify', help='Mode controller')
    parser.add_argument('--student-nim', default='', help='NIM mahasiswa untuk mode register')
    parser.add_argument('--student-name', default='', help='Nama mahasiswa untuk mode register')
    parser.add_argument('--student-email', default='', help='Email mahasiswa untuk mode register')
    parser.add_argument('--service-account', default='', help='Path serviceAccountKey.json Firebase Admin')
    parser.add_argument('--fingerprint-port', default='', help='Override fingerprint serial port (e.g. /dev/ttyUSB0)')
    parser.add_argument('--fingerprint-baud', type=int, default=0, help='Override fingerprint baud rate')
    parser.add_argument('--port', type=int, default=5000, help='Port untuk server mode')
    parser.add_argument('--host', default='0.0.0.0', help='Host untuk server mode')
    return parser


def run_verify_mode(devices: DeviceBundle, fingerprint: AS608FingerprintService, bridge: WebsiteBridge):
    devices.lcd.show_ready()
    print('[System] Raspberry Pi 5 hardware controller started')
    print('[System] Waiting for fingerprint verification')

    while True:
        try:
            match = fingerprint.verify()
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            devices.buzzer.failure()
            devices.lcd.show_message('Fingerprint error', str(exc)[:16])
            print(f'[FP] verify failed: {exc}')
            time.sleep(2)
            devices.lcd.show_ready()
            continue

        if match.is_verified:
            student_name = f'ID {match.enrolled_id or "-"}'
            devices.buzzer.success()
            devices.lcd.show_open()
            devices.relay.open()
            print('[Door] Pintu terbuka - delay selama', APP_CONFIG.door_open_seconds, 'detik')
            time.sleep(APP_CONFIG.door_open_seconds)
            devices.relay.close()
            devices.lcd.show_locked()
            bridge.report_access(
                student_id=str(match.enrolled_id or 'unknown'),
                verified=True,
                action='open-door',
                note='Fingerprint verified',
            )
            time.sleep(1.5)
            devices.lcd.show_ready()
        else:
            devices.buzzer.failure()
            devices.lcd.show_denied()
            bridge.report_access(
                student_id='unknown',
                verified=False,
                action='deny-access',
                note='Fingerprint not registered',
            )
            time.sleep(2.0)
            devices.lcd.show_ready()


def run_register_mode(
    devices: DeviceBundle,
    fingerprint: AS608FingerprintService,
    registry: StudentRegistry,
    bridge: WebsiteBridge,
    student_nim: str,
    student_name: str,
    student_email: str,
):
    nim = student_nim.strip()
    if not nim:
        raise RuntimeError('Mode register but --student-nim belum diisi')

    record = registry.get_first_by_nim(nim)
    display_name = (student_name or (record.name if record else '') or nim).strip()
    display_email = (student_email or (record.email if record else '') or '').strip()

    if record is None and not display_email:
        print(f'[Registry] Tidak ada data Firestore untuk NIM {nim}. Lanjutkan enrollment manual.')
    else:
        print(f'[Registry] Target enrollment: nim={nim}, name={display_name}, email={display_email or "-"}')

    devices.lcd.show_message('Mode Register', display_name[:16])
    devices.buzzer.success()
    print('[System] Mode register fingerprint dimulai')

    try:
        fingerprint_id = fingerprint.enroll(nim)
        updated = registry.update_fingerprint_status(nim, fingerprint_id, status='registered', fingerprint_mode='register')
        if updated == 0:
            print('[Registry] Firestore tidak ter-update, pastikan serviceAccountKey.json ada di folder hardware/raspberry_pi_5')

        if record is not None:
            bridge.request_fingerprint_registration(student_id=nim, nim=nim, name=display_name)

        bridge.report_fingerprint_verified(student_id=nim, fingerprint_id=str(fingerprint_id), verified=True)
        devices.buzzer.success()
        devices.lcd.show_message('Fingerprint OK', f'ID {fingerprint_id}')
        print(f'[System] Enrollment selesai untuk NIM {nim} -> fingerprint_id={fingerprint_id}')
        time.sleep(2)
        devices.lcd.show_ready()
        return fingerprint_id
    except Exception as exc:
        devices.buzzer.failure()
        devices.lcd.show_message('Enroll gagal', str(exc)[:16])
        print(f'[System] Enrollment failed: {exc}')
        raise


def run_server_mode(
    devices: DeviceBundle,
    fingerprint: AS608FingerprintService,
    registry: StudentRegistry,
    bridge: WebsiteBridge,
    host: str,
    port: int,
    service_account_path: str,
):
    if Flask is None:
        raise RuntimeError('Flask not installed. Run: pip install flask')

    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        return response

    @app.route('/api/fingerprint/register', methods=['POST'])
    def register_fingerprint():
        """Endpoint untuk registrasi fingerprint dari website"""
        try:
            payload = request.get_json()
            student_nim = payload.get('student_nim', '').strip()
            student_name = payload.get('student_name', '').strip()
            student_email = payload.get('student_email', '').strip()

            if not student_nim:
                return jsonify({'error': 'student_nim required'}), 400

            print(f'[API] Register request for NIM {student_nim}')

            # Check if fingerprint sensor is ready
            if not fingerprint.ready:
                error_msg = 'AS608 fingerprint sensor not initialized. Check GPIO14/GPIO15 and /dev/serial0'
                print(f'[API] Error: {error_msg}')
                registry.update_fingerprint_status(student_nim, None, status='failed', fingerprint_mode='register')
                return jsonify({
                    'success': False,
                    'error': error_msg,
                }), 503

            # Run enrollment
            fingerprint_id = run_register_mode(
                devices=devices,
                fingerprint=fingerprint,
                registry=registry,
                bridge=bridge,
                student_nim=student_nim,
                student_name=student_name,
                student_email=student_email,
            )

            return jsonify({
                'success': True,
                'fingerprint_id': fingerprint_id,
                'nim': student_nim,
                'message': f'Enrollment berhasil untuk NIM {student_nim}',
            }), 200

        except Exception as exc:
            print(f'[API] Register failed: {exc}')
            student_nim = payload.get('student_nim', '').strip() if 'payload' in locals() else 'unknown'
            if student_nim and student_nim != 'unknown':
                registry.update_fingerprint_status(student_nim, None, status='failed', fingerprint_mode='register')
            return jsonify({
                'success': False,
                'error': str(exc),
            }), 500

    @app.route('/api/fingerprint/template', methods=['DELETE'])
    def delete_fingerprint_template():
        payload = request.get_json(silent=True) or {}
        template_id = payload.get('fingerprint_id') or payload.get('template_id')

        if template_id is None:
            return jsonify({'success': False, 'error': 'fingerprint_id required'}), 400

        try:
            template_id = int(template_id)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'fingerprint_id must be an integer'}), 400

        if template_id <= 0:
            return jsonify({'success': False, 'error': 'fingerprint_id must be > 0'}), 400

        try:
            fingerprint.delete_template(template_id)
            print(f'[API] Deleted fingerprint template {template_id}')
            return jsonify({'success': True, 'fingerprint_id': template_id}), 200
        except Exception as exc:
            print(f'[API] Delete template failed: {exc}')
            return jsonify({'success': False, 'error': str(exc)}), 500

    @app.route('/api/fingerprint/reset', methods=['POST'])
    def reset_fingerprint_templates():
        try:
            fingerprint.clear_templates()
            print('[API] Reset fingerprint library')
            return jsonify({'success': True}), 200
        except Exception as exc:
            print(f'[API] Reset fingerprint library failed: {exc}')
            return jsonify({'success': False, 'error': str(exc)}), 500

    @app.route('/api/fingerprint/status', methods=['GET'])
    def fingerprint_status():
        """Endpoint untuk check status fingerprint sensor"""
        return jsonify({
            'ready': fingerprint.ready,
            'sensor': 'AS608',
        }), 200

    @app.route('/api/door/open', methods=['POST'])
    def open_door_from_portal():
        payload = request.get_json(silent=True) or {}
        try:
            devices.buzzer.success()
            devices.lcd.show_message('Portal Access', payload.get('status', 'open')[:12])
            devices.relay.open()
            print('[API] Door open requested from portal:', payload)
            time.sleep(APP_CONFIG.door_open_seconds)
            devices.relay.close()
            devices.lcd.show_ready()
            return jsonify({'success': True, 'message': 'Door opened'}), 200
        except Exception as exc:
            devices.lcd.show_message('Door Error', 'Portal')
            print(f'[API] Door open failed: {exc}')
            return jsonify({'success': False, 'error': str(exc)}), 500

    devices.lcd.show_message('Server Mode', 'Ready')
    print(f'[System] Server mode started at http://{host}:{port}')
    print('[API] POST /api/fingerprint/register - Daftar fingerprint dari website')
    print('[API] DELETE /api/fingerprint/template - Hapus template fingerprint di Pi')
    print('[API] POST /api/fingerprint/reset - Reset semua template fingerprint di Pi')
    print('[API] GET /api/fingerprint/status - Check status sensor')

    app.run(host=host, port=port, debug=False, use_reloader=False)


def main():
    parser = build_parser()
    args = parser.parse_args()

    fingerprint_port = args.fingerprint_port or APP_CONFIG.fingerprint_serial_port
    fingerprint_baud = args.fingerprint_baud or APP_CONFIG.fingerprint_baudrate

    devices = create_devices()
    fingerprint = AS608FingerprintService(
        serial_port=fingerprint_port,
        baudrate=fingerprint_baud,
    )
    bridge = WebsiteBridge(APP_CONFIG.bridge_base_url)
    registry = StudentRegistry(service_account_path=args.service_account or None)

    if args.mode == 'register':
        run_register_mode(
            devices=devices,
            fingerprint=fingerprint,
            registry=registry,
            bridge=bridge,
            student_nim=args.student_nim,
            student_name=args.student_name,
            student_email=args.student_email,
        )
        return

    if args.mode == 'server':
        run_server_mode(
            devices=devices,
            fingerprint=fingerprint,
            registry=registry,
            bridge=bridge,
            host=args.host,
            port=args.port,
            service_account_path=args.service_account or None,
        )
        return

    run_verify_mode(devices=devices, fingerprint=fingerprint, bridge=bridge)


if __name__ == '__main__':
    main()