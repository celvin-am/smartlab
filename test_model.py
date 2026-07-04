import os
from ultralytics import YOLO

# Cek path
path = os.path.join(os.getcwd(), 'models', 'best.pt')
print(f'Mencari di: {path}')

# Cek apakah file ada
if os.path.exists(path):
    print('File ada? YA')
    try:
        model = YOLO(path)
        print('Model berhasil dimuat!')
    except Exception as e:
        print(f'Gagal memuat model: {e}')
else:
    print('File ada? TIDAK (Pastikan file best.pt ada di folder models)')
