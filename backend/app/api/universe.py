from fastapi import APIRouter, Query
from app.db.session import get_conn

router = APIRouter(prefix="/universe", tags=["Universe"])


@router.get("/funds")
def search_funds(
    q: str = Query(..., min_length=1),
    limit: int = 50
):
    """
    搜索 CN 公募基金
    """

    sql = """
    SELECT
        code,
        name,
        fund_type
    FROM fund_universe_cn
    WHERE
        code ILIKE %(kw)s
        OR name ILIKE %(kw)s
        OR pinyin_abbr ILIKE %(kw)s
        OR pinyin_full ILIKE %(kw)s
    ORDER BY code
    LIMIT %(limit)s
    """

    kw = f"%{q}%"

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(sql, {
        "kw": kw,
        "limit": limit
    })

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "query": q,
        "count": len(rows),
        "results": rows
    }