from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db.session import get_conn
from app.schemas.trade import (
    TradeCreate,
    TradeUpdate,
    TradeResponse,
    TradeWithDetails
)
from app.schemas.trade_quick import QuickBuyRequest, QuickBuyResponse

router = APIRouter(prefix="/trades", tags=["Trades"])


@router.post("/quick_buy")
def quick_buy(req: QuickBuyRequest):
    """快速买入：根据买入金额和日期自动创建交易记录
    
    流程：
    1. 查找或创建默认组合（如果未指定）
    2. 查询买入日期的基金净值
    3. 计算份额 = 买入金额 / 净值
    4. 创建买入交易记录
    """
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        # 1. 确定组合
        portfolio_id = req.portfolio_id
        if not portfolio_id:
            cur.execute("""
                SELECT id FROM portfolios 
                WHERE name = '默认组合' AND include_in_overall = true
                LIMIT 1
            """)
            portfolio = cur.fetchone()
            
            if not portfolio:
                cur.execute("""
                    INSERT INTO portfolios (name, include_in_overall)
                    VALUES ('默认组合', true)
                    RETURNING id
                """)
                portfolio = cur.fetchone()
                conn.commit()
            
            portfolio_id = portfolio["id"]
        
        # 2. 检查资产是否存在
        cur.execute("SELECT id, code, name FROM assets WHERE id = %(id)s", {"id": req.asset_id})
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(status_code=404, detail="资产不存在")
        
        # 3. 查询买入日期的净值
        cur.execute("""
            SELECT nav FROM prices
            WHERE asset_id = %(asset_id)s AND price_date <= %(price_date)s
            ORDER BY price_date DESC
            LIMIT 1
        """, {"asset_id": req.asset_id, "price_date": req.buy_date})
        
        price_row = cur.fetchone()
        if not price_row:
            raise HTTPException(
                status_code=404,
                detail=f"未找到该资产在 {req.buy_date} 或之前的净值数据，请先导入价格数据"
            )
        
        nav = price_row["nav"]
        
        # 4. 计算份额
        shares = req.buy_amount / nav
        
        # 5. 创建交易记录
        cur.execute("""
            INSERT INTO trades 
            (portfolio_id, asset_id, trade_date, trade_type, shares, price, amount, note)
            VALUES 
            (%(portfolio_id)s, %(asset_id)s, %(trade_date)s, 'buy', 
             %(shares)s, %(price)s, %(amount)s, %(note)s)
            RETURNING id
        """, {
            "portfolio_id": portfolio_id,
            "asset_id": req.asset_id,
            "trade_date": req.buy_date,
            "shares": shares,
            "price": nav,
            "amount": req.buy_amount,
            "note": req.note or f"快速买入 {asset['name']}"
        })
        
        trade = cur.fetchone()
        conn.commit()
        
        return QuickBuyResponse(
            success=True,
            trade_id=trade["id"],
            portfolio_id=portfolio_id,
            asset_id=req.asset_id,
            buy_amount=req.buy_amount,
            buy_date=req.buy_date,
            nav=nav,
            shares=round(shares, 2),
            message=f"成功买入 {asset['name']}，份额：{round(shares, 2)}"
        )
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/", response_model=List[TradeWithDetails])
def get_trades(
    portfolio_id: Optional[int] = Query(None, description="筛选组合ID"),
    asset_id: Optional[int] = Query(None, description="筛选资产ID"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    side: Optional[str] = Query(None, description="筛选方向: buy/sell"),
    limit: int = Query(100, le=500)
):
    """获取交易记录列表"""
    conn = get_conn()
    cur = conn.cursor()

    # 构建查询条件
    where_clauses = ["t.is_valid = true"]  # 默认只显示有效交易
    params = {}

    if portfolio_id:
        where_clauses.append("t.portfolio_id = %(portfolio_id)s")
        params["portfolio_id"] = portfolio_id
    
    if asset_id:
        where_clauses.append("t.asset_id = %(asset_id)s")
        params["asset_id"] = asset_id
    
    if start_date:
        where_clauses.append("t.trade_date >= %(start_date)s")
        params["start_date"] = start_date
    
    if end_date:
        where_clauses.append("t.trade_date <= %(end_date)s")
        params["end_date"] = end_date
    
    if side:
        where_clauses.append("t.side = %(side)s")
        params["side"] = side

    where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
    SELECT
        t.id, t.portfolio_id, t.asset_id, t.trade_date, t.trade_time,
        t.side, t.quantity, t.price, t.amount, t.fee,
        t.is_valid, t.source, t.note,
        t.created_at, t.updated_at,
        a.code as asset_code,
        a.name as asset_name,
        p.name as portfolio_name
    FROM trades t
    JOIN assets a ON a.id = t.asset_id
    JOIN portfolios p ON p.id = t.portfolio_id
    {where_sql}
    ORDER BY t.trade_date DESC, t.trade_time DESC NULLS LAST, t.id DESC
    LIMIT %(limit)s
    """
    params["limit"] = limit

    cur.execute(sql, params)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows


@router.get("/{trade_id}", response_model=TradeWithDetails)
def get_trade(trade_id: int):
    """获取单条交易记录"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        t.id, t.portfolio_id, t.asset_id, t.trade_date, t.trade_time,
        t.side, t.quantity, t.price, t.amount, t.fee,
        t.is_valid, t.source, t.note,
        t.created_at, t.updated_at,
        a.code as asset_code,
        a.name as asset_name,
        p.name as portfolio_name
    FROM trades t
    JOIN assets a ON a.id = t.asset_id
    JOIN portfolios p ON p.id = t.portfolio_id
    WHERE t.id = %(trade_id)s
    """

    cur.execute(sql, {"trade_id": trade_id})
    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="交易记录不存在")

    return row


@router.post("/", response_model=TradeResponse, status_code=201)
def create_trade(trade: TradeCreate):
    """创建交易记录"""
    conn = get_conn()
    cur = conn.cursor()

    # 验证组合和资产存在
    check_sql = """
    SELECT 
        (SELECT COUNT(*) FROM portfolios WHERE id = %(portfolio_id)s) as p_exists,
        (SELECT COUNT(*) FROM assets WHERE id = %(asset_id)s) as a_exists
    """
    cur.execute(check_sql, {
        "portfolio_id": trade.portfolio_id,
        "asset_id": trade.asset_id
    })
    check_result = cur.fetchone()

    if check_result["p_exists"] == 0:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="组合不存在")
    
    if check_result["a_exists"] == 0:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="资产不存在")

    # 自动计算金额（如果未提供）
    amount = trade.amount if trade.amount is not None else (trade.quantity * trade.price)

    sql = """
    INSERT INTO trades
    (portfolio_id, asset_id, trade_date, trade_time, side, quantity, price, 
     amount, fee, is_valid, source, note)
    VALUES
    (%(portfolio_id)s, %(asset_id)s, %(trade_date)s, %(trade_time)s, %(side)s,
     %(quantity)s, %(price)s, %(amount)s, %(fee)s, %(is_valid)s, %(source)s, %(note)s)
    RETURNING id, portfolio_id, asset_id, trade_date, trade_time, side, quantity,
              price, amount, fee, is_valid, source, note, created_at, updated_at
    """

    data = trade.model_dump()
    data["amount"] = amount

    cur.execute(sql, data)
    new_trade = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_trade


@router.put("/{trade_id}", response_model=TradeResponse)
def update_trade(trade_id: int, trade_update: TradeUpdate):
    """更新交易记录"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查交易是否存在
    check_sql = "SELECT id FROM trades WHERE id = %(id)s"
    cur.execute(check_sql, {"id": trade_id})
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="交易记录不存在")

    # 构建更新字段
    update_data = trade_update.model_dump(exclude_unset=True)
    if not update_data:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    # 如果更新了 quantity 或 price，重新计算 amount
    if "quantity" in update_data or "price" in update_data:
        # 获取当前记录
        cur.execute("SELECT quantity, price FROM trades WHERE id = %(id)s", {"id": trade_id})
        current = cur.fetchone()
        new_quantity = update_data.get("quantity", current["quantity"])
        new_price = update_data.get("price", current["price"])
        update_data["amount"] = new_quantity * new_price

    set_clauses = [f"{key} = %({key})s" for key in update_data.keys()]
    set_clauses.append("updated_at = now()")

    sql = f"""
    UPDATE trades
    SET {', '.join(set_clauses)}
    WHERE id = %(trade_id)s
    RETURNING id, portfolio_id, asset_id, trade_date, trade_time, side, quantity,
              price, amount, fee, is_valid, source, note, created_at, updated_at
    """

    update_data["trade_id"] = trade_id
    cur.execute(sql, update_data)
    updated_trade = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return updated_trade


