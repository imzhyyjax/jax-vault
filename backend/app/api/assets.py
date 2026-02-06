from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from app.db.session import get_conn
from app.deps import get_current_user
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
    limit: int = Query(100, le=500),
    current_user=Depends(get_current_user)
):
    """获取资产列表"""
    conn = get_conn()
    cur = conn.cursor()

    # 构建查询条件
    where_clauses = ["user_id = %(user_id)s"]
    params = {"user_id": current_user["id"]}

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
def get_asset(asset_id: int, current_user=Depends(get_current_user)):
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
    AND user_id = %(user_id)s
    """

    cur.execute(sql, {"asset_id": asset_id, "user_id": current_user["id"]})
    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="资产不存在")

    return row


@router.post("/", response_model=AssetResponse, status_code=201)
def create_asset(asset: AssetCreate, current_user=Depends(get_current_user)):
    """创建资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查是否已存在
    check_sql = """
    SELECT id FROM assets
    WHERE market = %(market)s AND code = %(code)s
    AND user_id = %(user_id)s
    """
    cur.execute(check_sql, {"market": asset.market, "code": asset.code, "user_id": current_user["id"]})
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="该资产已存在")

    sql = """
    INSERT INTO assets
    (user_id, market, code, name, bucket, subclass, currency, benchmark, provider, status)
    VALUES
    (%(user_id)s, %(market)s, %(code)s, %(name)s, %(bucket)s, %(subclass)s, 
     %(currency)s, %(benchmark)s, %(provider)s, %(status)s)
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    data = asset.model_dump()
    data["user_id"] = current_user["id"]
    cur.execute(sql, data)
    new_asset = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_asset


@router.post("/from_universe", response_model=AssetResponse, status_code=201)
def create_asset_from_universe(req: AssetFromUniverseRequest, current_user=Depends(get_current_user)):
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
    check_sql = """
    SELECT id FROM assets
    WHERE market = 'CN' AND code = %(code)s
    AND user_id = %(user_id)s
    """
    cur.execute(check_sql, {"code": req.fund_code, "user_id": current_user["id"]})
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="该基金已添加到资产字典")

    # 插入 assets 表
    insert_sql = """
    INSERT INTO assets
    (user_id, market, code, name, bucket, subclass, currency, status, provider)
    VALUES
    (%(user_id)s, 'CN', %(code)s, %(name)s, %(bucket)s, %(subclass)s, 'CNY', %(status)s, 'eastmoney')
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    cur.execute(insert_sql, {
        "user_id": current_user["id"],
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
def update_asset(asset_id: int, asset_update: AssetUpdate, current_user=Depends(get_current_user)):
    """更新资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查资产是否存在
    check_sql = "SELECT id FROM assets WHERE id = %(id)s AND user_id = %(user_id)s"
    cur.execute(check_sql, {"id": asset_id, "user_id": current_user["id"]})
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
    WHERE id = %(asset_id)s AND user_id = %(user_id)s
    RETURNING id, market, code, name, bucket, subclass, currency, 
              benchmark, provider, status, created_at, updated_at
    """

    update_data["asset_id"] = asset_id
    update_data["user_id"] = current_user["id"]
    cur.execute(sql, update_data)
    updated_asset = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return updated_asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, current_user=Depends(get_current_user)):
    """删除资产"""
    conn = get_conn()
    cur = conn.cursor()

    # 检查是否有关联的持仓或交易（保护重要数据）
    check_sql = """
    SELECT 
        (SELECT COUNT(*) FROM holdings_snapshot WHERE asset_id = %(id)s) as holdings_cnt,
        (SELECT COUNT(*) FROM trades WHERE asset_id = %(id)s) as trades_cnt,
        (SELECT COUNT(*) FROM prices WHERE asset_id = %(id)s) as prices_cnt
    """
    cur.execute(check_sql, {"id": asset_id})
    result = cur.fetchone()
    
    # 如果有持仓或交易记录，不允许删除（保护核心数据）
    if result["holdings_cnt"] > 0 or result["trades_cnt"] > 0:
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"该资产有关联的持仓或交易记录，无法删除。持仓记录: {result['holdings_cnt']}，交易记录: {result['trades_cnt']}"
        )

    # 如果只有价格数据，先删除价格数据（允许删除纯字典资产）
    if result["prices_cnt"] > 0:
        cur.execute("DELETE FROM prices WHERE asset_id = %(id)s", {"id": asset_id})

    # 删除资产
    delete_sql = "DELETE FROM assets WHERE id = %(id)s AND user_id = %(user_id)s RETURNING id"
    cur.execute(delete_sql, {"id": asset_id, "user_id": current_user["id"]})
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
def get_assets_stats(current_user=Depends(get_current_user)):
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
    WHERE user_id = %(user_id)s
    """

    cur.execute(sql, {"user_id": current_user["id"]})
    stats = cur.fetchone()

    cur.close()
    conn.close()

    return stats

