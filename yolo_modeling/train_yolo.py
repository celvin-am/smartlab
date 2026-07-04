"""
Training script for YOLOv11 (Ultralytics)
Usage examples (PowerShell):
python .\yolo_modeling\train_yolo.py --model yolo11n.pt --data yolo_modeling/data.yaml --epochs 100 --imgsz 640 --batch 16

Note: install requirements first: pip install -r yolo_modeling/requirements.txt
"""
import argparse
from ultralytics import YOLO

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--model', default='yolo11n.pt', help='Base model checkpoint (yolo11n.pt, yolo11s.pt, ... )')
    p.add_argument('--data', default='yolo_modeling/data.yaml', help='Path to data.yaml')
    p.add_argument('--epochs', type=int, default=100)
    p.add_argument('--imgsz', type=int, default=640)
    p.add_argument('--batch', type=int, default=16)
    p.add_argument('--project', default='runs/train', help='Project folder')
    p.add_argument('--name', default='yolo11_experiment', help='Experiment name')
    return p.parse_args()


def main():
    args = parse_args()
    print(f"Training model {args.model} on {args.data} for {args.epochs} epochs")

    model = YOLO(args.model)

    # Ultralytics train API
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=args.project,
        name=args.name,
        exist_ok=True
    )

if __name__ == '__main__':
    main()
