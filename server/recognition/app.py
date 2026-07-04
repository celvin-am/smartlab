"""
Flask server untuk:
- /api/rfid_event : menerima event dari Box1 (borrow_start, return_start)
- /api/recognize  : menerima image POST dan melakukan matching terhadap template images di folder models/

Server ini mendukung menulis ke Firebase Realtime Database (fallback) dan Firestore (direkomendasikan).

Konfigurasi:
- Tempatkan `serviceAccountKey.json` (dari Firebase) di folder ini dan ganti path pada inisialisasi.
- Pastikan folder `models/` berisi gambar template (15 contoh) bernama <part_id>.jpg
"""

import os
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify, Response
import numpy as np
import cv2
import requests

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - optional dependency
    YOLO = None

# Firebase admin
import firebase_admin
from firebase_admin import credentials, db, firestore

# ====== CONFIG ======
SERVICE_ACCOUNT = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
FIREBASE_DB_URL = 'https://your-project.firebaseio.com/'  # Ganti URL database Anda (Realtime DB)
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'models')
DOOR_CONTROLLER_URL = os.getenv('DOOR_CONTROLLER_URL', 'http://127.0.0.1:5001').rstrip('/')

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

# Initialize Firebase
fs_client = None
if os.path.exists(SERVICE_ACCOUNT):
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_DB_URL})
    print('Firebase admin initialized')
    try:
        fs_client = firestore.client()
        print('Firestore client ready')
    except Exception as e:
        print('Failed to initialize Firestore client:', e)
else:
    print('Warning: serviceAccountKey.json not found. Firebase will not be initialized.')

# Load templates (ORB descriptors)
orb = cv2.ORB_create(nfeatures=500)
templates = []
if os.path.isdir(TEMPLATE_DIR):
    for fname in os.listdir(TEMPLATE_DIR):
        path = os.path.join(TEMPLATE_DIR, fname)
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        kp, des = orb.detectAndCompute(img, None)
        templates.append({'id': os.path.splitext(fname)[0], 'kp': kp, 'des': des})
print('Loaded templates:', [t['id'] for t in templates])

bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

yolo_model = None
camera = None
camera_lock = threading.Lock()
latest_frame = None
latest_frame_time = 0


def get_camera():
    global camera
    if camera is None:
        try:
            # Try device 24 first (Raspberry Pi camera), then fallback to others
            working_devices = [1, 2, 0, 24, 25, 26, 27, 33, 34, 35, 36, 3]
            for device_id in working_devices:
                try:
                    camera = cv2.VideoCapture(device_id)
                    if camera.isOpened():
                        print(f'Camera initialized with device {device_id}')
                        return camera
                    camera.release()
                    camera = None
                except Exception:
                    pass
            
            # If no device works, raise error
            raise RuntimeError('No camera device available')
        except Exception as exc:
            print('Camera init failed:', exc)
            camera = None
    return camera


def capture_loop():
    global latest_frame, latest_frame_time
    while True:
        cap = get_camera()
        if cap is None:
            time.sleep(1)
            continue
        ok, frame = cap.read()
        if ok:
            with camera_lock:
                latest_frame = frame
                latest_frame_time = time.time()
        time.sleep(0.03)


threading.Thread(target=capture_loop, daemon=True).start()


def load_yolo_model():
    global yolo_model
    if yolo_model is not None:
        return yolo_model

    # 1. Tentukan lokasi root proyek secara otomatis
    # __file__ adalah lokasi file ini (server/recognition/app.py)
    # Kita naik 2 tingkat ke atas (..) untuk sampai ke lab-access-system/
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    model_path = os.path.join(root_dir, 'models', 'best.pt')

    # 2. Daftar kandidat lokasi (Priority: Environment Variable > Default Path)
    candidate_paths = [
        os.getenv('YOLO_MODEL_PATH', '').strip(),
        model_path
    ]

    # 3. Coba loading
    for path in candidate_paths:
        if path and os.path.exists(path):
            try:
                yolo_model = YOLO(path)
                print(f'YOLO model loaded successfully from: {path}')
                return yolo_model
            except Exception as e:
                print(f'Error loading model at {path}: {e}')

    print(f'YOLO model not found. Please ensure best.pt is inside: {model_path}')
    return None


def write_to_firebase(path, data):
    """Write to Realtime DB and attempt to also write to Firestore (collection = top-level path)."""
    if firebase_admin._apps:
        try:
            ref = db.reference(path)
            ref.push(data)
        except Exception as e:
            print('Realtime DB write skipped or failed:', e)
        # Firestore: write to top-level collection
        try:
            coll = path.strip('/').split('/')[0]
            if fs_client and coll:
                fs_client.collection(coll).add(data)
        except Exception as e:
            print('Firestore write skipped or failed:', e)
    else:
        print('Firebase not initialized; skipping write:', path, data)


