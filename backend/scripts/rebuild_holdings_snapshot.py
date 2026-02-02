"""
重建持仓快照
根据交易记录计算所有资产的持仓，并生成今日持仓快照
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date
from app.db.session import get_conn


def rebuild_holdings_snapshot():
    """根据交易记录重建今日持仓快照"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        today = date.today()
        
        # 1. 获取所有组合和资产的交易汇总
        cur.execute("""
            SELECT 
                t.portfolio_id,
                t.asset_id,
                a.name as asset_name,
                p.name as portfolio_name,
                COALESCE(SUM(CASE WHEN t.side = 'buy' THEN t.quantity ELSE -t.quantity END), 0) as total_shares,
                COALESCE(SUM(CASE WHEN t.side = 'buy' THEN t.amount ELSE -t.amount END), 0) as total_cost
            FROM trades t
            JOIN assets a ON a.id = t.asset_id
            JOIN portfolios p ON p.id = t.portfolio_id
            WHERE t.is_valid = true
            GROUP BY t.portfolio_id, t.asset_id, a.name, p.name
            HAVING SUM(CASE WHEN t.side = 'buy' THEN t.quantity ELSE -t.quantity END) > 0
        """)
        
        positions = cur.fetchall()
        
        if not positions:
            print("❌ 没有找到任何交易记录")
            return
        
        print(f"找到 {len(positions)} 个持仓需要更新\n")
        
        updated_count = 0
        
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
                print(f"⚠️  {pos['portfolio_name']} - {pos['asset_name']}: 缺少价格数据，跳过")
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
            
            pnl = market_value - total_cost
            return_rate = (pnl / total_cost * 100) if total_cost > 0 else 0
            
            print(f"✅ {pos['portfolio_name']} - {pos['asset_name']}")
            print(f"   份额: {total_shares:.2f}, 市值: ¥{market_value:.2f}, 成本: ¥{total_cost:.2f}")
            print(f"   收益: ¥{pnl:.2f} ({return_rate:+.2f}%)\n")
            
            updated_count += 1
        
        conn.commit()
        print(f"\n🎉 成功更新 {updated_count} 个持仓快照！")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ 更新失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    print("开始重建持仓快照...\n")
    rebuild_holdings_snapshot()

