# AIPE 项目 AI 助手快速参考

> 为 AI 助手准备的项目快速上手指南
> 最后更新：2026-02-21

---

## 一分钟了解项目

**AIPE** 是一个智能体育动作评估系统，使用 YOLOv8-Pose 进行姿态识别，对比用户动作与标准动作的关节角度差异，生成评分和反馈。

**核心技术栈**:
- 后端：FastAPI + SQLAlchemy + MySQL
- AI: YOLOv8-Pose + OpenCV
- 前端：React 18 + TypeScript + Vite
- 认证：JWT + OAuth2

---

## 项目结构速查

```
AIPEdev/
├── api/              # 路由层 (9 个模块)
├── core/             # 配置 (config/database/security/deps)
├── crud/             # 数据访问层 (7 个 CRUD 模块)
├── models/           # ORM 模型 (8 个表)
├── schemas/          # Pydantic 模式 (7 个 DTO)
├── services/         # 业务逻辑 (5 个服务)
├── utils/            # 工具函数
├── front/            # React 前端 (15 个页面)
├── config.yaml       # 配置文件
├── main.py           # 应用入口
└── docs/             # 文档
```

---

## 核心服务函数

### recognition_service.py

| 函数 | 说明 | 输入 | 输出 |
|------|------|------|------|
| `recognize_video(path)` | 视频关键点提取 | 视频路径 | `{sequence: [{keypoints}]}` |
| `recognize_frame(frame)` | 单帧关键点提取 | OpenCV 图像 | `{name: [x,y,conf]}` |
| `recognize_frame_base64(b64)` | Base64 图片识别 | Base64 字符串 | `{name: [x,y,conf]}` |
| `get_video_metadata(path)` | 获取视频元数据 | 视频路径 | `{fps, frames, width, height}` |

### score_service.py

| 函数 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `score_action_by_angle(std, usr)` | 主评分函数 | 标准/用户动作序列 | `{total_score, joint_scores, frame_scores, feedback}` |

**评分公式**:
```python
score = max(0, 100 - angle_diff * 1.2)  # 每 1.2 度扣 1 分
total = Σ(score * weight) / Σ(weight)   # 加权平均
```

**关节权重**:
- 膝关节 (left/right_knee): 1.5
- 髋关节 (left/right_hip): 1.3
- 肩关节 (left/right_shoulder): 1.2
- 肘关节 (left/right_elbow): 1.0

---

## API 路由速查

### 认证模块 `/auth`
```python
POST /auth/register    # 用户注册
POST /auth/login       # OAuth2 登录 → 返回 JWT Token
```

### 动作模块 `/actions`
```python
GET  /actions/         # 获取动作列表
POST /actions/create-from-video  # 从视频创建动作
GET  /actions/{id}     # 获取动作详情
GET  /actions/live     # 获取可用于实时检测的动作
GET  /actions/by-video/{video_id}  # 根据视频 ID 获取动作
GET  /actions/{id}/keypoints  # 获取动作关键点序列
```

### 评分模块 `/scores`
```python
POST /scores/?action_id=1&video_id=2&student_video_delay=0.5  # 执行评分
GET  /scores/history   # 获取评分历史
GET  /scores/{id}      # 获取评分详情
GET  /scores/history/count  # 获取历史总数
```

### 实时检测 `/ws`
```python
WebSocket /ws/live/action/{action_id}?sync_offset_ms=0  # 实时检测
GET  /ws/live/status/action/{action_id}  # 获取连接状态
```

### 音乐模块 `/music`
```python
GET  /music/           # 获取音乐列表
POST /music/upload     # 上传音乐
GET  /music/{id}       # 获取音乐详情
```

### 同步配置 `/sync`
```python
GET  /sync/action/{action_id}/music           # 获取动作的音乐列表
GET  /sync/action/{action_id}/align/{music_id} # 获取对齐配置
POST /sync/action/{action_id}/align           # 保存对齐配置
```

---

## 数据库表速查

```sql
-- 8 个核心表
users                  # 用户表
actions                # 标准动作表
videos                 # 视频表
music                  # 音乐表
score_records          # 评分记录表
action_music_sync      # 动作音乐对齐表
action_records         # 动作记录表
sync_config            # 同步配置表
```

