// API 调用封装

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

// ============ Assets API ============

export interface Asset {
  id: number;
  market: string;
  code: string;
  name: string;
  bucket: string;
  subclass: string;
  currency: string;
  benchmark: string;
  provider?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AssetCreate {
  market: string;
  code: string;
  name: string;
  bucket: string;
  subclass: string;
  currency?: string;
  benchmark?: string;
  provider?: string;
  status?: string;
}

export interface AssetFromUniverse {
  fund_code: string;
  bucket: string;
  subclass: string;
  status?: string;
}

export interface AssetStats {
  total: number;
  progressive_count: number;
  defensive_count: number;
  holding_count: number;
  watchlist_count: number;
  archived_count: number;
  cn_count: number;
  us_count: number;
  hk_count: number;
}

// 获取资产列表
export async function getAssets(params?: {
  status?: string;
  market?: string;
  bucket?: string;
  limit?: number;
}): Promise<Asset[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.market) query.set("market", params.market);
  if (params?.bucket) query.set("bucket", params.bucket);
  if (params?.limit) query.set("limit", params.limit.toString());

  const url = `${API_BASE}/assets/?${query.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 获取单个资产
export async function getAsset(id: number): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 创建资产
export async function createAsset(data: AssetCreate): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 从基金库添加资产
export async function createAssetFromUniverse(
  data: AssetFromUniverse
): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/from_universe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 更新资产
export async function updateAsset(
  id: number,
  data: Partial<AssetCreate>
): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 删除资产
export async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
}

// 获取资产统计
export async function getAssetsStats(): Promise<AssetStats> {
  const res = await fetch(`${API_BASE}/assets/stats/summary`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============ Portfolios API ============

export interface Portfolio {
  id: number;
  name: string;
  include_in_overall: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioWithStats extends Portfolio {
  asset_count: number;
  total_value: number;
  total_cost: number;
  total_pnl: number;
  return_rate: number;
}

export interface PortfolioCreate {
  name: string;
  include_in_overall?: boolean;
}

// 获取组合列表
export async function getPortfolios(): Promise<PortfolioWithStats[]> {
  const res = await fetch(`${API_BASE}/portfolios/`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 获取单个组合
export async function getPortfolio(id: number): Promise<PortfolioWithStats> {
  const res = await fetch(`${API_BASE}/portfolios/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 创建组合
export async function createPortfolio(
  data: PortfolioCreate
): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/portfolios/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 更新组合
export async function updatePortfolio(
  id: number,
  data: Partial<PortfolioCreate>
): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/portfolios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 删除组合
export async function deletePortfolio(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/portfolios/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
}

// 获取组合统计
export async function getPortfoliosStats(): Promise<{
  total_portfolios: number;
  enabled_portfolios: number;
  total_assets: number;
}> {
  const res = await fetch(`${API_BASE}/portfolios/stats/summary`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 获取组合持仓明细
export interface PortfolioHolding {
  asset_id: number;
  code: string;
  name: string;
  market: string;
  bucket: string;
  subclass: string;
  shares: number;
  market_value: number;
  cost_value: number;
  pnl: number;
  return_rate: number;
}

export async function getPortfolioHoldings(portfolioId: number): Promise<PortfolioHolding[]> {
  const res = await fetch(`${API_BASE}/portfolios/${portfolioId}/holdings`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============ Overall API ============

export interface OverallStats {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  daily_pnl: number;
  return_rate: number;
  asset_count: number;
  portfolio_count: number;
  has_data: boolean;
  latest_date?: string;
}

export interface OverallHolding {
  asset_id: number;
  code: string;
  name: string;
  market: string;
  bucket: string;
  subclass: string;
  shares: number;
  market_value: number;
  cost_value: number;
  pnl: number;
  return_rate: number;
}

// 获取整体统计
export async function getOverallStats(): Promise<OverallStats> {
  const res = await fetch(`${API_BASE}/overall/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 获取整体持仓
export async function getOverallHoldings(): Promise<OverallHolding[]> {
  const res = await fetch(`${API_BASE}/overall/holdings`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============ Holdings API ============

export interface QuickHoldingCreate {
  portfolio_id?: number;
  asset_id: number;
  shares?: number;
  market_value: number;
  cost_value?: number;
}

// 快速创建持仓（添加/编辑资产时使用）
export async function createQuickHolding(data: QuickHoldingCreate): Promise<{
  success: boolean;
  holding_id: number;
  portfolio_id: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/holdings/quick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface LatestHoldingSnapshot {
  portfolio_id: number;
  asset_id: number;
  snap_date: string;
  shares?: number | null;
  market_value: number;
  cost_value?: number | null;
  updated_at: string;
}

// 获取资产最新持仓快照
export async function getLatestHoldingByAsset(assetId: number): Promise<LatestHoldingSnapshot> {
  const res = await fetch(`${API_BASE}/holdings/asset/${assetId}/latest`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 删除某个资产的持仓快照
export async function deleteHoldingsByAsset(assetId: number): Promise<{
  success: boolean;
  deleted_count: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/holdings/asset/${assetId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 仅删除某组合下某资产的持仓快照
export async function deleteHoldingsByPortfolioAsset(portfolioId: number, assetId: number): Promise<{
  success: boolean;
  deleted_count: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/holdings/portfolio/${portfolioId}/asset/${assetId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 将持仓从组合移到默认组合（不影响总览）
export async function moveHoldingToDefault(portfolioId: number, assetId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/holdings/portfolio/${portfolioId}/asset/${assetId}/move_to_default`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============ Quick Buy API ============

export interface QuickBuyRequest {
  asset_id: number;
  buy_amount: number;
  buy_date: string; // YYYY-MM-DD
  portfolio_id?: number;
  note?: string;
}

export interface QuickBuyResponse {
  success: boolean;
  trade_id: number;
  portfolio_id: number;
  asset_id: number;
  buy_amount: number;
  buy_date: string;
  nav: number;
  shares: number;
  message: string;
}

// 快速买入：根据买入金额和日期自动创建交易记录
export async function quickBuy(data: QuickBuyRequest): Promise<QuickBuyResponse> {
  const res = await fetch(`${API_BASE}/trades/quick_buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 删除某个资产的交易记录（谨慎使用）
export async function deleteTradesByAsset(assetId: number): Promise<{
  success: boolean;
  deleted_count: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/trades/asset/${assetId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============ Position Import API ============

export interface PositionImportRequest {
  asset_id: number;
  current_value: number;  // 当前持仓金额
  profit_loss: number;     // 持有收益
  portfolio_id?: number;
  note?: string;
}

export interface PositionImportResponse {
  success: boolean;
  portfolio_id: number;
  asset_id: number;
  current_value: number;
  profit_loss: number;
  cost_value: number;
  shares: number | null;
  nav: number | null;
  message: string;
}

// 导入持仓：根据当前市值和收益反推成本和份额
export async function importPosition(data: PositionImportRequest): Promise<PositionImportResponse> {
  const res = await fetch(`${API_BASE}/trades/import_position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}


// ============ Estimates API ============

export interface FundEstimate {
  asset_id?: number;
  asset_name?: string;
  fund_code: string;
  estimate_value?: number;  // 估算净值
  estimate_change_pct?: number;  // 估算涨跌幅
  estimate_time?: string;  // 估值时间
  last_nav?: number;  // 昨日净值
  last_nav_date?: string;  // 昨日净值日期
  is_trading_time: boolean;
  cached?: boolean;
}

export interface BatchEstimateResponse {
  estimates: FundEstimate[];
  total: number;
  is_trading_time: boolean;
  cached_count: number;
  error_count: number;
}

// 获取单个资产的实时估值
export async function getFundEstimate(assetId: number): Promise<FundEstimate> {
  const res = await fetch(`${API_BASE}/estimates/fund/${assetId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// 批量获取多个资产的实时估值
export async function getBatchEstimates(assetIds: number[]): Promise<BatchEstimateResponse> {
  const res = await fetch(`${API_BASE}/estimates/batch?asset_ids=${assetIds.join(",")}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// 清空估值缓存
export async function clearEstimateCache(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/estimates/cache/clear`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

