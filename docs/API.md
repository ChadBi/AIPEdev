# API 参考文档

## 基础信息

- Base URL: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- 认证方式: Bearer Token (JWT)

## 认证与用户

### 注册
`POST /auth/register`

```json
{
  "username": "testuser",
  "password": "password123"
}
```

### 登录
`POST /auth/login` (`application/x-www-form-urlencoded`)

```text
username=testuser&password=password123
```

### 当前用户
`GET /users/me` (需要 Token)

## 动作模块 `/actions`

- `POST /actions/create-from-video` 创建标准动作（上传示范视频）
- `POST /actions/` 创建动作（JSON）
- `GET /actions/` 获取动作列表
- `GET /actions/count` 获取动作总数
- `GET /actions/{action_id}` 获取动作详情
- `PUT /actions/{action_id}` 更新动作
- `DELETE /actions/{action_id}` 删除动作

> 说明：动作库中的标准视频不会自动进入“我的练习视频”。

## 视频模块 `/videos`

- `POST /videos/upload` 上传练习视频（需要 Token）
- `GET /videos/` 获取全部视频
- `GET /videos/me` 获取当前用户视频（需要 Token）
- `GET /videos/me/count` 获取当前用户视频总数（需要 Token）
- `GET /videos/{video_id}` 获取视频详情（含同步信息）
- `PUT /videos/{video_id}` 更新视频关联信息（需要 Token）

### 视频响应（示例）

```json
{
  "id": 1,
  "user_id": 1,
  "file_path": "uploads/videos/abc.mp4",
  "fps": 30,
  "total_frames": 900,
  "music_id": null,
  "sync_config_id": null,
  "created_at": "2026-02-20T08:00:00"
}
```

## 评分模块 `/scores`

- `GET /scores/test` 服务测试
- `POST /scores/` 执行评分（需要 Token）
- `GET /scores/history` 评分历史（需要 Token）
- `GET /scores/history/count` 评分历史总数（需要 Token）
- `GET /scores/{score_id}` 评分详情（需要 Token）

## 音乐模块 `/music`

- `POST /music/upload` 上传音乐（需要 Token）
- `GET /music/` 音乐列表
- `GET /music/me` 当前用户上传音乐（需要 Token）
- `GET /music/{music_id}` 音乐详情
- `PUT /music/{music_id}` 更新音乐信息（需要 Token）
- `DELETE /music/{music_id}` 删除音乐（需要 Token）

## 同步模块 `/sync`

- `POST /sync/align` 手动对齐（需要 Token）
- `GET /sync/video/{video_id}` 获取某视频同步配置
- `POST /sync/` 创建同步配置（需要 Token）
- `PUT /sync/{sync_id}` 更新同步配置（需要 Token）
- `DELETE /sync/{sync_id}` 删除同步配置（需要 Token）
- `GET /sync/list` 同步配置列表

## 识别模块 `/recognize`

- `POST /recognize/?video_id=1`
- `POST /recognize/?video_path=uploads/videos/abc.mp4`

## 错误格式

```json
{
  "detail": "错误描述"
}
```

常见状态码: `400` `401` `403` `404` `500`

