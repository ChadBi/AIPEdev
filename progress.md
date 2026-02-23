# AIPE 项目开发进度记录

## 2026-02-23 - 实时检测结果入库并接入历史页

### 需求
- 将实时检测结果持久化到数据库。
- 在评分历史页展示实时记录，并可进入实时结果详情。

### 完成内容
- 数据库扩展：`score_records` 新增 `is_live` 与 `live_metadata` 字段。
- 后端新增接口：
  - `POST /scores/live`：保存实时检测结果。
  - `GET /scores/live/{score_id}`：获取实时检测结果详情。
- 历史接口扩展：`GET /scores/history` 增加 `is_live` 字段。
- 前端接入：实时检测停止时自动调用保存接口，成功后跳转 `/scores/live/result/:id`。
- 实时结果页支持按 `:id` 拉取详情，解决刷新丢失问题。
- 历史页新增“来源”列（实时/普通），并根据来源跳转对应详情页。
- 已执行迁移脚本：`migrations/003_add_live_fields_to_score_records.py`。

### 修改文件
- `models/score.py`
- `crud/score.py`
- `schemas/score.py`
- `api/score.py`
- `migrations/003_add_live_fields_to_score_records.py`
- `front/types.ts`
- `front/pages/LiveScoring.tsx`
- `front/pages/LiveScoreResult.tsx`
- `front/pages/ScoreHistory.tsx`
- `front/App.tsx`
- `progress.md`

### 潜在问题
- 实时记录目前未保存摄像头设备信息，如后续需要质量追踪可加到 `live_metadata`。

## 2026-02-23 - 新增实时检测结果页

### 需求
- 实时检测结束后进入专门结果页，展示本次评分结果。
- 结果页视觉风格参考非实时评分结果页。

### 完成内容
- 在实时检测页增加会话结果采集：记录开始时间、逐帧分数序列、结束时统计快照。
- 点击“停止”后自动跳转到实时结果页，并通过路由 state 传递本次结果数据。
- 新增实时结果页，展示：总评等级、平均分、峰值分、检测时长、处理帧、FPS、延迟、分数曲线。
- 新增路由 `/scores/live/result` 并接入应用。

### 修改文件
- `front/pages/LiveScoring.tsx`
- `front/pages/LiveScoreResult.tsx`
- `front/App.tsx`
- `front/types.ts`
- `progress.md`

### 潜在问题
- 当前实时结果采用前端会话内数据（未落库），刷新结果页会丢失本次结果。
- 若需要历史可追溯，后续可增加后端持久化接口。

## 2026-02-23 - 修复实时检测顶部统计卡宽度抖动

### 问题
- 实时检测开始后，顶部统计栏（当前分数、FPS、平均分、帧数、延迟、音乐状态、音量）会随数字长度变化出现宽度抖动。

### 根因
- 顶部统计卡采用内容自适应宽度（`px-*`），数值位数变化时会触发布局重新计算，导致视觉抖动。

### 完成内容
- 为全屏顶部统计卡设置固定宽度（`w-*`）并加 `shrink-0`，避免被压缩。
- 将分数与各数值字段增加 `tabular-nums`，确保数字切换时字形宽度稳定。
- 音乐状态和音量区域同步固定宽度，保持整排布局稳定。

### 修改文件
- `front/pages/LiveScoring.tsx`
- `progress.md`

### 潜在问题
- 固定宽度在极小屏幕下可能导致横向空间紧张，若后续增加更多指标，建议改为可横向滚动或分组折叠。

## 2026-02-23 - 修复 actions 表缺少 recognition_status 字段

### 问题
- 后端请求 `/actions` 与 `/actions/create-from-video` 时出现 MySQL 1054 错误：`Unknown column 'actions.recognition_status' in 'field list'`。

### 根因
- `models/action.py` 已定义 `recognition_status`、`recognition_error` 字段。
- 数据库 `actions` 表未执行对应迁移，导致 ORM 查询字段与实际表结构不一致。
- `migrations/002_add_recognition_status.py` 中使用了固定库名 `aipe_db`，在非该库名环境下存在兼容风险。

### 完成内容
- 执行迁移脚本：`migrations/002_add_recognition_status.py`，成功补齐缺失列。
- 修复迁移脚本：将 `TABLE_SCHEMA = 'aipe_db'` 改为动态读取 `SELECT DATABASE()`，避免环境耦合。
- 复跑迁移脚本验证幂等：已识别字段存在并安全跳过。
- 启动服务并请求 `GET /actions/?skip=0&limit=1`，返回 200，确认问题解决。

### 修改文件
- `migrations/002_add_recognition_status.py`
- `progress.md`

### 潜在问题
- 其他历史迁移脚本若仍有固定库名，后续在多环境部署时可能复现类似问题，建议统一排查。

## 2026-02-21 - 完整文档创建

### 任务概述
为项目创建完善的文档，方便接手人员或 AI 助手快速上手。

### 完成内容

#### 1. 完整项目文档 (docs/COMPLETE_DOCUMENTATION.md)
- 项目概述和核心特性
- 快速开始指南（安装、配置、启动）
- 项目结构详解（每个模块的说明）
- 技术架构图和数据流
- 数据库设计（8 个表的完整结构）
- API 接口文档（所有端点的请求/响应示例）
- 核心功能模块详解（识别、评分、实时检测、音乐对齐）
- 前端页面说明（15 个页面的功能和路由）
- 配置文件详解（config.yaml 每个参数）
- 开发指南（添加 API、数据库表、前端页面）
- 故障排查指南（常见问题和解决方案）
- FAQ 常见问题解答

#### 2. AI 助手快速参考 (docs/AI_ASSISTANT_GUIDE.md)
- 一分钟项目简介
- 项目结构速查表
- 核心服务函数速查
- API 路由速查
- 数据库表速查
- 前端页面路由
- 配置参数速查
- 常见任务代码片段
- 关键数据类型定义
- 调试技巧
- 性能优化建议
- 安全注意事项
- 故障排查命令
- 关键点名称对照表 (COCO17)
- HTTP/Ws 状态码速查

