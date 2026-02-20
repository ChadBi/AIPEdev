# AI 体育教学系统 (AIPE)

基于 FastAPI + YOLOv8 Pose 的智能体育动作评估平台，提供视频姿态识别、关节角度评分和实时反馈功能。

## 核心特性

- **智能评分** - 基于 8 个关键关节的加权评分系统
- **实时识别** - YOLOv8-Pose 姿态检测，每秒 6 帧采样
- **详细反馈** - 帧级别、关节级别的评分数据和可视化
- **安全认证** - JWT + OAuth2 身份验证
- **现代前端** - React 18 + TypeScript + Vite

## 快速开始

```bash
# 1. 安装 Python 依赖 (Python >= 3.10)
pip install -r requirements.txt

# 2. 安装前端依赖
cd front && npm install

# 3. 配置数据库 (编辑 config.yaml)

# 4. 初始化数据库
python init_db.py

# 5. 启动服务
uvicorn main:app --reload     # 后端 (8000)
cd front && npm run dev       # 前端 (5173)
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| API 文档 | http://localhost:8000/docs |
| 健康检查 | http://localhost:8000/health |

## 项目结构

```
AIPEdev/
├── api/              # API 路由层
│   ├── auth.py       # 认证接口
│   ├── action.py     # 动作库
│   ├── video.py      # 视频管理
│   ├── score.py      # 评分接口
│   └── recognize.py  # 识别接口
├── core/             # 核心配置
│   ├── config.py     # 配置加载
│   ├── database.py   # 数据库
│   └── security.py   # 安全工具
├── crud/             # 数据访问层
├── models/           # ORM 模型
├── schemas/          # Pydantic 模式
├── services/         # 业务逻辑
│   ├── recognition_service.py  # YOLOv8 识别
│   └── score_service.py        # 评分算法
├── utils/            # 工具函数
├── docs/             # 详细文档
├── front/            # React 前端
│   ├── pages/        # 页面组件
│   └── components/   # 通用组件
├── config.yaml       # 配置文件
├── main.py           # 应用入口
└── requirements.txt  # Python 依赖
```

## API 概览

### 认证模块 `/auth`
- `POST /auth/register` - 用户注册
- `POST /auth/login` - OAuth2 登录
- `GET /auth/me` - 获取当前用户

### 动作库 `/actions`
- `POST /actions/create-from-video` - 从视频创建标准动作
- `GET /actions/` - 获取动作列表

### 视频管理 `/videos`
- `POST /videos/upload` - 上传视频
- `GET /videos/my-videos` - 获取我的视频

### 评分系统 `/scores`
- `POST /scores/` - 执行动作评分
- `GET /scores/history` - 查看评分历史

## 文档

更多内容请查看 [docs/](docs/) 目录：

| 文档 | 说明 |
|------|------|
| API.md | 详细 API 接口文档 |
| DEPLOYMENT.md | 部署指南 |
| PROJECT_SUMMARY.md | 项目总结 |
| QUICK_REFERENCE.md | 快速参考 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI + SQLAlchemy + MySQL |
| AI | YOLOv8 Pose + OpenCV |
| 前端 | React + TypeScript + Vite |
| 认证 | JWT + OAuth2 |

## License

MIT
