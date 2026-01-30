from fastapi import APIRouter, HTTPException
from datetime import date
from app.db.session import get_conn
from app.schemas.price import PriceCreate, PriceResponse

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.get("/asset/{asset_id}/latest")
def get_latest_price(asset_id: int):
    """获取某资产的最新净值"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, asset_id, price_date, nav, acc_nav, source, created_at, updated_at
            FROM prices
            WHERE asset_id = %(asset_id)s
            ORDER BY price_date DESC
            LIMIT 1
        """, {"asset_id": asset_id})
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="未找到该资产的价格数据")
        
        return row
    finally:
        cur.close()
        conn.close()


@router.get("/asset/{asset_id}/date/{price_date}")
def get_price_by_date(asset_id: int, price_date: date):
    """获取某资产在指定日期的净值（如果没有，则返回最近的历史净值）"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        # 先尝试精确匹配
        cur.execute("""
            SELECT id, asset_id, price_date, nav, acc_nav, source, created_at, updated_at
            FROM prices
            WHERE asset_id = %(asset_id)s AND price_date = %(price_date)s
        """, {"asset_id": asset_id, "price_date": price_date})
        
        row = cur.fetchone()
        if row:
            return row
        
        # 如果没有精确匹配，找最近的历史数据
        cur.execute("""
            SELECT id, asset_id, price_date, nav, acc_nav, source, created_at, updated_at
            FROM prices
            WHERE asset_id = %(asset_id)s AND price_date <= %(price_date)s
            ORDER BY price_date DESC
            LIMIT 1
        """, {"asset_id": asset_id, "price_date": price_date})
        
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
def create_price(price: PriceCreate):
    """创建或更新价格记录"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        # 检查是否已存在
        cur.execute("""
            SELECT id FROM prices
            WHERE asset_id = %(asset_id)s AND price_date = %(price_date)s
        """, {"asset_id": price.asset_id, "price_date": price.price_date})
        
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