#### 3. 开发日志 (docs/DEVELOPMENT_LOG.md)
- 项目重要功能开发记录
- Bug 修复历史
- 架构变更说明
- 版本历史
- 待办事项
- 已知问题
- 重要决策记录

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `docs/COMPLETE_DOCUMENTATION.md` | 新建 | 完整项目文档 (~800 行) |
| `docs/AI_ASSISTANT_GUIDE.md` | 新建 | AI 助手快速参考 (~600 行) |
| `docs/DEVELOPMENT_LOG.md` | 新建 | 开发日志 (~400 行) |
| `progress.md` | 新建 | 开发进度记录 |

### 文档覆盖范围

#### 后端文档
- ✅ 项目结构和模块说明
- ✅ 技术架构和数据流
- ✅ 数据库设计 (8 个表)
- ✅ API 接口 (所有端点)
- ✅ 核心服务 (识别、评分)
- ✅ 配置文件说明
- ✅ WebSocket 实时检测协议

#### 前端文档
- ✅ 页面组件说明 (15 个页面)
- ✅ 路由配置
- ✅ API 调用方式
- ✅ 数据类型定义
- ✅ 核心页面详解

#### 开发指南
- ✅ 如何添加 API 端点
- ✅ 如何添加数据库表
- ✅ 如何开发前端页面
- ✅ 调试技巧
- ✅ 故障排查

### 文档特点

1. **分层设计**: 从快速入门到深度开发，适合不同阶段的开发者
2. **代码示例**: 每个功能点都有对应的代码片段
3. **速查表格**: 关键信息整理成表格，方便快速查找
4. **架构图示**: 使用 ASCII 图展示系统架构
5. **持续更新**: 开发日志记录所有重要变更

### 后续建议

1. **定期更新**: 每次重大功能开发后更新相关文档
2. **示例补充**: 添加更多实际使用场景的示例
3. **性能基准**: 添加性能测试数据和优化建议
4. **视频教程**: 考虑制作核心功能的视频演示

---

## 2026-02-21 - 音乐对齐页面修复 (早期记录)

### 问题
SyncAlign.tsx 页面加载时报错，显示 `setStandardKeypointsLoaded is not defined`

### 解决方案
1. 删除骨架检测相关的状态定义和 useEffect
2. 删除 Canvas 引用和相关 UI
3. 添加缺失的 Clock 图标导入
4. 为视频添加进度条控制

### 修改文件
- `front/pages/SyncAlign.tsx`

---

## 2026-02-20 - 实时检测功能完善

### 新增功能
1. 实时检测改为动作音乐解耦设计
2. 修复摄像头黑屏问题
3. 骨架叠加显示优化

### 修改文件
- `front/pages/LiveScoring.tsx`
- `api/websocket.py`
- `front/components/LiveVideoPanel.tsx`

---

## 2026-02-21 - 实时检测 UI 体验优化

### 需求
用户要求改进实时检测的用户体验：
1. 添加开始前的倒计时（5、4、3、2、1）
2. 确保每次开始检测媒体都从头开始播放
3. 改进 FPS 显示，添加更多统计信息

### 完成内容

#### 1. 倒计时功能 (LiveScoring.tsx)
- 添加 `countdown` 状态来跟踪倒计时值
- 在 `handleStart` 函数中实现 5 秒倒计时逻辑
- 添加倒计时覆盖层 UI，显示大号数字和提示文字
- 使用 `absolute inset-0` 和 `backdrop-blur-sm` 创建半透明模糊背景
- 倒计时期间内容变暗并禁用交互 (`opacity-30 pointer-events-none`)

#### 2. 媒体从头开始播放
- 修改 `handleStart` 在倒计时结束后确保所有媒体重置：
  - 标准视频：`pause()` + `currentTime = 0`，然后监听 `seeked` 事件后播放
  - 音频：在 `startMusic` 函数中先清理旧的音频元素，创建新的并设为 `currentTime = 0`
- 添加 `pointer-events-none` 防止倒计时期间用户点击

#### 3. 扩展实时统计显示
- 从 4 个统计卡片扩展到 7 个：
  - FPS（帧率）
  - 分数（当前匹配度）
  - 平均（平均分数）
  - 处理帧数（后端处理的帧数）
  - 网络延迟（往返延迟）
  - 音乐状态（播放中/未播放）
  - 模型状态（就绪/加载中）

