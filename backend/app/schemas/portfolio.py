from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PortfolioBase(BaseModel):
    name: str = Field(..., description="组合名称")
    include_in_overall: bool = Field(default=True, description="是否计入整体统计")


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    include_in_overall: Optional[bool] = None


class PortfolioResponse(PortfolioBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PortfolioWithStats(PortfolioResponse):
    """带统计信息的组合"""
    asset_count: int = 0
    total_value: float = 0.0
    total_cost: float = 0.0
    total_pnl: float = 0.0
    return_rate: float = 0.0

