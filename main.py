from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import auth, user, action, video, recognize, score, music, sync_config, action_music_sync
from api.websocket import router as ws_router
from core.config import UPLOAD_DIR
import os
import logging

logger = logging.getLogger(__name__)

# 创建 FastAPI 应用实例
app = FastAPI(title="AI 体育教学后端系统")

@app.on_event("startup")
async def startup_event():
    """预加载 YOLO 模型，避免首次请求时卡顿"""
    try:
        from services.recognition_service import _load_pose_model
        _load_pose_model()
        logger.info("YOLO 模型已预加载完成")
    except Exception as e:
        logger.warning(f"YOLO 模型预加载失败（首次启动属正常）: {e}")

# ========= CORS 配置 =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========= 静态文件挂载 =========
# 使上传的视频可通过 http://localhost:8000/uploads/videos/xxx.mp4 访问
# 从配置文件读取上传目录
uploads_base_dir = os.path.dirname(UPLOAD_DIR)  # 从 "uploads/videos" 提取 "uploads"
app.mount("/uploads", StaticFiles(directory=uploads_base_dir), name="uploads")

# 注册各个模块的路由
app.include_router(auth.router, prefix="/auth", tags=["认证模块"])
app.include_router(user.router, prefix="/users", tags=["用户模块"])
app.include_router(action.router, prefix="/actions", tags=["动作模块"])
app.include_router(video.router, prefix="/videos", tags=["视频模块"])
app.include_router(music.router, prefix="/music", tags=["音乐模块"])
app.include_router(sync_config.router, prefix="/sync", tags=["同步配置模块"])
app.include_router(action_music_sync.router, prefix="/sync", tags=["动作音乐对齐模块"])
app.include_router(recognize.router, prefix="/recognize", tags=["识别模块"])
app.include_router(score.router, prefix="/scores", tags=["评分模块"])
app.include_router(ws_router, prefix="/ws", tags=["实时检测模块"])

# 健康检查端点
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AI 体育教学系统运行正常"}
