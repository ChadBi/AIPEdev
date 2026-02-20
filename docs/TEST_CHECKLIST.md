# 测试清单 - 实时监测 + 音乐对齐功能

> 本文档用于功能验收测试，请逐项执行并记录结果。

## 测试环境准备

### 1. 启动后端服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端服务

```bash
cd front
npm run dev
```

### 3. 数据库准备

确保数据库已执行以下 SQL 创建新表：

```sql
-- 音乐表
CREATE TABLE IF NOT EXISTS music (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    duration_seconds FLOAT,
    file_size INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 同步配置表
CREATE TABLE IF NOT EXISTS sync_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL UNIQUE,
    music_id INTEGER NOT NULL,
    sync_offset_ms INTEGER DEFAULT 0,
    is_manually_aligned BOOLEAN DEFAULT FALSE,
    alignment_note TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (music_id) REFERENCES music(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 为 videos 表添加字段
ALTER TABLE videos ADD COLUMN music_id INTEGER REFERENCES music(id);
ALTER TABLE videos ADD COLUMN sync_config_id INTEGER;
```

---

## 模块一：音乐库功能测试

### 测试用例 M-01：音乐上传

| 项目 | 内容 |
|------|------|
| 路由 | `/music` |
| 前置条件 | 已登录用户 |
| 测试步骤 | 1. 进入音乐库页面<br>2. 点击"上传音乐"按钮<br>3. 选择一个 MP3 文件<br>4. 观察上传进度<br>5. 检查列表是否显示新音乐 |

| 预期结果 | ✅ 音乐上传成功，列表更新<br>✅ 显示音乐名称、时长、大小<br>✅ 可以播放/暂停预览 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 M-02：音乐播放控制

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 在音乐列表中找到一首音乐<br>2. 点击"播放"按钮<br>3. 观察播放状态<br>4. 点击"暂停"按钮 |

| 预期结果 | ✅ 显示播放中状态<br>✅ 点击暂停后停止播放 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 M-03：音乐删除

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 在音乐列表中找到一首音乐<br>2. 点击删除按钮<br>3. 确认删除 |

| 预期结果 | ✅ 音乐从列表中移除<br>✅ 文件从服务器删除 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 M-04：音乐搜索

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 上传多首不同名称的音乐<br>2. 在搜索框输入关键词<br>3. 观察过滤结果 |

| 预期结果 | ✅ 只显示匹配的音乐 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

---

## 模块二：视频上传 + 音乐关联测试

### 测试用例 V-01：上传视频时关联音乐

| 项目 | 内容 |
|------|------|
| 路由 | `/videos/upload` |
| 测试步骤 | 1. 进入视频上传页面<br>2. 先上传几首音乐（可选）<br>3. 点击"选择音乐"下拉框<br>4. 选择一首已上传的音乐<br>5. 选择视频文件<br>6. 上传 |

| 预期结果 | ✅ 下拉框显示已上传的音乐列表<br>✅ 视频上传成功后关联 music_id |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 V-02：查看视频详情（含音乐信息）

| 项目 | 内容 |
|------|------|
| 路由 | `/videos/{id}` |
| 测试步骤 | 1. 点击某个已上传视频的"详情" |

| 预期结果 | ✅ 显示关联的音乐名称 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

---

## 模块三：音视频对齐测试

### 测试用例 S-01：进入对齐页面

| 项目 | 内容 |
|------|------|
| 路由 | `/sync/align?video_id={id}` |
| 测试步骤 | 1. 从视频列表点击"对齐"按钮<br>2. 进入对齐页面 |

| 预期结果 | ✅ 页面正常加载<br>✅ 左侧显示视频预览<br>✅ 右侧显示音乐选择和偏移控制 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 S-02：选择并播放音乐

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 在音乐列表中选择一首音乐<br>2. 点击视频播放按钮 |

| 预期结果 | ✅ 视频开始播放<br>✅ 音乐开始播放（从偏移时间点） |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 S-03：调整同步偏移

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 拖动偏移滑块（-3s ~ +3s）<br>2. 观察时间显示变化<br>3. 重新播放测试效果 |

| 预期结果 | ✅ 滑块可正常拖动<br>✅ 显示当前偏移值（正/负秒）<br>✅ 音乐按偏移时间点播放 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 S-04：保存对齐配置

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 设置好偏移值<br>2. 点击"保存对齐设置" |

| 预期结果 | ✅ 显示"保存成功"<br>✅ 1.5秒后自动跳转到实时检测页面 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

---

## 模块四：实时检测功能测试

### 测试用例 L-01：进入实时检测页面

| 项目 | 内容 |
|------|------|
| 路由 | `/scores/live?video_id={id}` |
| 测试步骤 | 1. 点击侧边栏"实时检测"<br>2. 或从对齐页面跳转 |

| 预期结果 | ✅ 页面显示左右分栏布局<br>✅ 左侧：标准动作视频占位<br>✅ 右侧：摄像头选择区域 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 L-02：摄像头权限与枚举

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 在右侧找到"摄像头选择"区域<br>2. 点击刷新按钮<br>3. 允许浏览器访问摄像头 |

| 预期结果 | ✅ 显示可用的摄像头列表<br>✅ 有摄像头显示绿色"已就绪"状态 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | 需浏览器授权摄像头权限 |

