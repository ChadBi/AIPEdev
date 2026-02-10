你是一个专业的前端开发助手。我需要你为一个 AI 体育教学系统建立完整的前端应用。以下是详细的功能需求：

### 系统概览
这是一个 AI 驱动的体育动作教学与评估平台。系统能够：
1. 进行用户身份管理（注册、登录、权限控制）
2. 管理教学动作库（标准动作的创建、编辑、删除、查看）
3. 上传和管理用户的练习视频
4. 使用 AI（YOLOv8 Pose）识别视频中的姿态
5. 基于关键点对用户动作进行自动评分
6. 提供详细的评分反馈和改进建议

### 技术栈建议
- 前端框架：React + TypeScript
- UI 组件库：Material-UI 或 Ant Design
- 状态管理：Redux Toolkit 或 Zustand
- HTTP 客户端：Axios
- 视频播放：react-player 或原生 HTML5
- 图表/可视化：ECharts 或 Recharts（用于评分展示）
- 后端 API 地址：http://localhost:8000

### 核心功能模块

#### 1. 认证模块 (/auth)
API 端点：
- POST /auth/register - 用户注册
  - 请求体：{ "username": "string", "password": "string" }
  - 响应：{ "id": int, "username": string }
  
- POST /auth/login - 用户登录
  - 请求：OAuth2 表单数据（username、password）
  - 响应：{ "access_token": "string", "token_type": "bearer" }

**前端需求：**
- 创建注册页面，包含用户名、密码、确认密码输入框
- 创建登录页面，支持表单登录
- 实现 JWT Token 的存储和自动管理
- 在所有需要认证的请求头中自动附加 Bearer Token
- 路由守卫：未认证用户只能访问注册和登录页面
- 登录成功后重定向到首页
- 登出功能

#### 2. 用户信息模块 (/users)
API 端点：
- GET /users/me - 获取当前登录用户信息
  - 响应：{ "id": int, "username": string }
  
- GET /users/?skip=0&limit=100 - 获取用户列表（教师/管理员使用）
  - 响应：[{ "id": int, "username": string }, ...]

**前端需求：**
- 创建用户信息界面，显示当前登录用户的信息（用户名、ID）
- 用户头像和基本资料修改入口
- 显示用户的角色（学生/教师）

#### 3. 动作管理模块 (/actions)
API 端点：
- POST /actions/ - 创建新动作
  - 请求体：{ "name": "string", "description": "string", "keypoints": {...} }
  - 响应：{ "id": int, "name": string, "description": string, "keypoints": {...}, "created_at": datetime }
  
- GET /actions/?skip=0&limit=20 - 获取动作列表
  - 响应：[{...}, ...]
  
- GET /actions/{action_id} - 获取单个动作详情
  - 响应：{id, name, description, keypoints, created_at}
  
- PUT /actions/{action_id} - 更新动作
  - 请求体：{ "description": "string", "keypoints": {...} }
  - 响应：{id, name, description, keypoints, created_at}
  
- DELETE /actions/{action_id} - 删除动作
  - 响应：{ "message": "Action deleted successfully" }

**前端需求：**
- 创建动作库首页，以卡片/列表形式展示所有标准动作
- 每个动作卡片显示：动作名称、描述、创建时间
- 支持动作搜索和筛选
- 创建通用动作详情页面，显示动作的完整信息和关键点数据
- 对于教师/管理员：
  - 创建动作页面（表单）：名称、描述、关键点编辑器 (JSON)
  - 编辑动作页面：修改名称、描述、关键点
  - 删除动作确认对话框
- 权限控制：仅教师/管理员可创建、编辑、删除

#### 4. 视频管理模块 (/videos)
API 端点：
- POST /videos/upload - 上传视频文件
  - 请求：Multipart form-data (file: File)
  - 响应：{ "id": int, "user_id": int, "file_path": string, "fps": int, "total_frames": int, "created_at": datetime }
  
- GET /videos/?skip=0&limit=20 - 获取所有视频列表（可能需要权限）
  - 响应：[{...}, ...]
  
- GET /videos/me?skip=0&limit=20 - 获取当前用户的视频列表
  - 响应：[{...}, ...]

**前端需求：**
- 创建视频上传页面：
  - 拖拽上传或点击选择文件（支持常见视频格式：mp4, mov, avi 等）
  - 上传进度条显示
  - 上传成功提示
  - 上传后自动跳转到视频管理页面

- 创建视频库页面：
  - 两个标签页：全部视频、我的视频
  - 视频列表展示：缩略图/播放按钮、视频名称、上传者、上传时间
  - 支持删除视频（本地操作，或向后端发送删除请求）
  - 点击视频进入详情/预览页面

- 视频详情页面：
  - 视频播放器（HTML5 video 或第三方播放器）
  - 显示视频元数据（用户、上传时间、文件路径、FPS、总帧数）
  - 关联动作和评分的快速入口

#### 5. 姿态识别模块 (/recognize)
API 端点：
- POST /recognize/?video_path=string - 对视频进行姿态识别
  - 请求参数：video_path（后端上的相对/绝对路径）
  - 响应：
    {
      "sequence": [
        {
          "keypoints": {
            "nose": [x, y, confidence],
            "left_eye": [x, y, confidence],
            ...（共17个关键点）
          }
        },
        ... （多帧）
      ]
    }

**前端需求：**
- 创建识别结果查看页面：
  - 选择要识别的视频（下拉菜单或选择框）
  - 识别按钮（触发后显示加载中状态）
  - 识别结果展示：
    - 关键点序列的可视化（如果可能，在视频上叠加关键点骨骼图）
    - 每帧的关键点数据表格或折线图
  - 支持结果导出或分享