#### 4. 性能优化
- 画布尺寸从 320x240 提升到 640x480，提高图像质量
- 图像质量从 0.6 提升到 0.8
- 帧发送间隔从 200ms 改为 50ms（约 20 FPS，更流畅）
- 添加 `willReadFrequently: true` 优化 canvas 读取性能

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/pages/LiveScoring.tsx` | 修改 | 添加倒计时 UI 和逻辑，优化媒体播放控制，扩展统计显示，提升性能 |

### 潜在问题
无

---

## 2026-02-21 - 修复音乐播放问题

### 问题
开始检测后音乐不播放，点击开始按钮后没有任何声音。

### 原因
在 `startMusic` 函数中，`audioRef.current = audio` 的赋值放在了 `playAudio()` 调用之后。而 `playAudio()` 函数首先检查 `if (!audioRef.current) return;`，因此直接返回，没有执行播放逻辑。

### 解决方案
移动 `audioRef.current = audio` 的赋值位置，确保在调用 `playAudio()` 前已经设置了 audio 引用。

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 修正音乐对齐逻辑

### 问题
实时检测页面的音乐对齐逻辑与 SyncAlign 页面不一致，导致音乐和视频的播放时机不对。

### 原因分析
- **SyncAlign.tsx 逻辑（正确）**：音乐始终从 0 开始播放，视频根据 `videoOffsetMs` 延迟播放
  - `videoOffsetMs > 0`：视频晚播（视频延迟 8.45 秒后才播放）
  - 音乐立即从 0 开始播放

- **LiveScoring.tsx 逻辑（错误）**：之前实现的是音乐延迟播放，与 SyncAlign 逻辑相反

### 解决方案
修正 LiveScoring.tsx 的逻辑，使其与 SyncAlign.tsx 保持一致：
1. **音乐**：始终从头开始立即播放
2. **视频**：根据 `sync_offset_ms` 延迟播放（若为正数）

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 修复 FPS 页面显示问题

### 问题描述
- 页面显示的 FPS 始终是 1
- 控制台正确显示 "[FPS] 过去 1 秒发送了 13 帧" 和 "20 帧"

### 问题原因
React 状态更新的竞争条件：
- `fps` 是 `stats` 对象的一部分
- `fpsInterval` 定时器和 WebSocket 消息处理都会调用 `setStats`
- 高频的状态更新竞争导致 fps 的更新被"覆盖"

### 解决方案
将 FPS 从共享的 `stats` 状态中分离出来，创建独立的 `displayFps` 状态变量。

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 添加全屏比对模式

### 需求
用户希望在倒计时结束后进入全屏比对模式，提升实时检测体验：
- 两个视频流全屏显示
- 隐藏音乐选择和摄像头控制面板
- 参数移到边缘显示

### 新增功能

#### 1. 全屏比对模式
- 倒计时结束后自动切换到全屏比对模式
- 标准动作和实时画面并排大屏显示（各占 50% 宽度）
- 视觉效果更适合动作比对

#### 2. 可折叠统计面板
- 右侧 320px 宽的统计面板
- 包含大号分数显示和详细统计数据
- 可点击按钮隐藏面板
- 隐藏后显示右下角浮动按钮，可重新打开

#### 3. 常规布局（检测前）
- 保持原有的三面板布局
- 音乐选择、摄像头选择、音乐控制与统计

#### 4. 自动切换
- 开始检测 → 倒计时 → 全屏比对模式
- 停止检测 → 返回常规布局

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 修复全屏模式下视频引用丢失问题

### 问题描述
切换到全屏比对模式后出现：
- 控制台显示 "[帧发送] 视频未就绪"
- FPS 始终为 0
- 无法发送帧到后端进行姿态识别

### 问题原因
当 `isFullscreenCompare` 状态变化导致布局切换时：
1. 常规布局是 `grid-rows-2` 结构
2. 全屏比对模式是 `flex` 结构
3. LiveVideoPanel 组件在两种布局中的 DOM 位置和层级不同
4. React 将这些变化识别为需要卸载并重新挂载组件
5. 组件卸载时，`externalVideoRef.current` 的引用被清空

### 解决方案
为所有 LiveVideoPanel 组件添加固定的 `key` 属性：
- 实时画面：`key="live-video-panel"`
- 标准动作视频：`key="standard-video-panel"`

React 使用 `key` 识别组件身份，即使位置和层级变化也会保留组件实例，保持 ref 引用有效。

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 修复布局切换后视频引用丢失和摄像头流检测失败问题

### 问题描述
1. 用户可以看到实时画面说明摄像头连接正常
2. 但切换到全屏模式后控制台显示 `视频未就绪: {readyState: 0, width: 0, height: 0, srcObject: false}`
3. 点击开始检测后全屏模式没有弹出
4. FPS 始终为 0

### 问题原因
1. **布局切换导致 video 元素重新创建**：虽然使用了 key，但 React 会重新创建 DOM 节点
2. **ref 更新时机问题**：原 useEffect 依赖 `[stream, externalVideoRef]`，布局切换时两者都不变化，导致 useEffect 不重新执行
3. **时序问题**：切换布局后立即启动帧循环，此时 liveVideoRef.current 还未指向新的 video 元素

### 解决方案
1. **使用 useLayoutEffect 同步 ref**：在每次 DOM 更新后立即同步，确保 ref 始终指向正确的元素
2. **添加组件卸载清理**：避免引用过期或已被销毁的 video 元素
3. **启动延迟**：增加 300ms 延迟，确保 LiveVideoPanel 完成挂载并设置 ref
4. **增强就绪检查**：添加 `srcObject` 验证，确保 video 元素确实绑定到了流
5. **详细调试日志**：添加关键节点日志，方便排查问题

### 修改的文件
- `front/components/LiveVideoPanel.tsx`
- `front/pages/LiveScoring.tsx`

---

---

## 2026-02-21 - 修复 WebSocket 连接端口错误

### 问题描述
点击开始检测后，控制台显示 WebSocket 连接失败：
```
WebSocket connection to 'ws://localhost:3000/ws/live/action/1?...' failed:
WebSocket is closed before the connection is established
```

### 问题原因
`buildWsBaseUrl()` 函数在没有配置 `VITE_API_BASE_URL` 时，默认使用 `window.location.host`，导致连接到前端端口 3000 而不是后端端口 8000。

### 解决方案
修改 `buildWsBaseUrl()` 函数，在未配置环境变量时默认连接到 `localhost:8000`：
```typescript
function buildWsBaseUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configuredBase) {
    if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://');
    if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://');
  }
  // Default to backend port 8000, not frontend 3000
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://localhost:8000`;
}
```

同时删除了过多的调试日志，避免不必要的重新渲染。

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

## 2026-02-21 - 实时检测功能综合优化总结

### 本次优化包含的完整修复列表

#### 1. FPS 显示修复
- **问题**：FPS 始终显示为 1
- **原因**：React 状态更新竞争条件
- **解决**：创建独立的 `displayFps` 状态变量

#### 2. 全屏比对模式
- **功能**：倒计时后自动切换到全屏比对模式
- **特性**：两个视频各占 50% 宽度，可折叠统计面板

#### 3. Video 引用同步
- **问题**：布局切换后 video 引用丢失
- **解决**：使用 useLayoutEffect + 300ms 延迟 + srcObject 验证

#### 4. WebSocket 连接修复
- **问题**：连接到错误的端口 3000
- **解决**：修改默认连接地址为 localhost:8000

### 修改的文件汇总
- `front/pages/LiveScoring.tsx` - 主页面，包含所有核心逻辑
- `front/components/LiveVideoPanel.tsx` - 视频面板组件，ref 同步优化
- `api/websocket.py` - 后端 WebSocket 处理，降低节流限制

---

---

## 2026-02-21 - 修复 refs 未就绪启动问题

### 问题描述
点击开始检测后：
- `liveVideoRef.current` 和 `standardVideoRef.current` 都为空
- WebSocket 连接失败："closed before the connection is established"
- 无法正常启动实时检测

### 问题原因
当 `setIsFullscreenCompare(true)` 触发状态变化后：
1. React 批处理更新，可能导致多个状态一起更新
2. LiveVideoPanel 组件异步挂载，ref 设置有延迟
3. 固定 300ms 延迟无法保证 ref 一定设置完成

### 解决方案
使用轮询等待 refs 确实就绪后再启动：
```typescript
const checkRefs = (attempts: number = 0) => {
  if (liveVideoRef.current && standardVideoRef.current) {
    // Refs 已就绪，开始启动
    connectWebSocket(selectedAction.id, syncOffsetMs);
    startFrameLoop();
    startMusic();
  } else if (attempts < 30) {
    // 最多等待 1.5 秒（30 * 50ms）
    setTimeout(() => checkRefs(attempts + 1), 50);
  } else {
    // 超时处理
    setWarning('视频初始化超时，请重试');
    setIsFullscreenCompare(false);
    setIsPlaying(false);
  }
};
```

### 修改的文件
- `front/pages/LiveScoring.tsx`

---

---

## 2026-02-22 - WebSocket 连接问题深度修复

### 问题描述
前端调用实时检测时出现 WebSocket 连接失败：
1. Refs 已经就绪（日志显示 "[handleStart] Refs 已就绪，开始启动"）
2. WebSocket 连接失败："WebSocket connection to 'ws://localhost:8000/ws/live/action/1?sync_offset_ms=8450' failed: WebSocket is closed before the connection is established"
3. 控制台每秒显示 "[帧发送] WebSocket 未就绪"

### 根本原因分析
通过测试脚本验证，后端 WebSocket 端点完全正常工作。问题在于前端 WebSocket 连接方式：

1. **直接绕过 Vite 代理**：前端代码直接连接到 `ws://localhost:8000`，绕过了 Vite 开发服务器的 WebSocket 代理
2. **代理配置未生效**：虽然 vite.config.ts 中配置了 `/ws` 路径的 WebSocket 代理，但前端使用绝对 URL 连接，导致代理未生效
3. **连接方式不正确**：开发环境应使用相对路径 `/ws`，让 Vite 代理处理到后端的转发

