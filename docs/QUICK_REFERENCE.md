# 快速参考卡 (Quick Reference)

## 🚀 常用命令

### 启动服务

```bash
# 启动后端（开发模式）
uvicorn main:app --reload

# 启动后端（生产模式）
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# 启动前端
cd front && npm run dev

# 构建前端
cd front && npm run build
```

### 数据库操作

```bash
# 初始化数据库
python init_db.py

# 执行迁移
python migrations/migrate_xxx.py

# 备份数据库
mysqldump -u root -p aipe_db > backup.sql

# 恢复数据库
mysql -u root -p aipe_db < backup.sql
```

### 开发工具

```bash
# 安装依赖
pip install -r requirements.txt
cd front && npm install

# 创建虚拟环境
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# 清理缓存
Get-ChildItem -Path . -Filter __pycache__ -Recurse -Directory | Remove-Item -Recurse -Force
```

## 📁 目录导航

```
AIPEdev/
├── api/              # API路由（15个端点）
├── core/             # 核心配置
├── models/           # 数据库模型（5个表）
├── services/         # 业务逻辑（评分、识别）
├── crud/             # 数据访问
├── schemas/          # Pydantic模式
├── utils/            # 工具函数
├── migrations/       # 数据库迁移（4个脚本）
├── docs/             # 文档（6个文件）
├── front/            # React前端
│   ├── pages/        # 页面组件（12个页面）
│   ├── components/   # 通用组件
│   └── api.ts        # API客户端
├── config.yaml       # 配置文件
└── main.py           # 应用入口
```

## 🔧 配置速查

### 数据库连接

```yaml
database:
  host: localhost
  port: 3306
  user: root
  password: your_password
  database: aipe_db
```

### YOLOv8识别

```yaml
yolo:
  model_path: yolov8n-pose.pt
  device: cpu  # 或 'cuda'
  confidence: 0.35
```

### 评分算法

```yaml
scoring:
  angle_penalty: 1.2
  enable_sequence_loop: false
```

## 🌐 URL速查

| 服务 | 开发环境 | 生产环境 |
|------|---------|---------|
| 前端 | http://localhost:5173 | https://your-domain.com |
| 后端 | http://localhost:8000 | https://your-domain.com/api |
| API文档 | http://localhost:8000/docs | - |
| 健康检查 | http://localhost:8000/health | https://your-domain.com/api/health |

## 📊 关键数据

### 关节权重

| 关节 | 权重 | 重要性 |
|------|------|--------|
| 膝关节 | 1.5 | 最高 |
| 髋关节 | 1.3 | 高 |
| 肩关节 | 1.2 | 中高 |
| 肘关节 | 1.0 | 中等 |

### 评分标准

- **优秀 (90-100)**: 动作标准，继续保持
- **良好 (80-89)**: 基本规范，可优化
- **一般 (70-79)**: 需要改进
- **较差 (<70)**: 明显不规范

### 评分公式

```
关节得分 = 100 - (平均角度差 × 1.2)
总分 = Σ(关节得分 × 权重) / Σ(权重)
```

## 🔐 安全相关

### 生成密钥

```bash
# 生成SECRET_KEY
openssl rand -hex 32
```

### Token格式

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 密码要求

- 最小长度: 6位（建议8位以上）
- 建议包含: 大小写字母+数字+特殊字符

## 🐛 调试技巧

### 查看日志

```bash
# FastAPI日志（控制台）
uvicorn main:app --reload --log-level debug

# 系统日志（生产环境）
sudo journalctl -u aipe -f
```

### 常见错误

1. **数据库连接失败**
   - 检查MySQL服务: `systemctl status mysql`
   - 验证配置: `config.yaml`

2. **YOLO识别失败**
   - 检查模型文件: `yolov8n-pose.pt`
   - 检查依赖: `pip list | grep ultralytics`

3. **前端无法连接后端**
   - 检查CORS配置: `main.py`
   - 检查API_BASE_URL: `front/api.ts`

### 测试端点

```bash
# 健康检查
curl http://localhost:8000/health

# 测试登录
curl -X POST http://localhost:8000/auth/login \
  -d "username=test&password=test123"
```

## 📦 依赖版本

### Python (requirements.txt)
- FastAPI: ~0.100+
- SQLAlchemy: ~2.0+
- Pydantic: ~2.0+
- ultralytics: ~8.0+
- opencv-python: ~4.8+

### Node.js (front/package.json)
- React: ^18.2.0
- TypeScript: ^5.0.0
- Vite: ^5.0.0
- React Router: ^6.20.0

## 🎯 性能参数

### 视频处理
- 采样率: 6 FPS
- 最大文件: 500MB
- 支持格式: MP4, AVI, MOV

### 识别性能
- CPU模式: ~5秒/10秒视频
- GPU模式: ~1秒/10秒视频

### 数据库
- 连接池: 5-20
- 超时时间: 30秒

## 📞 帮助资源

| 资源 | 位置 |
|------|------|
| 主文档 | README.md |
| API文档 | docs/API.md |
| 部署指南 | docs/DEPLOYMENT.md |
| 项目总结 | docs/PROJECT_SUMMARY.md |
| Swagger UI | http://localhost:8000/docs |

## 🎨 前端路由

| 路径 | 说明 |
|------|------|
| / | 首页/仪表板 |
| /login | 登录 |
| /register | 注册 |
| /actions | 动作库 |
| /actions/:id | 动作详情 |
| /scoring | 评分 |
| /scores/result/:id | 评分结果 |
| /scores/history | 历史记录 |
| /videos | 视频库 |
| /profile | 用户资料 |

---

💡 提示: 将此页面加入浏览器书签，方便随时查阅！
