from sqlalchemy.orm import Session
from models.user import User

def get_user_by_username(db: Session, username: str):
    """
    根据用户名获取用户

    :param db: 数据库会话
    :param username: 用户名
    :return: 用户模型实例 或 None
    """
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, username: str, hashed_password: str, role: str = "user"):
    """
    创建新用户

    :param db: 数据库会话
    :param username: 用户名
    :param hashed_password: 已加密的密码
    :param role: 用户角色 (默认为 user)
    :return: 创建后的用户模型实例
    """
    user = User(
        username=username,
        hashed_password=hashed_password,
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
