"""
诊断数据流问题
检查 assets → trades → holdings_snapshot 的数据流
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import get_conn


def diagnose():
    """诊断数据流"""
    conn = get_conn()
    cur = conn.cursor()
    
    print("=" * 60)
    print("数据流诊断报告")
    print("=" * 60)
    
    try:
        # 1. 检查资产
        print("\n【1】资产字典 (assets)")
        cur.execute("""
            SELECT id, code, name, status, bucket, subclass
            FROM assets
            ORDER BY created_at DESC
        """)
        assets = cur.fetchall()
        
        if not assets:
            print("  ❌ 没有资产数据")
            return
        
        print(f"  ✅ 共 {len(assets)} 个资产")
        for asset in assets:
            print(f"     [{asset['id']}] {asset['name']} ({asset['code']}) - {asset['status']}")
        
        # 2. 检查价格数据
        print("\n【2】价格数据 (prices)")
        cur.execute("""
            SELECT 
                a.id, a.name, a.code,
                COUNT(p.id) as price_count,
                MAX(p.price_date) as latest_date
            FROM assets a
            LEFT JOIN prices p ON p.asset_id = a.id
            GROUP BY a.id, a.name, a.code
            ORDER BY a.id
        """)
        prices = cur.fetchall()
        
        has_price_data = False
        for p in prices:
            if p['price_count'] > 0:
                print(f"  ✅ [{p['id']}] {p['name']}: {p['price_count']} 条价格记录，最新日期: {p['latest_date']}")
                has_price_data = True
            else:
                print(f"  ❌ [{p['id']}] {p['name']}: 没有价格数据")
        
        if not has_price_data:
            print("\n  ⚠️  建议运行: python scripts/sync_prices.py")
        
        # 3. 检查交易记录
        print("\n【3】交易记录 (trades)")
        cur.execute("""
            SELECT 
                t.id, t.asset_id, a.name, a.code,
                t.trade_date, t.side, t.quantity, t.amount,
                p.name as portfolio_name
            FROM trades t
            JOIN assets a ON a.id = t.asset_id
            JOIN portfolios p ON p.id = t.portfolio_id
            WHERE t.is_valid = true
            ORDER BY t.created_at DESC
        """)
        trades = cur.fetchall()
        
        if not trades:
            print("  ❌ 没有交易记录")
            print("     原因: 可能是编辑资产时缺少价格数据，导致交易创建失败")
        else:
            print(f"  ✅ 共 {len(trades)} 条交易记录")
            for trade in trades:
                print(f"     [{trade['id']}] {trade['name']} - {trade['side']} - "
                      f"份额: {trade['quantity']:.2f}, 金额: ¥{trade['amount']:.2f}")
        
        # 4. 检查持仓快照
        print("\n【4】持仓快照 (holdings_snapshot)")
        cur.execute("""
            SELECT 
                h.id, h.asset_id, a.name, a.code,
                h.snap_date, h.shares, h.market_value, h.cost_value,
                p.name as portfolio_name
            FROM holdings_snapshot h
            JOIN assets a ON a.id = h.asset_id
            JOIN portfolios p ON p.id = h.portfolio_id
            ORDER BY h.snap_date DESC, h.id DESC
        """)
        holdings = cur.fetchall()
        
        if not holdings:
            print("  ❌ 没有持仓快照")
            print("     这就是为什么投资总览看不到数据的原因！")
        else:
            print(f"  ✅ 共 {len(holdings)} 条持仓快照")
            for holding in holdings:
                print(f"     [{holding['id']}] {holding['name']} - {holding['snap_date']} - "
                      f"市值: ¥{holding['market_value']:.2f}")
        
        # 5. 检查组合
        print("\n【5】投资组合 (portfolios)")
        cur.execute("""
            SELECT id, name, include_in_overall
            FROM portfolios
            ORDER BY created_at
        """)
        portfolios = cur.fetchall()
        
        if not portfolios:
            print("  ⚠️  没有组合（系统会自动创建默认组合）")
        else:
            print(f"  ✅ 共 {len(portfolios)} 个组合")
            for portfolio in portfolios:
                status = "✅ 包含在总览" if portfolio['include_in_overall'] else "❌ 不包含"
                print(f"     [{portfolio['id']}] {portfolio['name']} - {status}")
        
        # 总结
        print("\n" + "=" * 60)
        print("诊断总结")
        print("=" * 60)
        
        issues = []
        solutions = []
        
        if not has_price_data:
            issues.append("❌ 缺少价格数据")
            solutions.append("运行: python scripts/sync_prices.py")
        
        if not trades:
            issues.append("❌ 没有交易记录")
            solutions.append("重新编辑资产并填写买入金额")
        
        if not holdings:
            issues.append("❌ 没有持仓快照")
            solutions.append("运行: python scripts/rebuild_holdings_snapshot.py")
        
        if issues:
            print("\n发现问题:")
            for issue in issues:
                print(f"  {issue}")
            
            print("\n解决方案:")
            for i, solution in enumerate(solutions, 1):
                print(f"  {i}. {solution}")
        else:
            print("\n✅ 数据流正常！如果投资总览还是看不到数据，请刷新页面。")
        
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    diagnose()

