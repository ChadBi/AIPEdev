from datetime import timedelta
from core.security import hash_password, verify_password
from core.security import create_access_token as core_create_access_token

def create_access_token(user_id: int, expires_minutes: int = 60):
    """
    创建访问令牌 (Access Token)

    封装 core.security.create_access_token 以保持与原有服务签名的向后兼容性。

    :param user_id: 用户 ID
    :param expires_minutes: 过期时间 (分钟)，默认 60 分钟
    :return: JWT 令牌字符串
    """
    access_token_expires = timedelta(minutes=expires_minutes)
    return core_create_access_token(
        data={"user_id": user_id},
        expires_delta=access_token_expires
    )
