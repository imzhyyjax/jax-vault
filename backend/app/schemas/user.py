from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="登录邮箱")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="登录密码")


class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

