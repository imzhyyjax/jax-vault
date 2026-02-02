from pydantic import BaseModel, Field
from typing import Optional


class PositionImportRequest(BaseModel):
    """导入持仓请求"""
    asset_id: int = Field(..., description="资产ID")
    current_value: float = Field(..., gt=0, description="当前持仓金额（市值）")
    profit_loss: float = Field(default=0, description="持有收益（盈亏）")
    portfolio_id: Optional[int] = Field(None, description="组合ID（不填则使用默认组合）")
    note: Optional[str] = Field(None, description="备注")


class PositionImportResponse(BaseModel):
    """导入持仓响应"""
    success: bool
    portfolio_id: int
    asset_id: int
    current_value: float
    profit_loss: float
    cost_value: float
    shares: Optional[float]
    nav: Optional[float]
    message: str

