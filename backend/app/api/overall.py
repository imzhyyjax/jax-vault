from fastapi import APIRouter, Depends
from datetime import date
from app.db.session import get_conn
from app.deps import get_current_user

SYSTEM_PORTFOLIO_NAME = "默认组合"


def _get_default_portfolio_id(cur, user_id: int):
    cur.execute("""
    SELECT id FROM portfolios
    WHERE name = %(name)s
    AND user_id = %(user_id)s
    LIMIT 1
    """, {"name": SYSTEM_PORTFOLIO_NAME, "user_id": user_id})
    row = cur.fetchone()
    return row["id"] if row else None

router = APIRouter(prefix="/overall", tags=["Overall"])


@router.get("/stats")
def get_overall_stats(current_user=Depends(get_current_user)):
    """获取整体统计数据（首页用）"""
    conn = get_conn()
    cur = conn.cursor()

    # 先统计资产管理中持有中的资产数量
    cur.execute("""
    SELECT COUNT(*) as holding_count
    FROM assets
    WHERE status = 'holding'
    AND user_id = %(user_id)s
    """, {"user_id": current_user["id"]})
    holding_assets_result = cur.fetchone()
    holding_assets_count = int(holding_assets_result["holding_count"])

    # 获取默认组合的最新持仓快照日期（总览只看默认组合）
    default_portfolio_id = _get_default_portfolio_id(cur, current_user["id"])
    latest_date = None
    if default_portfolio_id:
        cur.execute("""
        SELECT MAX(snap_date) as latest_date
        FROM holdings_snapshot
        WHERE portfolio_id = %(portfolio_id)s
        """, {"portfolio_id": default_portfolio_id})
        latest_result = cur.fetchone()
        latest_date = latest_result["latest_date"] if latest_result else None

    if not latest_date:
        # 没有持仓快照，但如果资产管理里有持有资产，则仍然显示
        if holding_assets_count > 0:
            latest_date = date.today()
        else:
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

    # 获取整体统计（仅默认组合）
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
    FROM holdings_snapshot
    WHERE portfolio_id = %(portfolio_id)s
    AND snap_date = %(latest_date)s
    """
    cur.execute(stats_sql, {"portfolio_id": default_portfolio_id, "latest_date": latest_date})
    stats = cur.fetchone() or {"total_value": 0, "total_cost": 0, "total_pnl": 0, "return_rate": 0, "asset_count": 0}

    # 获取今日收益（仅默认组合）
    daily_pnl_sql = """
    SELECT COALESCE(SUM(daily_pnl), 0) as daily_pnl
    FROM pnl_snapshot
    WHERE portfolio_id = %(portfolio_id)s
    AND snap_date = %(latest_date)s
    """
    cur.execute(daily_pnl_sql, {"portfolio_id": default_portfolio_id, "latest_date": latest_date})
    daily_result = cur.fetchone() or {"daily_pnl": 0}

    # 获取组合数量（不含默认组合）
    portfolio_count_sql = """
    SELECT COUNT(*) as count
    FROM portfolios
    WHERE name != %(system_name)s
    AND user_id = %(user_id)s
    """
    cur.execute(portfolio_count_sql, {"system_name": SYSTEM_PORTFOLIO_NAME, "user_id": current_user["id"]})
    portfolio_result = cur.fetchone()

    cur.close()
    conn.close()

    return {
        "total_value": float(stats["total_value"]),
        "total_cost": float(stats["total_cost"]),
        "total_pnl": float(stats["total_pnl"]),
        "daily_pnl": float(daily_result["daily_pnl"]),
        "return_rate": float(stats["return_rate"]),
        "asset_count": holding_assets_count,
        "portfolio_count": int(portfolio_result["count"]),
        "has_data": holding_assets_count > 0,
        "latest_date": str(latest_date)
    }


@router.get("/holdings")
def get_overall_holdings(current_user=Depends(get_current_user)):
    """获取整体持仓列表（带资产占比）"""
    conn = get_conn()
    cur = conn.cursor()

    # 获取资产管理里持有中的资产
    cur.execute("""
    SELECT id, code, name, market, bucket, subclass
    FROM assets
    WHERE status = 'holding'
    AND user_id = %(user_id)s
    ORDER BY created_at DESC
    """, {"user_id": current_user["id"]})
    holding_assets = cur.fetchall()

    # 获取默认组合的最新日期
    default_portfolio_id = _get_default_portfolio_id(cur, current_user["id"])
    latest_date = None
    if default_portfolio_id:
        cur.execute("""
        SELECT MAX(snap_date) as latest_date
        FROM holdings_snapshot
        WHERE portfolio_id = %(portfolio_id)s
        """, {"portfolio_id": default_portfolio_id})
        latest_result = cur.fetchone()
        latest_date = latest_result["latest_date"] if latest_result else None

    if not latest_date:
        # 如果没有快照，但资产管理里有持有资产，也要展示
        if holding_assets:
            latest_date = date.today()
        else:
            cur.close()
            conn.close()
            return []

    # 先获取总市值（用于计算占比）
    total_value_sql = """
    SELECT COALESCE(SUM(market_value), 0) as total_value
    FROM holdings_snapshot
    WHERE portfolio_id = %(portfolio_id)s
    AND snap_date = %(latest_date)s
    """
    cur.execute(total_value_sql, {"portfolio_id": default_portfolio_id, "latest_date": latest_date})
    total_value_result = cur.fetchone()
    total_value = float(total_value_result["total_value"])

    # 获取整体持仓（包含资产管理里持有中的资产）
    sql = """
    SELECT
        a.id as asset_id,
        a.code,
        a.name,
        a.market,
        a.bucket,
        a.subclass,
        h.shares,
        COALESCE(h.market_value, 0) as market_value,
        COALESCE(h.cost_value, 0) as cost_value,
        COALESCE(h.market_value, 0) - COALESCE(h.cost_value, 0) as pnl,
        CASE 
            WHEN COALESCE(h.cost_value, 0) > 0 
            THEN ((COALESCE(h.market_value, 0) - COALESCE(h.cost_value, 0)) / COALESCE(h.cost_value, 0) * 100)
            ELSE 0 
        END as return_rate,
        CASE 
            WHEN %(total_value)s > 0 
            THEN (COALESCE(h.market_value, 0) / %(total_value)s * 100)
            ELSE 0 
        END as weight_pct
    FROM assets a
    LEFT JOIN holdings_snapshot h
      ON h.asset_id = a.id
      AND h.snap_date = %(latest_date)s
      AND h.portfolio_id = %(portfolio_id)s
    WHERE a.status = 'holding'
    AND a.user_id = %(user_id)s
    ORDER BY COALESCE(h.market_value, 0) DESC, a.created_at DESC
    """

    cur.execute(sql, {
        "latest_date": latest_date,
        "total_value": total_value,
        "portfolio_id": default_portfolio_id,
        "user_id": current_user["id"]
    })
    holdings = cur.fetchall()

    cur.close()
    conn.close()

    return holdings

