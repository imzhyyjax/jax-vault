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
from app.schemas.position_import import PositionImportRequest, PositionImportResponse

router = APIRouter(prefix="/trades", tags=["Trades"])


@router.delete("/asset/{asset_id}")
def delete_trades_by_asset(asset_id: int):
    """删除某个资产的所有交易记录（谨慎使用）"""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM trades
            WHERE asset_id = %(asset_id)s
            RETURNING id
        """, {"asset_id": asset_id})
        rows = cur.fetchall()
        conn.commit()
        return {
            "success": True,
            "deleted_count": len(rows),
            "message": f"已清理 {len(rows)} 条交易记录"
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


@router.post("/import_position")
def import_position(req: PositionImportRequest):
    """导入持仓：根据当前市值和收益反推成本和份额
    
    流程：
    1. 查找或创建默认组合
    2. 获取最新净值
    3. 计算：成本 = 当前市值 - 持有收益
    4. 计算：份额 = 当前市值 / 最新净值
    5. 创建持仓快照（不创建交易记录，因为不知道具体买入信息）
    """
    print("\n" + "="*60)
    print("🔵 [导入持仓] 开始处理请求")
    print(f"   资产ID: {req.asset_id}")
    print(f"   持仓金额: ¥{req.current_value}")
    print(f"   持有收益: ¥{req.profit_loss}")
    print("="*60)
    
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        from datetime import date
        today = date.today()
        
        # 1. 确定组合
        print("\n📁 步骤1: 确定投资组合")
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
        
        # 3. 获取最新净值
        print(f"\n💰 步骤3: 查询最新净值")
        cur.execute("""
            SELECT nav, price_date FROM prices
            WHERE asset_id = %(asset_id)s
            ORDER BY price_date DESC
            LIMIT 1
        """, {"asset_id": req.asset_id})
        
        price_row = cur.fetchone()
        nav = None
        shares = None
        if not price_row:
            print(f"   ⚠️ 未找到价格数据，将先保存持仓快照（不计算份额）")
        else:
            nav = float(price_row["nav"])
            print(f"   ✅ 最新净值: {nav} (日期: {price_row['price_date']})")
            shares = req.current_value / nav  # 份额 = 市值 / 净值
        
        # 4. 计算成本和份额
        print(f"\n🧮 步骤4: 计算成本和份额")
        cost_value = req.current_value - req.profit_loss  # 成本 = 市值 - 收益
        print(f"   持仓金额: ¥{req.current_value:,.2f}")
        print(f"   持有收益: ¥{req.profit_loss:,.2f}")
        print(f"   → 计算成本: ¥{cost_value:,.2f}")
        if shares is not None:
            print(f"   → 计算份额: {shares:,.2f}")
        else:
            print(f"   → 计算份额: 暂无（缺少净值数据）")
        
        # 5. 创建或更新今日持仓快照
        print(f"\n💾 步骤5: 保存持仓快照")
        print(f"   组合ID: {portfolio_id}")
        print(f"   资产ID: {req.asset_id}")
        print(f"   快照日期: {today}")
        
        cur.execute("""
            INSERT INTO holdings_snapshot 
            (portfolio_id, asset_id, snap_date, shares, market_value, cost_value, source, note)
            VALUES (%(portfolio_id)s, %(asset_id)s, %(snap_date)s, %(shares)s, %(market_value)s, %(cost_value)s, 'import', %(note)s)
            ON CONFLICT (portfolio_id, asset_id, snap_date)
            DO UPDATE SET 
                shares = EXCLUDED.shares,
                market_value = EXCLUDED.market_value,
                cost_value = EXCLUDED.cost_value,
                source = 'import',
                note = EXCLUDED.note,
                updated_at = now()
        """, {
            "portfolio_id": portfolio_id,
            "asset_id": req.asset_id,
            "snap_date": today,
            "shares": shares,
            "market_value": req.current_value,
            "cost_value": cost_value,
            "note": req.note or f"导入持仓：{asset['name']}"
        })
        
        conn.commit()
        print(f"   ✅ 持仓快照已保存")
        
        print(f"\n🎉 [导入持仓] 处理成功!")
        print(f"   资产: {asset['name']}")
        if shares is not None:
            print(f"   份额: {round(shares, 2)}")
        else:
            print(f"   份额: 暂无（缺少净值数据）")
        print(f"   市值: ¥{req.current_value:,.2f}")
        print(f"   成本: ¥{cost_value:,.2f}")
        print(f"   收益: ¥{req.profit_loss:,.2f}")
        print("="*60 + "\n")
        
        return PositionImportResponse(
            success=True,
            portfolio_id=portfolio_id,
            asset_id=req.asset_id,
            current_value=req.current_value,
            profit_loss=req.profit_loss,
            cost_value=cost_value,
            shares=round(shares, 2) if shares is not None else None,
            nav=nav,
            message=(
                f"成功导入 {asset['name']} 的持仓，份额：{round(shares, 2)}"
                if shares is not None
                else f"成功导入 {asset['name']} 的持仓（缺少净值，份额待补）"
            )
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


@router.post("/quick_buy")
def quick_buy(req: QuickBuyRequest):
    """快速买入：根据买入金额和日期自动创建交易记录
    
    流程：
    1. 查找或创建默认组合（如果未指定）
    2. 查询买入日期的基金净值
    3. 计算份额 = 买入金额 / 净值
    4. 创建买入交易记录
    """
    print("\n" + "="*60)
    print("🟢 [快速买入] 开始处理请求")
    print(f"   资产ID: {req.asset_id}")
    print(f"   买入金额: ¥{req.buy_amount}")
    print(f"   买入日期: {req.buy_date}")
    print("="*60)
    
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
        
        nav = float(price_row["nav"])  # 转换为 float
        
        # 4. 计算份额
        quantity = req.buy_amount / nav
        
        # 5. 创建交易记录
        cur.execute("""
            INSERT INTO trades 
            (portfolio_id, asset_id, trade_date, side, quantity, price, amount, note)
            VALUES 
            (%(portfolio_id)s, %(asset_id)s, %(trade_date)s, 'buy', 
             %(quantity)s, %(price)s, %(amount)s, %(note)s)
            RETURNING id
        """, {
            "portfolio_id": portfolio_id,
            "asset_id": req.asset_id,
            "trade_date": req.buy_date,
            "quantity": quantity,
            "price": nav,
            "amount": req.buy_amount,
            "note": req.note or f"快速买入 {asset['name']}"
        })
        
        trade = cur.fetchone()
        
        # 6. 自动更新今日持仓快照
        from datetime import date
        today = date.today()
        
        # 查询该资产在该组合的所有交易，计算当前持仓
        cur.execute("""
            SELECT 
                COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) as total_quantity,
                COALESCE(SUM(CASE WHEN side = 'buy' THEN amount ELSE -amount END), 0) as total_cost
            FROM trades
            WHERE portfolio_id = %(portfolio_id)s 
            AND asset_id = %(asset_id)s
            AND is_valid = true
        """, {"portfolio_id": portfolio_id, "asset_id": req.asset_id})
        
        position = cur.fetchone()
        total_quantity = float(position["total_quantity"])
        total_cost = float(position["total_cost"])
        
        # 获取最新净值计算市值
        cur.execute("""
            SELECT nav FROM prices
            WHERE asset_id = %(asset_id)s
            ORDER BY price_date DESC
            LIMIT 1
        """, {"asset_id": req.asset_id})
        
        latest_price = cur.fetchone()
        current_nav = float(latest_price["nav"]) if latest_price else nav
        market_value = total_quantity * current_nav
        
        # 创建或更新今日持仓快照
        cur.execute("""
            INSERT INTO holdings_snapshot 
            (portfolio_id, asset_id, snap_date, shares, market_value, cost_value, source)
            VALUES (%(portfolio_id)s, %(asset_id)s, %(snap_date)s, %(shares)s, %(market_value)s, %(cost_value)s, 'system')
            ON CONFLICT (portfolio_id, asset_id, snap_date)
            DO UPDATE SET 
                shares = EXCLUDED.shares,
                market_value = EXCLUDED.market_value,
                cost_value = EXCLUDED.cost_value,
                source = 'system',
                updated_at = now()
        """, {
            "portfolio_id": portfolio_id,
            "asset_id": req.asset_id,
            "snap_date": today,
            "shares": total_quantity,
            "market_value": market_value,
            "cost_value": total_cost
        })
        
        conn.commit()
        
        print(f"\n🎉 [快速买入] 处理成功!")
        print(f"   资产: {asset['name']}")
        print(f"   份额: {round(quantity, 2)}")
        print(f"   净值: {nav}")
        print(f"   金额: ¥{req.buy_amount:,.2f}")
        print("="*60 + "\n")
        
        return QuickBuyResponse(
            success=True,
            trade_id=trade["id"],
            portfolio_id=portfolio_id,
            asset_id=req.asset_id,
            buy_amount=req.buy_amount,
            buy_date=req.buy_date,
            nav=nav,
            shares=round(quantity, 2),
            message=f"成功买入 {asset['name']}，份额：{round(quantity, 2)}，持仓已更新"
        )
        
    except HTTPException as e:
        print(f"\n❌ [快速买入] HTTP错误: {e.detail}")
        print("="*60 + "\n")
        conn.rollback()
        raise
    except Exception as e:
        print(f"\n❌ [快速买入] 系统错误: {str(e)}")
        print("="*60 + "\n")
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

