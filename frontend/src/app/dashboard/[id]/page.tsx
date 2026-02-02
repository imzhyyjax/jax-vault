"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import PortfolioModal from "@/components/PortfolioModal";
import {
  getPortfolio,
  getPortfolioHoldings,
  getAssets,
  createQuickHolding,
  getLatestHoldingByAsset,
  getBatchEstimates,
  deletePortfolio,
  deleteHoldingsByPortfolioAsset,
  moveHoldingToDefault,
  deleteHoldingsByAsset,
  deleteTradesByAsset,
  deleteAsset,
  type Asset,
  type PortfolioWithStats,
  type PortfolioHolding,
  type LatestHoldingSnapshot,
  type FundEstimate,
} from "@/lib/api";

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = parseInt(params.id as string);

  const [portfolio, setPortfolio] = useState<PortfolioWithStats | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [estimates, setEstimates] = useState<Map<number, FundEstimate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addingHolding, setAddingHolding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [marketValue, setMarketValue] = useState("");
  const [costValue, setCostValue] = useState("");
  const [latestHolding, setLatestHolding] = useState<LatestHoldingSnapshot | null>(null);
  const [latestHoldingLoading, setLatestHoldingLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PortfolioHolding | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // 格式化货币
  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 格式化百分比
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  // 编辑组合
  const handleEdit = () => {
    setShowModal(true);
  };

  // 删除组合
  const handleDelete = async () => {
    if (!portfolio) return;
    
    if (!confirm(`确定要删除组合"${portfolio.name}"吗？\n\n删除后所有持仓数据将被清空，此操作不可恢复！`)) {
      return;
    }

    try {
      await deletePortfolio(portfolio.id);
      alert("删除成功");
      router.push("/dashboard");
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  // 模态框确认回调
  const handleModalConfirm = async (data: { name: string }) => {
    if (!portfolio) return;
    
    try {
      const { updatePortfolio } = await import("@/lib/api");
      await updatePortfolio(portfolio.id, data);
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(`更新失败: ${err.message}`);
    }
  };

  // 加载组合信息和持仓
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [portfolioData, holdingsData] = await Promise.all([
        getPortfolio(portfolioId),
        getPortfolioHoldings(portfolioId),
      ]);

      setPortfolio(portfolioData);
      setHoldings(holdingsData);

      // 加载可添加的持有资产（排除已在组合内的）
      const holdingAssets = await getAssets({ status: "holding", limit: 500 });
      const existingIds = new Set(holdingsData.map((h) => h.asset_id));
      const filteredAssets = holdingAssets.filter((asset) => !existingIds.has(asset.id));
      setAvailableAssets(filteredAssets);
      const nextSelectedId = filteredAssets[0]?.id ?? null;
      if (!selectedAssetId || !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
        setSelectedAssetId(nextSelectedId);
      }

      // 加载实时估值
      if (holdingsData.length > 0) {
        setEstimatesLoading(true);
        try {
          const assetIds = holdingsData.map((h) => h.asset_id);
          const response = await getBatchEstimates(assetIds);
          const estimatesMap = new Map<number, FundEstimate>(
            response.estimates.filter(e => e.asset_id !== undefined).map((e) => [e.asset_id!, e])
          );
          setEstimates(estimatesMap);
        } catch (err) {
          console.error("获取估值失败:", err);
        } finally {
          setEstimatesLoading(false);
        }
      }
    } catch (err: any) {
      console.error("加载失败:", err);
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (portfolioId) {
      loadData();
    }
  }, [portfolioId]);

  useEffect(() => {
    if (!selectedAssetId) {
      setLatestHolding(null);
      setMarketValue("");
      setCostValue("");
      return;
    }

    const loadLatest = async () => {
      setLatestHoldingLoading(true);
      setAddError(null);
      try {
        const snapshot = await getLatestHoldingByAsset(selectedAssetId);
        setLatestHolding(snapshot);
        setMarketValue(snapshot.market_value.toString());
        setCostValue(snapshot.cost_value !== null && snapshot.cost_value !== undefined ? snapshot.cost_value.toString() : "");
      } catch (err: any) {
        setLatestHolding(null);
        setMarketValue("");
        setCostValue("");
      } finally {
        setLatestHoldingLoading(false);
      }
    };

    loadLatest();
  }, [selectedAssetId]);

  const canAddHolding = useMemo(() => {
    if (!selectedAssetId) return false;
    if (latestHolding) return true;
    if (!marketValue) return false;
    const value = parseFloat(marketValue);
    if (isNaN(value) || value < 0) return false;
    return true;
  }, [marketValue, selectedAssetId, latestHolding]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">{error || "组合不存在"}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            返回组合列表
          </button>
        </div>
      </div>
    );
  }

  const handleAddHolding = async () => {
    if (!portfolio || !selectedAssetId) return;
    const mv = marketValue
      ? parseFloat(marketValue)
      : latestHolding
        ? latestHolding.market_value
        : 0;
    const cv = costValue
      ? parseFloat(costValue)
      : latestHolding && latestHolding.cost_value !== null && latestHolding.cost_value !== undefined
        ? latestHolding.cost_value
        : undefined;
    if (marketValue && (isNaN(mv) || mv < 0)) {
      setAddError("市值不能为负数");
      return;
    }
    if (costValue && (isNaN(cv!) || cv! < 0)) {
      setAddError("成本不能为负数");
      return;
    }

    setAddingHolding(true);
    setAddError(null);
    try {
      await createQuickHolding({
        portfolio_id: portfolio.id,
        asset_id: selectedAssetId,
        market_value: mv,
        cost_value: cv ?? (latestHolding ? latestHolding.cost_value ?? 0 : 0),
      });
      setMarketValue("");
      setCostValue("");
      setLatestHolding(null);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || "添加失败");
    } finally {
      setAddingHolding(false);
    }
  };

  const handleRemoveFromPortfolio = async () => {
    if (!portfolio || !removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteHoldingsByPortfolioAsset(portfolio.id, removeTarget.asset_id);
      setRemoveTarget(null);
      await loadData();
    } catch (err: any) {
      setRemoveError(err.message || "操作失败");
    } finally {
      setRemoving(false);
    }
  };

  const handleMoveToDefault = async () => {
    if (!portfolio || !removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await moveHoldingToDefault(portfolio.id, removeTarget.asset_id);
      setRemoveTarget(null);
      await loadData();
    } catch (err: any) {
      setRemoveError(err.message || "操作失败");
    } finally {
      setRemoving(false);
    }
  };

  const handleDeleteEverywhere = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteHoldingsByAsset(removeTarget.asset_id);
      await deleteTradesByAsset(removeTarget.asset_id);
      await deleteAsset(removeTarget.asset_id);
      setRemoveTarget(null);
      await loadData();
    } catch (err: any) {
      setRemoveError(err.message || "操作失败");
    } finally {
      setRemoving(false);
    }
  };

  // 计算进攻型和防守型占比
  const progressiveValue = holdings
    .filter((h) => h.bucket === "progressive")
    .reduce((sum, h) => sum + h.market_value, 0);
  const defensiveValue = holdings
    .filter((h) => h.bucket === "defensive")
    .reduce((sum, h) => sum + h.market_value, 0);
  const totalValue = portfolio.total_value;
  const progressivePercent = totalValue > 0 ? (progressiveValue / totalValue) * 100 : 0;
  const defensivePercent = totalValue > 0 ? (defensiveValue / totalValue) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={portfolio.name}
          description={`${holdings.length} 个资产 · ${
            portfolio.include_in_overall ? "已启用" : "已禁用"
          }`}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleEdit}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 hover:text-red-700 font-medium border border-red-300 rounded-lg hover:bg-red-50"
          >
            删除
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            ← 返回列表
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="总市值"
          value={formatCurrency(portfolio.total_value)}
          icon="💰"
          changeType="neutral"
        />
        <StatCard
          title="总成本"
          value={formatCurrency(portfolio.total_cost)}
          icon="📊"
          changeType="neutral"
        />
        <StatCard
          title="总收益"
          value={formatCurrency(portfolio.total_pnl)}
          subtitle={formatPercent(portfolio.return_rate)}
          icon={portfolio.total_pnl >= 0 ? "📈" : "📉"}
          changeType={portfolio.total_pnl >= 0 ? "positive" : "negative"}
        />
        <StatCard
          title="资产数量"
          value={portfolio.asset_count.toString()}
          subtitle={`进攻 ${progressivePercent.toFixed(1)}% · 防守 ${defensivePercent.toFixed(1)}%`}
          icon="🎯"
          changeType="neutral"
        />
      </div>

      {/* 添加已持有基金到组合 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">添加已持有基金</h3>
          <span className="text-xs text-gray-400">
            从资产管理“持有中”里挑选
          </span>
        </div>
        {availableAssets.length === 0 ? (
          <div className="text-sm text-gray-500">
            暂无可添加的持有资产（都已在该组合中）
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">选择资产</label>
              <select
                value={selectedAssetId ?? undefined}
                onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} · {asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">市值</label>
              <input
                value={marketValue}
                onChange={(e) => setMarketValue(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={latestHolding ? "已从持仓快照带入" : "请输入市值"}
                disabled={!!latestHolding}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">成本</label>
              <input
                value={costValue}
                onChange={(e) => setCostValue(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={latestHolding ? "已从持仓快照带入" : "请输入成本"}
                disabled={!!latestHolding}
              />
            </div>
          </div>
        )}
        {latestHoldingLoading && (
          <div className="mt-2 text-xs text-gray-400">正在读取持仓快照...</div>
        )}
        {latestHolding && (
          <div className="mt-2 text-xs text-green-600">
            已按最新持仓快照填充，将原封不动加入该组合
          </div>
        )}
        {!latestHolding && !latestHoldingLoading && (
          <div className="mt-2 text-xs text-amber-600">
            未找到持仓快照，将按当前输入加入组合
          </div>
        )}
        {addError && (
          <div className="mt-3 text-sm text-red-600">{addError}</div>
        )}
        <div className="mt-4">
          <button
            onClick={handleAddHolding}
            disabled={!canAddHolding || addingHolding || availableAssets.length === 0}
            className="px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {addingHolding ? "添加中..." : "添加到组合"}
          </button>
        </div>
      </div>

      {/* 持仓明细表 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <h3 className="text-lg font-bold text-gray-900">持仓明细</h3>
        </div>

        <div className="overflow-x-auto">
          {holdings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">暂无持仓数据</p>
            </div>
          ) : (
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[6%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
              <col className="w-[15%]" />
              <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    资产名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    代码
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    市值
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    占比
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成本
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益率
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日内估值
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holdings.map((holding) => {
                  const percentage =
                    totalValue > 0
                      ? (holding.market_value / totalValue) * 100
                      : 0;

                  return (
                    <tr
                      key={holding.asset_id}
                      className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-200 group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              holding.bucket === "progressive"
                                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                                : "bg-gradient-to-r from-green-500 to-emerald-500"
                            }`}
                          ></div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                              {holding.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {holding.subclass}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                        {holding.code}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left font-bold text-gray-900 tabular-nums">
                        {formatCurrency(holding.market_value)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left tabular-nums">
                        <span className="text-sm font-semibold text-purple-600">
                          {percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left text-gray-600 font-medium">
                        {formatCurrency(holding.cost_value)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left font-bold">
                        <span
                          className={
                            holding.pnl >= 0 ? "text-red-600" : "text-green-600"
                          }
                        >
                          {formatCurrency(holding.pnl)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                            holding.return_rate >= 0
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {formatPercent(holding.return_rate)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left text-sm">
                        {(() => {
                          const estimate = estimates.get(holding.asset_id);
                          if (estimatesLoading) {
                            return (
                              <span className="text-gray-400 text-xs">
                                ...
                              </span>
                            );
                          }
                          if (
                            estimate?.estimate_change_pct !== undefined &&
                            estimate?.estimate_change_pct !== null
                          ) {
                            const isPositive = estimate.estimate_change_pct >= 0;
                            const dailyPnl =
                              holding.market_value *
                              (estimate.estimate_change_pct / 100);
                            return (
                              <div className="flex flex-col items-start">
                                <span
                                  className={`font-bold ${
                                    isPositive
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {isPositive ? "↗" : "↘"}{" "}
                                  {estimate.estimate_change_pct.toFixed(2)}%
                                </span>
                                <span
                                  className={`text-xs font-semibold ${
                                    isPositive
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }`}
                                >
                                  {formatCurrency(dailyPnl)}
                                </span>
                              </div>
                            );
                          }
                          if (estimate && !estimate.is_trading_time) {
                            return (
                              <span className="text-gray-400 text-xs">
                                休市
                              </span>
                            );
                          }
                          return (
                            <span className="text-gray-400 text-xs">-</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-left">
                        <button
                          onClick={() => {
                            setRemoveTarget(holding);
                            setRemoveError(null);
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {showModal && portfolio && (
        <PortfolioModal
          portfolio={portfolio}
          onConfirm={handleModalConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* 删除持仓弹窗 */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-6 text-white rounded-t-2xl">
              <h3 className="text-xl font-bold">删除持仓</h3>
              <p className="text-sm opacity-90 mt-1">
                {removeTarget.code} · {removeTarget.name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-700">
                请选择删除方式：
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleMoveToDefault}
                  disabled={removing}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50"
                >
                  <div className="font-semibold text-gray-900">仅从组合移除（不影响投资总览）</div>
                  <div className="text-xs text-gray-500 mt-1">
                    持仓将转移到默认组合，总览仍保留
                  </div>
                </button>
                <button
                  onClick={handleRemoveFromPortfolio}
                  disabled={removing}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50"
                >
                  <div className="font-semibold text-gray-900">仅从本组合移除</div>
                  <div className="text-xs text-gray-500 mt-1">
                    只影响当前组合，可能影响总览
                  </div>
                </button>
                <button
                  onClick={handleDeleteEverywhere}
                  disabled={removing}
                  className="w-full text-left px-4 py-3 rounded-xl border border-red-200 hover:border-red-400 hover:bg-red-50"
                >
                  <div className="font-semibold text-red-700">彻底删除（资产+持仓+交易）</div>
                  <div className="text-xs text-red-500 mt-1">
                    不可恢复，请谨慎
                  </div>
                </button>
              </div>
              {removeError && (
                <div className="text-sm text-red-600">{removeError}</div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end rounded-b-2xl">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

