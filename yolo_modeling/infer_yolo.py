"""
Inference script that runs trained YOLOv11 model on images or a folder and prints JSON-like detections.
Usage:
python .\yolo_modeling\infer_yolo.py --weights runs/train/yolo11_experiment/weights/best.pt --source images/test.jpg --out out

Outputs: prints detections and saves visualized images to out/ folder.
"""
import argparse
import os
from ultralytics import YOLO
import cv2


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--weights', required=True, help='Path to trained weights (best.pt)')
    p.add_argument('--source', required=True, help='Image file or folder')
    p.add_argument('--out', default='yolo_output', help='Output folder for visualized images')
    p.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    return p.parse_args()


def ensure_out(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def main():
    args = parse_args()
    ensure_out(args.out)

    model = YOLO(args.weights)

    sources = []
    if os.path.isdir(args.source):
        for f in os.listdir(args.source):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                sources.append(os.path.join(args.source, f))
    else:
        sources = [args.source]

    for src in sources:
        results = model.predict(src, conf=args.conf, save=False)
        # results can be multiple; ultralytics returns list-like
        for i, res in enumerate(results):
            boxes = res.boxes
            img = cv2.imread(src)
            h, w = img.shape[:2]
            detections = []
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                name = model.names[cls_id] if hasattr(model, 'names') else str(cls_id)
                det = {
                    'nama_komponen': name,
                    'confidence': round(conf, 4),
                    'bounding_box': {
                        'x1': round(float(xyxy[0]), 2),
                        'y1': round(float(xyxy[1]), 2),
                        'x2': round(float(xyxy[2]), 2),
                        'y2': round(float(xyxy[3]), 2)
                    }
                }
                detections.append(det)
                # draw box
                x1, y1, x2, y2 = map(int, xyxy)
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 200, 0), 2)
                label = f"{name} {conf:.2f}"
                cv2.putText(img, label, (x1, max(15, y1-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)

            print(f"Source: {src}")
            print(detections)

            # save image
            out_path = os.path.join(args.out, os.path.basename(src))
            cv2.imwrite(out_path, img)
            print(f"Saved visualization to {out_path}")

if __name__ == '__main__':
    main()
