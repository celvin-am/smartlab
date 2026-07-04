YOLOv11 modeling pipeline for lab components (ESP32, Sensor PIR, Resistor)

Overview
--------
This folder contains helper files to train and run YOLOv11 using the Ultralytics package.

Files
-----
- `requirements.txt` - Python dependencies
- `data.yaml` - dataset manifest (edit paths as needed)
- `train_yolo.py` - training script using Ultralytics API
- `infer_yolo.py` - inference script that prints detections and saves visualizations

Dataset preparation (Roboflow)
-----------------------------
1. Create an Object Detection project in Roboflow.
2. Add classes: `ESP32`, `Sensor PIR`, `Resistor`.
3. Upload and label images (bounding boxes).
4. Export the dataset in `YOLO` / `Ultralytics` format.
5. Organize files locally as:

project_root/
  dataset/
    train/
      images/
      labels/
    valid/
      images/
      labels/
    test/
      images/
      labels/

6. Update `yolo_modeling/data.yaml` to point to your local `dataset` paths.

Install dependencies
--------------------
For CPU-only (example):

```powershell
python -m pip install -r yolo_modeling/requirements.txt
# install torch for your platform following https://pytorch.org/
```

Training
--------
Run training with:

```powershell
python .\yolo_modeling\train_yolo.py --model yolo11n.pt --data yolo_modeling/data.yaml --epochs 100 --imgsz 640 --batch 16
```

- `--model` can be `yolo11n.pt`, `yolo11s.pt`, `yolo11m.pt` depending on resources.
- Trained weights will be saved under `runs/train/<name>/weights/best.pt`.

Inference
---------
Run inference on a file or folder:

```powershell
python .\yolo_modeling\infer_yolo.py --weights runs/train/yolo11_experiment/weights/best.pt --source images/test.jpg --out yolo_out
```

Output: detections printed (name, confidence, bbox) and visualized images saved to `yolo_out/`.

Tips
----
- Start with smaller model (`yolo11n.pt`) and increase size if needed.
- Balance classes; if one class is rare, collect more images or use augmentation.
- Monitor mAP and per-class recall/precision.
- Use GPU for faster training; set appropriate `batch` and `imgsz`.

If you ingin, saya bisa:
- bantu generate skrip otomatis untuk mengunduh ekspor Roboflow
- bantu menulis notebook training dengan visualisasi learning curves
- bantu tuning hyperparameters (lr, augmentasi, scheduler)
