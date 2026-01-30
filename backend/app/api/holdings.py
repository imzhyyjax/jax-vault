from fastapi import APIRouter, HTTPException
from datetime import date
from app.db.session import get_conn
from app.schemas.holding import QuickHoldingCreate

router = APIRouter(prefix="/holdings", tags=["Holdings"])


@router.post("/quick")
def create_quick_holding(holding: QuickHoldingCreate):
    """快速创建持仓快照（用于添加/编辑资产时）
    
    会自动：
    1. 找到或创建一个默认组合
    2. 创建今日持仓快照
    """
    conn = get_conn()
    cur = conn.cursor()

    try:
        # 1. 查找或创建默认组合
        cur.execute("""
            SELECT id FROM portfolios 
            WHERE name = '默认组合' AND include_in_overall = true
            LIMIT 1
        """)
        portfolio = cur.fetchone()

        if not portfolio:
            # 创建默认组合
            cur.execute("""
                INSERT INTO portfolios (name, include_in_overall)
                VALUES ('默认组合', true)
                RETURNING id
            """)
            portfolio = cur.fetchone()
            conn.commit()

        portfolio_id = portfolio["id"]

        # 2. 检查资产是否存在
        cur.execute("SELECT id FROM assets WHERE id = %(id)s", {"id": holding.asset_id})
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="资产不存在")

        # 3. 创建或更新今日持仓快照
        today = date.today()
        
        # 先检查是否已存在
        cur.execute("""
            SELECT id FROM holdings_snapshot
            WHERE portfolio_id = %(portfolio_id)s
            AND asset_id = %(asset_id)s
            AND snap_date = %(snap_date)s
        """, {
            "portfolio_id": portfolio_id,
            "asset_id": holding.asset_id,
            "snap_date": today
        })
        
        existing = cur.fetchone()

        if existing:
            # 更新
            sql = """
            UPDATE holdings_snapshot
            SET shares = %(shares)s,
                market_value = %(market_value)s,
                cost_value = %(cost_value)s,
                source = 'manual',
                updated_at = now()
            WHERE id = %(id)s
            RETURNING id
            """
            cur.execute(sql, {
                "id": existing["id"],
                "shares": holding.shares,
                "market_value": holding.market_value,
                "cost_value": holding.cost_value
            })
        else:
            # 插入
            sql = """
            INSERT INTO holdings_snapshot
            (portfolio_id, asset_id, snap_date, shares, market_value, cost_value, source)
            VALUES
            (%(portfolio_id)s, %(asset_id)s, %(snap_date)s, %(shares)s, 
             %(market_value)s, %(cost_value)s, 'manual')
            RETURNING id
            """
            cur.execute(sql, {
                "portfolio_id": portfolio_id,
                "asset_id": holding.asset_id,
                "snap_date": today,
                "shares": holding.shares,
                "market_value": holding.market_value,
                "cost_value": holding.cost_value
            })

        result = cur.fetchone()
        conn.commit()
        
        return {
            "success": True,
            "holding_id": result["id"],
            "portfolio_id": portfolio_id,
            "message": "持仓快照已创建/更新"
        }

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