def open_door():
    """Trigger the door controller open endpoint. Returns True if request succeeded."""
    try:
        import requests
        url = DOOR_CONTROLLER_URL.rstrip('/') + '/open'
        resp = requests.get(url, timeout=3)
        print('Door open request', url, 'status', resp.status_code)
        return resp.status_code == 200
    except Exception as e:
        print('Failed to call door controller:', e)
        return False


@app.route('/api/rfid_event', methods=['POST'])
def rfid_event():
    j = request.get_json(force=True)
    print('RFID event', j)
    box = j.get('box')
    action = j.get('action')
    uid = j.get('uid')
    timestamp = datetime.utcnow().isoformat()

    # record event
    entry = {'box': box, 'action': action, 'uid': uid, 'timestamp': timestamp}
    write_to_firebase('/events', entry)

    if action == 'borrow_start':
        session = {'uid': uid, 'start_time': timestamp, 'parts': [], 'returned': False}
        if firebase_admin._apps:
            # Realtime DB push
            key = None
            try:
                ref = db.reference('/sessions')
                key = ref.push(session).key
            except Exception:
                key = None
            # Firestore add
            fsid = None
            try:
                if fs_client:
                    doc_ref = fs_client.collection('sessions').add(session)
                    fsid = doc_ref[0].id if isinstance(doc_ref, tuple) else (doc_ref.id if hasattr(doc_ref, 'id') else None)
            except Exception as e:
                print('Firestore session add failed:', e)
                fsid = None
            return jsonify({'status': 'ok', 'session_key': key, 'session_doc': fsid})
        else:
            return jsonify({'status': 'ok', 'note': 'no-firebase'}), 200

    if action == 'return_start':
        # return list of active loans for this uid
        if firebase_admin._apps:
            try:
                if fs_client:
                    loans_q = fs_client.collection('loans').where('uid', '==', uid).where('returned', '==', False).stream()
                    loans = {doc.id: doc.to_dict() for doc in loans_q}
                    return jsonify({'status': 'ok', 'loans': loans}), 200
            except Exception as e:
                print('Firestore loans query failed:', e)
            try:
                ref = db.reference('/loans')
                loans = ref.order_by_child('uid').equal_to(uid).get() or {}
                return jsonify({'status': 'ok', 'loans': loans}), 200
            except Exception as e:
                print('Realtime loans query failed:', e)
                return jsonify({'status': 'ok', 'note': 'no-firebase'}), 200
        else:
            return jsonify({'status': 'ok', 'note': 'no-firebase'}), 200

    return jsonify({'status': 'ok'})


@app.route('/api/session/add_part', methods=['POST'])
def add_part_to_session():
    """Add a recognized part to a session. JSON: {session_key, part_id, qty}
    This appends to session.parts and returns the updated parts list.
    """
    j = request.get_json(force=True)
    session_key = j.get('session_key')
    part_id = j.get('part_id')
    qty = int(j.get('qty', 1))
    if not session_key or not part_id:
        return jsonify({'error': 'missing session_key or part_id'}), 400

    if not firebase_admin._apps:
        return jsonify({'status': 'ok', 'note': 'no-firebase', 'parts': []})

    # Try Firestore
    try:
        doc_ref = fs_client.collection('sessions').document(session_key)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'session not found'}), 404
        session = doc.to_dict()
        parts = session.get('parts', [])
        parts.append({'part_id': part_id, 'qty': qty, 'time': datetime.utcnow().isoformat()})
        doc_ref.update({'parts': parts})
        return jsonify({'status': 'ok', 'parts': parts})
    except Exception as e:
        print('Firestore session add_part failed:', e)
        # fallback to Realtime DB
        try:
            session_ref = db.reference('/sessions/' + session_key)
            session = session_ref.get()
            if not session:
                return jsonify({'error': 'session not found'}), 404
            parts = session.get('parts', [])
            parts.append({'part_id': part_id, 'qty': qty, 'time': datetime.utcnow().isoformat()})
            session_ref.update({'parts': parts})
            return jsonify({'status': 'ok', 'parts': parts})
        except Exception as e2:
            print('Realtime session add_part failed:', e2)
            return jsonify({'error': 'internal error'}), 500


