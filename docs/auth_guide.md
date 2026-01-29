# 登录模块接口文档

## 1. 注册

- 方法：POST
- 路径：/auth/register
- 说明：创建新用户

请求体（JSON）：
```json
{
	"username": "user_001",
	"email": "user@example.com",
	"password": "Test@123456"
}
```

响应（200/201）：
```json
{
	"id": 1,
	"username": "user_001",
	"email": "user@example.com",
	"is_active": true,
	"created_at": "2026-01-29T12:00:00"
}
```

## 2. 登录

- 方法：POST
- 路径：/auth/login
- 说明：获取 Token（OAuth2 表单）

请求体（x-www-form-urlencoded）：
```
username=user_001
password=Test@123456
```

响应：
```json
{
	"access_token": "<token>",
	"token_type": "bearer"
}
```

## 3. 获取当前用户

- 方法：GET
- 路径：/auth/me
- 说明：需要 Bearer Token

请求头：
```
Authorization: Bearer <token>
```

响应：
```json
{
	"id": 1,
	"username": "user_001",
	"email": "user@example.com",
	"is_active": true,
	"created_at": "2026-01-29T12:00:00"
}
```

## 4. 获取所有用户

- 方法：GET
- 路径：/auth/userall
- 说明：返回用户列表

响应：
```json
[
	{
		"id": 1,
		"username": "user_001",
		"email": "user@example.com",
		"is_active": true,
		"created_at": "2026-01-29T12:00:00"
	}
]
```

## 主要文件

- [app/main.py](../app/main.py)：应用入口，挂路由。
- [app/api/auth.py](../app/api/auth.py)：注册/登录/当前用户接口。
- [app/services/auth_service.py](../app/services/auth_service.py)：用户相关逻辑。
- [app/core/security.py](../app/core/security.py)：密码加密和 Token。
- [app/db/session.py](../app/db/session.py)：数据库连接。
- [app/db/models.py](../app/db/models.py)：用户表。
- [app/schemas/auth.py](../app/schemas/auth.py)：请求/返回的数据结构。


