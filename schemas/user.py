from pydantic import BaseModel

class UserCreate(BaseModel):
    """用户注册请求模型"""
    username: str
    password: str

class UserLogin(BaseModel):
    """用户登录请求模型"""
    username: str
    password: str

class UserOut(BaseModel):
    """用户响应模型"""
    id: int
    username: str
    role: str = "user"

    class Config:
        from_attributes = True
