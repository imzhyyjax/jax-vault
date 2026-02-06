from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import httpx
from datetime import datetime, time
import asyncio
import json
import re
from app.db.session import get_conn
from app.schemas.estimate import FundEstimateResponse, BatchEstimateResponse
from app.deps import get_current_user

router = APIRouter(prefix="/estimates", tags=["estimates"])

# 简单的内存缓存（生产环境建议使用 Redis）
_cache = {}
_cache_ttl = 300  # 5分钟缓存


def is_trading_time() -> bool:
    """判断是否在交易时间内（工作日 9:00-15:00）"""
    now = datetime.now()
    # 周末不交易
    if now.weekday() >= 5:  # 5=周六, 6=周日
        return False
    # 交易时间 9:00-15:00
    current_time = now.time()
    return time(9, 0) <= current_time <= time(15, 0)


def _to_float(value: Optional[str | float]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def fetch_eastmoney_estimate(fund_code: str) -> Optional[dict]:
    """备用：从天天基金接口获取实时估值"""
    url = f"https://fundgz.1234567.com.cn/js/{fund_code}.js"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://fund.eastmoney.com/",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    try:
        print(f"🔁 切换备用接口: {url}")
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                print(f"⚠️ 备用接口返回状态码: {response.status_code}")
                return None
            text = response.text.strip()
            match = re.search(r"jsonpgz\((.*)\)", text)
            if not match:
                print("⚠️ 备用接口返回格式异常")
                return None
            data = json.loads(match.group(1))
            return {
                "fund_code": fund_code,
                "estimate_value": _to_float(data.get("gsz")),
                "estimate_change_pct": _to_float(data.get("gszzl")),
                "estimate_time": data.get("gztime"),
                "last_nav": _to_float(data.get("dwjz")),
                "last_nav_date": data.get("jzrq"),
                "cached": False,
            }
    except Exception as e:
        print(f"❌ 备用接口异常: {type(e).__name__}: {e}")
        return None


async def fetch_fund_estimate(fund_code: str) -> Optional[dict]:
    """
    从 fund123.cn 获取单个基金的实时估值
    
    返回格式示例:
    {
        "fund_code": "161725",
        "estimate_value": 1.234,
        "estimate_change_pct": 0.56,
        "estimate_time": "2026-02-02 14:30:00",
        "last_nav": 1.227,
        "last_nav_date": "2026-02-01"
    }
    """
    print(f"\n{'='*60}")
    print(f"📊 正在获取基金实时估值: {fund_code}")
    print(f"{'='*60}")
    
    # 检查缓存
    cache_key = f"estimate_{fund_code}"
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        age = (datetime.now() - cached_time).total_seconds()
        if age < _cache_ttl:
            print(f"💾 使用缓存数据 (缓存时间: {age:.0f}秒前)")
            return {**cached_data, "cached": True}
    
    try:
        url = "https://www.fund123.cn/api/fund/queryFundEstimateIntraday"
        params = {"fundCode": fund_code}
        
        # 添加浏览器请求头，避免被反爬虫拦截
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.fund123.cn/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        
        print(f"🌐 请求URL: {url}")
        print(f"📝 参数: {params}")
        
        # 访问国内网站，跳过系统代理设置
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=False) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code == 404:
                print("⚠️ fund123 返回 404，尝试备用接口")
                data = await fetch_eastmoney_estimate(fund_code)
                if data:
                    _cache[cache_key] = (data, datetime.now())
                return data
            response.raise_for_status()
            data = response.json()
            
            print(f"✅ 接口响应成功")
            print(f"📦 原始数据: {data}")
            
            # 解析响应数据（根据实际接口格式调整）
            # 这里假设返回格式，你需要根据实际接口调整
            if data and isinstance(data, dict):
                result = {
                    "fund_code": fund_code,
                    "estimate_value": data.get("gsz"),  # 估算净值
                    "estimate_change_pct": data.get("gszzl"),  # 估算涨跌幅
                    "estimate_time": data.get("gztime"),  # 估值时间
                    "last_nav": data.get("dwjz"),  # 昨日净值
                    "last_nav_date": data.get("jzrq"),  # 昨日净值日期
                    "cached": False
                }
                
                # 更新缓存
                _cache[cache_key] = (result, datetime.now())
                
                print(f"💰 估算净值: {result['estimate_value']}")
                print(f"📈 估算涨跌: {result['estimate_change_pct']}%")
                print(f"⏰ 估值时间: {result['estimate_time']}")
                
                return result
            else:
                print(f"⚠️ 接口返回数据格式异常，尝试备用接口")
                data = await fetch_eastmoney_estimate(fund_code)
                if data:
                    _cache[cache_key] = (data, datetime.now())
                return data
                
    except httpx.TimeoutException:
        print(f"⏱️ 请求超时 (10秒)")
        return None
    except httpx.HTTPError as e:
        print(f"❌ HTTP错误: {e}")
        return None
    except Exception as e:
        print(f"❌ 未知错误: {type(e).__name__}: {e}")
        return None


