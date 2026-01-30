from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AssetBase(BaseModel):
    market: str = Field(..., description="市场: CN/US/HK")
    code: str = Field(..., description="资产代码")
    name: str = Field(..., description="资产名称")
    bucket: str = Field(..., description="类型: progressive/defensive")
    subclass: str = Field(..., description="子类")
    currency: str = Field(default="CNY", description="币种")
    benchmark: str = Field(default="NONE", description="基准指数")
    provider: Optional[str] = Field(None, description="提供商")
    status: str = Field(default="watchlist", description="状态: holding/archived/watchlist")


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    bucket: Optional[str] = None
    subclass: Optional[str] = None
    currency: Optional[str] = None
    benchmark: Optional[str] = None
    provider: Optional[str] = None
    status: Optional[str] = None


class AssetResponse(AssetBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetFromUniverseRequest(BaseModel):
    """从基金库添加资产"""
    fund_code: str = Field(..., description="基金代码")
    bucket: str = Field(..., description="类型: progressive/defensive")
    subclass: str = Field(..., description="子类")
    status: str = Field(default="watchlist", description="状态")

