from fastapi import APIRouter, HTTPException
from typing import List
from app.db.session import get_conn
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioWithStats
)

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])


@router.get("/", response_model=List[PortfolioWithStats])
def get_portfolios():
    """获取所有组合列表（带统计信息）"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        p.id,
        p.name,
        p.include_in_overall,
        p.created_at,
        p.updated_at,
        COALESCE(COUNT(DISTINCT h.asset_id), 0) as asset_count,
        COALESCE(SUM(h.market_value), 0) as total_value,
        COALESCE(SUM(h.cost_value), 0) as total_cost,
        COALESCE(SUM(h.market_value) - SUM(h.cost_value), 0) as total_pnl,
        CASE 
            WHEN SUM(h.cost_value) > 0 
            THEN ((SUM(h.market_value) - SUM(h.cost_value)) / SUM(h.cost_value) * 100)
            ELSE 0 
        END as return_rate
    FROM portfolios p
    LEFT JOIN LATERAL (
        SELECT asset_id, market_value, cost_value
        FROM holdings_snapshot
        WHERE portfolio_id = p.id
        AND snap_date = (
            SELECT MAX(snap_date)
            FROM holdings_snapshot
            WHERE portfolio_id = p.id
        )
    ) h ON true
    GROUP BY p.id, p.name, p.include_in_overall, p.created_at, p.updated_at
    ORDER BY p.created_at DESC
    """

    cur.execute(sql)
    portfolios = cur.fetchall()

    cur.close()
    conn.close()

    return portfolios


@router.get("/{portfolio_id}", response_model=PortfolioWithStats)
def get_portfolio(portfolio_id: int):
    """获取单个组合详情"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        p.id,
        p.name,
        p.include_in_overall,
        p.created_at,
        p.updated_at,
        COALESCE(COUNT(DISTINCT h.asset_id), 0) as asset_count,
        COALESCE(SUM(h.market_value), 0) as total_value,
        COALESCE(SUM(h.cost_value), 0) as total_cost,
        COALESCE(SUM(h.market_value) - SUM(h.cost_value), 0) as total_pnl,
        CASE 
            WHEN SUM(h.cost_value) > 0 
            THEN ((SUM(h.market_value) - SUM(h.cost_value)) / SUM(h.cost_value) * 100)
            ELSE 0 
        END as return_rate
    FROM portfolios p
    LEFT JOIN LATERAL (
        SELECT asset_id, market_value, cost_value
        FROM holdings_snapshot
        WHERE portfolio_id = p.id
        AND snap_date = (
            SELECT MAX(snap_date)
            FROM holdings_snapshot
            WHERE portfolio_id = p.id
        )
    ) h ON true
    WHERE p.id = %(portfolio_id)s
    GROUP BY p.id, p.name, p.include_in_overall, p.created_at, p.updated_at
    """

    cur.execute(sql, {"portfolio_id": portfolio_id})
    portfolio = cur.fetchone()

    cur.close()
    conn.close()

    if not portfolio:
        raise HTTPException(status_code=404, detail="组合不存在")

    return portfolio


@router.post("/", response_model=PortfolioResponse, status_code=201)
def create_portfolio(portfolio: PortfolioCreate):
    """创建组合"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查名称是否已存在
    check_sql = "SELECT id FROM portfolios WHERE name = %(name)s"
    cur.execute(check_sql, {"name": portfolio.name})
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="组合名称已存在")

    sql = """
    INSERT INTO portfolios
    (name, include_in_overall)
    VALUES
    (%(name)s, %(include_in_overall)s)
    RETURNING id, name, include_in_overall, created_at, updated_at
    """

    cur.execute(sql, portfolio.model_dump())
    new_portfolio = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_portfolio


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
def update_portfolio(portfolio_id: int, portfolio_update: PortfolioUpdate):
    """更新组合"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查组合是否存在
    check_sql = "SELECT id FROM portfolios WHERE id = %(id)s"
    cur.execute(check_sql, {"id": portfolio_id})
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="组合不存在")

    # 构建更新字段
    update_data = portfolio_update.model_dump(exclude_unset=True)
    if not update_data:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    # 如果更新名称，检查是否重复
    if "name" in update_data:
        name_check_sql = """
        SELECT id FROM portfolios 
        WHERE name = %(name)s AND id != %(portfolio_id)s
        """
        cur.execute(name_check_sql, {
            "name": update_data["name"],
            "portfolio_id": portfolio_id
        })
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="组合名称已存在")

    set_clauses = [f"{key} = %({key})s" for key in update_data.keys()]
    set_clauses.append("updated_at = now()")

    sql = f"""
    UPDATE portfolios
    SET {', '.join(set_clauses)}
    WHERE id = %(portfolio_id)s
    RETURNING id, name, include_in_overall, created_at, updated_at
    """

    update_data["portfolio_id"] = portfolio_id
    cur.execute(sql, update_data)
    updated_portfolio = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return updated_portfolio


@router.delete("/{portfolio_id}", status_code=204)
def delete_portfolio(portfolio_id: int):
    """删除组合"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查是否有关联数据
    check_sql = """
    SELECT COUNT(*) as cnt FROM holdings_snapshot WHERE portfolio_id = %(id)s
    UNION ALL
    SELECT COUNT(*) FROM trades WHERE portfolio_id = %(id)s
    UNION ALL
    SELECT COUNT(*) FROM pnl_snapshot WHERE portfolio_id = %(id)s
    """
    cur.execute(check_sql, {"id": portfolio_id})
    results = cur.fetchall()
    
    if any(row["cnt"] > 0 for row in results):
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="该组合有关联的持仓、交易或盈亏记录，无法删除"
        )

    # 删除组合
    delete_sql = "DELETE FROM portfolios WHERE id = %(id)s RETURNING id"
    cur.execute(delete_sql, {"id": portfolio_id})
    deleted = cur.fetchone()

    if not deleted:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="组合不存在")

    conn.commit()
    cur.close()
    conn.close()

    return None


@router.get("/stats/summary")
def get_portfolios_stats():
    """获取组合统计摘要"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        COUNT(*) as total_portfolios,
        COUNT(*) FILTER (WHERE include_in_overall = true) as enabled_portfolios,
        COALESCE(SUM(stats.asset_count), 0) as total_assets
    FROM portfolios p
    LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT asset_id) as asset_count
        FROM holdings_snapshot
        WHERE portfolio_id = p.id
        AND snap_date = (
            SELECT MAX(snap_date)
            FROM holdings_snapshot
            WHERE portfolio_id = p.id
        )
    ) stats ON true
    """

    cur.execute(sql)
    stats = cur.fetchone()

    cur.close()
    conn.close()

    return stats

