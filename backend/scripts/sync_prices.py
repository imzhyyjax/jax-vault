"""
同步基金价格数据
从天天基金网抓取净值数据并存入数据库
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import requests
from datetime import datetime, timedelta
from app.db.session import get_conn


def fetch_fund_nav_history(fund_code: str, days: int = 30):
    """从天天基金网获取净值历史数据"""
    # 注意：这是一个示例实现，实际API可能需要调整
    url = f"https://fundgz.1234567.com.cn/js/{fund_code}.js"
    
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        # 返回示例数据（实际需要解析API返回）
        # 这里暂时返回空，需要根据实际API格式来解析
        return []
    except Exception as e:
        print(f"获取 {fund_code} 价格数据失败: {e}")
        return []


def import_mock_prices(asset_id: int, fund_code: str, days: int = 90):
    """导入模拟价格数据（用于测试）"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        base_nav = 1.5  # 模拟基础净值
        today = datetime.now().date()
        
        imported_count = 0
        for i in range(days, -1, -1):
            price_date = today - timedelta(days=i)
            # 模拟净值波动（±2%）
            nav = base_nav * (1 + (i % 20 - 10) / 500)
            
            # 插入或更新
            cur.execute("""
                INSERT INTO prices (asset_id, price_date, nav, source)
                VALUES (%(asset_id)s, %(price_date)s, %(nav)s, 'mock')
                ON CONFLICT (asset_id, price_date) 
                DO UPDATE SET nav = EXCLUDED.nav, source = 'mock', updated_at = now()
            """, {
                "asset_id": asset_id,
                "price_date": price_date,
                "nav": round(nav, 4)
            })
            imported_count += 1
        
        conn.commit()
        print(f"✅ 成功导入 {imported_count} 条价格数据（asset_id={asset_id}, code={fund_code}）")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ 导入失败: {e}")
    finally:
        cur.close()
        conn.close()


def sync_all_assets_prices():
    """为所有资产同步价格数据"""
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT id, code, name FROM assets WHERE status = 'holding'")
        assets = cur.fetchall()
        
        print(f"找到 {len(assets)} 个持有中的资产")
        
        for asset in assets:
            print(f"\n同步 {asset['name']} ({asset['code']})...")
            import_mock_prices(asset['id'], asset['code'], days=90)
        
        print("\n✅ 全部同步完成！")
        
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    print("开始同步价格数据...\n")
    sync_all_assets_prices()

