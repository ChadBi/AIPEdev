# AIPE 项目开发日志

> 记录项目重要功能开发、bug 修复和架构变更
> 最后更新：2026-02-21

---

## 2026-02-21

### 音乐对齐页面修复

**问题**: SyncAlign.tsx 页面加载时报错，显示 `setStandardKeypointsLoaded is not defined`

**原因**: 骨架检测相关代码已从音乐对齐页面删除，但遗留了状态定义引用

**修复内容**:
1. 删除骨架检测相关的状态定义 (`keypoints`, `standardKeypointsSeq`, `standardKeypointsLoaded`)
2. 删除骨架绘制 useEffect
3. 删除 Canvas 引用
4. 删除获取关键点序列的 API 调用
5. 删除状态提示 UI 中的"骨架检测"显示
6. 添加缺失的 `Clock` 图标导入
7. 为视频添加进度条控制，音乐和视频进度绑定

**修改文件**:
- `front/pages/SyncAlign.tsx`

**进度条功能**:
- 显示当前播放时间和总时长
- 支持拖拽进度条调整播放位置
- 音乐和视频进度同步 (根据 offset 自动计算)
- 播放/暂停按钮集成到进度条控制栏

---

## 2026-02-20

### 实时检测功能完善

**新增功能**:
1. 实时检测改为动作音乐解耦设计
2. 摄像头黑屏问题修复
3. 骨架叠加显示优化

**修改文件**:
- `front/pages/LiveScoring.tsx`
- `api/websocket.py`
- `front/components/LiveVideoPanel.tsx`

---

## 2026-02-15

### 评分算法优化

**优化内容**:
1. 修复评分不对称问题（标准动作和用户动作现在都进行置信度检查）
2. 修复有效帧计数 bug（准确记录每个关节的有效帧数）
3. 扩展关节评估范围（从 4 个扩展到 8 个：膝、髋、肘、肩）
4. 引入关节权重系统（下肢权重 > 上肢权重）
5. 优化帧级别分数计算逻辑
6. 调整惩罚系数（从 1.0 提高到 1.2，更严格）

**修改文件**:
- `services/score_service.py`

**评分对比**:
```
旧版本 (4 关节，无权重):
- left_elbow, right_elbow
- left_shoulder, right_shoulder

新版本 (8 关节，带权重):
- left_knee, right_knee (权重 1.5)
- right_knee, right_knee (权重 1.5)
- left_hip, right_hip (权重 1.3)
- right_hip, right_hip (权重 1.3)
- left_shoulder, right_shoulder (权重 1.2)
- left_elbow, right_elbow (权重 1.0)
```

---

## 2026-02-10

### 音乐对齐功能上线

**新增功能**:
1. 动作 - 音乐对齐配置页面
2. 音乐选择和时间偏移调整
3. 实时预览对照效果
4. 对齐配置保存到数据库

**新增文件**:
- `front/pages/SyncAlign.tsx`
- `api/action_music_sync.py`
- `models/action_music_sync.py`
- `schemas/action_music_sync.py`
- `crud/action_music_sync.py`

**数据库表**:
```sql
CREATE TABLE action_music_sync (
    id INT PRIMARY KEY,
    action_id INT,
    music_id INT,
    sync_offset_ms INT DEFAULT 0,
    is_aligned BOOLEAN DEFAULT FALSE,
    alignment_note TEXT,
    created_by INT,
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY uq_action_music (action_id, music_id)
);
```

---

## 2026-02-07

### 实时检测 WebSocket 上线

**新增功能**:
1. WebSocket 实时姿态识别
2. 客户端帧推送和服务端评分推送
3. 骨架叠加显示
4. 实时统计数据 (FPS、延迟、平均分)

**新增文件**:
- `api/websocket.py`
- `front/pages/LiveScoring.tsx`
- `front/components/LiveVideoPanel.tsx`
- `front/components/CameraSelector.tsx`

**WebSocket 协议**:
```
客户端 → 服务端：{"type": "frame", "data": {"image_base64": "...", "elapsed_ms": 1000}}
服务端 → 客户端：{"type": "score", "data": {"current_score": 85.5, "keypoints": {...}}}
```

---

## 2026-02-05

### 音乐模块上线

**新增功能**:
1. 音乐上传和管理
2. 音乐元数据提取（时长、文件大小）
3. 音乐播放组件

**新增文件**:
- `api/music.py`
- `models/music.py`
- `schemas/music.py`
- `crud/music.py`
- `front/pages/MusicLibrary.tsx`
- `front/api/music.ts`

---

## 2026-01-28

### 时间同步功能优化

