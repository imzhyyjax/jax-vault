"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import EditAssetModal from "@/components/EditAssetModal";
import { getAssets, getAssetsStats, deleteAsset, updateAsset, quickBuy, getBatchEstimates, type Asset, type AssetStats, type FundEstimate } from "@/lib/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑相关
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [updating, setUpdating] = useState(false);

  // 实时估值相关
  const [estimates, setEstimates] = useState<Map<number, FundEstimate>>(new Map());
  const [estimatesLoading, setEstimatesLoading] = useState(false);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 并行加载资产列表和统计
      const [assetsData, statsData] = await Promise.all([
        getAssets(filter === "all" ? {} : { status: filter }),
        getAssetsStats(),
      ]);
      
      setAssets(assetsData);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  // 加载实时估值（仅持有中的资产）
  useEffect(() => {
    const loadEstimates = async () => {
      // 只为持有中的资产加载实时估值
      const holdingAssets = assets.filter(a => a.status === 'holding');
      if (holdingAssets.length === 0) return;

      setEstimatesLoading(true);
      try {
        const assetIds = holdingAssets.map(a => a.id);
        const result = await getBatchEstimates(assetIds);
        
        // 转换为 Map 便于查找
        const estimateMap = new Map<number, FundEstimate>();
        result.estimates.forEach(est => {
          if (est.asset_id) {
            estimateMap.set(est.asset_id, est);
          }
        });
        
        setEstimates(estimateMap);
      } catch (e) {
        console.error('加载实时估值失败:', e);
      } finally {
        setEstimatesLoading(false);
      }
    };

    if (assets.length > 0) {
      loadEstimates();
      // 每 5 分钟自动刷新一次
      const interval = setInterval(loadEstimates, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [assets]);

  const marketBadgeColor = (market: string) => {
    const colors: Record<string, string> = {
      CN: "bg-red-100 text-red-700",
      US: "bg-blue-100 text-blue-700",
      HK: "bg-purple-100 text-purple-700",
    };
    return colors[market] || "bg-gray-100 text-gray-700";
  };

  const statusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      holding: "bg-green-100 text-green-700",
      archived: "bg-gray-100 text-gray-500",
      watchlist: "bg-yellow-100 text-yellow-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const statusText: Record<string, string> = {
    holding: "持有中",
    archived: "已归档",
    watchlist: "观察中",
  };

  // 编辑资产
  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
  };

  const handleUpdateAsset = async (updates: any) => {
    if (!editingAsset) return;
    
    setUpdating(true);
    try {
      // 提取交易信息
      const trade = updates.trade;
      delete updates.trade;

      // 1. 更新资产信息（如果有修改）
      if (Object.keys(updates).length > 0) {
        await updateAsset(editingAsset.id, updates);
      }

      // 2. 如果有交易信息，创建买入交易记录
      let tradeCreated = false;
      let tradeError = null;
      
      if (trade) {
        try {
          await quickBuy({
            asset_id: editingAsset.id,
            buy_amount: trade.buy_amount,
            buy_date: trade.buy_date,
          });
          tradeCreated = true;
        } catch (tradeErr: any) {
          tradeError = tradeErr.message;
          // 如果不是价格数据缺失，直接抛出错误
          if (!tradeErr.message.includes("净值数据")) {
            throw tradeErr;
          }
        }
      }

      setEditingAsset(null);
      loadData(); // 重新加载数据
      
      // 显示结果提示
      if (trade) {
        if (tradeCreated) {
          alert("✅ 资产信息已更新，交易记录已创建！");
        } else if (tradeError) {
          alert(`⚠️ 资产信息已更新，但交易记录创建失败：\n\n${tradeError}\n\n请先在后端运行价格同步脚本：\npython backend/scripts/sync_prices.py`);
        }
      }
    } catch (e: any) {
      alert(e.message || "更新失败");
    } finally {
      setUpdating(false);
    }
  };

  // 删除资产
  const handleDelete = async (asset: Asset) => {
    setDeleteConfirm(asset);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      await deleteAsset(deleteConfirm.id);
      setDeleteConfirm(null);
      loadData(); // 重新加载数据
    } catch (e: any) {
      alert(e.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  // 搜索过滤
  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      asset.code.toLowerCase().includes(q) ||
      asset.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="资产管理"
        description="管理您的投资资产字典"
        action={
          <Button variant="primary">
            ✨ 添加资产
          </Button>
        }
      />

      {/* 筛选器 */}
      <div className="bg-gradient-to-r from-white to-slate-50 rounded-2xl border border-gray-200 p-5 shadow-md">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 font-semibold">状态筛选：</span>
          <div className="flex gap-2">
            {["all", "holding", "watchlist", "archived"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
                  filter === f
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/50"
                    : "bg-white text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 border border-gray-200"
                }`}
              >
                {f === "all" ? "全部" : statusText[f] || f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 加载或错误状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600 font-medium">加载中...</span>
          </div>
        </div>
      )}

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

      {/* 资产分类统计 */}
      {!loading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="group relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white rounded-2xl p-6 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="text-sm font-semibold opacity-90 mb-2">进攻型资产</div>
              <div className="text-4xl font-black mb-1">{stats.progressive_count}</div>
              <div className="text-xs opacity-75 font-medium uppercase tracking-wider">Progressive</div>
            </div>
          </div>
          <div className="group relative bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 text-white rounded-2xl p-6 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="text-sm font-semibold opacity-90 mb-2">防守型资产</div>
              <div className="text-4xl font-black mb-1">{stats.defensive_count}</div>
              <div className="text-xs opacity-75 font-medium uppercase tracking-wider">Defensive</div>
            </div>
          </div>
          <div className="group relative bg-gradient-to-br from-purple-500 via-violet-600 to-fuchsia-600 text-white rounded-2xl p-6 hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="text-sm font-semibold opacity-90 mb-2">持有中</div>
              <div className="text-4xl font-black mb-1">{stats.holding_count}</div>
              <div className="text-xs opacity-75 font-medium uppercase tracking-wider">Holding</div>
            </div>
          </div>
          <div className="group relative bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white rounded-2xl p-6 hover:shadow-2xl hover:shadow-amber-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="text-sm font-semibold opacity-90 mb-2">观察中</div>
              <div className="text-4xl font-black mb-1">{stats.watchlist_count}</div>
              <div className="text-xs opacity-75 font-medium uppercase tracking-wider">Watchlist</div>
            </div>
          </div>
        </div>
      )}

      {/* 资产列表 */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              资产列表 ({filteredAssets.length})
            </h3>
            <input
              type="text"
              placeholder="🔍 搜索资产代码或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm hover:shadow-md transition-shadow"
            />
          </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  市场
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  代码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  子类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  实时估值
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-6xl mb-4">📊</div>
                      <p className="text-gray-500 mb-4">
                        {searchQuery ? "未找到匹配的资产" : "暂无资产数据"}
                      </p>
                      {!searchQuery && (
                        <Button variant="primary" onClick={() => window.location.href = "/funds"}>
                          从基金库添加
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${marketBadgeColor(
                          asset.market
                        )}`}
                      >
                        {asset.market}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-semibold">
                      {asset.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{asset.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {asset.bucket === "progressive" ? "进攻型" : "防守型"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {asset.subclass}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor(
                          asset.status
                        )}`}
                      >
                        {statusText[asset.status] || asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {asset.status === 'holding' && (() => {
                        const estimate = estimates.get(asset.id);
                        if (estimatesLoading) {
                          return <span className="text-gray-400 text-xs">加载中...</span>;
                        }
                        if (estimate?.estimate_change_pct !== undefined && estimate?.estimate_change_pct !== null) {
                          const isPositive = estimate.estimate_change_pct >= 0;
                          return (
                            <div className="flex flex-col items-center">
                              <span className={`font-bold ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                                {isPositive ? '↗' : '↘'} {estimate.estimate_change_pct.toFixed(2)}%
                              </span>
                              {estimate.estimate_time && (
                                <span className="text-xs text-gray-400 mt-0.5">
                                  {estimate.estimate_time.substring(11, 16)}
                                </span>
                              )}
                              {estimate.cached && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 mt-1">
                                  缓存
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (estimate && !estimate.is_trading_time) {
                          return <span className="text-gray-400 text-xs">非交易时间</span>;
                        }
                        return <span className="text-gray-400 text-xs">-</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        className="text-blue-600 hover:text-blue-700 font-medium mr-3 hover:underline"
                        onClick={() => handleEdit(asset)}
                      >
                        编辑
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-700 font-medium hover:underline"
                        onClick={() => handleDelete(asset)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* 编辑弹窗 */}
      {editingAsset && (
        <EditAssetModal
          asset={editingAsset}
          onConfirm={handleUpdateAsset}
          onCancel={() => setEditingAsset(null)}
        />
      )}

      {/* 更新中遮罩 */}
      {updating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg font-semibold text-gray-900">
                更新中...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-6 text-white rounded-t-2xl">
              <h3 className="text-xl font-bold">确认删除</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                确定要删除以下资产吗？
              </p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="font-mono font-bold text-gray-900">{deleteConfirm.code}</div>
                <div className="text-sm text-gray-700 mt-1">{deleteConfirm.name}</div>
              </div>
              <p className="text-sm text-red-600 mt-4">
                ⚠️ 注意：如果该资产有关联的持仓或交易记录，将无法删除
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
              <Button 
                variant="ghost" 
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button 
                variant="primary"
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              >
                {deleting ? "删除中..." : "确认删除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

