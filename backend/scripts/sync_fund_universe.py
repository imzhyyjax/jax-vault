import akshare as ak
import psycopg2
from psycopg2.extras import execute_batch
import os

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://jax:imzhyyjax@localhost/jaxvault"
)


def main():
    print("Fetching fund list from AkShare...")

    df = ak.fund_name_em()

    print(f"Fetched {len(df)} funds")

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    sql = """
    INSERT INTO fund_universe_cn
    (code, name, fund_type, provider)
    VALUES (%s, %s, %s, 'eastmoney')
    ON CONFLICT (code)
    DO UPDATE SET
        name = EXCLUDED.name,
        fund_type = EXCLUDED.fund_type,
        updated_at = now();
    """

    rows = []

    for _, r in df.iterrows():
        rows.append((
            r["基金代码"],
            r["基金简称"],
            r["基金类型"]
        ))

    execute_batch(cur, sql, rows, page_size=500)

    conn.commit()
    cur.close()
    conn.close()

    print("Sync completed.")


if __name__ == "__main__":
    main()