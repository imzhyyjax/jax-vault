from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FundEstimateBase(BaseModel):
    """基金实时估值基础模型"""
    fund_code: str
    estimate_value: Optional[float] = None  # 估算净值
    estimate_change_pct: Optional[float] = None  # 估算涨跌幅
    estimate_time: Optional[str] = None  # 估值时间
    last_nav: Optional[float] = None  # 昨日净值
    last_nav_date: Optional[str] = None  # 昨日净值日期


class FundEstimateResponse(FundEstimateBase):
    """单个基金估值响应"""
    asset_id: Optional[int] = None  # 关联的资产ID
    asset_name: Optional[str] = None  # 资产名称
    is_trading_time: bool = False  # 是否交易时间
    cached: bool = False  # 是否来自缓存


class BatchEstimateResponse(BaseModel):
    """批量估值响应"""
    estimates: list[FundEstimateResponse]
    total: int
    is_trading_time: bool
    cached_count: int
    error_count: int

