import json
import os
from pathlib import Path
import re


def labelstudio_kps_to_yolo_txt(json_path, output_label_dir, class_name="person", keypoint_order=None):
    """
    适配你的 JSON 格式：从 data.image 的 URL 中提取 frame_4169.jpg 这类文件名，生成对应 TXT
    """
    # 创建输出目录
    os.makedirs(output_label_dir, exist_ok=True)

    # 1. 读取 JSON 文件
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误：未找到 JSON 文件 {json_path}")
        return
    except json.JSONDecodeError:
        print(f"错误：{json_path} 不是合法的 JSON 文件")
        return

    # 校验 JSON 格式
    if not isinstance(data, list):
        print("错误：JSON 根节点不是列表！")
        return

    # 2. 定义关键点顺序（匹配你的 pose 标注）
    if keypoint_order is None:
        # 适配 YOLOv8-pose 标准关键点顺序（可根据你的实际标注调整）
        keypoint_order = [
            "nose", "left_eye", "right_eye", "left_ear", "right_ear",
            "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
            "left_wrist", "right_wrist", "left_hip", "right_hip",
            "left_knee", "right_knee", "left_ankle", "right_ankle"
        ]
    print("✅ 关键点顺序（YOLOv8-pose 标准）：")
    for idx, kp_name in enumerate(keypoint_order):
        print(f"  {idx + 1}. {kp_name}")

    # 类别索引（默认 0 代表 person）
    class_idx = 0

    # 3. 遍历每个标注项，精准提取文件名并生成 TXT
    for img_anno in data:
        # ====================== 核心：从 data.image URL 提取 frame_xxx.jpg ======================
        # 提取 data 字段中的 image URL
        data_field = img_anno.get('data', {})
        image_url = data_field.get('image', '')

        # 从 URL 中提取文件名（如 http://xxx/frame_4169.jpg → frame_4169.jpg）
        # 方法1：用 Path 提取（兼容 / 分隔的 URL）
        img_filename = Path(image_url).name
        # 兜底：若 Path 提取失败，用正则匹配 frame_数字.jpg 格式
        if not img_filename.startswith('frame_'):
            match = re.search(r'frame_\d+\.(jpg|png|jpeg)', image_url)
            if match:
                img_filename = match.group(0)
            else:
                # 终极兜底：用 task ID 生成（你的 JSON 中 task=510）
                task_id = img_anno.get('task', f"img_{os.urandom(4).hex()}")
                img_filename = f"frame_{task_id}.jpg"

        # 生成 TXT 文件名（frame_4169.jpg → frame_4169.txt）
        img_file_stem = Path(img_filename).stem
        txt_filename = f"{img_file_stem}.txt"
        txt_path = os.path.join(output_label_dir, txt_filename)

        # ====================== 提取关键点信息 ======================
        kps_dict = {}
        img_width = 3840  # 你的 JSON 中 original_width
        img_height = 2160  # 你的 JSON 中 original_height

        # 遍历 annotations → result 提取关键点
        annotations = img_anno.get('annotations', [])
        for anno in annotations:
            results = anno.get('result', [])
            for res in results:
                # 提取关键点标签和坐标
                value = res.get('value', {})
                kp_labels = value.get('keypointlabels', [])
                if len(kp_labels) == 0:
                    continue
                kp_name = kp_labels[0]  # 如 "right_ankle"

                # 提取 x/y 百分比，转为 0~1 归一化值
                kp_x = value.get('x', 0) / 100.0
                kp_y = value.get('y', 0) / 100.0

                # 边界校验（防止超出 0~1 范围）
                kp_x = max(0.0, min(1.0, kp_x))
                kp_y = max(0.0, min(1.0, kp_y))

                kps_dict[kp_name] = (kp_x, kp_y)

        # ====================== 按顺序整理关键点坐标 ======================
        kps_coords = []
        for kp_name in keypoint_order:
            if kp_name in kps_dict:
                kps_coords.extend(kps_dict[kp_name])
            else:
                # 缺失的关键点用 -1 -1 标记（YOLOv8 标准）
                kps_coords.extend([-1.0, -1.0])

        # ====================== 生成 YOLOv8 关键点格式 ======================
        # 格式：类别 中心点x 中心点y 宽 高 关键点1x 关键点1y ... 关键点nx 关键点ny
        # 无目标框时，用 0.5 0.5 1.0 1.0 填充（覆盖整张图）
        yolo_line = [
            str(class_idx),
            "0.5",  # 中心点x
            "0.5",  # 中心点y
            "1.0",  # 宽度
            "1.0",  # 高度
        ]
        # 添加关键点坐标（保留 6 位小数）
        yolo_line.extend([f"{coord:.6f}" for coord in kps_coords])
        yolo_line = " ".join(yolo_line) + "\n"

        # ====================== 写入 TXT 文件 ======================
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(yolo_line)

        print(
            f"✅ 生成成功：{txt_filename} → 对应图片：{img_filename} → 有效关键点：{len([k for k in kps_coords if k != -1.0]) // 2}")

    print(f"\n📌 转换完成！所有 TXT 文件已保存至：{output_label_dir}")
    print(f"🔑 关键信息：")
    print(f"   1. TXT 文件名已精准匹配：frame_4169.jpg → frame_4169.txt")
    print(f"   2. 关键点顺序适配 YOLOv8-pose 标准，共 {len(keypoint_order)} 个关键点")
    print(f"   3. 缺失关键点标记为 -1 -1，符合 YOLOv8 训练要求")


# ====================== 你的配置（直接修改这里！）======================
if __name__ == "__main__":
    # 1. 你的 JSON 文件路径（必填）
    JSON_FILE_PATH = r"E:\PEYOLO\image_json\6.json"
    # 2. TXT 输出目录（必填）
    OUTPUT_LABEL_DIR = r"E:\data\labels\train"
    # 3. 关键点顺序（适配 YOLOv8-pose，可根据你的标注增删）
    KEYPOINT_ORDER = [
        "nose", "left_eye", "right_eye", "left_ear", "right_ear",
        "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
        "left_wrist", "right_wrist", "left_hip", "right_hip",
        "left_knee", "right_knee", "left_ankle", "right_ankle"
    ]
    # 4. 类别名称（默认 person，索引 0）
    CLASS_NAME = "person"

    # 执行转换
    labelstudio_kps_to_yolo_txt(
        json_path=JSON_FILE_PATH,
        output_label_dir=OUTPUT_LABEL_DIR,
        class_name=CLASS_NAME,
        keypoint_order=KEYPOINT_ORDER
    )