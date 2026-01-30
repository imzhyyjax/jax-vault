## table design
### portfolios table
~~~~sql
CREATE TABLE portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  include_in_overall BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
~~~~

### assessts table
~~~~sql
CREATE TABLE assets (
  id SERIAL PRIMARY KEY,

  market TEXT NOT NULL CHECK (market IN ('CN','US','HK')),
  code TEXT NOT NULL,

  name TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (
    bucket IN ('progressive','defensive')
    ),

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
    (bucket = 'progressive' AND subclass IN (
        'CN_A',
        'HK_EQ',
        'US_EQ',
        'GLOBAL_EQ'
    ))
    OR
    (bucket = 'defensive' AND subclass IN (
        'DIVIDEND',       
        'BOND',        
        'PRECIOUS_METAL',
        'CASH'
    ))
  )
);
~~~~

### trade table
~~~~sql
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,

  -- 关联
  portfolio_id INT REFERENCES portfolios(id),
  asset_id     INT REFERENCES assets(id),

  -- 时间
  trade_date DATE NOT NULL,
  trade_time TIME,                     -- 可选（以后导券商对账用）

  -- 方向
  side TEXT NOT NULL CHECK (
    side IN ('buy','sell')
  ),

  -- 数量与价格
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price    NUMERIC NOT NULL CHECK (price > 0),

  -- 成交金额（冗余字段，方便统计，可由 quantity*price 得）
  amount   NUMERIC,

  -- 费用
  fee      NUMERIC DEFAULT 0,

  -- 本次交易是否计入系统统计（纠错/模拟用）
  is_valid BOOLEAN DEFAULT true,

  -- 来源
  source TEXT CHECK (
    source IN ('manual','system','import')
  ) DEFAULT 'manual',

  -- 备注（做T理由、纠错说明等）
  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
~~~~

### prices table
~~~~sql
CREATE TABLE prices (
  id SERIAL PRIMARY KEY,

  -- 对应资产
  asset_id INT NOT NULL REFERENCES assets(id),

  -- 日期（基金净值通常是 T+1；ETF/指数可做日线）
  price_date DATE NOT NULL,

  -- 价格体系：你可以只用 nav（基金），或用 close（ETF/指数）
  nav NUMERIC,            -- 基金单位净值
  close NUMERIC,          -- 收盘价（ETF/指数）
  open NUMERIC,
  high NUMERIC,
  low  NUMERIC,
  volume NUMERIC,

  -- 币种（可选：一般等于资产币种，但留着方便未来多币种行情源）
  currency TEXT DEFAULT 'CNY',

  -- 数据来源与质量
  source TEXT,            -- manual / api / import
  quality TEXT CHECK (
    quality IN ('final','estimate','revised')
  ) DEFAULT 'final',

  -- 备注（比如：T+1 补齐、拆分复权说明等）
  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- 同一资产同一天只能一条“最终口径”
  UNIQUE (asset_id, price_date)
);
~~~~

### holdings_snapshot
~~~~sql
CREATE TABLE holdings_snapshot (
  id SERIAL PRIMARY KEY,

  -- 关联：同一资产可在多个 portfolio 中持有
  portfolio_id INT NOT NULL REFERENCES portfolios(id),
  asset_id     INT NOT NULL REFERENCES assets(id),

  -- 快照日期（建议每日一条；基金净值 T+1 也能照样记录“当日持仓”）
  snap_date DATE NOT NULL,

  -- 持仓事实
  shares NUMERIC,                       -- 份额/股数（可为空：只知道市值也行）
  market_value NUMERIC NOT NULL,        -- 当日市值（你导入/估算/系统计算）
  cost_value   NUMERIC,                 -- 当日成本总额（可选但强烈建议有）

  -- 占比（冗余快照，便于 UI 直接展示；也可由 market_value / 组合总市值算）
  weight NUMERIC,

  -- 数据来源
  source TEXT CHECK (
    source IN ('manual','csv','system','import')
  ) DEFAULT 'manual',

  note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- 每个组合-资产-日期只能一条快照
  UNIQUE (portfolio_id, asset_id, snap_date)
);

~~~~
### pnl_snapshot table
~~~~sql
CREATE TABLE pnl_snapshot (
  id SERIAL PRIMARY KEY,

  -- 关联
  portfolio_id INT NOT NULL REFERENCES portfolios(id),
  asset_id     INT NOT NULL REFERENCES assets(id),

  -- 快照日期（对应 prices.price_date / holdings_snapshot.snap_date）
  snap_date DATE NOT NULL,

  -- 已实现收益（做T、卖出落袋）
  realized_pnl NUMERIC DEFAULT 0,

  -- 未实现收益（浮盈浮亏）
  unrealized_pnl NUMERIC DEFAULT 0,

  -- 总收益（realized + unrealized）
  total_pnl NUMERIC GENERATED ALWAYS AS
    (COALESCE(realized_pnl,0) + COALESCE(unrealized_pnl,0)) STORED,

  -- 当日收益（对比前一日）
  daily_pnl NUMERIC DEFAULT 0,

  -- 成本与市值（冗余快照，方便校验）
  cost_value   NUMERIC,
  market_value NUMERIC,

  -- 可选：当日收益率
  daily_return NUMERIC,

  -- 来源（自动算 / 修正）
  source TEXT CHECK (
    source IN ('system','manual','adjust')
  ) DEFAULT 'system',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- 每资产/组合/日期 只能一条
  UNIQUE (portfolio_id, asset_id, snap_date)
);
~~~~
### add index
~~~~sql
-- trades
CREATE INDEX idx_trades_portfolio_date ON trades(portfolio_id, trade_date);
CREATE INDEX idx_trades_asset_date     ON trades(asset_id, trade_date);

-- prices
CREATE INDEX idx_prices_asset_date     ON prices(asset_id, price_date);

-- holdings_snapshot
CREATE INDEX idx_holdings_portfolio_date ON holdings_snapshot(portfolio_id, snap_date);
CREATE INDEX idx_holdings_asset_date     ON holdings_snapshot(asset_id, snap_date);

-- pnl_snapshot
CREATE INDEX idx_pnl_portfolio_date    ON pnl_snapshot(portfolio_id, snap_date);
CREATE INDEX idx_pnl_asset_date        ON pnl_snapshot(asset_id, snap_date);
~~~~~