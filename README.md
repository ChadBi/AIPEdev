# AI 体育教学系统 (AIPE)

基于 FastAPI + YOLOv8 Pose 的智能体育动作评估平台，提供视频姿态识别、关节角度评分和实时反馈功能。

## ✨ 核心特性

- 🎯 **智能评分**: 基于关节角度的加权评分系统，支持8个关键关节评估
- 📹 **实时识别**: YOLOv8-Pose 姿态检测，每秒6帧采样
- ⏱️ **时间同步**: 支持手动调整视频时间对齐
- 📊 **详细反馈**: 帧级别、关节级别的评分数据和可视化
- 🔐 **安全认证**: JWT + OAuth2 身份验证
- 🎨 **现代前端**: React 18 + TypeScript + Vite

## 🚀 快速开始

### 1. 安装依赖

```bash
# Python 依赖 (Python >= 3.10)
pip install -r requirements.txt

# 前端依赖
cd front
npm install
```

### 2. 配置数据库

编辑 `config.yaml` 配置数据库连接：

```yaml
database:
  host: localhost
  port: 3306
  user: root
  password: your_password
  database: aipe_db
```

### 3. 初始化数据库

```bash
python init_db.py
```

### 4. 启动服务

```bash
# 后端 (默认端口 8000)
uvicorn main:app --reload

# 前端 (默认端口 5173)
cd front
npm run dev
```

### 5. 访问应用

- 前端: http://localhost:5173
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 📁 项目结构

```
AIPEdev/
├── api/              # 路由层（API端点）
│   ├── auth.py       # 认证接口
│   ├── user.py       # 用户管理
│   ├── action.py     # 动作库管理
│   ├── video.py      # 视频上传
│   ├── score.py      # 评分接口
│   └── recognize.py  # 识别接口
├── core/             # 核心配置
│   ├── config.py     # 配置加载
│   ├── database.py   # 数据库连接
│   ├── security.py   # 安全工具
│   └── deps.py       # 依赖注入
├── models/           # ORM 模型
│   ├── user.py       # 用户模型
│   ├── action.py     # 动作模型
│   ├── video.py      # 视频模型
│   └── score.py      # 评分记录模型
├── schemas/          # Pydantic 模式
│   ├── user.py       # 用户模式
│   ├── action.py     # 动作模式
│   ├── video.py      # 视频模式
│   └── score.py      # 评分模式
├── services/         # 业务逻辑层
│   ├── auth_service.py         # 认证服务
│   ├── recognition_service.py  # YOLOv8 识别
│   ├── score_service.py        # 评分算法
│   ├── action_service.py       # 动作管理
│   └── video_service.py        # 视频处理
├── crud/             # 数据访问层
│   ├── user.py       # 用户 CRUD
│   ├── action.py     # 动作 CRUD
│   ├── video.py      # 视频 CRUD
│   └── score.py      # 评分 CRUD
├── utils/            # 工具函数
│   ├── file.py       # 文件处理
│   └── json_handler.py  # JSON 处理
├── migrations/       # 数据库迁移脚本
├── front/            # React 前端
│   ├── pages/        # 页面组件
│   ├── components/   # 通用组件
│   └── api.ts        # API 客户端
├── config.yaml       # 配置文件
├── main.py           # FastAPI 应用入口
└── requirements.txt  # Python 依赖
```

## 🎯 功能模块

### 认证模块 (`/auth`)
- `POST /auth/register` - 用户注册
- `POST /auth/login` - OAuth2 登录
- `GET /auth/me` - 获取当前用户信息

### 动作库 (`/actions`)
- `POST /actions/create-from-video` - 从视频创建标准动作
- `GET /actions/` - 获取动作列表
- `GET /actions/{id}` - 获取动作详情
- `PUT /actions/{id}` - 更新动作
- `DELETE /actions/{id}` - 删除动作

### 视频管理 (`/videos`)
- `POST /videos/upload` - 上传视频
- `GET /videos/` - 获取视频列表
- `GET /videos/my-videos` - 获取我的视频

### 评分系统 (`/scores`)
- `POST /scores/` - 执行动作评分
- `GET /scores/history` - 查看评分历史
- `GET /scores/{id}` - 获取评分详情

### 识别服务 (`/recognize`)
- `POST /recognize/video` - 识别视频姿态关键点

## 🔧 配置说明

### config.yaml 关键配置

```yaml
# YOLOv8 识别配置
yolo:
  model_path: yolov8n-pose.pt
  device: cpu  # 或 'cuda' for GPU
  confidence: 0.35
  iou: 0.7

# 视频采样配置
video:
  sample_fps: 6  # 每秒采样6帧

# 评分算法配置
scoring:
  angle_penalty: 1.2      # 角度差惩罚系数
  enable_sequence_loop: false  # 序列循环
```

## 📊 评分算法

### 关节权重系统

| 关节 | 权重 | 说明 |
|------|------|------|
| 左膝/右膝 | 1.5 | 下肢稳定性关键 |
| 左髋/右髋 | 1.3 | 影响整体姿态 |
| 左肩/右肩 | 1.2 | 连接躯干 |
| 左肘/右肘 | 1.0 | 上肢协调 |

### 评分公式

```
关节得分 = 100 - (平均角度差异 × 惩罚系数)
总分 = Σ(关节得分 × 权重) / Σ(权重)
```

### 特性
- ✅ 实时识别（标准动作和用户动作同时识别，确保参数一致）
- ✅ 有效帧计数（只计算有效关键点的帧）
- ✅ 加权平均（大关节权重更高）
- ✅ 帧级别评分（支持时间轴可视化）

## 🛠️ 开发指南

### 代码规范

```python
# 路由层：简洁的端点定义
@router.post("/", response_model=ScoreOut)
def score_action(...): 
    return service.score_action(...)

# 服务层：业务逻辑
def score_action(...):
    # 1. 数据验证
    # 2. 调用识别
    # 3. 执行评分
    # 4. 保存结果
    return result

# CRUD 层：数据库操作
def create_score_record(db, record):
    db.add(record)
    db.commit()
    return record
```

### 添加新功能

1. 定义数据模型 (`models/`)
2. 创建 Pydantic 模式 (`schemas/`)
3. 实现 CRUD 操作 (`crud/`)
4. 编写业务逻辑 (`services/`)
5. 添加 API 路由 (`api/`)
6. 更新前端页面 (`front/pages/`)

## 🔍 常见问题

### Q: YOLOv8 识别速度慢？
A: 考虑使用 GPU (`device: cuda`) 或降低采样率 (`sample_fps: 3`)

### Q: 评分结果不准确？
A: 检查：
- 视频拍摄角度（正面或侧面）
- 光线条件（避免逆光）
- 时间对齐是否正确

### Q: 数据库连接失败？
A: 确保：
- MySQL 服务运行中
- config.yaml 中的数据库配置正确
- 数据库用户有足够权限

## 📝 更新日志

### 2026-02-10
- ✅ 完善评分算法（8个关节，权重系统）
- ✅ 修复置信度检查不对称问题
- ✅ 修复有效帧计数bug
- ✅ 改为评分时实时识别（确保配置一致）
- ✅ 优化项目结构和文档

## 📝 许可证

本项目仅供学习和研究使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

📧 技术支持: AI 体育教学系统团队

