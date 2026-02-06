from fastapi import APIRouter, HTTPException, Depends
from datetime import date
from app.db.session import get_conn
from app.schemas.price import PriceCreate, PriceResponse
from app.deps import get_current_user

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.get("/asset/{asset_id}/latest")
def get_latest_price(asset_id: int, current_user=Depends(get_current_user)):
    """获取某资产的最新净值"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT p.id, p.asset_id, p.price_date, p.nav, p.acc_nav, p.source, p.created_at, p.updated_at
            FROM prices p
            JOIN assets a ON a.id = p.asset_id
            WHERE p.asset_id = %(asset_id)s
            AND a.user_id = %(user_id)s
            ORDER BY p.price_date DESC
            LIMIT 1
        """, {"asset_id": asset_id, "user_id": current_user["id"]})
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="未找到该资产的价格数据")
        
        return row
    finally:
        cur.close()
        conn.close()


@router.get("/asset/{asset_id}/date/{price_date}")
def get_price_by_date(asset_id: int, price_date: date, current_user=Depends(get_current_user)):
    """获取某资产在指定日期的净值（如果没有，则返回最近的历史净值）"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        # 先尝试精确匹配
        cur.execute("""
            SELECT p.id, p.asset_id, p.price_date, p.nav, p.acc_nav, p.source, p.created_at, p.updated_at
            FROM prices p
            JOIN assets a ON a.id = p.asset_id
            WHERE p.asset_id = %(asset_id)s AND p.price_date = %(price_date)s
            AND a.user_id = %(user_id)s
        """, {"asset_id": asset_id, "price_date": price_date, "user_id": current_user["id"]})
        
        row = cur.fetchone()
        if row:
            return row
        
        # 如果没有精确匹配，找最近的历史数据
        cur.execute("""
            SELECT p.id, p.asset_id, p.price_date, p.nav, p.acc_nav, p.source, p.created_at, p.updated_at
            FROM prices p
            JOIN assets a ON a.id = p.asset_id
            WHERE p.asset_id = %(asset_id)s AND p.price_date <= %(price_date)s
            AND a.user_id = %(user_id)s
            ORDER BY p.price_date DESC
            LIMIT 1
        """, {"asset_id": asset_id, "price_date": price_date, "user_id": current_user["id"]})
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=404, 
                detail=f"未找到资产在 {price_date} 或之前的价格数据"
            )
        
        return row
    finally:
        cur.close()
        conn.close()


@router.post("/")
def create_price(price: PriceCreate, current_user=Depends(get_current_user)):
    """创建或更新价格记录"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        # 检查资产归属
        cur.execute(
            "SELECT id FROM assets WHERE id = %(id)s AND user_id = %(user_id)s",
            {"id": price.asset_id, "user_id": current_user["id"]}
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="资产不存在")
        # 检查是否已存在
        cur.execute("""
            SELECT p.id FROM prices p
            JOIN assets a ON a.id = p.asset_id
            WHERE p.asset_id = %(asset_id)s AND p.price_date = %(price_date)s
            AND a.user_id = %(user_id)s
        """, {"asset_id": price.asset_id, "price_date": price.price_date, "user_id": current_user["id"]})
        
        existing = cur.fetchone()
        
        if existing:
            # 更新
            cur.execute("""
                UPDATE prices
                SET nav = %(nav)s, acc_nav = %(acc_nav)s, source = %(source)s, updated_at = now()
                WHERE id = %(id)s
                RETURNING id, asset_id, price_date, nav, acc_nav, source, created_at, updated_at
            """, {
                "id": existing["id"],
                "nav": price.nav,
                "acc_nav": price.acc_nav,
                "source": price.source
            })
        else:
            # 插入
            cur.execute("""
                INSERT INTO prices (asset_id, price_date, nav, acc_nav, source)
                VALUES (%(asset_id)s, %(price_date)s, %(nav)s, %(acc_nav)s, %(source)s)
                RETURNING id, asset_id, price_date, nav, acc_nav, source, created_at, updated_at
            """, {
                "asset_id": price.asset_id,
                "price_date": price.price_date,
                "nav": price.nav,
                "acc_nav": price.acc_nav,
                "source": price.source
            })
        
        result = cur.fetchone()
        conn.commit()
        return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

