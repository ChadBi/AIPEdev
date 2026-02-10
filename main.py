from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import auth, user, action, video, recognize, score
from core.config import UPLOAD_DIR
import os

# 创建 FastAPI 应用实例
app = FastAPI(title="AI 体育教学后端系统")

# ========= CORS 配置 =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
app.include_router(recognize.router, prefix="/recognize", tags=["识别模块"])
app.include_router(score.router, prefix="/scores", tags=["评分模块"])