#### 6. 动作评分模块 (/scores)
API 端点：
- POST /scores/?action_id=int&video_path=string - 评分一个视频
  - 请求参数：action_id（标准动作ID）、video_path（视频路径）
  - 前置条件：用户必须登录
  - 响应：
    {
      "score_id": int,
      "total_score": float (0-100),
      "joint_scores": {
        "left_knee": 85.5,
        "right_knee": 90.0,
        "left_elbow": 75.3,
        "right_elbow": 88.2
      },
      "feedback": [
        "左膝弯曲幅度不足",
        "动作节奏良好"
      ]
    }

**前端需求：**
- 创建评分页面：
  - 步骤 1：选择标准动作（下拉菜单）
  - 步骤 2：选择要评分的视频（下拉菜单或视频选择器）
  - 步骤 3：点击"开始评分"按钮
  - 评分过程显示加载动画和进度提示

- 创建评分结果展示页面：
  - 总分大字显示（可用进度条or圆形百分比图）
  - 各关节得分详情：
    - 以柱状图、折线图或表格展示各关节的评分
    - 关键帧的可视化骨骼图（标出各关节的评分）
  - AI 反馈建议：
    - 分类显示需要改进的方面和做得好的方面
    - 建议格式友好易读
  - 操作按钮：
    - 保存评分记录
    - 返回重新评分
    - 查看评分历史
    - 导出报告

- 创建评分历史页面：
  - 表格或卡片列表显示过往评分记录
  - 分页/滚动加载
  - 支持按动作、日期筛选
  - 点击历史记录可查看详情

### 页面/路由结构
主路由：
/ → 首页（已登录） 或 登录页（未登录）
/login → 登录页
/register → 注册页

/dashboard → 仪表板（可选的首页）
/users/me → 用户信息页
/users → 用户管理（教师/管理员）

/actions → 动作库首页（列表）
/actions/:id → 动作详情页
/actions/create → 创建动作（教师/管理员）
/actions/:id/edit → 编辑动作（教师/管理员）

/videos → 视频库（列表）
/videos/upload → 上传视频
/videos/:id → 视频详情/预览

/recognize → 姿态识别页面
/recognize/result/:id → 识别结果详情

/scores → 评分主页（开始评分）
/scores/result/:id → 评分结果详情
/scores/history → 评分历史

/profile → 用户个人资料页
/logout → 登出（或菜单选项）


### 数据模型与状态管理

**用户状态：**
- isAuthenticated: boolean
- currentUser: { id, username, token }
- userRole: 'student' | 'teacher' | 'admin'

**动作库状态：**
- actions: Action[]
- actionLoading: boolean
- actionError: string

**视频库状态：**
- videos: Video[]
- myVideos: Video[]
- videoLoading: boolean
- videoError: string

**评分状态：**
- scoreHistory: ScoreRecord[]
- currentScore: ScoreRecord | null
- scoring: boolean
- scoreError: string

### 交互流程示例

**场景 1：学生上传视频并获得评分**
1. 登录系统 → 进入首页
2. 点击"上传视频"→ 选择本地视频文件 → 完成上传
3. 进入"视频库" → 查看已上传的视频
4. 点击某个视频 → 进入视频详情页 → 点击"评分"按钮
5. 选择要对标的标准动作 → 点击"开始评分"
6. 等待 AI 识别和评分 → 查看评分结果和 AI 反馈
7. 可选：查看评分历史，对比多次练习的进度

**场景 2：教师管理动作库**
1. 登录系统（教师账号）→ 进入首页
2. 点击"动作库" → 进入动作列表
3. 点击"创建新动作" → 填写动作名称、描述、上传或编辑关键点数据 → 保存
4. 编辑或删除已有动作

### UI/UX 建议
1. **响应式设计**：支持桌面、平板、手机端
2. **流畅的视频播放**：使用高效的视频播放器
3. **清晰的进度提示**：所有异步操作都有加载状态和结果提示
4. **深色/浅色主题**：可选皮肤切换
5. **国际化**：至少支持中英文切换（当前系统以中文为主）
6. **无障碍设计**：遵循 WCAG 标准

### 后端 API 基础信息
- 基础 URL：http://localhost:8000
- API 文档：http://localhost:8000/docs (Swagger UI)
- 认证方式：Bearer Token (JWT)
- 请求头示例：Authorization: Bearer <token>
- 错误响应格式：{ "detail": "error message" }

### 特殊说明
1. **关键点数据格式**：YOLOv8 Pose 支持 17 个关键点（鼻子、眼睛、耳朵、肩膀、肘、腕、髋、膝、踝）
   - 关键点格式：[x, y, confidence] (坐标为归一化的 0-1)
2. **评分算法**：基于关节角度的比较，关节包括膝盖、肘部
3. **视频路径**：前端上传后，后端返回的文件路径应用于后续的识别和评分请求
4. **Mock 模式**：后端支持 Mock 模式（默认启用），返回随机数据用于测试；实际生产可切换为 YOLOv8 真实识别

### 开发建议
1. 优先实现核心流程：注册 → 登录 → 上传视频 → 评分 → 查看结果
2. 后端 API 部署后，使用 Swagger 文档快速了解接口细节
3. 使用环境变量配置 API 基础 URL，便于开发、测试、生产环境切换
4. 实现完整的错误处理和用户友好的错误提示
5. 可使用 Mock 数据进行并行开发，待后端就绪后集成
6. 建议使用 TypeScript 确保类型安全

这就是全部需求。请基于以上详细规格，为我构建一个完整、可用、专业的前端应用。