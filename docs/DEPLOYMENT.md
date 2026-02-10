# 部署指南

本文档介绍如何在生产环境部署 AIPE 系统。

## 🔧 环境要求

### 硬件要求
- CPU: 4核及以上（推荐8核）
- 内存: 8GB 及以上（推荐16GB）
- 存储: 50GB 及以上
- GPU: 可选（NVIDIA GPU 可加速识别）

### 软件要求
- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- Nginx (可选，用于反向代理)

## 📦 部署步骤

### 1. 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Python 和依赖
sudo apt install python3.10 python3.10-venv python3-pip -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# 安装 MySQL
sudo apt install mysql-server -y
```

### 2. 克隆项目

```bash
git clone <repository-url> /var/www/aipe
cd /var/www/aipe
```

### 3. 配置后端

```bash
# 创建虚拟环境
python3.10 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 编辑配置文件
cp config.yaml config.prod.yaml
nano config.prod.yaml  # 修改数据库连接等配置
```

### 4. 配置数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE aipe_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建用户
CREATE USER 'aipe_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON aipe_db.* TO 'aipe_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 初始化数据库
python init_db.py
```

### 5. 构建前端

```bash
cd front
npm install
npm run build
cd ..
```

### 6. 配置 Systemd 服务

创建 `/etc/systemd/system/aipe.service`:

```ini
[Unit]
Description=AIPE FastAPI Application
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/aipe
Environment="PATH=/var/www/aipe/.venv/bin"
ExecStart=/var/www/aipe/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable aipe
sudo systemctl start aipe
sudo systemctl status aipe
```

### 7. 配置 Nginx

创建 `/etc/nginx/sites-available/aipe`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/aipe/front/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件大小限制
    client_max_body_size 500M;
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/aipe /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. 配置 HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 🔒 安全加固

### 1. 修改默认密钥

编辑 `config.yaml`:
```yaml
security:
  secret_key: "使用 openssl rand -hex 32 生成的随机密钥"
  algorithm: HS256
  access_token_expire_minutes: 60
```

### 2. 配置防火墙

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. 配置日志轮转

创建 `/etc/logrotate.d/aipe`:

```
/var/log/aipe/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

## 📊 性能优化

### 1. 使用 GPU 加速

如果有 NVIDIA GPU：

```bash
# 安装 CUDA
# 安装 PyTorch with CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# 修改配置
yolo:
  device: cuda
```

### 2. 启用缓存

```yaml
cache:
  enabled: true
  redis_url: redis://localhost:6379/0
```

### 3. 数据库优化

```sql
-- MySQL 配置优化
SET GLOBAL max_connections = 500;
SET GLOBAL innodb_buffer_pool_size = 4G;
```

## 🔍 监控和维护

### 日志查看

```bash
# 查看应用日志
sudo journalctl -u aipe -f

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 健康检查

```bash
curl http://localhost:8000/health
```

### 备份数据库

```bash
# 创建备份脚本 /root/backup_aipe.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u aipe_user -p aipe_db > /backup/aipe_db_$DATE.sql
find /backup -name "aipe_db_*.sql" -mtime +7 -delete

# 添加到 crontab
0 2 * * * /root/backup_aipe.sh
```

## 🚨 故障排查

### 应用无法启动
1. 检查日志: `sudo journalctl -u aipe -n 50`
2. 检查端口占用: `sudo netstat -tulpn | grep 8000`
3. 检查配置文件: `python -c "from core.config import *"`

### 识别失败
1. 检查 YOLOv8 模型路径
2. 检查视频文件权限
3. 检查内存使用情况

### 数据库连接失败
1. 检查 MySQL 服务: `sudo systemctl status mysql`
2. 测试连接: `mysql -u aipe_user -p aipe_db`
3. 检查配置文件中的连接字符串

## 📞 技术支持

遇到问题请联系技术支持团队或查看项目文档。