@app.route('/api/session/finalize_borrow', methods=['POST'])
def finalize_borrow():
    """Finalize a borrow session: move session to loans and open door.
    JSON: {session_key, name (optional), nim (optional)}
    """
    j = request.get_json(force=True)
    session_key = j.get('session_key')
    name = j.get('name')
    nim = j.get('nim')
    if not session_key:
        return jsonify({'error': 'missing session_key'}), 400

    if not firebase_admin._apps:
        return jsonify({'status': 'ok', 'note': 'no-firebase'})

    # Try Firestore
    try:
        doc_ref = fs_client.collection('sessions').document(session_key)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'session not found'}), 404
        session = doc.to_dict()
        parts = session.get('parts', [])
        if not parts:
            return jsonify({'error': 'no parts scanned, cannot finalize'}), 400

        loan = {
            'uid': session.get('uid'),
            'name': name or '',
            'nim': nim or '',
            'parts': parts,
            'start_time': session.get('start_time'),
            'finalize_time': datetime.utcnow().isoformat(),
            'returned': False
        }
        loan_doc_ref = fs_client.collection('loans').add(loan)
        loan_key = loan_doc_ref[0].id if isinstance(loan_doc_ref, tuple) else (loan_doc_ref.id if hasattr(loan_doc_ref, 'id') else None)

        # mark session as finalized with loan_key
        doc_ref.update({'finalized': True, 'loan_key': loan_key})

        opened = open_door()
        return jsonify({'status': 'ok', 'loan_key': loan_key, 'door_opened': opened})
    except Exception as e:
        print('Firestore finalize_borrow failed:', e)
        # fallback to Realtime DB
        try:
            session_ref = db.reference('/sessions/' + session_key)
            session = session_ref.get()
            if not session:
                return jsonify({'error': 'session not found'}), 404
            parts = session.get('parts', [])
            if not parts:
                return jsonify({'error': 'no parts scanned, cannot finalize'}), 400
            loan = {
                'uid': session.get('uid'),
                'name': name or '',
                'nim': nim or '',
                'parts': parts,
                'start_time': session.get('start_time'),
                'finalize_time': datetime.utcnow().isoformat(),
                'returned': False
            }
            loans_ref = db.reference('/loans')
            loan_key = loans_ref.push(loan).key
            session_ref.update({'finalized': True, 'loan_key': loan_key})
            opened = open_door()
            return jsonify({'status': 'ok', 'loan_key': loan_key, 'door_opened': opened})
        except Exception as e2:
            print('Realtime finalize_borrow failed:', e2)
            return jsonify({'error': 'internal error'}), 500


@app.route('/api/session/finalize_return', methods=['POST'])
def finalize_return():
    """Finalize return for a loan. JSON: {loan_key, returned_parts: [{part_id, qty}, ...]}
    Verifies returned_parts cover required loan parts. Marks loan returned and opens door if OK.
    """
    j = request.get_json(force=True)
    loan_key = j.get('loan_key')
    returned_parts = j.get('returned_parts') or []
    if not loan_key:
        return jsonify({'error': 'missing loan_key'}), 400

    if not firebase_admin._apps:
        return jsonify({'status': 'ok', 'note': 'no-firebase'})

    # Try Firestore verification
    try:
        loan_doc = fs_client.collection('loans').document(loan_key).get()
        if not loan_doc.exists:
            return jsonify({'error': 'loan not found'}), 404
        loan = loan_doc.to_dict()
        loan_parts = loan.get('parts', [])

        # aggregate required parts
        req = {}
        for p in loan_parts:
            pid = p.get('part_id') or p.get('id')
            qty = int(p.get('qty', 1))
            req[pid] = req.get(pid, 0) + qty

        # aggregate returned parts provided
        ret = {}
        for p in returned_parts:
            pid = p.get('part_id') or p.get('id')
            qty = int(p.get('qty', 1))
            ret[pid] = ret.get(pid, 0) + qty

        # check if all required parts are returned with sufficient qty
        missing = []
        for pid, needed in req.items():
            if ret.get(pid, 0) < needed:
                missing.append({'part_id': pid, 'needed': needed, 'returned': ret.get(pid, 0)})

        if missing:
            return jsonify({'status': 'failed', 'reason': 'missing_parts', 'missing': missing}), 400

        # ok mark returned
        fs_client.collection('loans').document(loan_key).update({'returned': True, 'return_time': datetime.utcnow().isoformat()})
        opened = open_door()
        return jsonify({'status': 'ok', 'door_opened': opened})
    except Exception as e:
        print('Firestore finalize_return failed:', e)
        # fallback to simple Realtime DB mark
        try:
            loan_ref = db.reference('/loans/' + loan_key)
            loan = loan_ref.get()
            if not loan:
                return jsonify({'error': 'loan not found'}), 404
            loan_ref.update({'returned': True, 'return_time': datetime.utcnow().isoformat()})
            opened = open_door()
            return jsonify({'status': 'ok', 'door_opened': opened})
        except Exception as e2:
            print('Realtime finalize_return failed:', e2)
            return jsonify({'error': 'internal error'}), 500


