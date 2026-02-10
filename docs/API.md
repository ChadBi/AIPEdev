# API 参考文档

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API 文档**: `http://localhost:8000/docs` (Swagger UI)
- **认证方式**: Bearer Token (JWT)

## 认证流程

### 1. 注册用户

```http
POST /auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}
```

**响应**:
```json
{
  "id": 1,
  "username": "testuser",
  "created_at": "2026-02-10T12:00:00"
}
```

### 2. 登录

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=testuser&password=password123
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 3. 获取当前用户信息

```http
GET /auth/me
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "id": 1,
  "username": "testuser",
  "created_at": "2026-02-10T12:00:00"
}
```

## 动作管理

### 从视频创建标准动作

```http
POST /actions/create-from-video
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

name: 深蹲
description: 标准深蹲动作
file: <video_file>
```

**响应**:
```json
{
  "id": 1,
  "name": "深蹲",
  "description": "标准深蹲动作",
  "video_path": "uploads/videos/xxx.mp4",
  "keypoints": null,
  "created_at": "2026-02-10T12:00:00"
}
```

### 获取动作列表

```http
GET /actions/?skip=0&limit=20
```

**响应**:
```json
[
  {
    "id": 1,
    "name": "深蹲",
    "description": "标准深蹲动作",
    "video_path": "uploads/videos/xxx.mp4",
    "created_at": "2026-02-10T12:00:00"
  }
]
```

### 获取动作详情

```http
GET /actions/1
```

### 更新动作

```http
PUT /actions/1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "description": "更新后的描述"
}
```

### 删除动作

```http
DELETE /actions/1
Authorization: Bearer <access_token>
```

## 视频管理

### 上传视频

```http
POST /videos/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <video_file>
```

**响应**:
```json
{
  "id": 1,
  "file_path": "uploads/videos/xxx.mp4",
  "filename": "my_video.mp4",
  "user_id": 1,
  "uploaded_at": "2026-02-10T12:00:00"
}
```

### 获取视频列表

```http
GET /videos/?skip=0&limit=20
Authorization: Bearer <access_token>
```

### 获取我的视频

```http
GET /videos/my-videos?skip=0&limit=20
Authorization: Bearer <access_token>
```

## 动作评分

### 执行评分

```http
POST /scores/?action_id=1&video_id=1&student_video_delay=0.0
Authorization: Bearer <access_token>
```

**参数说明**:
- `action_id`: 标准动作ID（必填）
- `video_id`: 用户视频ID（video_id 和 video_path 二选一）
- `video_path`: 视频文件路径（video_id 和 video_path 二选一）
- `student_video_delay`: 时间对齐延迟（秒），正值表示用户视频晚开始

**响应**:
```json
{
  "id": 1,
  "user_id": 1,
  "action_id": 1,
  "video_id": 1,
  "total_score": 85.5,
  "joint_scores": {
    "left_knee": 88.2,
    "right_knee": 87.5,
    "left_elbow": 83.1,
    "right_elbow": 84.3,
    "left_hip": 86.0,
    "right_hip": 85.5,
    "left_shoulder": 84.8,
    "right_shoulder": 85.2
  },
  "frame_scores": [
    {
      "frame_index": 0,
      "score": 85.3,
      "timestamp": 0.0
    },
    {
      "frame_index": 1,
      "score": 86.1,
      "timestamp": 0.17
    }
  ],
  "feedback": [
    "✅ 优秀: 左膝, 右膝 - 动作标准，继续保持",
    "👍 良好: 左肘, 右肘 - 动作基本规范，可进一步优化"
  ],
  "student_video_delay": 0.0,
  "created_at": "2026-02-10T12:00:00"
}
```

### 查看评分历史

```http
GET /scores/history?skip=0&limit=20
Authorization: Bearer <access_token>
```

**响应**:
```json
[
  {
    "id": 1,
    "action_name": "深蹲",
    "total_score": 85.5,
    "created_at": "2026-02-10T12:00:00"
  }
]
```

### 获取评分详情

```http
GET /scores/1
Authorization: Bearer <access_token>
```

## 姿态识别

### 识别视频

```http
POST /recognize/video
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <video_file>
```

**响应**:
```json
{
  "sequence": [
    {
      "keypoints": {
        "nose": [0.5, 0.3, 0.95],
        "left_eye": [0.48, 0.28, 0.93],
        "right_eye": [0.52, 0.28, 0.94],
        "left_ear": [0.46, 0.29, 0.91],
        "right_ear": [0.54, 0.29, 0.92],
        "left_shoulder": [0.42, 0.38, 0.96],
        "right_shoulder": [0.58, 0.38, 0.97],
        "left_elbow": [0.35, 0.50, 0.89],
        "right_elbow": [0.65, 0.50, 0.90],
        "left_wrist": [0.30, 0.62, 0.85],
        "right_wrist": [0.70, 0.62, 0.86],
        "left_hip": [0.43, 0.58, 0.94],
        "right_hip": [0.57, 0.58, 0.95],
        "left_knee": [0.43, 0.75, 0.92],
        "right_knee": [0.57, 0.75, 0.93],
        "left_ankle": [0.43, 0.92, 0.88],
        "right_ankle": [0.57, 0.92, 0.89]
      }
    }
  ]
}
```

**关键点格式**: `[x, y, confidence]`
- `x, y`: 归一化坐标 (0-1)
- `confidence`: 置信度 (0-1)

## 错误响应

所有错误响应遵循以下格式：

```json
{
  "detail": "错误描述信息"
}
```

常见HTTP状态码：
- `400`: 请求参数错误
- `401`: 未授权（未登录或token无效）
- `403`: 禁止访问（权限不足）
- `404`: 资源不存在
- `500`: 服务器内部错误

## 数据模型

### User (用户)
```typescript
{
  id: number
  username: string
  created_at: string  // ISO 8601
}
```

### Action (标准动作)
```typescript
{
  id: number
  name: string
  description: string | null
  video_path: string | null
  keypoints: object | null
  created_at: string
}
```

### Video (视频)
```typescript
{
  id: number
  file_path: string
  filename: string
  user_id: number
  uploaded_at: string
}
```

### ScoreRecord (评分记录)
```typescript
{
  id: number
  user_id: number
  action_id: number
  video_id: number | null
  total_score: number
  joint_scores: { [joint: string]: number }
  frame_scores: Array<{
    frame_index: number
    score: number
    timestamp: number
  }>
  feedback: string[]
  student_video_delay: number
  created_at: string
}
```

## 速率限制

当前版本暂无速率限制，生产环境建议添加。

## WebSocket (待实现)

未来版本将支持 WebSocket 实时推送识别进度。

## 版本历史

### v1.0.0 (2026-02-10)
- 基础功能实现
- 完善评分算法
- 实时识别优化
