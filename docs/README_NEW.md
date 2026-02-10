# AI 体育教学后端系统

本项目基于 FastAPI + SQLAlchemy + Pydantic + JWT，提供用户认证、动作管理、视频上传、识别与评分等能力，并支持 YOLOv8 Pose 作为识别后端。

## 功能模块
- 认证模块（/auth）：注册、登录（OAuth2 Password Flow）
- 用户模块（/users）：获取当前用户信息、用户列表
- 动作模块（/actions）：创建、查询、更新、删除标准动作
- 视频模块（/videos）：上传视频文件、查看视频列表、查看我的视频
- 识别模块（/recognize）：对指定视频进行姿态识别（Mock 或 YOLOv8）
- 评分模块（/scores）：对用户视频进行动作评分（角度算法）

## 快速开始

### 1. 安装依赖（确保 Python >= 3.10）

```bash
pip install -r requirements.txt
# 或手动安装核心包：
pip install fastapi uvicorn sqlalchemy pymysql pydantic bcrypt python-jose
# 可选：YOLOv8 与 OpenCV（用于真实识别）
pip install ultralytics opencv-python
```

### 2. 配置管理（通过 config.yaml 文件）

项目根目录已包含 `config.yaml` 文件，所有配置项都在其中管理。**无需环境变量！**

#### 常用配置修改：

**切换识别模式（Mock vs 真实 YOLO）：**
```yaml
ai:
  use_mock: false  # true 为测试模式，false 为真实 YOLO 识别
```

**配置数据库连接：**
```yaml
database:
  url: "mysql+pymysql://root:wyzy11001@localhost:3306/fastapi_db"
```

**配置 YOLO 参数：**
```yaml
ai:
  yolo_model_path: "yolov8n-pose.pt"   # 模型文件路径
  yolo_device: "cpu"                   # 推理设备：cpu, 0, cuda:0 等
  sample_fps: 6                        # 每秒采样帧数（6 表示 30fps 视频采样 5 帧）
  yolo_confidence: 0.35                # 关键点置信度阈值
  yolo_iou: 0.7                        # NMS 阈值
```

**修改文件上传目录：**
```yaml
file_storage:
  upload_dir: "uploads/videos"  # 相对于项目根目录
```

**配置服务器地址和端口：**
```yaml
server:
  host: "127.0.0.1"
  port: 8000
  reload: true  # 开发环境热加载
  log_level: "info"
```

### 3. 初始化数据库

```bash
python init_db.py
```

### 4. 启动服务

```bash
uvicorn main:app --reload
```

访问 Swagger 文档：`http://localhost:8000/docs`

## 配置文件说明

### 文件位置
- `config.yaml` 在项目根目录

### 配置读取流程
1. 应用启动时自动从 `config.yaml` 读取所有配置
2. 若文件缺失，应用会报错并提示创建文件
3. 修改配置后需要重启应用才能生效

### 配置文件完整结构

```yaml
# =============================================================================
# 安全配置
# =============================================================================
security:
  # JWT 密钥 (生产环境务必修改为复杂字符串)
  secret_key: "change_this_in_production"
  # JWT 签名算法
  algorithm: "HS256"
  # Access Token 过期时间 (分钟)
  access_token_expire_minutes: 1440  # 24小时

# =============================================================================
# 数据库配置
# =============================================================================
database:
  # 数据库连接字符串
  # 格式: mysql+pymysql://username:password@host:port/database_name
  url: "mysql+pymysql://root:wyzy11001@localhost:3306/fastapi_db"

# =============================================================================
# AI 服务配置
# =============================================================================
ai:
  # 是否启用 Mock 模式
  # True: 返回随机关键点数据 (用于测试)
  # False: 使用真实 YOLOv8 Pose 模型识别
  use_mock: false
  
  # YOLO 模型路径 (支持相对路径和绝对路径)
  # 支持的模型: yolov8n-pose.pt, yolov8s-pose.pt, yolov8m-pose.pt 等
  yolo_model_path: "yolov8n-pose.pt"
  
  # YOLO 推理设备
  # "cpu"      : 使用 CPU 推理 (所有电脑都支持)
  # "0"        : 使用第一块 GPU (CUDA)
  # "cuda:0"   : 同上
  # "mps"      : MacOS GPU 加速
  yolo_device: "cpu"
  
  # 抽帧采样率 (每秒采样帧数)
  # 该参数会根据视频 FPS 自动计算采样间隔
  # 示例: 30fps 视频 + sample_fps=6 => 每5帧采样1帧
  # 数值越高 = 更准确但更慢
  # 数值越低 = 更快但可能漏掉动作细节
  sample_fps: 6
  
  # YOLO 置信度阈值 (0.0 - 1.0)
  # 仅保留置信度 >= 该值的关键点检测
  # 值越高越严格,可能漏掉弱检测
  # 值越低越宽松,可能包含噪声
  yolo_confidence: 0.35
  
  # YOLO IOU 阈值 (0.0 - 1.0)
  # 非极大值抑制 (NMS) 参数,用于去除重复检测框
  yolo_iou: 0.7

# =============================================================================
# 文件存储配置
# =============================================================================
file_storage:
  # 视频上传目录 (相对于项目根目录)
  upload_dir: "uploads/videos"
  
  # 允许的视频格式
  allowed_video_extensions:
    - ".mp4"
    - ".avi"
    - ".mov"
    - ".mkv"
    - ".flv"
  
  # 最大文件大小 (字节) - 500MB
  max_file_size: 524288000

# =============================================================================
# 服务器配置
# =============================================================================
server:
  # REST API 主机
  host: "127.0.0.1"
  # REST API 端口
  port: 8000
  # 是否启用热加载 (开发环境使用)
  reload: true
  # 日志级别: "debug", "info", "warning", "error"
  log_level: "info"
```