**优化内容**:
1. 学生视频延迟参数 (`student_video_delay`) 引入
2. 评分时自动跳过对应帧数
3. 前端评分页面支持时间调整滑块

**修改文件**:
- `api/score.py`
- `front/pages/Scoring.tsx`
- `models/score.py`

**时间对齐逻辑**:
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

## 2026-01-20

### 评分结果页面重构

**优化内容**:
1. 双视频对照播放功能
2. 时间轴分数图表 (Recharts)
3. 关节得分柱状图
4. AI 反馈建议展示
5. 视频同步控制 (根据延迟自动调整)

**修改文件**:
- `front/pages/ScoreResult.tsx`

**视频同步实现**:
```typescript
const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
  const time = e.currentTarget.currentTime;
  setCurrentTime(time);

  // 应用延迟同步学生视频
  if (userVideoRef.current) {
    const userTargetTime = Math.max(0, time - studentVideoDelay);
    userVideoRef.current.currentTime = userTargetTime;
  }
};
```

---

## 2026-01-15

### 核心架构定型

**完成内容**:
1. 分层架构确定 (路由 → 服务 → CRUD → 模型)
2. JWT 认证系统
3. YOLOv8-Pose 识别服务
4. 基于关节角度的评分算法
5. 基础前端页面

**核心文件**:
- `main.py` - FastAPI 应用入口
- `core/config.py` - 配置文件加载
- `core/database.py` - 数据库连接
- `core/security.py` - 密码加密和 JWT 生成
- `services/recognition_service.py` - YOLO 识别
- `services/score_service.py` - 评分算法
- `api/score.py` - 评分 API

**初始技术栈**:
```
Backend: FastAPI 0.128.0 + SQLAlchemy 2.0.46 + MySQL 8.0
AI: YOLOv8 8.4.11 + OpenCV 4.13.0 + PyTorch 2.10.0
Frontend: React 18 + TypeScript + Vite 5
Auth: JWT + OAuth2 Password Flow
```

---

## 待办事项

### 功能优化
- [ ] 标准动作关键点序列预生成（当前每次评分时动态识别）
- [ ] 多人员同时检测支持（当前仅支持单人）
- [ ] 3D 姿态估计支持（当前为 2D）
- [ ] 动作完成度检测（当前仅评分）

### 性能优化
- [ ] 视频识别批处理
- [ ] WebSocket 连接池管理
- [ ] 前端图片懒加载
- [ ] 数据库查询优化

### 用户体验
- [ ] 评分结果分享功能
- [ ] 历史成绩趋势图表
- [ ] 动作难度分级
- [ ] 个性化训练计划

---

## 已知问题

### 低优先级
1. 某些视频格式在 Safari 浏览器无法播放
2. 长视频（>5 分钟）评分时间较长

### 中优先级
1. 弱光环境下 YOLO 识别准确率下降
2. 多人场景关键点检测可能混淆

### 高优先级
- 无

---

## 版本历史

| 版本 | 日期 | 主要内容 |
|------|------|----------|
| 0.1.0 | 2026-01-15 | 初始版本，核心功能上线 |
| 0.2.0 | 2026-01-28 | 时间同步功能 |
| 0.3.0 | 2026-02-07 | WebSocket 实时检测 |
| 0.4.0 | 2026-02-10 | 音乐对齐功能 |
| 0.5.0 | 2026-02-15 | 评分算法优化 (8 关节) |
| 0.6.0 | 2026-02-20 | 实时检测优化 |
| 0.6.1 | 2026-02-21 | 音乐对齐页面修复 + 进度条 |

---

## 贡献者

- 主要开发
- AI 助手辅助

---

## 附录：重要决策记录

### 决策 1: 选择 YOLOv8-Pose 而非 OpenPose
**日期**: 2026-01-10
**原因**:
- YOLOv8 推理速度更快
- 模型体积更小 (yolov8n-pose.pt 仅 6MB)
- Ultralytics 库 API 更友好

### 决策 2: 使用关节角度评分而非关键点距离
**日期**: 2026-01-12
**原因**:
- 角度更能反映动作质量
- 不受拍摄距离影响
- 更符合体育教学标准

### 决策 3: 抽帧采样而非全帧处理
**日期**: 2026-01-15
**原因**:
- 视频通常 30fps，相邻帧差异很小
- 采样到 6fps 可节省 80% 计算时间
- 对评分准确性影响很小

### 决策 4: 前端使用 React 而非 Vue
**日期**: 2026-01-08
**原因**:
- TypeScript 支持更完善
- 生态系统更大
- 团队更熟悉 React

---

**文档结束**
