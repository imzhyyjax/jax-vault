from fastapi import APIRouter
from app.db.session import get_conn

router = APIRouter(prefix="/overall", tags=["Overall"])


@router.get("/stats")
def get_overall_stats():
    """获取整体统计数据（首页用）"""
    conn = get_conn()
    cur = conn.cursor()

    # 获取最新持仓快照日期
    latest_date_sql = """
    SELECT MAX(snap_date) as latest_date
    FROM holdings_snapshot h
    JOIN portfolios p ON p.id = h.portfolio_id
    WHERE p.include_in_overall = true
    """
    cur.execute(latest_date_sql)
    latest_result = cur.fetchone()
    latest_date = latest_result["latest_date"] if latest_result else None

    if not latest_date:
        # 没有持仓数据，返回零值
        cur.close()
        conn.close()
        return {
            "total_value": 0,
            "total_cost": 0,
            "total_pnl": 0,
            "daily_pnl": 0,
            "return_rate": 0,
            "asset_count": 0,
            "portfolio_count": 0,
            "has_data": False
        }

    # 获取整体统计（通过视图）
    stats_sql = """
    SELECT
        COALESCE(SUM(market_value), 0) as total_value,
        COALESCE(SUM(cost_value), 0) as total_cost,
        COALESCE(SUM(market_value) - SUM(cost_value), 0) as total_pnl,
        CASE 
            WHEN SUM(cost_value) > 0 
            THEN ((SUM(market_value) - SUM(cost_value)) / SUM(cost_value) * 100)
            ELSE 0 
        END as return_rate,
        COUNT(DISTINCT asset_id) as asset_count
    FROM v_overall_holdings
    WHERE snap_date = %(latest_date)s
    """
    
    cur.execute(stats_sql, {"latest_date": latest_date})
    stats = cur.fetchone()

    # 获取今日收益（如果有）
    daily_pnl_sql = """
    SELECT COALESCE(SUM(daily_pnl), 0) as daily_pnl
    FROM v_overall_pnl
    WHERE snap_date = %(latest_date)s
    """
    cur.execute(daily_pnl_sql, {"latest_date": latest_date})
    daily_result = cur.fetchone()

    # 获取已启用的组合数量
    portfolio_count_sql = """
    SELECT COUNT(*) as count
    FROM portfolios
    WHERE include_in_overall = true
    """
    cur.execute(portfolio_count_sql)
    portfolio_result = cur.fetchone()

    cur.close()
    conn.close()

    return {
        "total_value": float(stats["total_value"]),
        "total_cost": float(stats["total_cost"]),
        "total_pnl": float(stats["total_pnl"]),
        "daily_pnl": float(daily_result["daily_pnl"]),
        "return_rate": float(stats["return_rate"]),
        "asset_count": int(stats["asset_count"]),
        "portfolio_count": int(portfolio_result["count"]),
        "has_data": True,
        "latest_date": str(latest_date)
    }


@router.get("/holdings")
def get_overall_holdings():
    """获取整体持仓列表（带资产占比）"""
    conn = get_conn()
    cur = conn.cursor()

    # 获取最新日期
    latest_date_sql = """
    SELECT MAX(snap_date) as latest_date
    FROM holdings_snapshot h
    JOIN portfolios p ON p.id = h.portfolio_id
    WHERE p.include_in_overall = true
    """
    cur.execute(latest_date_sql)
    latest_result = cur.fetchone()
    latest_date = latest_result["latest_date"] if latest_result else None

    if not latest_date:
        cur.close()
        conn.close()
        return []

    # 先获取总市值（用于计算占比）
    total_value_sql = """
    SELECT COALESCE(SUM(market_value), 0) as total_value
    FROM v_overall_holdings
    WHERE snap_date = %(latest_date)s
    """
    cur.execute(total_value_sql, {"latest_date": latest_date})
    total_value_result = cur.fetchone()
    total_value = float(total_value_result["total_value"])

    # 获取整体持仓（聚合后，带占比）
    sql = """
    SELECT
        h.asset_id,
        a.code,
        a.name,
        a.market,
        a.bucket,
        a.subclass,
        h.shares,
        h.market_value,
        h.cost_value,
        h.market_value - h.cost_value as pnl,
        CASE 
            WHEN h.cost_value > 0 
            THEN ((h.market_value - h.cost_value) / h.cost_value * 100)
            ELSE 0 
        END as return_rate,
        CASE 
            WHEN %(total_value)s > 0 
            THEN (h.market_value / %(total_value)s * 100)
            ELSE 0 
        END as weight_pct
    FROM v_overall_holdings h
    JOIN assets a ON a.id = h.asset_id
    WHERE h.snap_date = %(latest_date)s
    ORDER BY h.market_value DESC
    """

    cur.execute(sql, {"latest_date": latest_date, "total_value": total_value})
    holdings = cur.fetchall()

    cur.close()
    conn.close()

    return holdings