### 解决方案

#### 1. 修改 WebSocket URL 构建策略
修改 `buildWsBaseUrl()` 函数：
- **开发环境**：返回空字符串，使用相对路径 `/ws`，由 Vite WebSocket 代理到 `ws://localhost:8000`
- **生产环境**：根据 `VITE_API_BASE_URL` 配置构建完整的 WebSocket URL

```typescript
function buildWsBaseUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configuredBase) {
    if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://');
    if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://');
    return configuredBase;
  }
  // 开发环境：使用 Vite 的 WebSocket 代理
  return '';
}
```

#### 2. 增强错误处理和调试信息
- 添加详细的 WebSocket 连接日志（URL、页面地址、连接状态）
- 添加 WebSocket 连接超时处理（10 秒超时）
- 优化错误消息，显示具体的错误代码和原因
- 记录 WebSocket 的 readyState 和连接事件

#### 3. 修复 LiveVideoPanel ref 同步
在 LiveVideoPanel 组件中修复 ref 同步机制：
- 为 `useLayoutEffect` 添加 `[externalVideoRef]` 依赖项
- 确保 externalVideoRef 变化时重新同步引用
- 避免组件卸载时外部引用被清空的问题

#### 4. 测试验证
通过 Python 测试脚本验证后端 WebSocket 端点工作正常：
- 成功建立连接
- 正确收到 status 消息
- ping/pong 通信正常

### 技术细节

#### Vite WebSocket 代理配置
```typescript
'/ws': {
  target: 'ws://localhost:8000',
  ws: true,
  changeOrigin: true,
},
```

#### 连接流程
1. 前端使用相对路径 `/ws/live/action/1?...` 建立连接
2. Vite 开发服务器拦截 `/ws` 开头的 WebSocket 请求
3. Vite 将连接代理到 `ws://localhost:8000`
4. 后端处理 WebSocket 连接并返回响应

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/pages/LiveScoring.tsx` | 修改 | 修复 WebSocket URL 构建策略，增强错误处理和日志 |
| `front/components/LiveVideoPanel.tsx` | 修改 | 修复 ref 同步机制，添加依赖项 |

### 测试结果
- 后端 WebSocket 端点正常（通过 Python 脚本验证）
- 前端连接方式修正，使用 Vite WebSocket 代理
- 错误处理更加详细，便于问题排查

### 潜在问题和建议
1. **环境配置**：生产环境需要确保 `VITE_API_BASE_URL` 正确配置
2. **CORS**：当前 CORS 配置支持本地开发，生产环境需要相应调整
3. **性能**：WebSocket 连接超时设置为 10 秒，可根据实际网络情况调整

---

## 2026-02-22 - 视频未就绪问题深度调试

### 问题描述
实时检测页面在 WebSocket 连接成功后，视频无法就绪导致帧发送失败：
- WebSocket 连接成功建立
- 收到 status 消息
- 控制台显示 "[帧发送] 视频未就绪: {readyState: 0, width: 0, height: 0, srcObject: false}"
- 无法发送视频帧到后端进行识别
- WebSocket 随后关闭

### 问题分析

1. **时序问题**：
   - `handleStart` 只等待 `liveVideoRef.current` 存在就认为就绪
   - 即使 ref 指向了 video 元素，视频可能还没加载完元数据
   - 视频的 `readyState < 2`（HAVE_CURRENT_DATA）说明仍在加载中
   - `videoWidth` 和 `videoHeight` 为 0 说明元数据未加载

2. **ref 同步依赖问题**：
   - 原来的 `useLayoutEffect` 只依赖 `[externalVideoRef]`
   - 当 `stream` 变化时不会重新同步 ref
   - 可能导致 ref 指向过期的 video 元素引用

3. **视频播放状态**：
   - 虽然设置了 `autoPlay` 和调用 `play()`，但视频可能因为各种原因暂停
   - 浏览器自动播放策略可能拒绝播放

### 解决方案

#### 1. 增强视频就绪检查
在 `handleStart` 中不仅检查 ref 是否存在，还检查视频是否真正就绪：
```typescript
const liveVideoReady = liveVideo.readyState >= 2 &&
                      liveVideo.videoWidth > 0 &&
                      liveVideo.videoHeight > 0 &&
                      !!liveVideo.srcObject;
