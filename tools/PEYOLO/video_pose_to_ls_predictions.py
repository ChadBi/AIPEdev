import json
import uuid
from pathlib import Path

import cv2
from ultralytics import YOLO

IMAGE_NAME = "image"
KPS_NAME   = "kps"

COCO17 = [
    "nose",
    "left_eye", "right_eye",
    "left_ear", "right_ear",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
]

def main():
    frames_dir = Path(r"E:\PEYOLO\image") # 图片地址
    model_path = "yolov8n-pose.pt" # 模型配置
    # 可修改模型：n , s , m , l , x改下v8的后缀就行，模型大小和精度依次递增
    out_json = "labelstudio_tasks_with_predictions.json" # 输出文件名字

    conf = 0.35
    iou = 0.7
    imgsz = 640
    device = "cpu"
    fps = 6          # 抽帧 fps
    keep_top1 = False   # True = 每帧只保留一个人

    model = YOLO(model_path)

    tasks = []
    img_paths = sorted(frames_dir.glob("*.jpg"))

    for idx, img_path in enumerate(img_paths, start=1):
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]

        BASE_URL = "http://127.0.0.1:9000"  # 静态服务地址
        rel = img_path.resolve().as_posix().replace("E:/PEYOLO", "")
        rel = rel.lstrip("/")
        image_uri = f"{BASE_URL}/{rel}"

        r = model.predict(
            source=str(img_path),
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            device=device,
            verbose=False
        )[0]

        results = []

        if r.keypoints is not None and r.boxes is not None:
            scores = r.boxes.conf.cpu().numpy()
            kpts = r.keypoints.xy.cpu().numpy()  # (N,17,2)

            person_ids = range(len(scores))
            if keep_top1 and len(scores) > 0:
                person_ids = [int(scores.argmax())]

            for pid in person_ids:
                score = float(scores[pid])

                for k, label in enumerate(COCO17):
                    x_px, y_px = kpts[pid][k]

                    if not (0 <= x_px <= w and 0 <= y_px <= h):
                        continue

                    x_pct = float(x_px) / float(w) * 100.0
                    y_pct = float(y_px) / float(h) * 100.0


                    results.append({
                        "id": uuid.uuid4().hex[:8],
                        "type": "keypointlabels",
                        "from_name": KPS_NAME,
                        "to_name": IMAGE_NAME,
                        "original_width": w,
                        "original_height": h,
                        "image_rotation": 0,
                        "value": {
                            "x": x_pct,
                            "y": y_pct,
                            "width": 1.0,
                            "keypointlabels": [label]
                        },
                        "score": score
                    })

        tasks.append({
            "data": {
                "image": image_uri,
                "frame_index": idx,
                "timestamp_sec": (idx - 1) / fps
            },
            "predictions": [{
                "model_version": "yolov8n-pose",
                "score": 0.5,
                "result": results
            }]
        })

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)

    print(f"生成完成：{out_json}")
    print(f"帧数：{len(tasks)}")

if __name__ == "__main__":
    main()