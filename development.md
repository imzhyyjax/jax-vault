~~~~
jax-vault/
├─ README.md
├─ .gitignore
├─ docker-compose.yml            # 可选：本地一键起 Postgres
├─ db/
│  ├─ init.sql                   # 你的一键建表脚本（A路线核心）
│  └─ migrations/                # 后续变更：001_add_xxx.sql ...
├─ backend/
│  ├─ pyproject.toml / requirements.txt
│  ├─ .env.example               # DB_URL、密钥等（别提交真实 .env）
│  ├─ app/
│  │  ├─ main.py                 # FastAPI 入口
│  │  ├─ core/
│  │  │  ├─ config.py            # 读环境变量、配置
│  │  │  ├─ logging.py
│  │  │  └─ security.py          # 可选：简单 auth
│  │  ├─ db/
│  │  │  ├─ session.py           # DB 连接（asyncpg / psycopg2）
│  │  │  └─ healthcheck.py
│  │  ├─ models/                 # ORM（可选：你也可纯 SQL）
│  │  │  ├─ asset.py
│  │  │  ├─ portfolio.py
│  │  │  ├─ trade.py
│  │  │  ├─ price.py
│  │  │  ├─ holding.py
│  │  │  └─ pnl.py
│  │  ├─ schemas/                # Pydantic：请求/返回结构
│  │  │  ├─ asset.py
│  │  │  ├─ portfolio.py
│  │  │  ├─ trade.py
│  │  │  ├─ price.py
│  │  │  ├─ holding.py
│  │  │  └─ pnl.py
│  │  ├─ services/               # 业务逻辑（核心）
│  │  │  ├─ import_service.py    # CSV导入 holdings/trades
│  │  │  ├─ pricing_service.py   # 拉取净值/行情（先 stub）
│  │  │  ├─ holdings_service.py  # 快照写入、聚合
│  │  │  ├─ pnl_service.py       # 计算 pnl_snapshot（心脏）
│  │  │  └─ risk_service.py      # drawdown/state（后面做 signals）
│  │  ├─ api/                    # 路由层（REST）
│  │  │  ├─ router.py
│  │  │  ├─ assets.py
│  │  │  ├─ portfolios.py
│  │  │  ├─ trades.py
│  │  │  ├─ prices.py
│  │  │  ├─ holdings.py
│  │  │  └─ overall.py           # 读 v_overall_holdings / v_overall_pnl
│  │  ├─ jobs/                   # 半自动每日任务（cron 调用）
│  │  │  ├─ run_daily.py         # 总调度：update_prices + snapshot + pnl
│  │  │  ├─ update_prices.py
│  │  │  ├─ snapshot_holdings.py
│  │  │  └─ compute_pnl.py
│  │  └─ utils/
│  │     ├─ csv_utils.py
│  │     ├─ date_utils.py
│  │     └─ math_utils.py
│  └─ tests/
│     ├─ test_import.py
│     └─ test_pnl.py
├─ frontend/
│  ├─ package.json
│  ├─ next.config.js
│  ├─ .env.local.example         # NEXT_PUBLIC_API_BASE 等
│  ├─ src/
│  │  ├─ app/                    # Next.js App Router
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx             # Dashboard
│  │  │  ├─ portfolio/page.tsx   # 导入/查看 holdings
│  │  │  ├─ trades/page.tsx      # 交易流水
│  │  │  ├─ assets/page.tsx      # 资产字典（可选）
│  │  │  └─ settings/page.tsx
│  │  ├─ components/
│  │  │  ├─ StatCard.tsx
│  │  │  ├─ HoldingsTable.tsx
│  │  │  ├─ TradeForm.tsx
│  │  │  ├─ UploadCsv.tsx
│  │  │  └─ charts/
│  │  │     ├─ NavLineChart.tsx
│  │  │     └─ DrawdownChart.tsx
│  │  ├─ lib/
│  │  │  ├─ api.ts               # fetch 封装
│  │  │  └─ types.ts             # 对齐后端 schema
│  │  └─ styles/
│  │     └─ globals.css
└─ scripts/
   ├─ dev.sh                      # 一键启动前后端
   ├─ init_db.sh                  # psql -f db/init.sql
   └─ backup_db.sh                # pg_dump 备份
~~~~