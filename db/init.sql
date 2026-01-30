-- =========================
-- JAX-VAULT init.sql
-- =========================

-- 可选：重复执行时先清理（开发期方便）
-- ⚠️ 会删除数据，生产环境别开
-- DROP VIEW IF EXISTS v_overall_pnl;
-- DROP VIEW IF EXISTS v_overall_holdings;
-- DROP TABLE IF EXISTS pnl_snapshot;
-- DROP TABLE IF EXISTS holdings_snapshot;
-- DROP TABLE IF EXISTS prices;
-- DROP TABLE IF EXISTS trades;
-- DROP TABLE IF EXISTS assets;
-- DROP TABLE IF EXISTS portfolios;

-- =========================
-- 1) portfolios
-- =========================
CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  include_in_overall BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
-- =========================
-- fund universe (CN funds)
-- =========================
CREATE TABLE IF NOT EXISTS fund_universe_cn (
  id SERIAL PRIMARY KEY,

  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  fund_type TEXT,

  pinyin_abbr TEXT,
  pinyin_full TEXT,

  provider TEXT DEFAULT 'eastmoney',
  status TEXT DEFAULT 'active',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_universe_cn_code
ON fund_universe_cn(code);

CREATE INDEX IF NOT EXISTS idx_fund_universe_cn_name
ON fund_universe_cn(name);
-- =========================
-- 2) assets
-- =========================
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,

  market TEXT NOT NULL CHECK (market IN ('CN','US','HK')),
  code   TEXT NOT NULL,

  name   TEXT NOT NULL,

  bucket TEXT NOT NULL CHECK (bucket IN ('progressive','defensive')),
  subclass TEXT NOT NULL,

  currency TEXT DEFAULT 'CNY',

  benchmark TEXT CHECK (
    benchmark IN ('CSI300','SP500','NASDAQ','HSI','NONE')
  ) DEFAULT 'NONE',

  provider TEXT,

  status TEXT CHECK (
    status IN ('holding','archived','watchlist')
  ) DEFAULT 'watchlist',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (market, code),

  CONSTRAINT bucket_subclass_check CHECK (
    (bucket = 'progressive' AND subclass IN ('CN_A','HK_EQ','US_EQ','GLOBAL_EQ'))
    OR
    (bucket = 'defensive' AND subclass IN ('DIVIDEND','BOND','PRECIOUS_METAL','CASH'))
  )
);

-- =========================
-- 3) trades
-- =========================
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,

  portfolio_id INT NOT NULL REFERENCES portfolios(id),
  asset_id     INT NOT NULL REFERENCES assets(id),

  trade_date DATE NOT NULL,
  trade_time TIME,

  side TEXT NOT NULL CHECK (side IN ('buy','sell')),

  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price    NUMERIC NOT NULL CHECK (price > 0),

  -- 冗余字段（可选）：你也可以后端写入时算
  amount   NUMERIC,

  fee      NUMERIC DEFAULT 0,
  is_valid BOOLEAN DEFAULT true,

  source TEXT CHECK (
    source IN ('manual','system','import')
  ) DEFAULT 'manual',

  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- =========================
-- 4) prices
-- =========================
CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,

  asset_id INT NOT NULL REFERENCES assets(id),
  price_date DATE NOT NULL,

  nav NUMERIC,
  close NUMERIC,
  open NUMERIC,
  high NUMERIC,
  low  NUMERIC,
  volume NUMERIC,

  currency TEXT DEFAULT 'CNY',

  source TEXT,
  quality TEXT CHECK (
    quality IN ('final','estimate','revised')
  ) DEFAULT 'final',

  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (asset_id, price_date)
);

-- =========================
-- 5) holdings_snapshot
-- =========================
CREATE TABLE IF NOT EXISTS holdings_snapshot (
  id SERIAL PRIMARY KEY,

  portfolio_id INT NOT NULL REFERENCES portfolios(id),
  asset_id     INT NOT NULL REFERENCES assets(id),

  snap_date DATE NOT NULL,

  shares NUMERIC,
  market_value NUMERIC NOT NULL,
  cost_value NUMERIC,

  weight NUMERIC,

  source TEXT CHECK (
    source IN ('manual','csv','system','import')
  ) DEFAULT 'manual',

  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (portfolio_id, asset_id, snap_date)
);

-- =========================
-- 6) pnl_snapshot
-- =========================
CREATE TABLE IF NOT EXISTS pnl_snapshot (
  id SERIAL PRIMARY KEY,

  portfolio_id INT NOT NULL REFERENCES portfolios(id),
  asset_id     INT NOT NULL REFERENCES assets(id),

  snap_date DATE NOT NULL,

  realized_pnl NUMERIC DEFAULT 0,
  unrealized_pnl NUMERIC DEFAULT 0,

  total_pnl NUMERIC GENERATED ALWAYS AS
    (COALESCE(realized_pnl,0) + COALESCE(unrealized_pnl,0)) STORED,

  daily_pnl NUMERIC DEFAULT 0,

  cost_value NUMERIC,
  market_value NUMERIC,
  daily_return NUMERIC,

  source TEXT CHECK (
    source IN ('system','manual','adjust')
  ) DEFAULT 'system',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (portfolio_id, asset_id, snap_date)
);

-- =========================
-- 7) Indexes
-- =========================
-- trades
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_date ON trades(portfolio_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_asset_date     ON trades(asset_id, trade_date);

-- prices
CREATE INDEX IF NOT EXISTS idx_prices_asset_date     ON prices(asset_id, price_date);

-- holdings_snapshot
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_date ON holdings_snapshot(portfolio_id, snap_date);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_date     ON holdings_snapshot(asset_id, snap_date);

-- pnl_snapshot
CREATE INDEX IF NOT EXISTS idx_pnl_portfolio_date    ON pnl_snapshot(portfolio_id, snap_date);
CREATE INDEX IF NOT EXISTS idx_pnl_asset_date        ON pnl_snapshot(asset_id, snap_date);

-- =========================
-- 8) Views: Overall (no double counting)
-- =========================

-- Overall holdings: 按 asset 聚合 + 只算 include_in_overall=true 的组合
CREATE OR REPLACE VIEW v_overall_holdings AS
SELECT
  h.snap_date,
  h.asset_id,
  SUM(h.shares)       AS shares,
  SUM(h.market_value) AS market_value,
  SUM(h.cost_value)   AS cost_value,
  CASE WHEN SUM(h.shares) > 0 THEN SUM(h.cost_value) / SUM(h.shares) ELSE NULL END AS avg_cost
FROM holdings_snapshot h
JOIN portfolios p ON p.id = h.portfolio_id
WHERE p.include_in_overall = true
GROUP BY h.snap_date, h.asset_id;

-- Overall pnl: 按 asset 聚合 + 只算 include_in_overall=true 的组合
CREATE OR REPLACE VIEW v_overall_pnl AS
SELECT
  s.snap_date,
  s.asset_id,
  SUM(s.realized_pnl)   AS realized_pnl,
  SUM(s.unrealized_pnl) AS unrealized_pnl,
  SUM(s.total_pnl)      AS total_pnl,
  SUM(s.daily_pnl)      AS daily_pnl,
  SUM(s.cost_value)     AS cost_value,
  SUM(s.market_value)   AS market_value
FROM pnl_snapshot s
JOIN portfolios p ON p.id = s.portfolio_id
WHERE p.include_in_overall = true
GROUP BY s.snap_date, s.asset_id;