### 表关系
```
users → videos (1:N)
users → score_records (1:N)
users → music (1:N)

actions → score_records (1:N)
videos → score_records (1:N)

actions → action_music_sync (N:N)
music → action_music_sync (N:N)
```

---

## 前端页面路由

```typescript
// 15 个主要页面
/login              → Login.tsx
/register           → Register.tsx
/                   → Dashboard.tsx
/actions            → ActionLibrary.tsx
/actions/:id        → ActionDetail.tsx
/actions/create     → ActionForm.tsx
/videos             → VideoLibrary.tsx
/videos/upload      → VideoUpload.tsx
/music              → MusicLibrary.tsx
/scores             → Scoring.tsx (4 步评分流程)
/scores/result/:id  → ScoreResult.tsx
/scores/history     → ScoreHistory.tsx
/scores/live        → LiveScoring.tsx (实时检测)
/sync/align         → SyncAlign.tsx (音乐对齐)
/profile            → UserProfile.tsx
```

---

## 配置参数速查

### config.yaml

```yaml
# AI 配置
ai:
  use_mock: false           # Mock 模式开关
  sample_fps: 6             # 视频采样率 (秒 6 帧)
  yolo_confidence: 0.35     # 关键点置信度阈值
  yolo_iou: 0.7             # NMS IOU 阈值

# 评分配置
scoring:
  enable_sequence_loop: false   # 是否循环标准动作
  loop_threshold: 1.5           # 循环触发阈值

# 安全配置
security:
  access_token_expire_minutes: 1440  # Token 24 小时过期
```

---

## 常见任务代码片段

### 1. 添加新的 API 端点

```python
# api/new_module.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user

router = APIRouter()

@router.get("/example")
def example_endpoint(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return {"message": "Hello"}
```

### 2. 添加数据库表

```python
# models/new_model.py
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from core.database import Base

class NewModel(Base):
    __tablename__ = "new_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 3. 前端 API 调用

```typescript
// api/example.ts
import api from './api';

export function getData(id: number) {
  return api.get(`/example/${id}`);
}

// 使用
const response = await getData(1);
console.log(response.data);
```

### 4. WebSocket 消息处理

```typescript
// 客户端发送
ws.send(JSON.stringify({
  type: "frame",
  data: {
    image_base64: "data:image/jpeg;base64,...",
    elapsed_ms: 1000
  }
}));

// 服务端推送
{
  "type": "score",
  "data": {
    "current_score": 85.5,
    "average_score": 82.3,
    "keypoints": {...}
  }
}
```

---

## 关键数据类型

### TypeScript 类型定义 (front/types.ts)

```typescript
interface Action {
  id: number;
  name: string;
  description: string;
  video_path: string;
  is_aligned: boolean;
}

interface ScoreResponse {
  score_id: number;
  total_score: number;
  joint_scores: Record<string, number>;
  frame_scores: Array<{frame_index: number, score: number, timestamp: number}>;
  feedback: string[];
}

interface Keypoints {
  nose: [number, number, number];
  left_shoulder: [number, number, number];
  // ... 17 个关键点
}
```

### Python Schema (schemas/)

```python
# schemas/score.py
class ScoreOut(BaseModel):
    score_id: int
    action_id: int
    total_score: float
    joint_scores: Dict[str, float]
    frame_scores: List[Dict[str, Any]]
    feedback: List[str]
```

---

## 调试技巧

### 后端日志

```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"处理用户 {user_id} 的评分请求")
logger.debug(f"标准动作序列长度：{len(standard_sequence)}")
logger.error(f"识别失败：{error}")
```

### 前端调试

```typescript
// 开启调试日志
console.log('[DEBUG] 加载动作列表...', actionId);