```

如果视频未就绪，继续轮询等待（最多 2 秒，40 次 * 50ms）。

#### 2. 改进 ref 同步机制
为 `useLayoutEffect` 添加 `stream` 和 `videoRef` 依赖：
```typescript
useLayoutEffect(() => {
  const video = videoRef.current;
  if (video && externalVideoRef) {
    externalVideoRef.current = video;
    console.log('[LiveVideoPanel] 同步 externalVideoRef:', {...});
  }
}, [externalVideoRef, videoRef, stream]);
```

#### 3. 添加视频事件监听
在 LiveVideoPanel 中添加详细的事件监听：
- `loadedmetadata`：视频元数据加载完成
- `canplay`：视频可以开始播放
- `play` / `pause`：播放状态变化
- 记录详细的视频状态用于调试

#### 4. 修复依赖数组
修正 `startFrameLoop` 的依赖数组，包含 `cameraReady` 和 `isFullscreenCompare`。

#### 5. 添加详细的调试日志
在关键节点添加详细日志：
- stream 变化时的状态
- 视频加载事件
- ref 同步时机
- 视频就绪检查（包括 readyState 字符串映射）
- 帧发送时的详细状态
- DOM 中的 video 元素状态

#### 6. 尝试激活视频
在视频未就绪时，尝试调用 `play()` 来激活视频。

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/pages/LiveScoring.tsx` | 修改 | 增强视频就绪检查，添加详细日志，修复依赖数组 |
| `front/components/LiveVideoPanel.tsx` | 修改 | 改进 ref 同步，添加视频事件监听，增强日志 |

### 新增功能

1. **详细调试日志**：
   - 所有视频状态变化都有日志记录
   - readyState 字符串映射便于理解
   - 流状态变化的完整追踪

2. **视频就绪验证**：
   - 不仅检查 ref 存在性
   - 验证 readyState、videoWidth、videoHeight、srcObject
   - 最多等待 2 秒让视频完全就绪

3. **ref 同步改进**：
   - 依赖 `stream` 变化
   - 确保 ref 始终指向正确的 video 元素

### 调试信息示例

新增的日志输出：
```
[LiveVideoPanel] 设置 video.srcObject: true
[LiveVideoPanel] loadedmetadata 事件触发: {readyState: 1, videoWidth: 640, videoHeight: 480, paused: false}
[LiveVideoPanel] canplay 事件触发: {readyState: 3, videoWidth: 640, videoHeight: 480}
[checkRefs] 视频就绪检查: {liveVideoReady: true, readyState: 3, readyStateStr: 'HAVE_FUTURE_DATA', ...}
```

### 潜在问题
1. 如果视频设备不支持，可能需要更长的初始化时间
2. 某些浏览器的自动播放策略可能需要用户交互
3. 如果问题仍然存在，可能需要检查设备权限

---

## 2026-02-22 - 实时检测页面全屏模式视频显示修复

### 问题描述
用户反馈在倒计时结束后进入全屏比对模式时：
- 实时画面区域的视频不显示，只显示"等待视频信号"占位文字
- WebSocket 连接成功，持续收到评分消息
- FPS 稳定在 20，说明帧正常发送
- 日志显示：
  ```
  [LiveVideoPanel] stream prop 为 null，但 video 仍在播放，保留当前流
  [LiveVideoPanel] video 已有 MediaStream，保留 srcObject，不调用 load()
  [FPS Interval] 过去 1 秒发送了 20 帧
  ```

### 根本原因分析

#### 1. 占位文字显示条件过于简单
LiveVideoPanel 中的占位文字显示条件是：
```tsx
{!stream && !videoSrc && (
  <div className="absolute inset-0 ...">
    <p className="text-sm">等待视频信号...</p>
  </div>
)}
```

当布局切换时，`stream` prop 可能变为 `null`，但 `video.srcObject` 仍然有值，视频仍在播放。此时占位文字条件 `!stream` 满足，占位文字覆盖了 video 元素，导致用户看不到视频。

#### 2. CameraSelector 卸载导致流被清空
当从常规布局切换到全屏布局时：
- CameraSelector 组件（只在常规布局中显示）被卸载
- CameraSelector 的清理 useEffect 调用 `stopStream()`
- `stopStream()` 调用 `onStreamReady(null)`
- LiveScoring 的 `handleStreamReady` 将 stream state 设置为 `null`

虽然 `handleStreamReady` 有条件来忽略这种情况，但时序问题可能导致这个条件不满足。

#### 3. LayoutEffect 依赖不完整
LiveVideoPanel 的 `useLayoutEffect` 依赖项不完整，可能导致在布局切换时 ref 同步不及时。

### 解决方案

#### 1. 修改占位文字显示条件
从 `!stream && !videoSrc` 改为 `!stream && !videoSrc && !currentStreamRef.current && !(videoRef.current?.srcObject)`：
- 只有在没有 stream、没有 videoSrc、内部 ref 没有流、video 元素没有 srcObject 时才显示占位文字
- 确保即使 stream prop 为 null，但 video 仍在播放，占位文字也不会显示

#### 2. 添加流状态保护机制
- 添加 `ignoreNullStreamUpdateRef` 来标记是否应该忽略空流更新
- 在倒计时结束后设置这个标记为 `true`，防止 CameraSelector 卸载时错误清空流
- 在停止会话时重置这个标记为 `false`

