from fastapi import APIRouter, HTTPException, Depends
from datetime import date
from app.db.session import get_conn
from app.schemas.holding import QuickHoldingCreate
from app.deps import get_current_user

router = APIRouter(prefix="/holdings", tags=["Holdings"])


def _get_or_create_default_portfolio(cur, conn, user_id: int):
    cur.execute("""
        SELECT id FROM portfolios 
        WHERE name = '默认组合' AND include_in_overall = true
        AND user_id = %(user_id)s
        LIMIT 1
    """, {"user_id": user_id})
    portfolio = cur.fetchone()
    if not portfolio:
        cur.execute("""
            INSERT INTO portfolios (user_id, name, include_in_overall)
            VALUES (%(user_id)s, '默认组合', true)
            RETURNING id
        """, {"user_id": user_id})
        portfolio = cur.fetchone()
        conn.commit()
    return portfolio["id"]


def _get_default_portfolio_id(cur, user_id: int):
    cur.execute("""
        SELECT id FROM portfolios 
        WHERE name = '默认组合' AND include_in_overall = true
        AND user_id = %(user_id)s
        LIMIT 1
    """, {"user_id": user_id})
    row = cur.fetchone()
    return row["id"] if row else None


@router.delete("/portfolio/{portfolio_id}/asset/{asset_id}")
def delete_holdings_by_portfolio_asset(portfolio_id: int, asset_id: int, current_user=Depends(get_current_user)):
    """仅删除某组合下某资产的持仓快照"""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id FROM portfolios WHERE id = %(id)s AND user_id = %(user_id)s",
            {"id": portfolio_id, "user_id": current_user["id"]}
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="组合不存在")
        cur.execute("""
            DELETE FROM holdings_snapshot
            WHERE portfolio_id = %(portfolio_id)s
            AND asset_id = %(asset_id)s
            RETURNING id
        """, {"portfolio_id": portfolio_id, "asset_id": asset_id})
        rows = cur.fetchall()
        conn.commit()
        return {
            "success": True,
            "deleted_count": len(rows),
            "message": f"已从组合移除 {len(rows)} 条持仓快照"
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


@router.post("/portfolio/{portfolio_id}/asset/{asset_id}/move_to_default")
def move_holding_to_default(portfolio_id: int, asset_id: int, current_user=Depends(get_current_user)):
    """将某组合下的资产持仓快照转移到默认组合（不影响总览）"""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id FROM portfolios WHERE id = %(id)s AND user_id = %(user_id)s",
            {"id": portfolio_id, "user_id": current_user["id"]}
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="组合不存在")
        # 1. 获取该组合该资产的最新快照
        cur.execute("""
            SELECT snap_date, shares, market_value, cost_value
            FROM holdings_snapshot
            WHERE portfolio_id = %(portfolio_id)s
            AND asset_id = %(asset_id)s
            ORDER BY snap_date DESC, updated_at DESC
            LIMIT 1
        """, {"portfolio_id": portfolio_id, "asset_id": asset_id})
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="未找到该组合下的持仓快照")

        # 2. 获取或创建默认组合
        default_portfolio_id = _get_or_create_default_portfolio(cur, conn, current_user["id"])

        # 3. 写入默认组合（同一日期 upsert）
        cur.execute("""
            INSERT INTO holdings_snapshot 
            (portfolio_id, asset_id, snap_date, shares, market_value, cost_value, source, note)
            VALUES (%(portfolio_id)s, %(asset_id)s, %(snap_date)s, %(shares)s, %(market_value)s, %(cost_value)s, 'manual', '从组合移入默认组合')
            ON CONFLICT (portfolio_id, asset_id, snap_date)
            DO UPDATE SET
                shares = EXCLUDED.shares,
                market_value = EXCLUDED.market_value,
                cost_value = EXCLUDED.cost_value,
                source = 'manual',
                note = EXCLUDED.note,
                updated_at = now()
        """, {
            "portfolio_id": default_portfolio_id,
            "asset_id": asset_id,
            "snap_date": row["snap_date"],
            "shares": row["shares"],
            "market_value": row["market_value"],
            "cost_value": row["cost_value"],
        })

        # 4. 删除该组合下该资产的所有快照
        cur.execute("""
            DELETE FROM holdings_snapshot
            WHERE portfolio_id = %(portfolio_id)s
            AND asset_id = %(asset_id)s
        """, {"portfolio_id": portfolio_id, "asset_id": asset_id})

        conn.commit()
        return {
            "success": True,
            "message": "已从组合移除并迁移到默认组合（不影响总览）"
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

@router.get("/asset/{asset_id}/latest")
def get_latest_holding_by_asset(asset_id: int, current_user=Depends(get_current_user)):
    """获取某个资产最新的持仓快照"""
    conn = get_conn()
    cur = conn.cursor()
    try:
        default_portfolio_id = _get_default_portfolio_id(cur, current_user["id"])
        if not default_portfolio_id:
            raise HTTPException(status_code=404, detail="未找到默认组合")
        cur.execute("""
            SELECT
                portfolio_id,
                asset_id,
                snap_date,
                shares,
                market_value,
                cost_value,
                updated_at
            FROM holdings_snapshot
            WHERE asset_id = %(asset_id)s
            AND portfolio_id = %(portfolio_id)s
            ORDER BY snap_date DESC, updated_at DESC
            LIMIT 1
        """, {"asset_id": asset_id, "portfolio_id": default_portfolio_id})
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="未找到持仓快照")
        return row
    finally:
        cur.close()
        conn.close()


@router.delete("/asset/{asset_id}")
def delete_holdings_by_asset(asset_id: int, current_user=Depends(get_current_user)):
    """删除某个资产的所有持仓快照"""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM holdings_snapshot h
            USING assets a
            WHERE h.asset_id = a.id
            AND h.asset_id = %(asset_id)s
            AND a.user_id = %(user_id)s
            RETURNING h.id
        """, {"asset_id": asset_id, "user_id": current_user["id"]})
        rows = cur.fetchall()
        conn.commit()
        return {
            "success": True,
            "deleted_count": len(rows),
            "message": f"已清理 {len(rows)} 条持仓快照"
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


@router.post("/quick")
def create_quick_holding(holding: QuickHoldingCreate, current_user=Depends(get_current_user)):
    """快速创建持仓快照（用于添加/编辑资产时）
    
    会自动：
    1. 使用指定组合；未指定则使用默认组合
    2. 创建今日持仓快照
    """
    conn = get_conn()
    cur = conn.cursor()

    try:
        # 1. 使用指定组合；未指定则使用默认组合
        portfolio_id = holding.portfolio_id
        if portfolio_id:
            cur.execute(
                "SELECT id FROM portfolios WHERE id = %(id)s AND user_id = %(user_id)s",
                {"id": portfolio_id, "user_id": current_user["id"]}
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="组合不存在")
        else:
            portfolio_id = _get_or_create_default_portfolio(cur, conn, current_user["id"])

        # 2. 检查资产是否存在
        cur.execute(
            "SELECT id FROM assets WHERE id = %(id)s AND user_id = %(user_id)s",
            {"id": holding.asset_id, "user_id": current_user["id"]}
        )
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