@router.get("/fund/{asset_id}", response_model=FundEstimateResponse)
async def get_fund_estimate_by_asset(asset_id: int, current_user=Depends(get_current_user)):
    """
    根据资产ID获取实时估值
    
    - 先查询资产表获取基金代码
    - 调用 fund123.cn 接口获取实时估值
    - 只在交易时间内查询，否则返回历史数据
    """
    print(f"\n{'='*80}")
    print(f"🎯 API调用: 获取资产 #{asset_id} 的实时估值")
    print(f"{'='*80}")
    
    trading = is_trading_time()
    print(f"⏰ 当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📊 交易状态: {'交易时间' if trading else '非交易时间'}")
    
    conn = get_conn()
    cursor = conn.cursor()
    
    try:
        # 查询资产信息
        cursor.execute("""
            SELECT a.id, a.name, a.code, a.market
            FROM assets a
            WHERE a.id = %s
            AND a.user_id = %s
        """, (asset_id, current_user["id"]))
        
        asset = cursor.fetchone()
        if not asset:
            print(f"❌ 资产不存在: asset_id={asset_id}")
            raise HTTPException(status_code=404, detail="资产不存在")
        
        # RealDictCursor 返回字典，需要用字典方式访问
        asset_id_val = asset['id']
        asset_name = asset['name']
        code = asset['code']
        market = asset['market']
        print(f"✅ 找到资产: {asset_name} (代码: {code}, 市场: {market})")
        
        # 只有中国市场的基金才支持实时估值
        if market != "CN":
            print(f"⚠️ 非中国市场，不支持实时估值")
            return FundEstimateResponse(
                asset_id=asset_id_val,
                asset_name=asset_name,
                fund_code=code,
                is_trading_time=trading
            )
        
        # 非交易时间，返回空估值
        if not trading:
            print(f"⏸️ 非交易时间，跳过估值查询")
            return FundEstimateResponse(
                asset_id=asset_id_val,
                asset_name=asset_name,
                fund_code=code,
                is_trading_time=False
            )
        
        # 获取实时估值
        estimate_data = await fetch_fund_estimate(code)
        
        if estimate_data:
            print(f"🎉 成功获取实时估值")
            return FundEstimateResponse(
                asset_id=asset_id_val,
                asset_name=asset_name,
                is_trading_time=trading,
                **estimate_data
            )
        else:
            print(f"⚠️ 未获取到估值数据")
            return FundEstimateResponse(
                asset_id=asset_id_val,
                asset_name=asset_name,
                fund_code=code,
                is_trading_time=trading
            )
        
    finally:
        cursor.close()
        conn.close()


@router.get("/batch", response_model=BatchEstimateResponse)
async def get_batch_estimates(
    asset_ids: str = Query(..., description="资产ID列表，逗号分隔，如: 1,2,3")
    ,
    current_user=Depends(get_current_user)
):
    """
    批量获取多个资产的实时估值
    
    - 适合资产管理页面批量查询
    - 并发请求，提高效率
    """
    print(f"\n{'='*80}")
    print(f"🎯 API调用: 批量获取实时估值")
    print(f"{'='*80}")
    
    trading = is_trading_time()
    print(f"⏰ 当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📊 交易状态: {'交易时间' if trading else '非交易时间'}")
    
    # 解析资产ID列表
    try:
        id_list = [int(x.strip()) for x in asset_ids.split(",") if x.strip()]
        print(f"📋 资产ID列表: {id_list} (共{len(id_list)}个)")
    except ValueError:
        print(f"❌ 资产ID格式错误")
        raise HTTPException(status_code=400, detail="资产ID格式错误")
    
    if not id_list:
        print(f"❌ 资产ID列表为空")
        raise HTTPException(status_code=400, detail="资产ID列表不能为空")
    
    # 并发查询所有资产
    tasks = [get_fund_estimate_by_asset(asset_id, current_user) for asset_id in id_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    estimates = []
    error_count = 0
    cached_count = 0
    
    for result in results:
        if isinstance(result, Exception):
            error_count += 1
            print(f"⚠️ 某个查询失败: {result}")
        else:
            estimates.append(result)
            if result.cached:
                cached_count += 1
    
    print(f"\n{'='*80}")
    print(f"✅ 批量查询完成:")
    print(f"   - 成功: {len(estimates)}")
    print(f"   - 失败: {error_count}")
    print(f"   - 缓存: {cached_count}")
    print(f"{'='*80}\n")
    
    return BatchEstimateResponse(
        estimates=estimates,
        total=len(estimates),
        is_trading_time=trading,
        cached_count=cached_count,
        error_count=error_count
    )


@router.post("/cache/clear")
async def clear_cache():
    """清空估值缓存"""
    global _cache
    count = len(_cache)
    _cache.clear()
    print(f"🗑️ 清空估值缓存: {count}条")
    return {"message": f"已清空 {count} 条缓存"}

