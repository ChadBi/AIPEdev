# 数据库迁移脚本

本目录包含所有数据库架构变更的迁移脚本。

## 迁移历史

### migrate_db.py
- **目的**: 初始数据库架构创建
- **执行时间**: 项目初始化时
- **变更**: 创建 users, actions, videos, score_records, action_records 表

### migrate_cascade_delete.py
- **目的**: 添加级联删除外键约束
- **执行时间**: 2026-02-10
- **变更**: 为外键关系添加 CASCADE 删除规则

### migrate_score_history.py
- **目的**: 扩展评分记录表
- **执行时间**: 2026-02-10
- **变更**: 
  - 添加 `video_id` 字段（关联用户视频）
  - 添加 `student_video_delay` 字段（时间对齐参数）
  - 添加 `frame_scores` 字段（帧级别评分数据）
  - 添加 `joint_scores` 字段（关节级别评分数据）

### migrate_action_keypoints_nullable.py
- **目的**: 修改标准动作关键点存储策略
- **执行时间**: 2026-02-10
- **变更**: 
  - 将 `actions.keypoints` 改为可空字段
  - 清空现有关键点数据
- **原因**: 改为评分时实时识别标准视频，确保配置一致性

## 执行迁移

```bash
# 执行单个迁移
python migrations/migrate_xxx.py

# 或使用 Python 环境
.venv/Scripts/python.exe migrations/migrate_xxx.py
```

## 注意事项

⚠️ **重要**: 迁移脚本应该按顺序执行，不要跳过中间步骤。
⚠️ **备份**: 执行迁移前务必备份数据库。
⚠️ **测试**: 在生产环境执行前，先在开发环境测试。
