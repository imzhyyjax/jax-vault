from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


class PriceBase(BaseModel):
    asset_id: int = Field(..., description="资产ID")
    price_date: date = Field(..., description="价格日期")
    nav: float = Field(..., gt=0, description="单位净值")
    acc_nav: Optional[float] = Field(None, description="累计净值")
    source: str = Field(default="manual", description="数据来源")


class PriceCreate(PriceBase):
    pass


class PriceResponse(PriceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PriceBatchImport(BaseModel):
    """批量导入价格数据"""
    asset_id: int
    prices: list[dict]  # [{date, nav, acc_nav}, ...]

