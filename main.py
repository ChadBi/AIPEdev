from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio
from api import auth, user, action, video, recognize, score, music, sync_config, action_music_sync
from api.websocket import router as ws_router
from core.config import UPLOAD_DIR
import os
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时预加载 YOLO 模型，启动后台批处理任务"""
    # 启动时预加载模型
    try:
        from services.recognition_service import _load_pose_model
        logger.info("开始预加载 YOLO 模型...")
        _load_pose_model()  # 强制执行第一次加载，初始化到缓存
        from services.recognition_service import is_pose_model_loaded
        if is_pose_model_loaded():
            logger.info("YOLO 模型预加载完成")
        else:
            logger.warning("YOLO 模型预加载可能失败，将在首次使用时加载")
    except Exception as e:
        logger.warning(f"YOLO 模型预加载失败: {e}")

    # 启动后台批处理处理器
    try:
        from services.background_recognition import _background_processor, start_background_processor
        start_background_processor()
        # 创建后台任务
        asyncio.create_task(_background_processor())
        logger.info("后台批处理处理器已启动")
    except Exception as e:
        logger.warning(f"后台批处理处理器启动失败: {e}")

    yield  # 应用运行

    # 关闭时的清理逻辑
    try:
        from services.background_recognition import stop_background_processor
        stop_background_processor()
        logger.info("后台批处理处理器已停止")
    except Exception as e:
        logger.error(f"停止后台批处理处理器失败: {e}")

    logger.info("应用关闭")

# 使用 lifespan 创建 FastAPI 应用实例
app = FastAPI(
    title="AI 体育教学后端系统",
    lifespan=lifespan
)

# ========= CORS 配置 =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001",
        "http://localhost:3002", "http://127.0.0.1:3002",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
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