#### 3. 增强调试功能
- 为 LiveVideoPanel 添加调试事件：双击标题可查看详细状态
- 增强日志输出，包含 video 元素的完整状态信息
- 检查 video 元素是否在 DOM 中，避免引用已被销毁的元素

#### 4. 修复 CameraSelector 设备选择
防止在 selectedDeviceId 没有变化时触发不必要的 update。

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/components/LiveVideoPanel.tsx` | 修改 | 修复占位文字显示条件，增强调试功能，改进 ref 同步 |
| `front/pages/LiveScoring.tsx` | 修改 | 添加流状态保护机制，修复布局切换时的流管理 |
| `front/components/CameraSelector.tsx` | 修改 | 防止不必要的设备选择触发 |

### 关键代码修改

#### LiveVideoPanel.tsx 占位文字条件
```tsx
// 修改前
{!stream && !videoSrc && (
  <div className="absolute inset-0 ...">
    <p className="text-sm">等待视频信号...</p>
  </div>
)}

// 修改后
{!stream && !videoSrc && !currentStreamRef.current && !(videoRef.current?.srcObject) && (
  <div className="absolute inset-0 ...">
    <p className="text-sm">等待视频信号...</p>
  </div>
)}
```

#### LiveScoring.tsx 流状态保护
```tsx
// 添加 ref
const ignoreNullStreamUpdateRef = useRef(false);

// 倒计时结束后标记忽略空流更新
ignoreNullStreamUpdateRef.current = true;

// handleStreamReady 中检查标记
if ((isPlaying && isFullscreenCompare) || ignoreNullStreamUpdateRef.current) {
  if (newStream === null && stream !== null) {
    return; // 忽略空流更新
  }
}

// 停止会话时重置标记
ignoreNullStreamUpdateRef.current = false;
```

### 测试建议
1. 启动摄像头，选择标准动作和音乐
2. 点击"开始检测"，等待 5 秒倒计时
3. 验证全屏模式下实时画面正常显示
4. 检查控制台日志，确认没有"等待视频信号"占位文字显示
5. 双击"实时画面"标题，查看详细的视频状态信息（调试功能）

### 潜在问题
1. 如果摄像头设备出现故障，可能需要更完善的错误处理
2. 调试日志较多，建议在生产环境中减少或移除
3. 布局切换的动画可能会有轻微闪烁，可以通过优化 CSS 改善

---

## 2026-02-22 - 修复全屏模式视频黑屏问题（自动播放恢复）

### 问题描述
全屏比对模式下实时画面区域显示黑色背景：
- WebSocket 连接成功，持续收到评分消息
- FPS 稳定在 20，说明帧正常发送和捕获
- 视频元素有 srcObject（摄像头流已绑定）
- 但视频元素在布局切换后停止播放，导致黑屏

### 根本原因分析
当布局切换时：
1. `stream` prop 变为 `null`（CameraSelector 卸载导致）
2. `video.srcObject` 仍然存在（流被保留到 `currentStreamRef`）
3. 视频元素可能处于暂停状态（`video.paused === true`）
4. 占位文字已正确修复，但视频元素本身没有继续播放
5. 即然 `srcObject` 存在且 FPS 正常发送，说明 canvas 在工作，但 video 元素没有渲染画面

### 解决方案

#### 1. 自动检查并恢复视频播放
在 `LiveVideoPanel` 的 `useEffect` 中，当 `stream` prop 为 `null` 但 `video.srcObject` 仍然有效时：
- 检查视频是否暂停：`video.paused`
- 如果暂停且 `readyState >= 2`，自动调用 `video.play()` 恢复播放
- 记录详细的播放状态日志

#### 2. 确保视频元素处于自动播放状态
在保留流时同时设置：
```typescript
video.autoplay = true;
video.muted = true;
```

#### 3. 从 currentStreamRef 恢复流（如果 lost）
如果 `video.srcObject` 丢失但 `currentStreamRef` 有保存的流引用：
- 重新设置 `video.srcObject = currentStreamRef.current`
- 自动调用 `play()` 开始播放

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/components/LiveVideoPanel.tsx` | 修改 | 添加自动播放恢复机制，确保布局切换后视频继续播放 |

### 关键代码

```typescript
if (hasValidStream) {
  currentStreamRef.current = video.srcObject as MediaStream;

  // 如果视频暂停了，尝试重新播放
  if (video.paused && video.readyState >= 2) {
    console.log('[LiveVideoPanel] 视频暂停中，尝试重新播放');
    video.play().then(() => {
      console.log('[LiveVideoPanel] 视频重新播放成功');
    }).catch((err) => {
      console.error('[LiveVideoPanel] 视频重新播放失败:', err.message);
    });
  }

  // 确保 video 仍然是自动播放状态
  video.autoplay = true;
  video.muted = true;
}
```

### 测试建议
1. 启动摄像头，选择标准动作和音乐
2. 点击"开始检测"，等待 5 秒倒计时
3. 验证全屏模式下实时画面正常显示摄像头视频
4. 检查控制台日志，确认视频在布局切换后自动恢复播放

### 潜在问题
1. 如果浏览器自动播放策略严格，`video.play()` 可能被拒绝
2. 当前方案将 `muted` 设为 `true` 绕过大部分自动播放限制
3. 如果问题仍存在，可能需要添加"点击播放"按钮作为回退方案

---

## 2026-02-22 - 修复实时画面黑屏问题（布局切换流保持）

### 问题描述
全屏比对模式下实时画面区域显示黑屏：
- WebSocket 连接成功，持续收到评分消息
- FPS 稳定在 20，说明帧正常发送和捕获
- 控制台显示 `[LiveVideoPanel] 没有可用的流，清空视频`

### 根本原因分析

#### 执行顺序问题（已通过 agent 诊断）
1. 用户点击"开始检测" → 倒计时开始
2. 倒计时结束 → `setIsFullscreenCompare(true)` 触发重新渲染
3. React 开始新渲染 → CameraSelector 从 DOM 移除
4. CameraSelector cleanup 执行 → `onStreamReady(null)` 被调用
5. `handleStreamReady` 检查条件，但由于时序问题，流保护有时不生效
6. `stream` state 被设置为 `null`
7. LiveVideoPanel 接收 `stream=null`，清空 `video.srcObject`