@router.delete("/{trade_id}", status_code=204)
def delete_trade(trade_id: int):
    """删除交易记录"""
    conn = get_conn()
    cur = conn.cursor()

    delete_sql = "DELETE FROM trades WHERE id = %(id)s RETURNING id"
    cur.execute(delete_sql, {"id": trade_id})
    deleted = cur.fetchone()

    if not deleted:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="交易记录不存在")

    conn.commit()
    cur.close()
    conn.close()

    return None


@router.get("/stats/summary")
def get_trades_stats(
    portfolio_id: Optional[int] = Query(None, description="组合ID"),
    asset_id: Optional[int] = Query(None, description="资产ID")
):
    """获取交易统计摘要"""
    conn = get_conn()
    cur = conn.cursor()

    where_clauses = ["is_valid = true"]
    params = {}

    if portfolio_id:
        where_clauses.append("portfolio_id = %(portfolio_id)s")
        params["portfolio_id"] = portfolio_id
    
    if asset_id:
        where_clauses.append("asset_id = %(asset_id)s")
        params["asset_id"] = asset_id

    where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
    SELECT
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE side = 'buy') as buy_count,
        COUNT(*) FILTER (WHERE side = 'sell') as sell_count,
        COALESCE(SUM(amount) FILTER (WHERE side = 'buy'), 0) as total_buy_amount,
        COALESCE(SUM(amount) FILTER (WHERE side = 'sell'), 0) as total_sell_amount,
        COALESCE(SUM(fee), 0) as total_fee
    FROM trades
    {where_sql}
    """

    cur.execute(sql, params)
    stats = cur.fetchone()

    cur.close()
    conn.close()

    return stats

