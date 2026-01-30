from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time, datetime


class TradeBase(BaseModel):
    portfolio_id: int = Field(..., description="组合ID")
    asset_id: int = Field(..., description="资产ID")
    trade_date: date = Field(..., description="交易日期")
    trade_time: Optional[time] = Field(None, description="交易时间")
    side: str = Field(..., description="方向: buy/sell")
    quantity: float = Field(..., gt=0, description="数量")
    price: float = Field(..., gt=0, description="价格")
    amount: Optional[float] = Field(None, description="成交金额")
    fee: float = Field(default=0, description="手续费")
    is_valid: bool = Field(default=True, description="是否有效")
    source: str = Field(default="manual", description="来源: manual/system/import")
    note: Optional[str] = Field(None, description="备注")


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    portfolio_id: Optional[int] = None
    asset_id: Optional[int] = None
    trade_date: Optional[date] = None
    trade_time: Optional[time] = None
    side: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    amount: Optional[float] = None
    fee: Optional[float] = None
    is_valid: Optional[bool] = None
    source: Optional[str] = None
    note: Optional[str] = None


class TradeResponse(TradeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TradeWithDetails(TradeResponse):
    """带资产和组合详情的交易记录"""
    asset_code: str
    asset_name: str
    portfolio_name: str