#### 组件状态丢失
即使有相同的 `key` prop（`key="live-video-panel"`），在特定的布局切换情况下：
- LiveVideoPanel 的内部状态（如 `currentStreamRef`）被重置
- video 元素的 DOM 节点可能被重新创建而非复用
- 导致流引用丢失

### 解决方案

#### 1. 改进流保持逻辑
修改 LiveVideoPanel 的 useEffect：
- 优先使用 prop 传入的 `stream`
- 如果 `stream` 为 null 但 `video.srcObject` 还有 MediaStream，使用现有的
- 只有在确实没有任何流可用的情况下才清空 `video.srcObject`
- 确保视频暂停时自动尝试恢复播放

#### 2. 增强调试功能
- 添加 ResizeObserver 监控视频元素尺寸变化（带防抖）
- 添加持续监控定时器（布局切换后 2 秒内）
- 添加详细的事件监听（playing、error、stalled）
- 添加调试信息显示面板（默认关闭）

#### 3. 改进条件判断
```typescript
// 确定要使用的流（优先使用 prop，否则使用现有的或 saved）
const targetStream = stream ||
  (hasExistingStream ? (video.srcObject as MediaStream) : currentStreamRef.current);

// 保留现有流
if (hasExistingStream && !targetStream) {
  currentStreamRef.current = video.srcObject as MediaStream;
  if (video.paused && video.readyState >= 2) {
    video.play().catch(console.error);
  }
}
```

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/components/LiveVideoPanel.tsx` | 修改 | 改进流保持逻辑，增强调试功能，添加自动恢复播放 |

### 关键代码修改

#### 流保持优先级
```typescript
const hasExistingStream = video.srcObject instanceof MediaStream;
const targetStream = stream ||
  (hasExistingStream ? (video.srcObject as MediaStream) : currentStreamRef.current);

if (targetStream) {
  // 只有当流真的不同时才重新设置，避免不必要的重置
  if (video.srcObject !== targetStream) {
    video.srcObject = targetStream;
  }
  currentStreamRef.current = targetStream;
}
```

### 测试建议
1. 启动摄像头，选择标准动作和音乐
2. 点击"开始检测"，观察倒计时和布局切换
3. 验证全屏模式下实时画面正常显示摄像头视频
4. 检查控制台日志，确认没有"没有可用的流，清空视频"

### 潜在问题和建议
1. 如果问题仍存在，建议将 stream 管理完全移到父组件 LiveScoring 中，避免子组件卸载导致流丢失
2. 可以考虑使用 Zustand 或其他状态管理库来全局管理 stream 状态
3. 某些浏览器可能需要用户交互才能播放视频，可以考虑添加"点击播放"按钮作为回退方案

---

## 2026-02-22 - 视频显示异常尺寸问题修复

### 问题描述
全屏比对模式下实时画面区域显示黑屏：
- 正常布局下视频显示正常（1280x720）
- 倒计时结束后切换到全屏比对模式
- 全屏模式下实时画面区域显示黑屏
- FPS 正常（20），WebSocket 正常，说明摄像头和后端都工作正常
- 关键日志：布局切换后 `[LiveVideoPanel] loadedmetadata 事件触发: {videoWidth: 2, videoHeight: 2}` - 视频尺寸变成 2x2！

### 根本原因分析

#### 1. React 动态 key 导致组件重新挂载
LiveVideoPanel 使用了动态 key `key={live-${isFullscreenCompare}}`：
- 当布局切换时，key 值变化导致 React 完全卸载并重新创建组件
- video 元素被重新创建，MediaStream 状态可能无法正确传递
- 新 video 元素加载流时出现异常，导致尺寸变成 2x2

#### 2. Stream 保护标记重置时机不当
`ignoreNullStreamUpdateRef.current` 在 stopSession 中被无条件重置：
- 组件卸载时不应该重置这个保护标记
- 真实停止检测时才需要重置，避免中断正在进行的流处理

#### 3. 缺少异常视频尺寸的处理机制
当视频尺寸变成 2x2 这种异常状态时，没有自动恢复机制：
- 没有检测异常尺寸的代码
- 没有自动重新加载流的逻辑
- 导致视频一直处于显示异常状态

### 解决方案

#### 1. 移除动态 key 属性
```typescript
// 修改前
<LiveVideoPanel
  key={`live-${isFullscreenCompare}`}
  ...
/>

// 修改后
<LiveVideoPanel
  key="live-video-panel"
  ...
/>
```
LiveVideoPanel 使用固定 key，避免在布局切换时重新挂载组件：
- 全屏模式：`key="live-video-panel"`
- 常规模式：`key="live-video-panel-regular"`
- 确保组件在布局切换时不会被重新创建

#### 2. 修复保护标记重置逻辑
```typescript
// 只在真实停止检测时重置
if (reason !== 'cleanup') {
  ignoreNullStreamUpdateRef.current = false;
} else {
  console.log('[stopSession] 组件卸载 cleanup，保持保护标记不重置');
}
```

#### 3. 添加异常视频尺寸检测和自动修复
在 LiveVideoPanel 的定时监控中添加：
```typescript
// 检测异常视频尺寸（<= 2x2）
if (checkVideo.srcObject instanceof MediaStream &&
    (vw === 0 || vw <= 2 || vh <= 2) && state >= 1) {
  console.warn('[LiveVideoPanel] 检测异常：视频尺寸异常小');

  // 重新加载流
  const stream = checkVideo.srcObject as MediaStream;
  checkVideo.pause();
  checkVideo.srcObject = null;
  void checkVideo.offsetWidth; // 强制回流
  checkVideo.srcObject = stream;
  checkVideo.play();
}
```

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/pages/LiveScoring.tsx` | 修改 | 移除动态 key，修复保护标记重置逻辑 |
| `front/components/LiveVideoPanel.tsx` | 修改 | 添加异常视频尺寸检测和自动修复 |