### 测试用例 L-03：开始实时检测

| 项目 | 内容 |
|------|------|
| 前提 | 已选择摄像头，音乐已对齐 |
| 测试步骤 | 1. 点击顶部"开始检测"按钮<br>2. 观察以下内容：<br>   - 右侧摄像头画面<br>   - 音乐自动播放<br>   - 实时分数统计<br>   - FPS/延迟数据 |

| 预期结果 | ✅ 摄像头画面显示在右侧<br>✅ 音乐按设置偏移自动播放<br>✅ 显示实时统计面板（FPS、分数、延迟）<br>✅ 播放状态更新为"进行中" |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 L-04：暂停/继续/停止

| 项目 | 内容 |
|------|------|
| 测试步骤 | 1. 检测进行中，点击"暂停"<br>2. 观察画面和音乐<br>3. 点击"继续"<br>4. 点击"停止" |

| 预期结果 | ✅ 暂停：画面冻结，音乐停止<br>✅ 继续：恢复检测<br>✅ 停止：摄像头释放，画面关闭 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

### 测试用例 L-05：未对齐警告

| 项目 | 内容 |
|------|------|
| 前提 | 视频未执行过对齐操作 |
| 测试步骤 | 1. 进入实时检测页面 |

| 预期结果 | ✅ 显示警告提示"该视频尚未进行音视频对齐"<br>✅ 提示中包含"调整对齐"链接 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |
| 备注 | |

---

## 边界情况测试

### 测试用例 E-01：无摄像头设备

| 测试步骤 | 1. 在没有摄像头的设备打开实时检测页面 |
| 预期结果 | ✅ 显示"未检测到摄像头设备"<br>✅ "开始检测"按钮禁用 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |

### 测试用例 E-02：摄像头权限被拒绝

| 测试步骤 | 1. 浏览器阻止摄像头权限<br>2. 尝试使用摄像头 |
| 预期结果 | ✅ 显示"摄像头权限被拒绝"错误 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |

### 测试用例 E-03：删除已被视频引用的音乐

| 测试步骤 | 1. 视频 A 关联了音乐 M<br>2. 删除音乐 M |
| 预期结果 | ✅ 音乐删除成功<br>✅ 视频关联的 music_id 变为 null（不报错） |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |

### 测试用例 E-04：上传不支持的格式

| 测试步骤 | 1. 上传 TXT 文件到音乐库<br>2. 上传图片文件到视频 |
| 预期结果 | ✅ 显示"不支持的文件格式"错误 |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |

### 测试用例 E-05：文件大小超限

| 测试步骤 | 1. 上传 >50MB 的音乐文件 |
| 预期结果 | ✅ 显示"文件大小不能超过 50MB" |
| 测试结果 | ⬜ 通过 / ⬜ 失败 |

---

## API 接口测试

使用 curl 或 Postman 测试后端 API：

### 音乐模块

```bash
# 上传音乐
curl -X POST http://localhost:8000/music/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@music.mp3" \
  -F "name=测试音乐"

# 获取音乐列表
curl http://localhost:8000/music/

# 获取单个音乐
curl http://localhost:8000/music/{id}

# 删除音乐
curl -X DELETE http://localhost:8000/music/{id} \
  -H "Authorization: Bearer {token}"
```

### 同步配置模块

```bash
# 手动对齐
curl -X POST http://localhost:8000/sync/align \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"video_id": 1, "music_id": 1, "sync_offset_ms": 500}'

# 获取视频同步配置
curl http://localhost:8000/sync/video/{video_id}
```

### WebSocket 实时连接

```javascript
// 浏览器控制台测试
const ws = new WebSocket('ws://localhost:8000/ws/live/1');

ws.onopen = () => console.log('连接成功');
ws.onmessage = (e) => console.log('收到消息:', e.data);
ws.onerror = (e) => console.error('错误:', e);
ws.onclose = () => console.log('连接关闭');

// 发送心跳
ws.send(JSON.stringify({ type: 'ping' }));

// 发送关键点数据
ws.send(JSON.stringify({
  type: 'keypoints',
  data: {
    frame_index: 0,
    keypoints: { nose: [0.5, 0.5, 0.9], ... }
  }
}));
```

---

## 测试记录汇总

| 模块 | 用例数 | 通过 | 失败 | 待测 |
|------|--------|------|------|------|
| 音乐库功能 | 4 | | | 4 |
| 视频上传+关联 | 2 | | | 2 |
| 音视频对齐 | 4 | | | 4 |
| 实时检测 | 5 | | | 5 |
| 边界情况 | 5 | | | 5 |
| **合计** | **20** | | | **20** |

---

## 缺陷记录

| 编号 | 描述 | 严重程度 | 状态 |
|------|------|----------|------|
| | | | |

---

## 测试总结

测试日期：__________
测试人员：__________
测试环境：__________

| 项目 | 结果 |
|------|------|
| 功能完整性 | ⬜ 全部通过 / ⬜ 部分通过 / ⬜ 未通过 |
| UI 一致性 | ⬜ 符合设计 / ⬜ 需调整 |
| 性能表现 | ⬜ 良好 / ⬜ 需优化 |
| 异常处理 | ⬜ 完善 / ⬜ 需补充 |

**总体评估**：⬜ 可上线 / ⬜ 需修复 / ⬜ 需重大修改
