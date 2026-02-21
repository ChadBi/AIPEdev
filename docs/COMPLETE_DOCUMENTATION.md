# AIPE 智能体育动作评估系统 - 完整文档

> 基于 FastAPI + YOLOv8 Pose 的智能体育动作评估平台
> 最后更新：2026-02-21

---

## 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [项目结构](#项目结构)
4. [技术架构](#技术架构)
5. [数据库设计](#数据库设计)
6. [API 接口文档](#api 接口文档)
7. [核心功能模块](#核心功能模块)
8. [前端页面说明](#前端页面说明)
9. [配置文件说明](#配置文件说明)
10. [开发指南](#开发指南)
11. [故障排查](#故障排查)
12. [FAQ](#faq)

---

## 项目概述

### 功能特性

- **智能评分** - 基于 8 个关键关节（膝、髋、肘、肩）的加权评分系统
- **实时识别** - YOLOv8-Pose 姿态检测，每秒 6 帧采样
- **实时检测** - WebSocket 实时推送，摄像头画面骨架叠加显示
- **音乐对齐** - 动作视频与背景音乐的时间同步配置
- **详细反馈** - 帧级别、关节级别的评分数据和 AI 指导建议
- **安全认证** - JWT + OAuth2 身份验证
- **现代前端** - React 18 + TypeScript + Vite

### 核心评分算法

评分基于关节角度差异计算：
- 扩展关节评估范围：膝、髋、肘、肩（左右共 8 个关节）
- 引入关节权重系统：下肢关节权重 (1.3-1.5) > 上肢关节权重 (1.0-1.2)
- 角度差异惩罚系数：每 1.2 度扣 1 分
- 置信度阈值过滤：0.3 以下的关键点不参与评分

---

## 快速开始

### 环境要求

- Python >= 3.10
- Node.js >= 18
- MySQL >= 8.0
- CUDA (可选，用于 GPU 加速)

### 安装步骤

```bash
# 1. 克隆项目
cd E:\python\AIPE\AIPEdev

# 2. 创建虚拟环境并安装 Python 依赖
uv venv
uv sync

# 3. 安装前端依赖
cd front
npm install

# 4. 配置数据库 (编辑 config.yaml)
# 修改 database.url 为实际的 MySQL 连接字符串

# 5. 初始化数据库
uv run python init_db.py

# 6. 启动后端服务
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 7. 启动前端开发服务器
cd front
npm run dev
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | React 前端应用 |
| API 文档 | http://localhost:8000/docs | Swagger UI |
| 健康检查 | http://localhost:8000/health | 服务状态检查 |

---

## 项目结构

```
AIPEdev/
├── api/                    # API 路由层 (Controller)
│   ├── auth.py            # 认证接口 (/auth)
│   ├── user.py            # 用户接口 (/users)
│   ├── action.py          # 动作库接口 (/actions)
│   ├── video.py           # 视频管理接口 (/videos)
│   ├── music.py           # 音乐管理接口 (/music)
│   ├── score.py           # 评分接口 (/scores)
│   ├── recognize.py       # 识别接口 (/recognize)
│   ├── sync_config.py     # 同步配置接口 (/sync)
│   ├── action_music_sync.py # 动作音乐对齐接口 (/sync)
│   └── websocket.py       # WebSocket 实时检测 (/ws)
│
├── core/                   # 核心配置
│   ├── config.py          # 配置文件加载 (config.yaml)
│   ├── database.py        # 数据库连接和会话管理
│   ├── deps.py            # 依赖注入 (JWT 认证)
│   └── security.py        # 密码加密、JWT 生成
│
├── crud/                   # 数据访问层 (Repository)
│   ├── user.py            # 用户 CRUD 操作
│   ├── action.py          # 动作 CRUD 操作
│   ├── video.py           # 视频 CRUD 操作
│   ├── music.py           # 音乐 CRUD 操作
│   ├── score.py           # 评分 CRUD 操作
│   ├── sync_config.py     # 同步配置 CRUD
│   └── action_music_sync.py # 动作音乐对齐 CRUD
│
├── models/                 # ORM 模型 (SQLAlchemy)
│   ├── user.py            # 用户模型
│   ├── action.py          # 标准动作模型
│   ├── video.py           # 视频记录模型
│   ├── music.py           # 音乐模型
│   ├── score.py           # 评分记录模型
│   ├── action_record.py   # 动作记录模型
│   ├── sync_config.py     # 同步配置模型
│   └── action_music_sync.py # 动作音乐对齐模型
│
├── schemas/                # Pydantic 模式 (DTO)
│   ├── user.py            # 用户请求/响应模式
│   ├── action.py          # 动作请求/响应模式
│   ├── video.py           # 视频请求/响应模式
│   ├── music.py           # 音乐请求/响应模式
│   ├── score.py           # 评分请求/响应模式
│   ├── sync_config.py     # 同步配置模式
│   └── recognition.py     # 识别响应模式
│
├── services/               # 业务逻辑层
│   ├── auth_service.py    # 认证服务
│   ├── action_service.py  # 动作服务
│   ├── video_service.py   # 视频服务
│   ├── recognition_service.py  # YOLO 识别服务
│   └── score_service.py   # 评分算法服务
│
├── utils/                  # 工具函数
│   ├── file.py            # 文件处理工具
│   └── json_handler.py    # JSON 处理工具
│
├── migrations/             # 数据库迁移脚本
│
├── front/                  # React 前端
│   ├── pages/             # 页面组件
│   │   ├── Login.tsx              # 登录页
│   │   ├── Register.tsx           # 注册页
│   │   ├── Dashboard.tsx          # 仪表板
│   │   ├── ActionLibrary.tsx      # 动作库
│   │   ├── ActionDetail.tsx       # 动作详情
│   │   ├── ActionForm.tsx         # 动作表单
│   │   ├── VideoLibrary.tsx       # 视频库
│   │   ├── VideoUpload.tsx        # 视频上传
│   │   ├── MusicLibrary.tsx       # 音乐库
│   │   ├── Scoring.tsx            # 开始评分
│   │   ├── ScoreResult.tsx        # 评分结果
│   │   ├── ScoreHistory.tsx       # 评分历史
│   │   ├── LiveScoring.tsx        # 实时检测
│   │   ├── SyncAlign.tsx          # 音乐对齐
│   │   ├── UserProfile.tsx        # 用户资料
│   │   └── Register.tsx           # 用户注册
│   │
│   ├── components/        # 通用组件
│   │   ├── Layout.tsx             # 布局组件
│   │   ├── CameraSelector.tsx     # 摄像头选择
│   │   └── LiveVideoPanel.tsx     # 实时视频面板
│   │
│   ├── api/               # API 客户端
│   │   ├── api.ts                 # 主 API 客户端
│   │   ├── api/music.ts           # 音乐 API
│   │   └── api/sync.ts            # 同步 API
│   │
│   ├── types.ts           # TypeScript 类型定义
│   ├── App.tsx            # 应用入口
│   └── main.tsx           # React 入口
│
├── docs/                   # 文档目录
├── uploads/                # 上传文件存储
├── config.yaml             # 配置文件
├── main.py                 # FastAPI 应用入口
├── init_db.py              # 数据库初始化脚本
└── requirements.txt        # Python 依赖清单
```

---

## 技术架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                               │
│  React 18 + TypeScript + Vite + TailwindCSS                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 登录注册 │ │ 动作管理 │ │ 视频管理 │ │ 评分系统 │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         API 层                               │
│  FastAPI + Swagger UI (OpenAPI 3.0)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ /auth   │ │ /actions│ │ /videos │ │ /scores │          │
│  │ /users  │ │ /music  │ │ /sync   │ │ /ws     │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 依赖注入
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       服务层                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ recognition_svc │  │   score_svc     │                  │
│  │  - YOLOv8 Pose  │  │  - 角度计算     │                  │
│  │  - 抽帧采样     │  │  - 权重评分     │                  │
│  │  - 关键点提取   │  │  - 反馈生成     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ ORM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       数据层                                 │
│  SQLAlchemy + MySQL 8.0                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  users  │ │ actions │ │ videos  │ │ scores  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

1. **评分流程**:
   ```
   用户上传视频 → API 接收请求 → 识别服务处理视频 → 评分算法对比 → 保存结果 → 返回响应
   ```

2. **实时检测流程**:
   ```
   客户端 WebSocket 连接 → 每 200ms 发送一帧 → 服务端识别关键点 →
   对比标准动作 → 推送评分 → 客户端显示骨架和分数
   ```

---

## 数据库设计

### 表结构

#### users (用户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| username | VARCHAR(50) | 用户名 (唯一) |
| hashed_password | VARCHAR(255) | 加密密码 |
| role | VARCHAR(20) | 角色 (默认 user) |

#### actions (标准动作表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 动作名称 |
| description | VARCHAR(255) | 动作描述 |
| keypoints | JSON | 标准关键点序列 |
| video_path | VARCHAR(500) | 标准视频路径 |
| music_id | INT | 绑定音乐 ID |
| sync_offset_ms | INT | 音乐偏移 (毫秒) |
| is_aligned | BOOLEAN | 是否已对齐 |
| created_at | DATETIME | 创建时间 |

#### videos (视频表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | INT | 用户 ID |
| music_id | INT | 音乐 ID (可选) |
| file_path | VARCHAR(255) | 文件路径 |
| fps | INT | 帧率 |
| total_frames | INT | 总帧数 |
| sync_config_id | INT | 同步配置 ID |
| created_at | DATETIME | 上传时间 |

#### music (音乐表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(255) | 音乐名称 |
| file_path | VARCHAR(512) | 文件路径 |
| duration_seconds | FLOAT | 时长 (秒) |
| file_size | INT | 文件大小 (字节) |
| is_default | BOOLEAN | 是否默认 |
| uploaded_by | INT | 上传者 ID |
| created_at | DATETIME | 上传时间 |
| updated_at | DATETIME | 更新时间 |

#### score_records (评分记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | INT | 用户 ID |
| action_id | INT | 动作 ID |
| video_id | INT | 视频 ID |
| student_video_delay | FLOAT | 延迟 (秒) |
| total_score | FLOAT | 总分 (0-100) |
| joint_scores | JSON | 关节得分 |
| frame_scores | JSON | 帧级得分 |
| feedback | JSON | AI 反馈 |
| created_at | DATETIME | 创建时间 |

#### action_music_sync (动作音乐对齐表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| action_id | INT | 动作 ID |
| music_id | INT | 音乐 ID |
| sync_offset_ms | INT | 偏移 (毫秒) |
| is_aligned | BOOLEAN | 是否已对齐 |
| alignment_note | TEXT | 对齐备注 |
| created_by | INT | 创建者 ID |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 关系图

```
users (1) ──────< videos (N)
users (1) ──────< score_records (N)
users (1) ──────< music (N)

actions (1) ────< score_records (N)
videos (1) ─────< score_records (N)

actions (1) ────< action_music_sync (N)
music (1) ──────< action_music_sync (N)
music (1) ──────< videos (N)
```

---

## API 接口文档

### 认证模块 `/auth`

#### POST /auth/register
用户注册
```json
// Request
{ "username": "testuser", "password": "password123" }

// Response
{ "id": 1, "username": "testuser" }
```

#### POST /auth/login
OAuth2 登录
```
// Request (Form)
username: testuser
password: password123

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### 用户模块 `/users`

#### GET /users/me
获取当前用户信息
```json
// Response
{
  "id": 1,
  "username": "testuser",
  "role": "user"
}
```

### 动作模块 `/actions`

#### GET /actions/
获取动作列表
```json
// Response
[
  {
    "id": 1,
    "name": "深蹲",
    "description": "标准深蹲动作",
    "video_path": "uploads/videos/squat.mp4",
    "is_aligned": true
  }
]
```

#### POST /actions/create-from-video
从视频创建标准动作
```json
// Request (Form)
name: "深蹲"
description: "标准深蹲动作"
video: <video_file>
```

### 视频模块 `/videos`

#### POST /videos/upload
上传视频
```json
// Request (Form)
file: <video_file>

// Response
{
  "id": 1,
  "file_path": "uploads/videos/xxx.mp4",
  "fps": 30,
  "total_frames": 900
}
```

#### GET /videos/me
获取我的视频列表

### 音乐模块 `/music`

#### POST /music/upload
上传音乐

#### GET /music/
获取音乐列表

### 评分模块 `/scores`

#### POST /scores/
执行评分
```
// Request
POST /scores/?action_id=1&video_id=2&student_video_delay=0.5

// Response
{
  "score_id": 1,
  "total_score": 85.5,
  "joint_scores": {
    "left_knee": 88.0,
    "right_knee": 90.0,
    "left_elbow": 82.0,
    "right_elbow": 85.0,
    "left_shoulder": 87.0,
    "right_shoulder": 86.0,
    "left_hip": 84.0,
    "right_hip": 83.0
  },
  "frame_scores": [
    {"frame_index": 0, "score": 85.5, "timestamp": 0.0},
    ...
  ],
  "feedback": [
    "✅ 优秀：右膝 - 动作标准，继续努力",
    "⚠️ 一般：左肘 - 动作偏离标准，需要改进"
  ]
}
```

#### GET /scores/history
获取评分历史

#### GET /scores/{score_id}
获取评分详情

### 实时检测 `/ws`

#### WebSocket /ws/live/action/{action_id}
实时动作检测
```javascript
// 客户端发送
ws.send(JSON.stringify({
  type: "frame",
  data: {
    image_base64: "data:image/jpeg;base64,/9j/...",
    elapsed_ms: 1000
  }
}));

// 服务端推送
{
  "type": "score",
  "data": {
    "current_score": 85.5,
    "average_score": 82.3,
    "keypoints": {...},
    "standard_keypoints": {...}
  }
}
```

### 同步配置 `/sync`

#### GET /sync/action/{action_id}/music
获取动作的音乐列表

#### POST /sync/action/{action_id}/align
保存动作音乐对齐配置

---

## 核心功能模块

### 1. 姿态识别服务 (recognition_service.py)

**功能**: 使用 YOLOv8-Pose 进行视频/图片姿态识别

**核心函数**:
- `recognize_video(video_path)`: 视频关键点提取
- `recognize_frame(frame)`: 单帧关键点提取
- `recognize_frame_base64(frame_base64)`: Base64 图片识别
- `get_video_metadata(video_path)`: 获取视频元数据

**配置参数**:
```yaml
ai:
  use_mock: false              # 是否使用 Mock 数据
  yolo_model_path: "yolov8n-pose.pt"  # 模型路径
  yolo_device: "cuda:0"        # 推理设备
  sample_fps: 6                # 采样率 (每秒帧数)
  yolo_confidence: 0.35        # 置信度阈值
  yolo_iou: 0.7                # NMS IOU 阈值
```

### 2. 评分算法服务 (score_service.py)

**功能**: 基于关节角度差异的动作评分

**核心函数**:
- `score_action_by_angle(standard_action, user_action)`: 主评分函数

**评分流程**:
1. 对齐标准动作序列和用户动作序列
2. 遍历每一帧，计算 8 个关节的角度差异
3. 应用权重和惩罚系数计算帧级分数
4. 累积得到关节级分数和总分
5. 生成 AI 反馈建议

**关节权重表**:
| 关节 | 权重 | 分组 |
|------|------|------|
| left_knee | 1.5 | lower_body |
| right_knee | 1.5 | lower_body |
| left_hip | 1.3 | lower_body |
| right_hip | 1.3 | lower_body |
| left_shoulder | 1.2 | upper_body |
| right_shoulder | 1.2 | upper_body |
| left_elbow | 1.0 | upper_body |
| right_elbow | 1.0 | upper_body |

### 3. 实时检测服务 (websocket.py)

**功能**: WebSocket 实时姿态识别和评分推送

**消息类型**:
- `frame`: 客户端发送图片帧
- `keypoints`: 客户端发送关键点数据
- `score`: 服务端推送评分结果
- `ping/pong`: 心跳检测
- `error`: 错误通知

**通信流程**:
```
客户端                      服务端
  │                          │
  │──── connect ────────────▶│
  │◀──── status ─────────────│
  │                          │
  │──── frame (200ms) ──────▶│
  │◀──── score ──────────────│
  │                          │
  │──── ping ───────────────▶│
  │◀──── pong ───────────────│
```

### 4. 音乐对齐服务

**功能**: 配置标准动作视频与背景音乐的同步

**关键概念**:
- `sync_offset_ms`: 音乐相对于视频的偏移 (毫秒)
  - 正值：音乐晚播放 (视频早)
  - 负值：音乐早播放 (视频晚)

**使用场景**:
- 实时检测时自动播放同步的音乐
- 创建健美操等需要音乐配合的动作

---

## 前端页面说明

### 页面列表

| 路由 | 组件 | 功能 |
|------|------|------|
| `/login` | Login.tsx | 用户登录 |
| `/register` | Register.tsx | 用户注册 |
| `/` | Dashboard.tsx | 仪表板/首页 |
| `/actions` | ActionLibrary.tsx | 动作库列表 |
| `/actions/:id` | ActionDetail.tsx | 动作详情 |
| `/actions/create` | ActionForm.tsx | 创建/编辑动作 |
| `/videos` | VideoLibrary.tsx | 视频库 |
| `/videos/upload` | VideoUpload.tsx | 上传视频 |
| `/music` | MusicLibrary.tsx | 音乐库 |
| `/scores` | Scoring.tsx | 开始评分 (4 步流程) |
| `/scores/result/:id` | ScoreResult.tsx | 评分结果详情 |
| `/scores/history` | ScoreHistory.tsx | 评分历史 |
| `/scores/live` | LiveScoring.tsx | 实时检测 |
| `/sync/align` | SyncAlign.tsx | 音乐对齐 |
| `/profile` | UserProfile.tsx | 用户资料 |

### 核心页面说明

#### 1. LiveScoring.tsx (实时检测页)

**功能**:
- 选择标准动作和音乐
- 摄像头实时画面采集
- WebSocket 连接推送帧到服务端
- 接收并显示实时评分
- 骨架叠加显示

**状态管理**:
```typescript
const [actions, setActions] = useState<Action[]>();
const [selectedActionId, setSelectedActionId] = useState<number>();
const [selectedMusicId, setSelectedMusicId] = useState<number>();
const [isPlaying, setIsPlaying] = useState(false);
const [wsConnected, setWsConnected] = useState(false);
const [stats, setStats] = useState<LiveStats>();
const [keypoints, setKeypoints] = useState<Keypoints>();
```

#### 2. ScoreResult.tsx (评分结果页)

**功能**:
- 显示总分和等级
- 双视频对照播放 (标准 vs 用户)
- 时间轴分数图表
- 关节得分柱状图
- AI 反馈建议

**视频同步**:
- 根据 `student_video_delay` 自动同步两个视频
- 支持播放/暂停/拖拽进度

#### 3. Scoring.tsx (开始评分页)

**功能**: 4 步评分流程
1. 选择标准动作
2. 选择练习视频
3. 调整时间同步
4. 执行 AI 评分

#### 4. SyncAlign.tsx (音乐对齐页)

**功能**:
- 选择动作和音乐
- 对照播放视频和音乐
- 调整偏移量 (滑块)
- 保存对齐配置

---

## 配置文件说明

### config.yaml

```yaml
# 安全配置
security:
  secret_key: "change_this_in_production"  # JWT 密钥
  algorithm: "HS256"                        # 签名算法
  access_token_expire_minutes: 1440         # Token 过期时间 (分钟)

# 数据库配置
database:
  url: "mysql+pymysql://root:password@localhost:3307/aipe_db"

# AI 服务配置
ai:
  use_mock: false              # Mock 模式
  yolo_model_path: "yolov8n-pose.pt"  # 模型路径
  yolo_device: "cuda:0"        # 推理设备
  sample_fps: 6                # 采样率
  yolo_confidence: 0.35        # 置信度阈值
  yolo_iou: 0.7                # NMS 阈值

# 评分配置
scoring:
  enable_sequence_loop: false  # 启用标准动作循环
  loop_threshold: 1.5          # 循环触发阈值

# 文件存储配置
file_storage:
  upload_dir: "uploads/videos"
  allowed_video_extensions: [".mp4", ".avi", ".mov", ".mkv", ".flv"]
  max_file_size: 524288000     # 500MB

# 服务器配置
server:
  host: "127.0.0.1"
  port: 8000
  reload: true
  log_level: "info"
```

---

## 开发指南

### 添加新的 API 端点

1. 在对应模块的 `api/xxx.py` 添加路由
2. 定义 Pydantic Schema (`schemas/xxx.py`)
3. 编写业务逻辑 (`services/xxx.py`)
4. 实现 CRUD 操作 (`crud/xxx.py`)

```python
# api/example.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db

router = APIRouter()

@router.get("/example")
def get_example(db: Session = Depends(get_db)):
    return {"message": "Hello"}
```

### 添加新的数据库表

1. 创建 Model (`models/xxx.py`)
2. 创建 Schema (`schemas/xxx.py`)
3. 创建 CRUD (`crud/xxx.py`)
4. 运行迁移或重建表

```python
# models/example.py
from sqlalchemy import Column, Integer, String
from core.database import Base

class Example(Base):
    __tablename__ = "examples"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
```

### 前端开发

#### 添加新页面

1. 在 `front/pages/` 创建 `.tsx` 文件
2. 在 `App.tsx` 添加路由
3. 在导航组件添加链接

#### API 调用

```typescript
// api/example.ts
import api from './api';

export function getExample() {
  return api.get('/example');
}

// pages/Example.tsx
const response = await getExample();
console.log(response.data);
```

---

## 故障排查

### 常见问题

#### 1. YOLO 模型加载失败

**症状**: 评分时返回错误或超时
**解决**:
```bash
# 检查模型文件是否存在
ls yolov8n-pose.pt

# 重新下载模型
uv run python -c "from ultralytics import YOLO; YOLO('yolov8n-pose.pt')"
```

#### 2. 数据库连接失败

**症状**: API 返回 500 错误
**解决**:
```bash
# 检查 MySQL 服务状态
systemctl status mysql

# 验证连接字符串
uv run python -c "from core.config import DATABASE_URL; print(DATABASE_URL)"
```

#### 3. WebSocket 连接断开

**症状**: 实时检测页面频繁断开
**解决**:
- 检查浏览器控制台是否有错误
- 确认后端服务正常运行
- 检查防火墙设置

#### 4. 视频无法播放

**症状**: 前端视频区域黑屏
**解决**:
```bash
# 检查视频文件权限
ls -la uploads/videos/

# 验证视频格式
file uploads/videos/xxx.mp4

# 确认 CORS 配置正确
```

### 日志查看

```bash
# 后端日志
tail -f logs/app.log

# 前端控制台
# 打开浏览器开发者工具 (F12)
```

---

## FAQ

### Q: 如何修改评分算法？
A: 编辑 `services/score_service.py`，调整 `SCORING_CONFIG` 配置或修改 `score_action_by_angle` 函数。

### Q: 如何添加新的关节评估点？
A: 在 `score_service.py` 的 `ANGLE_JOINTS` 字典中添加新关节配置。

### Q: 实时检测帧率太低怎么办？
A: 调整 `config.yaml` 中的 `sample_fps` 参数，或降低摄像头分辨率。

### Q: 如何更换 YOLO 模型？
A: 修改 `config.yaml` 的 `yolo_model_path`，可选模型：
- `yolov8n-pose.pt` (最快，精度较低)
- `yolov8s-pose.pt` (平衡)
- `yolov8m-pose.pt` (较慢，精度高)

### Q: 前端页面样式如何修改？
A: 使用 Tailwind CSS 工具类，直接修改组件的 `className` 属性。

---

## 附录

### 依赖版本

```
Python: 3.10+
FastAPI: 0.128.0
SQLAlchemy: 2.0.46
Pydantic: 2.12.5
ultralytics: 8.4.11
opencv-python: 4.13.0
torch: 2.10.0

React: 18+
TypeScript: 5+
Vite: 5+
```

### 关键文件索引

| 文件 | 说明 |
|------|------|
| `main.py` | FastAPI 应用入口 |
| `config.yaml` | 主配置文件 |
| `services/score_service.py` | 评分算法核心 |
| `services/recognition_service.py` | YOLO 识别服务 |
| `api/websocket.py` | WebSocket 实时检测 |
| `front/pages/LiveScoring.tsx` | 实时检测前端 |
| `front/pages/ScoreResult.tsx` | 评分结果前端 |

### 外部资源

- [YOLOv8 文档](https://docs.ultralytics.com/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [React 文档](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