@app.route('/api/sessions/for_uid', methods=['GET'])
def sessions_for_uid():
    uid = request.args.get('uid')
    if not uid:
        return jsonify({'error': 'missing uid'}), 400
    if not firebase_admin._apps:
        return jsonify({'status': 'ok', 'note': 'no-firebase', 'sessions': {}})
    try:
        sessions_q = fs_client.collection('sessions').where('uid', '==', uid).stream()
        sessions = {d.id: d.to_dict() for d in sessions_q}
        loans_q = fs_client.collection('loans').where('uid', '==', uid).stream()
        loans = {d.id: d.to_dict() for d in loans_q}
        return jsonify({'sessions': sessions, 'loans': loans})
    except Exception as e:
        print('Firestore sessions_for_uid failed:', e)
        try:
            sessions_ref = db.reference('/sessions')
            sessions = sessions_ref.order_by_child('uid').equal_to(uid).get() or {}
            loans_ref = db.reference('/loans')
            loans = loans_ref.order_by_child('uid').equal_to(uid).get() or {}
            return jsonify({'sessions': sessions, 'loans': loans})
        except Exception as e2:
            print('Realtime sessions_for_uid failed:', e2)
            return jsonify({'status': 'ok', 'note': 'no-firebase', 'sessions': {}})


@app.route('/api/stream')
def stream_video():
    def generate():
        while True:
            with camera_lock:
                frame = latest_frame.copy() if latest_frame is not None else None
            if frame is None:
                time.sleep(0.1)
                continue

            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.05)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/snapshot', methods=['GET'])
def snapshot_image():
    global latest_frame
    
    # Use latest frame from capture loop if available
    with camera_lock:
        frame = latest_frame.copy() if latest_frame is not None else None
    
    if frame is None:
        # Try direct capture as fallback
        cap = get_camera()
        if cap is None:
            return jsonify({'success': False, 'error': 'camera unavailable'}), 503
        ok, frame = cap.read()
        if not ok or frame is None:
            return jsonify({'success': False, 'error': 'failed to read camera frame'}), 500

    try:
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if buffer is None or len(buffer) == 0:
            return jsonify({'success': False, 'error': 'failed to encode frame'}), 500
        return Response(buffer.tobytes(), mimetype='image/jpeg')
    except Exception as e:
        print('Snapshot encoding error:', e)
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recognize', methods=['POST'])
def recognize():
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'no image'}), 400

    file = request.files['image']
    arr = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({'success': False, 'error': 'bad image'}), 400

    model = load_yolo_model()
    if model is not None:
        try:
            conf_threshold = float(os.getenv('YOLO_CONF_THRESHOLD', '0.25'))
            results = model(img, conf=conf_threshold, stream=False)
            detections = []
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    name = model.names[cls_id] if hasattr(model, 'names') else str(cls_id)
                    detections.append({
                        'name': name,
                        'confidence': round(conf, 4),
                        'bounding_box': {
                            'x1': round(float(xyxy[0]), 2),
                            'y1': round(float(xyxy[1]), 2),
                            'x2': round(float(xyxy[2]), 2),
                            'y2': round(float(xyxy[3]), 2)
                        }
                    })
            detections.sort(key=lambda item: item['confidence'], reverse=True)
            best_detection = detections[0] if detections else None
            return jsonify({
                'success': True,
                'source': 'yolo',
                'detections': detections,
                'best_detection': best_detection,
                'detected_name': best_detection['name'] if best_detection else None
            }), 200
        except Exception as exc:
            print('YOLO inference failed:', exc)

    # Fallback to template matching when YOLO model is unavailable.
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kp2, des2 = orb.detectAndCompute(gray, None)
    best = None
    best_matches = 0
    for t in templates:
        if t['des'] is None or des2 is None:
            continue
        matches = bf.match(t['des'], des2)
        matches = sorted(matches, key=lambda x: x.distance)
        good = [m for m in matches if m.distance < 60]
        if len(good) > best_matches:
            best_matches = len(good)
            best = t['id']
    print('Recognition result:', best, 'matches:', best_matches)
    if best and best_matches > 8:
        return jsonify({'success': True, 'source': 'template', 'part_id': best, 'matches': best_matches}), 200
    return jsonify({'success': True, 'source': 'template', 'part_id': None, 'matches': best_matches}), 200


@app.route('/api/door/open', methods=['POST'])
def door_open_proxy():
    payload = request.get_json(silent=True) or {}
    try:
        response = requests.post(
            f'{DOOR_CONTROLLER_URL}/api/door/open',
            json=payload,
            timeout=8
        )
        response.raise_for_status()
        body = response.json() if response.content else {}
        return jsonify({'success': True, **body}), 200
    except Exception as exc:
        print('Door controller proxy failed:', exc)
        return jsonify({'success': False, 'error': str(exc)}), 502


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
