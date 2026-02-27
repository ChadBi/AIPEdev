# AIPE（AI 体育教学系统）

AIPE 是一个基于 `FastAPI + React + YOLOv8 Pose` 的体育动作评估平台，提供：

- 标准动作库管理
- 视频动作评分
- 实时动作检测与结果分析
- 体态检测（多角度拍照 + 问题识别 + 建议）
- 历史记录与趋势查看

---

## 1. 技术栈

- 后端：`FastAPI`、`SQLAlchemy`、`MySQL`、`PyMySQL`
- AI：`YOLOv8 Pose`、`OpenCV`
- 前端：`React`、`TypeScript`、`Vite`、`Recharts`
- 认证：`JWT`（OAuth2 Password Flow）

---

## 2. 项目目录（整理后）

```text
AIPEdev/
├─ api/                     # 路由层（auth/video/score/posture/...）
├─ core/                    # 配置、数据库连接、安全工具
├─ crud/                    # 数据库访问封装
├─ models/                  # SQLAlchemy 模型
├─ schemas/                 # Pydantic 模型
├─ services/                # 业务逻辑（识别、评分、体态分析）
├─ migrations/              # 数据库迁移脚本
├─ front/                   # 前端工程（React + TS）
├─ docs/                    # 项目文档
├─ tools/
│  └─ dev_sandbox/          # 开发期测试/调试脚本与临时说明（已归档）
├─ uploads/                 # 上传文件目录
├─ config.yaml              # 全局配置（数据库、AI、服务端口等）
├─ main.py                  # 后端入口
├─ requirements.txt         # Python 依赖
└─ progress.md              # 项目进度记录
```

> 说明：根目录中零散的测试/调试脚本已统一归档到 `tools/dev_sandbox/`。

---

## 3. 环境要求

- Python `>= 3.10`
- Node.js `>= 18`
- MySQL `>= 8.0`（或兼容版本）
- Windows / Linux / macOS

---

## 4. 快速启动（推荐用 uv）

### 4.1 初始化 Python 环境

```bash
# 在项目根目录执行
uv venv
uv sync
```

可选检查（确认是项目虚拟环境）：

```bash
uv run python -c "import sys; print(sys.prefix)"
```

### 4.2 配置后端

编辑 [config.yaml](config.yaml)：

- `database.url`：数据库连接串
- `ai.yolo_model_path`：模型文件路径（默认 `yolov8n-pose.pt`）
- `server.host/server.port`：后端监听地址

### 4.3 初始化数据库

```bash
uv run python init_db.py
```

如果有新增迁移脚本，按需执行（示例）：

```bash
uv run python migrations/004_fix_posture_issue_weight_score_range.py
```

### 4.4 启动后端

```bash
uv run python main.py
```

### 4.5 启动前端

```bash
cd front
npm install
npm run dev
```

---

## 5. 访问地址

- 前端：`http://localhost:5173`（Vite 默认）
- 后端 API：`http://127.0.0.1:8000`
- Swagger 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`

---

## 6. 核心接口分组

- `/auth`：登录、注册
- `/users`：用户信息
- `/actions`：动作库管理
- `/videos`：视频上传与管理
- `/scores`：普通评分、实时评分结果
- `/ws`：实时检测 WebSocket
- `/posture`：体态检测、报告、趋势、问题规则
- `/music`、`/sync`：音乐与动作同步

---

## 7. 开发调试说明

### 7.1 调试脚本归档位置

以下类型脚本统一放在 `tools/dev_sandbox/`：

- `debug_*.py`
- `test_*.py`
- `check_*.py`
- 临时排错文档与 SQL

### 7.2 常用命令

```bash
# 后端静态检查（示例）
uv run python -m py_compile main.py

# 前端构建
cd front && npm run build
```

---

## 8. 常见问题

### Q1：体态检测报 500 怎么看具体原因？

前端已支持显示后端 `detail`，请在体态检测页面查看错误面板中的“详细错误”。

### Q2：`weight_score` 越界报错（1264）怎么办？

执行迁移：

```bash
uv run python migrations/004_fix_posture_issue_weight_score_range.py
```

---

## 9. 许可证

MIT
