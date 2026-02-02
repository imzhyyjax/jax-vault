"use client";

export default function TradesPage() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-purple-50/20 rounded-2xl border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          交易记录功能开发中
        </h2>
        <p className="text-gray-600 mb-6">
          这个功能将支持记录买入/卖出交易，自动计算持仓和收益
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
          <span>📋</span>
          <span className="text-sm font-medium">API 已完成，前端页面待开发</span>
        </div>
      </div>
    </div>
  );
}

