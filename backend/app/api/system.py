"""
系统维护相关API
"""
from fastapi import APIRouter, Depends
from datetime import date
from app.db.session import get_conn
from app.deps import get_current_user

router = APIRouter(prefix="/system", tags=["System"])


@router.post("/rebuild_holdings")
def rebuild_holdings_snapshot(current_user=Depends(get_current_user)):
    """重建持仓快照：根据交易记录重新计算所有持仓"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        today = date.today()
        
        # 1. 获取所有组合和资产的交易汇总
        cur.execute("""
            SELECT 
                t.portfolio_id,
                t.asset_id,
                COALESCE(SUM(CASE WHEN t.side = 'buy' THEN t.quantity ELSE -t.quantity END), 0) as total_shares,
                COALESCE(SUM(CASE WHEN t.side = 'buy' THEN t.amount ELSE -t.amount END), 0) as total_cost
            FROM trades t
            JOIN portfolios p ON p.id = t.portfolio_id
            WHERE t.is_valid = true
            AND p.user_id = %(user_id)s
            GROUP BY t.portfolio_id, t.asset_id
            HAVING SUM(CASE WHEN t.side = 'buy' THEN t.quantity ELSE -t.quantity END) > 0
        """, {"user_id": current_user["id"]})
        
        positions = cur.fetchall()
        
        if not positions:
            return {
                "success": True,
                "updated_count": 0,
                "message": "没有找到任何交易记录"
            }
        
        updated_count = 0
        skipped_count = 0
        
        for pos in positions:
            portfolio_id = pos["portfolio_id"]
            asset_id = pos["asset_id"]
            total_shares = float(pos["total_shares"])
            total_cost = float(pos["total_cost"])
            
            # 获取最新净值
            cur.execute("""
                SELECT nav FROM prices
                WHERE asset_id = %(asset_id)s
                ORDER BY price_date DESC
                LIMIT 1
            """, {"asset_id": asset_id})
            
            price_row = cur.fetchone()
            
            if not price_row:
                skipped_count += 1
                continue
            
            nav = float(price_row["nav"])
            market_value = total_shares * nav
            
            # 插入或更新持仓快照
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
                "asset_id": asset_id,
                "snap_date": today,
                "shares": total_shares,
                "market_value": market_value,
                "cost_value": total_cost
            })
            
            updated_count += 1
        
        conn.commit()
        
        return {
            "success": True,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "message": f"成功更新 {updated_count} 个持仓快照" + 
                      (f"，跳过 {skipped_count} 个（缺少价格数据）" if skipped_count > 0 else "")
        }
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