### 预期效果
修复后，当倒计时结束切换到全屏比对模式时：
1. LiveVideoPanel 组件不会被重新挂载
2. 视频流状态保持稳定
3. 如果出现尺寸异常会自动修复
4. 实时画面应该能够正常显示，不再黑屏

### 调试建议
由于我无法直接在您的浏览器中执行调试代码，建议您在浏览器控制台中手动执行：
1. 在倒计时结束后（刚刚切换到全屏模式时），执行我提供的调试代码
2. 观察 videoWidth/videoHeight 是否为 2x2
3. 检查是否有异常日志输出
4. 如果发现异常，修复后的代码会自动重新加载流

### 潜在问题
1. 修复后需要重新测试布局切换流程，确保没有其他副作用
2. 自动修复机制可能在某些网络不稳定情况下频繁触发，建议观察控制台日志
3. 如果问题仍存在，可能是浏览器特定的视频流处理问题

---

## 2026-02-22 - 修复全屏模式黑屏问题（根本解决方案）

### 问题描述
全屏比对模式下实时画面区域显示黑屏：
- 正常布局下视频显示正常（1280x720）
- 倒计时结束后切换到全屏比对模式
- 全屏模式下实时画面区域显示黑屏
- FPS 正常（20），WebSocket 正常，说明摄像头和后端都工作正常

### 根本原因分析
之前的修复尝试使用了不同的 key 值：
- 全屏模式：`key="live-video-panel"`
- 常规模式：`key="live-video-panel-regular"`

当布局切换时，React 认为 key 不同，必须完全卸载旧组件并挂载新组件。这导致：
1. LiveVideoPanel 组件被重新创建
2. video 元素被重新创建
3. MediaStream 状态无法正确传递到新元素
4. video 元素加载流时出现异常，尺寸变成 2x2

### 解决方案

#### 1. 统一 key 值
```typescript
// 修改前 - 两种模式使用不同 key
// 全屏模式：key="live-video-panel"
// 常规模式：key="live-video-panel-regular"

// 修改后 - 始终使用相同 key
key="live-video-panel"
```

#### 2. 消除条件渲染，使用单一布局
不再使用 `{isFullscreenCompare ? A : B}` 的条件渲染结构，因为这种结构会导致 React 卸载和重新挂载组件。

改为：
- 始终渲染 LiveVideoPanel 组件
- 通过 CSS 类名控制布局方式
- 使用 `{!isFullscreen && ...}` 条件来隐藏/显示控制面板

#### 3. 布局结构统一
```typescript
// 主视频区域 - 两种布局使用相同结构
<div className={`${
  isFullscreenCompare
    ? 'flex h-full gap-4 pr-4' // 全屏模式：横向布局
    : 'grid grid-rows-2 gap-4'  // 常规模式：纵向布局
}`}>
  {/* 两个视频始终存在，只改变布局方式 */}
  <div className={`${
    isFullscreenCompare
      ? 'flex-1 grid grid-cols-2 gap-4'
      : 'grid grid-cols-2 gap-4'
  }`}>
    {/* 标准动作视频 */}
    <LiveVideoPanel key="standard-video-panel" ... />

    {/* 实时画面 */}
    <LiveVideoPanel key="live-video-panel" ... />
  </div>

  {/* 控制面板 - 通过条件显示/隐藏 */}
  <div className={`${
    isFullscreenCompare
      ? `flex flex-col ${showStatsPanel ? 'w-80' : 'hidden'}`
      : 'grid grid-cols-3 gap-4'
  }`}>
    {/* 音乐选择 - 只在常规模式显示 */}
    {!isFullscreenCompare && <MusicSelector ... />}

    {/* 摄像头选择 - 只在常规模式显示 */}
    {!isFullscreenCompare && <CameraSelector ... />}

    {/* 统计面板 - 两种模式都显示 */}
    {isFullscreenCompare && showStatsPanel && <FullscreenStats ... />}
    {!isFullscreenCompare && <RegularStats ... />}
  </div>
</div>
```

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `front/pages/LiveScoring.tsx` | 重大修改 | 消除条件渲染，统一布局结构，统一 key 值 |

### 技术要点

#### React 组件复用机制
- React 通过 `key` 属性识别组件身份
- 相同 `key` 时，React 会复用组件实例，只更新 props
- 不同 `key` 时，React 会完全卸载旧组件，创建新组件

#### 条件渲染 vs CSS 控制显示
- **条件渲染**：`{condition && <Component />}` - 组件会被卸载/挂载
- **CSS 隐藏**：`className="hidden"` - 组件保持挂载，只改变显示状态

#### 为什么之前的修复失败
1. 添加固定 key 但没有消除条件渲染
2. 条件渲染导致父容器结构变化
3. 父容器变化使 React 判断子组件需要重新挂载

### 预期效果
修复后，当倒计时结束切换到全屏比对模式时：
1. LiveVideoPanel 组件不会被卸载和重新挂载
2. video 元素保持不变，MediaStream 持续存在
3. 视频尺寸保持正常（1280x720），不会变成 2x2
4. 实时画面正常显示，不再黑屏

### 测试建议
1. 启动摄像头，选择标准动作和音乐
2. 点击"开始检测"，等待 5 秒倒计时
3. 验证全屏模式下实时画面正常显示摄像头视频
4. 点击"停止"返回常规模式
5. 重复上述流程，确保多次切换都正常工作
6. 检查控制台，确认没有组件重新挂载的警告

### 潜在问题和建议
1. **性能影响**：由于控制面板被隐藏而非卸载，可能占用少量内存
   - 影响：微小，因为主要是 UI 渲染成本
   - 必要性：为了保持 LiveVideoPanel 组件不重新挂载，这是必要的权衡

2. **后续优化**：如果性能成为问题，可以考虑：
   - 使用 React Portal 将控制面板渲染到其他位置
   - 使用状态管理库（Zustand、Jotai）全局管理 stream 状态

---

**最后更新**: 2026-02-22
