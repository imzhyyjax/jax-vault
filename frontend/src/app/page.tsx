"use client";

import { useEffect, useState, useMemo } from "react";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { getOverallStats, getOverallHoldings, getBatchEstimates, type OverallStats, type OverallHolding, type FundEstimate } from "@/lib/api";

export default function HomePage() {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [holdings, setHoldings] = useState<OverallHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  
  // 实时估值相关
  const [estimates, setEstimates] = useState<Map<number, FundEstimate>>(new Map());
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [estimatedDailyPnl, setEstimatedDailyPnl] = useState<number | null>(null);

  // 加载数据
  const loadData = async () => {
    const isRefresh = !loading;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    
    try {
      const [statsData, holdingsData] = await Promise.all([
        getOverallStats(),
        getOverallHoldings(),
      ]);
      
      setStats(statsData);
      setHoldings(holdingsData);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 加载实时估值并计算日内盈亏
  useEffect(() => {
    const loadEstimates = async () => {
      if (holdings.length === 0) return;

      setEstimatesLoading(true);
      try {
        const assetIds = holdings.map(h => h.asset_id);
        const result = await getBatchEstimates(assetIds);
        
        // 转换为 Map
        const estimateMap = new Map<number, FundEstimate>();
        result.estimates.forEach(est => {
          if (est.asset_id) {
            estimateMap.set(est.asset_id, est);
          }
        });
        
        setEstimates(estimateMap);

        // 计算日内盈亏估算
        if (result.is_trading_time) {
          let totalEstimatedPnl = 0;
          holdings.forEach(holding => {
            const estimate = estimateMap.get(holding.asset_id);
            if (estimate?.estimate_change_pct !== undefined && estimate?.estimate_change_pct !== null) {
              // 日内盈亏 = 持仓市值 * 涨跌幅%
              const dailyPnl = holding.market_value * (estimate.estimate_change_pct / 100);
              totalEstimatedPnl += dailyPnl;
            }
          });
          setEstimatedDailyPnl(totalEstimatedPnl);
        } else {
          setEstimatedDailyPnl(null);
        }
      } catch (e) {
        console.error('加载实时估值失败:', e);
      } finally {
        setEstimatesLoading(false);
      }
    };

    if (holdings.length > 0) {
      loadEstimates();
      // 每 5 分钟自动刷新一次
      const interval = setInterval(loadEstimates, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [holdings]);

  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // 筛选持仓
  const filteredHoldings = useMemo(() => {
    if (filterBucket === "all") return holdings;
    return holdings.filter((h) => h.bucket === filterBucket);
  }, [holdings, filterBucket]);

  // 计算资产配置
  const assetAllocation = useMemo(() => {
    const totalValue = stats?.total_value || 0;
    if (totalValue === 0) return [];

    const bucketMap = new Map<string, { value: number; count: number }>();
    
    holdings.forEach((h) => {
      const current = bucketMap.get(h.bucket) || { value: 0, count: 0 };
      bucketMap.set(h.bucket, {
        value: current.value + h.market_value,
        count: current.count + 1,
      });
    });

    return Array.from(bucketMap.entries()).map(([bucket, data]) => ({
      bucket,
      label: bucket === "progressive" ? "进攻型" : "防守型",
      value: data.value,
      count: data.count,
      percentage: (data.value / totalValue) * 100,
      color: bucket === "progressive" ? "from-blue-500 to-indigo-500" : "from-green-500 to-emerald-500",
    }));
  }, [holdings, stats]);

  // 收益榜单（前5）
  const topGainers = useMemo(() => {
    return [...holdings]
      .sort((a, b) => b.return_rate - a.return_rate)
      .slice(0, 5);
  }, [holdings]);

  const topLosers = useMemo(() => {
    return [...holdings]
      .sort((a, b) => a.return_rate - b.return_rate)
      .slice(0, 5);
  }, [holdings]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="投资总览"
        description={stats?.has_data ? `实时查看您的投资组合表现 · 更新于 ${stats.latest_date || '今日'}` : "实时查看您的投资组合表现"}
        action={
          <div className="flex gap-3">
            {stats?.has_data && (
              <Button 
                variant="secondary" 
                onClick={loadData}
                disabled={refreshing}
              >
                {refreshing ? "刷新中..." : "🔄 刷新"}
              </Button>
            )}
            <Button variant="primary" onClick={() => window.location.href = "/funds"}>
              ➕ 添加资产
            </Button>
          </div>
        }
      />

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600 font-medium">加载中...</span>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-red-900">加载失败</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 无数据状态 */}
      {!loading && !error && stats && !stats.has_data && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">欢迎使用 JAX VAULT</h3>
            <p className="text-gray-600 mb-6">
              还没有任何持仓数据，开始创建您的投资组合吧
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="primary" onClick={() => window.location.href = "/funds"}>
                从基金库添加资产
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = "/dashboard"}>
                创建投资组合
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 核心指标卡片 */}
      {!loading && !error && stats && stats.has_data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="总资产"
            value={formatCurrency(stats.total_value)}
            icon="💰"
            subtitle="当前市值"
          />
          <StatCard
            title="总成本"
            value={formatCurrency(stats.total_cost)}
            icon="📊"
            subtitle="累计投入"
          />
          <StatCard
            title="总收益"
            value={formatCurrency(stats.total_pnl)}
            change={formatPercent(stats.return_rate)}
            changeType={stats.total_pnl >= 0 ? "positive" : "negative"}
            icon="📈"
          />
          <StatCard
            title="今日收益"
            value={
              estimatedDailyPnl !== null 
                ? formatCurrency(estimatedDailyPnl) 
                : formatCurrency(stats.daily_pnl)
            }
            change={
              estimatedDailyPnl !== null
                ? (estimatesLoading ? "实时估算中..." : "实时估算")
                : (stats.daily_pnl >= 0 ? "盈利" : "亏损")
            }
            changeType={
              estimatedDailyPnl !== null
                ? (estimatedDailyPnl >= 0 ? "positive" : "negative")
                : (stats.daily_pnl >= 0 ? "positive" : "negative")
            }
            icon="⚡"
          />
        </div>
      )}

      {/* 图表区域 */}
      {!loading && !error && stats && stats.has_data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 资产配置 */}
          <div className="group bg-gradient-to-br from-white via-emerald-50/30 to-white rounded-2xl border border-gray-200 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  资产配置
                </h3>
              </div>
              <div className="text-xs text-gray-500 font-medium">
                共 {stats.asset_count} 个资产
              </div>
            </div>
            
            <div className="space-y-4">
              {assetAllocation.map((item) => (
                <div key={item.bucket} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${item.color}`}></div>
                      <span className="font-semibold text-gray-900">{item.label}</span>
                      <span className="text-gray-500">({item.count}个)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900">{formatCurrency(item.value)}</span>
                      <span className="text-gray-600 font-medium">{item.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {assetAllocation.length === 0 && (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-gray-600 font-medium">暂无配置数据</p>
                </div>
              </div>
            )}
          </div>

          {/* 收益榜单 */}
          <div className="group bg-gradient-to-br from-white via-purple-50/30 to-white rounded-2xl border border-gray-200 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                收益榜单
              </h3>
            </div>
            
            <div className="space-y-4">
              {/* 涨幅榜 */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span>📈</span>
                  <span>涨幅榜 TOP 3</span>
                </div>
                <div className="space-y-2">
                  {topGainers.slice(0, 3).map((holding, index) => (
                    <div key={holding.asset_id} className="flex items-center gap-3 bg-green-50/50 rounded-lg p-2 border border-green-100">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{holding.name}</div>
                        <div className="text-xs text-gray-500">{holding.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-600">{formatPercent(holding.return_rate)}</div>
                        <div className="text-xs text-green-600">{formatCurrency(holding.pnl)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 跌幅榜 */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span>📉</span>
                  <span>跌幅榜 TOP 3</span>
                </div>
                <div className="space-y-2">
                  {topLosers.slice(0, 3).map((holding, index) => (
                    <div key={holding.asset_id} className="flex items-center gap-3 bg-red-50/50 rounded-lg p-2 border border-red-100">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-rose-500 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{holding.name}</div>
                        <div className="text-xs text-gray-500">{holding.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-600">{formatPercent(holding.return_rate)}</div>
                        <div className="text-xs text-red-600">{formatCurrency(holding.pnl)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {holdings.length === 0 && (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <p className="text-gray-600 font-medium">暂无排行数据</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 持仓概览 */}
      {!loading && !error && stats && stats.has_data && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">持仓概览</h3>
              
              {/* 筛选按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterBucket("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterBucket === "all"
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-white text-gray-600 border border-gray-300 hover:border-purple-300"
                  }`}
                >
                  全部 ({holdings.length})
                </button>
                <button
                  onClick={() => setFilterBucket("progressive")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterBucket === "progressive"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-gray-600 border border-gray-300 hover:border-blue-300"
                  }`}
                >
                  进攻型 ({holdings.filter(h => h.bucket === "progressive").length})
                </button>
                <button
                  onClick={() => setFilterBucket("defensive")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterBucket === "defensive"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-white text-gray-600 border border-gray-300 hover:border-green-300"
                  }`}
                >
                  防守型 ({holdings.filter(h => h.bucket === "defensive").length})
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    资产名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    代码
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    市值
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    占比
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成本
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益率
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日内估值
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      暂无持仓数据
                    </td>
                  </tr>
                ) : (
                  filteredHoldings.map((holding) => {
                    const percentage = stats.total_value > 0 
                      ? (holding.market_value / stats.total_value) * 100 
                      : 0;
                    
                    return (
                      <tr key={holding.asset_id} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-200 group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              holding.bucket === "progressive" 
                                ? "bg-gradient-to-r from-blue-500 to-indigo-500" 
                                : "bg-gradient-to-r from-green-500 to-emerald-500"
                            }`}></div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                                {holding.name}
                              </div>
                              <div className="text-xs text-gray-500">{holding.subclass}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                          {holding.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                          {formatCurrency(holding.market_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-purple-600">
                            {percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-medium">
                          {formatCurrency(holding.cost_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-bold">
                          <span className={holding.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                            {formatCurrency(holding.pnl)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                            holding.return_rate >= 0 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            {formatPercent(holding.return_rate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          {(() => {
                            const estimate = estimates.get(holding.asset_id);
                            if (estimatesLoading) {
                              return <span className="text-gray-400 text-xs">...</span>;
                            }
                            if (estimate?.estimate_change_pct !== undefined && estimate?.estimate_change_pct !== null) {
                              const isPositive = estimate.estimate_change_pct >= 0;
                              const dailyPnl = holding.market_value * (estimate.estimate_change_pct / 100);
                              return (
                                <div className="flex flex-col items-center">
                                  <span className={`font-bold ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                                    {isPositive ? '↗' : '↘'} {estimate.estimate_change_pct.toFixed(2)}%
                                  </span>
                                  <span className={`text-xs font-semibold ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
                                    {formatCurrency(dailyPnl)}
                                  </span>
                                </div>
                              );
                            }
                            if (estimate && !estimate.is_trading_time) {
                              return <span className="text-gray-400 text-xs">休市</span>;
                            }
                            return <span className="text-gray-400 text-xs">-</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

