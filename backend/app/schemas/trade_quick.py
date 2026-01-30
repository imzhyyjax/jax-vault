from pydantic import BaseModel, Field
from datetime import date
from typing import Optional


class QuickBuyRequest(BaseModel):
    """快速买入请求"""
    asset_id: int = Field(..., description="资产ID")
    buy_amount: float = Field(..., gt=0, description="买入金额（含手续费）")
    buy_date: date = Field(..., description="买入日期")
    portfolio_id: Optional[int] = Field(None, description="组合ID（不填则使用默认组合）")
    note: Optional[str] = Field(None, description="备注")


class QuickBuyResponse(BaseModel):
    """快速买入响应"""
    success: bool
    trade_id: int
    portfolio_id: int
    asset_id: int
    buy_amount: float
    buy_date: date
    nav: float
    shares: float
    message: str

