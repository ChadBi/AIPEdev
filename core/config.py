import os
import yaml
from pathlib import Path
from typing import Any, Dict

# =============================================================================
# 配置文件加载模块
# =============================================================================

def _load_config() -> Dict[str, Any]:
    """从 config.yaml 文件加载配置"""
    config_path = Path(__file__).parent.parent / "config.yaml"
    
    if not config_path.exists():
        raise FileNotFoundError(
            f"配置文件不存在: {config_path}\n"
            "请在项目根目录创建 config.yaml 文件。"
        )
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        return config or {}
    except yaml.YAMLError as e:
        raise ValueError(f"配置文件格式错误: {e}")


# 全局配置字典
_CONFIG = _load_config()

# =============================================================================
# 安全配置
# =============================================================================
SECRET_KEY = _CONFIG.get("security", {}).get("secret_key", "change_this_in_production")
ALGORITHM = _CONFIG.get("security", {}).get("algorithm", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = _CONFIG.get("security", {}).get("access_token_expire_minutes", 1440)

# =============================================================================
# 数据库配置
# =============================================================================
DATABASE_URL = _CONFIG.get("database", {}).get("url", "mysql+pymysql://root:wyzy11001@localhost:3306/fastapi_db")

# =============================================================================
# AI 服务配置
# =============================================================================
USE_MOCK = _CONFIG.get("ai", {}).get("use_mock", False)
YOLO_MODEL_PATH = _CONFIG.get("ai", {}).get("yolo_model_path", "yolov8n-pose.pt")
YOLO_DEVICE = _CONFIG.get("ai", {}).get("yolo_device", "cpu")
SAMPLE_FPS = _CONFIG.get("ai", {}).get("sample_fps", 6)
YOLO_CONFIDENCE = _CONFIG.get("ai", {}).get("yolo_confidence", 0.35)
YOLO_IOU = _CONFIG.get("ai", {}).get("yolo_iou", 0.7)

# =============================================================================
# 评分配置
# =============================================================================
ENABLE_SEQUENCE_LOOP = _CONFIG.get("scoring", {}).get("enable_sequence_loop", True)
SEQUENCE_LOOP_THRESHOLD = _CONFIG.get("scoring", {}).get("loop_threshold", 1.5)

# =============================================================================
# 文件存储配置
# =============================================================================
UPLOAD_DIR = _CONFIG.get("file_storage", {}).get("upload_dir", "uploads/videos")
MAX_FILE_SIZE = _CONFIG.get("file_storage", {}).get("max_file_size", 524288000)

# =============================================================================
# 服务器配置
# =============================================================================
SERVER_HOST = _CONFIG.get("server", {}).get("host", "127.0.0.1")
SERVER_PORT = _CONFIG.get("server", {}).get("port", 8000)
LOG_LEVEL = _CONFIG.get("server", {}).get("log_level", "info")