// 网络请求调试
try {
  const res = await api.get('/actions');
  console.log('[DEBUG] 响应:', res.data);
} catch (err) {
  console.error('[ERROR] 请求失败:', err);
}
```

### 数据库查询日志

```python
# 在 core/database.py 中开启 SQL 日志
engine = create_engine(DATABASE_URL, echo=True)  # 打印所有 SQL
```

---

## 性能优化建议

1. **YOLO 模型缓存**: 使用 `@lru_cache` 避免重复加载模型
2. **视频抽帧**: 使用 `sample_fps=6` 而非全帧处理
3. **数据库连接池**: `pool_pre_ping=True` 防止连接超时
4. **前端懒加载**: 视频列表分页加载，避免一次性加载过多

---

## 安全注意事项

1. **JWT 密钥**: 生产环境必须修改 `secret_key`
2. **密码加密**: 使用 SHA256+bcrypt 双重加密
3. **CORS 配置**: 限制允许的来源域名
4. **权限验证**: 所有用户相关接口使用 `get_current_user` 依赖

---

## 故障排查命令

```bash
# 检查 Python 环境
uv run python -c "import sys; print(sys.prefix)"

# 检查模型加载
uv run python -c "from services.recognition_service import is_pose_model_loaded; print(is_pose_model_loaded())"

# 检查数据库连接
uv run python -c "from core.database import SessionLocal; db=SessionLocal(); print(db.query('SELECT 1').all())"

# 检查上传目录权限
ls -la uploads/videos/

# 查看进程占用
netstat -ano | findstr :8000  # Windows
lsof -i :8000  # Linux/Mac
```

---

## 快速参考表

### 关键点名称 (COCO17)

| ID | 名称 | ID | 名称 |
|----|------|----|------|
| 0 | nose | 8 | right_elbow |
| 1 | left_eye | 9 | left_wrist |
| 2 | right_eye | 10 | right_wrist |
| 3 | left_ear | 11 | left_hip |
| 4 | right_ear | 12 | right_hip |
| 5 | left_shoulder | 13 | left_knee |
| 6 | right_shoulder | 14 | right_knee |
| 7 | left_elbow | 15 | left_ankle |
| | | 16 | right_ankle |

### HTTP 状态码

| 状态码 | 含义 | 常见场景 |
|--------|------|----------|
| 200 | 成功 | 正常返回 |
| 400 | 请求错误 | 参数错误 |
| 401 | 未授权 | Token 无效/过期 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 未找到 | 资源不存在 |
| 500 | 服务器错误 | 内部异常 |

### WebSocket 关闭码

| 关闭码 | 含义 |
|--------|------|
| 1000 | 正常关闭 |
| 1006 | 异常断开 |
| 4004 | 资源不存在 |
| 4400 | 参数错误 |

---

## 文件路径处理

```python
# 规范化存储路径 (去除前导斜杠)
from utils.file import normalize_storage_path
path = normalize_storage_path("uploads/videos/xxx.mp4")
# 返回："uploads/videos/xxx.mp4"

# 前端获取完整 URL
import { getVideoUrl } from './api';
const url = getVideoUrl("uploads/videos/xxx.mp4");
// 返回："http://localhost:8000/uploads/videos/xxx.mp4"
```

---

## 时间同步处理

```python
# student_video_delay > 0: 学生视频提前播放，跳过学生视频前几帧
# student_video_delay < 0: 标准动作提前播放，跳过标准动作前几帧
skip_frames = int(round(student_video_delay * SAMPLE_FPS))
if student_video_delay > 0:
    user_sequence = user_sequence[skip_frames:]
else:
    standard_sequence = standard_sequence[skip_frames:]
```

---

## 音乐偏移处理

```python
# sync_offset_ms > 0: 音乐晚播放 (视频早于音乐)
# sync_offset_ms < 0: 音乐早播放 (视频晚于音乐)

# 实时检测中计算标准动作帧索引
adjusted_elapsed_ms = max(0, elapsed_ms + sync_offset_ms)
frame_index = int((adjusted_elapsed_ms / 1000.0) * SAMPLE_FPS)
```

---

## 总结

这是 AIPE 项目的核心信息速查表。详细文档请参考 `docs/COMPLETE_DOCUMENTATION.md`。

**关键文件位置**:
- 评分算法：`services/score_service.py`
- 识别服务：`services/recognition_service.py`
- 实时检测：`api/websocket.py`
- 前端核心：`front/pages/LiveScoring.tsx`, `front/pages/ScoreResult.tsx`