## YOLOv8 使用说明

### 启用真实识别模式

1. 设置配置文件：`config.yaml` 中 `ai.use_mock: false`
2. 确保已安装：`pip install ultralytics opencv-python`
3. 将 `yolov8n-pose.pt` 放在项目根目录，或修改 `config.yaml` 中 `ai.yolo_model_path`
4. 重启应用

### 快速测试（Mock 模式）

设置 `config.yaml` 中 `ai.use_mock: true` 即可返回随机关键点数据快速测试，无需 YOLO 模型文件。

### GPU 加速

修改 `config.yaml` 中 `ai.yolo_device`:
```yaml
ai:
  yolo_device: "0"  # 第一块 GPU
```

## 端到端流程示例

```
1. 注册：POST /auth/register 
   JSON: { "username": "user", "password": "pass" }

2. 登录：POST /auth/login 
   使用 Swagger 的 Authorize 按钮输入用户名密码（Form 格式）

3. 上传视频：POST /videos/upload 
   Multipart 表单上传视频文件，自动提取 fps 和总帧数

4. 创建标准动作：POST /actions/ 
   JSON: { "name": "深蹲", "description": "标准深蹲", "keypoints": {...} }

5. 评分：POST /scores/?action_id=1&video_id=1 
   自动识别视频关键点并与标准动作对比，返回评分结果

6. 查看历史：GET /scores/history 
   获取当前用户所有的评分记录

7. 详细分析：GET /scores/{score_id} 
   获取单个评分的详细关键点数据和反馈建议
```

## 目录结构与约定

```
.
├── api/                     # API 路由层
│   ├── auth.py             # 认证路由
│   ├── user.py             # 用户路由
│   ├── action.py           # 动作路由
│   ├── video.py            # 视频上传路由
│   ├── recognize.py        # 识别路由
│   └── score.py            # 评分路由
│
├── core/                    # 核心配置和工具
│   ├── config.py           # 从 config.yaml 读取配置
│   ├── database.py         # 数据库连接和会话管理
│   ├── deps.py             # 依赖注入（当前用户等）
│   └── security.py         # 安全工具（密码哈希、JWT 等）
│
├── models/                  # SQLAlchemy ORM 模型
│   ├── user.py
│   ├── action.py
│   ├── video.py
│   ├── score.py
│   └── action_record.py
│
├── schemas/                 # Pydantic 请求/响应数据模型
│   ├── user.py
│   ├── action.py
│   ├── video.py
│   ├── score.py
│   └── recognition.py
│
├── crud/                    # 数据库操作封装
│   ├── user.py
│   ├── action.py
│   ├── video.py
│   └── score.py
│
├── services/                # 业务逻辑层
│   ├── auth_service.py      # 认证逻辑
│   ├── recognition_service.py # YOLOv8 识别逻辑
│   ├── score_service.py     # 评分计算逻辑
│   ├── action_service.py
│   └── video_service.py
│
├── config.yaml             # 配置文件
├── main.py                 # FastAPI 应用入口
├── init_db.py              # 数据库初始化脚本
├── requirements.txt        # Python 依赖列表
└── README.md               # 本文件
```

## 代码规范与设计原则

1. **分层架构**：严格遵循路由 → 服务 → CRUD → 模型的调用链
2. **配置集中管理**：所有非代码配置存储在 `config.yaml` 中
3. **类型安全**：使用 Pydantic V2 的 `from_attributes=True` 兼容 ORM 对象返回
4. **无状态设计**：每个请求独立，支持水平扩展
5. **错误处理**：详细的 HTTP 异常消息，便于前端调试

## 常见问题

| 问题 | 解决方案 |
|------|--------|
| `配置文件找不到` | 确保 `config.yaml` 在项目根目录 |
| `无法加载 YOLO 模型` | 1. 校验 `use_mock` 是否为 true<br>2. 检查 `yolo_model_path` 是否正确<br>3. 确认 ultralytics opencv-python 已安装 |
| `MySQL 连接失败` | 1. 检查 MySQL 服务是否运行<br>2. 校验 `database.url` 中的凭证和主机<br>3. 确认数据库存在 |
| `视频上传失败` | 1. 检查 `file_storage.upload_dir` 目录权限<br>2. 确认磁盘空间充足<br>3. 检查视频文件格式是否被允许 |
| `识别速度很慢` | 1. 增加 `sample_fps` 值（更快但准确度降低）<br>2. 减小模型规模（用 yolov8s-pose.pt 替代 yolov8m-pose.pt）<br>3. 启用 GPU 推理（修改 `yolo_device` 为 GPU 编号） |
| `评分结果不准确` | 1. 校验上传的标准动作关键点是否准确<br>2. 检查视频清晰度和角度<br>3. 调整 `yolo_confidence` 和 `sample_fps` 参数 |

## 部署到生产环境

1. 修改 `config.yaml` 中的敏感值：
   - `security.secret_key` - 改为复杂随机字符串
   - `database.url` - 改为生产数据库地址

2. 修改配置以启用 HTTPS 和 CORS 白名单

3. 使用 gunicorn 或 systemd 管理应用进程：
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
   ```

4. 建议使用 nginx 反向代理和 PM2/Supervisor 进程管理
