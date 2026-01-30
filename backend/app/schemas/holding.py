from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class HoldingBase(BaseModel):
    portfolio_id: int = Field(..., description="组合ID")
    asset_id: int = Field(..., description="资产ID")
    snap_date: date = Field(..., description="快照日期")
    shares: Optional[float] = Field(None, description="份额/股数")
    market_value: float = Field(..., gt=0, description="市值")
    cost_value: Optional[float] = Field(None, description="成本")
    weight: Optional[float] = Field(None, description="占比")
    source: str = Field(default="manual", description="来源")
    note: Optional[str] = Field(None, description="备注")


class HoldingCreate(HoldingBase):
    pass


class HoldingResponse(HoldingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuickHoldingCreate(BaseModel):
    """快速创建持仓（用于添加/编辑资产时）"""
    asset_id: int
    shares: Optional[float] = None
    market_value: float
    cost_value: Optional[float] = None

