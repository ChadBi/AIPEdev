"""应用配置。

使用环境变量读取配置，便于不同环境（开发/生产）切换。
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
	"""配置类。

	变量名可通过环境变量覆盖（例如 DATABASE_URL）。
	"""

	# 数据库连接字符串
	DATABASE_URL: str = "sqlite:///./app.db"
	# JWT 密钥（生产环境必须更换）
	JWT_SECRET: str = "change-me"
	# JWT 加密算法
	JWT_ALGORITHM: str = "HS256"
	# 令牌过期时间（分钟）
	ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

	class Config:
		# 允许从 .env 文件读取配置
		env_file = ".env"


# 全局配置实例
settings = Settings()
