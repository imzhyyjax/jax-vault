"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import StatCard from "@/components/StatCard";
import PortfolioModal from "@/components/PortfolioModal";
import {
  getPortfolios,
  getPortfoliosStats,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  type PortfolioWithStats,
} from "@/lib/api";

export default function DashboardPage() {
  const [portfolios, setPortfolios] = useState<PortfolioWithStats[]>([]);
  const [stats, setStats] = useState<{
    total_portfolios: number;
    enabled_portfolios: number;
    total_assets: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioWithStats | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<PortfolioWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [portfoliosData, statsData] = await Promise.all([
        getPortfolios(),
        getPortfoliosStats(),
      ]);
      
      setPortfolios(portfoliosData);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // 处理创建/编辑
  const handleCreate = () => {
    setEditingPortfolio(null);
    setShowModal(true);
  };

  const handleEdit = (portfolio: PortfolioWithStats) => {
    setEditingPortfolio(portfolio);
    setShowModal(true);
  };

  const handleSave = async (data: { name: string; include_in_overall: boolean }) => {
    setSaving(true);
    try {
      if (editingPortfolio) {
        // 编辑
        await updatePortfolio(editingPortfolio.id, data);
      } else {
        // 创建
        await createPortfolio(data);
      }
      setShowModal(false);
      setEditingPortfolio(null);
      loadData(); // 重新加载数据
    } catch (e: any) {
      alert(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 处理删除
  const handleDelete = (portfolio: PortfolioWithStats) => {
    setDeleteConfirm(portfolio);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      await deletePortfolio(deleteConfirm.id);
      setDeleteConfirm(null);
      loadData(); // 重新加载数据
    } catch (e: any) {
      alert(e.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="投资组合"
        description="管理您的多个投资组合"
        action={
          <Button variant="primary" onClick={handleCreate}>
            ✨ 创建组合
          </Button>
        }
      />

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

      {/* 组合概览统计 */}
      {!loading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="总组合数"
            value={stats.total_portfolios}
            icon="📁"
            subtitle="已创建的投资组合"
          />
          <StatCard
            title="已启用组合"
            value={stats.enabled_portfolios}
            icon="✅"
            subtitle="计入整体统计"
          />
          <StatCard
            title="总资产种类"
            value={stats.total_assets}
            icon="📊"
            subtitle="跨所有组合"
          />
        </div>
      )}

      {/* 组合列表 */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
            <h3 className="text-lg font-bold text-gray-900">
              组合列表 ({portfolios.length})
            </h3>
          </div>
        <div className="overflow-x-auto">
          {portfolios.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="text-6xl mb-4">📁</div>
                <p className="text-gray-500 mb-4">还没有创建任何投资组合</p>
                <p className="text-sm text-gray-400 mb-6">
                  创建组合来管理不同的投资策略或账户
                </p>
                <Button variant="primary" onClick={handleCreate}>
                  创建第一个组合
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    组合名称
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    资产数量
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    总市值
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    总成本
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收益率
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {portfolios.map((portfolio) => (
                  <tr key={portfolio.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-bold text-gray-900">
                          {portfolio.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 font-medium">
                      {portfolio.asset_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(portfolio.total_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {formatCurrency(portfolio.total_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                      <span
                        className={
                          portfolio.total_pnl >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {formatCurrency(portfolio.total_pnl)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span
                        className={`font-bold ${
                          portfolio.return_rate >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatPercent(portfolio.return_rate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {portfolio.include_in_overall ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          已启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          已禁用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        className="text-blue-600 hover:text-blue-700 font-medium mr-3 hover:underline"
                        onClick={() => alert("查看功能开发中")}
                      >
                        查看
                      </button>
                      <button 
                        className="text-gray-600 hover:text-gray-700 font-medium mr-3 hover:underline"
                        onClick={() => handleEdit(portfolio)}
                      >
                        编辑
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-700 font-medium hover:underline"
                        onClick={() => handleDelete(portfolio)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* 快速操作指南 */}
      {!loading && !error && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="group relative bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 border-2 border-blue-300 rounded-2xl p-6 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
            <h4 className="font-bold text-white mb-2 text-lg">记录交易</h4>
            <p className="text-sm text-blue-50 leading-relaxed">
              记录买入、卖出操作，系统自动计算持仓和收益
            </p>
          </div>
        </div>
        <div className="group relative bg-gradient-to-br from-emerald-500 via-green-500 to-lime-500 border-2 border-emerald-300 rounded-2xl p-6 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📈</div>
            <h4 className="font-bold text-white mb-2 text-lg">导入快照</h4>
            <p className="text-sm text-emerald-50 leading-relaxed">
              从券商导出 CSV，快速导入持仓快照数据
            </p>
          </div>
        </div>
        <div className="group relative bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 border-2 border-purple-300 rounded-2xl p-6 hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💰</div>
            <h4 className="font-bold text-white mb-2 text-lg">查看分析</h4>
            <p className="text-sm text-purple-50 leading-relaxed">
              查看收益曲线、回撤分析、资产配置等
            </p>
          </div>
        </div>
      </div>
      )}

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <PortfolioModal
          portfolio={editingPortfolio}
          onConfirm={handleSave}
          onCancel={() => {
            setShowModal(false);
            setEditingPortfolio(null);
          }}
        />
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
                确定要删除以下投资组合吗？
              </p>
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                <div className="font-bold text-gray-900 text-lg">{deleteConfirm.name}</div>
                <div className="text-sm text-gray-600 mt-2">
                  <div>资产数量：{deleteConfirm.asset_count}</div>
                  <div>总市值：{formatCurrency(deleteConfirm.total_value)}</div>
                </div>
              </div>
              <p className="text-sm text-red-600 mt-4">
                ⚠️ 注意：如果该组合有关联的持仓、交易或盈亏记录，将无法删除
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

      {/* 保存中遮罩 */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg font-semibold text-gray-900">
                保存中...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

