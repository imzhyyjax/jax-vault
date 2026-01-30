from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db.session import get_conn
from app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetFromUniverseRequest
)

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/", response_model=List[AssetResponse])
def get_assets(
    status: Optional[str] = Query(None, description="筛选状态: holding/archived/watchlist"),
    market: Optional[str] = Query(None, description="筛选市场: CN/US/HK"),
    bucket: Optional[str] = Query(None, description="筛选类型: progressive/defensive"),
    limit: int = Query(100, le=500)
):
    """获取资产列表"""
    conn = get_conn()
    cur = conn.cursor()

    # 构建查询条件
    where_clauses = []
    params = {}

    if status:
        where_clauses.append("status = %(status)s")
        params["status"] = status
    
    if market:
        where_clauses.append("market = %(market)s")
        params["market"] = market
    
    if bucket:
        where_clauses.append("bucket = %(bucket)s")
        params["bucket"] = bucket

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
    SELECT
        id, market, code, name, bucket, subclass,
        currency, benchmark, provider, status,
        created_at, updated_at
    FROM assets
    {where_sql}
    ORDER BY created_at DESC
    LIMIT %(limit)s
    """
    params["limit"] = limit

    cur.execute(sql, params)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(asset_id: int):
    """获取单个资产详情"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        id, market, code, name, bucket, subclass,
        currency, benchmark, provider, status,
        created_at, updated_at
    FROM assets
    WHERE id = %(asset_id)s
    """

    cur.execute(sql, {"asset_id": asset_id})
    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="资产不存在")

    return row


@router.post("/", response_model=AssetResponse, status_code=201)
def create_asset(asset: AssetCreate):
    """创建资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查是否已存在
    check_sql = "SELECT id FROM assets WHERE market = %(market)s AND code = %(code)s"
    cur.execute(check_sql, {"market": asset.market, "code": asset.code})
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="该资产已存在")

    sql = """
    INSERT INTO assets
    (market, code, name, bucket, subclass, currency, benchmark, provider, status)
    VALUES
    (%(market)s, %(code)s, %(name)s, %(bucket)s, %(subclass)s, 
     %(currency)s, %(benchmark)s, %(provider)s, %(status)s)
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    cur.execute(sql, asset.model_dump())
    new_asset = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_asset


@router.post("/from_universe", response_model=AssetResponse, status_code=201)
def create_asset_from_universe(req: AssetFromUniverseRequest):
    """从基金库添加资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 从 fund_universe_cn 查询基金信息
    fund_sql = """
    SELECT code, name, fund_type
    FROM fund_universe_cn
    WHERE code = %(code)s
    """
    cur.execute(fund_sql, {"code": req.fund_code})
    fund = cur.fetchone()

    if not fund:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="基金库中未找到该基金")

    # 检查是否已添加
    check_sql = "SELECT id FROM assets WHERE market = 'CN' AND code = %(code)s"
    cur.execute(check_sql, {"code": req.fund_code})
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="该基金已添加到资产字典")

    # 插入 assets 表
    insert_sql = """
    INSERT INTO assets
    (market, code, name, bucket, subclass, currency, status, provider)
    VALUES
    ('CN', %(code)s, %(name)s, %(bucket)s, %(subclass)s, 'CNY', %(status)s, 'eastmoney')
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    cur.execute(insert_sql, {
        "code": fund["code"],
        "name": fund["name"],
        "bucket": req.bucket,
        "subclass": req.subclass,
        "status": req.status
    })

    new_asset = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_asset


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: int, asset_update: AssetUpdate):
    """更新资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查资产是否存在
    check_sql = "SELECT id FROM assets WHERE id = %(id)s"
    cur.execute(check_sql, {"id": asset_id})
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="资产不存在")

    # 构建更新字段
    update_data = asset_update.model_dump(exclude_unset=True)
    if not update_data:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    set_clauses = [f"{key} = %({key})s" for key in update_data.keys()]
    set_clauses.append("updated_at = now()")

    sql = f"""
    UPDATE assets
    SET {', '.join(set_clauses)}
    WHERE id = %(asset_id)s
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    update_data["asset_id"] = asset_id
    cur.execute(sql, update_data)
    updated_asset = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return updated_asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int):
    """删除资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查是否有关联的持仓或交易（可选：更严格的检查）
    check_sql = """
    SELECT COUNT(*) as cnt FROM holdings_snapshot WHERE asset_id = %(id)s
    UNION ALL
    SELECT COUNT(*) FROM trades WHERE asset_id = %(id)s
    """
    cur.execute(check_sql, {"id": asset_id})
    results = cur.fetchall()
    
    if any(row["cnt"] > 0 for row in results):
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="该资产有关联的持仓或交易记录，无法删除"
        )

    # 删除资产
    delete_sql = "DELETE FROM assets WHERE id = %(id)s RETURNING id"
    cur.execute(delete_sql, {"id": asset_id})
    deleted = cur.fetchone()

    if not deleted:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="资产不存在")

    conn.commit()
    cur.close()
    conn.close()

    return None


@router.get("/stats/summary")
def get_assets_stats():
    """获取资产统计摘要"""
    conn = get_conn()
    cur = conn.cursor()

    sql = """
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE bucket = 'progressive') as progressive_count,
        COUNT(*) FILTER (WHERE bucket = 'defensive') as defensive_count,
        COUNT(*) FILTER (WHERE status = 'holding') as holding_count,
        COUNT(*) FILTER (WHERE status = 'watchlist') as watchlist_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        COUNT(*) FILTER (WHERE market = 'CN') as cn_count,
        COUNT(*) FILTER (WHERE market = 'US') as us_count,
        COUNT(*) FILTER (WHERE market = 'HK') as hk_count
    FROM assets
    """

    cur.execute(sql)
    stats = cur.fetchone()

    cur.close()
    conn.close()

    return stats

