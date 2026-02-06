"use client";

import { useState } from "react";
import Button from "./Button";

type AddAssetModalProps = {
  fundCode: string;
  fundName: string;
  onConfirm: (data: {
    bucket: string;
    subclass: string;
    status: string;
    trade?: {
      buy_amount: number;
      buy_date: string;
    };
    position?: {
      current_value: number;
      profit_loss: number;
    };
  }) => void;
  onCancel: () => void;
  error?: string | null;
  isLoading?: boolean;
};

const BUCKET_OPTIONS = [
  { value: "progressive", label: "进攻型", color: "from-blue-500 to-indigo-500" },
  { value: "defensive", label: "防守型", color: "from-green-500 to-teal-500" },
];

const SUBCLASS_OPTIONS = {
  progressive: [
    { value: "CN_A", label: "中国 A 股" },
    { value: "HK_EQ", label: "香港股票" },
    { value: "US_EQ", label: "美国股票" },
    { value: "GLOBAL_EQ", label: "全球股票" },
  ],
  defensive: [
    { value: "DIVIDEND", label: "红利股息" },
    { value: "BOND", label: "债券" },
    { value: "PRECIOUS_METAL", label: "贵金属" },
    { value: "CASH", label: "现金" },
  ],
};

const STATUS_OPTIONS = [
  { value: "holding", label: "持有中", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "watchlist", label: "观察中", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "archived", label: "已归档", color: "bg-gray-100 text-gray-700 border-gray-300" },
];

export default function AddAssetModal({
  fundCode,
  fundName,
  onConfirm,
  onCancel,
  error,
  isLoading,
}: AddAssetModalProps) {
  const [bucket, setBucket] = useState<string>("");
  const [subclass, setSubclass] = useState<string>("");
  const [status, setStatus] = useState<string>("watchlist");
  
  // 交易信息（可选）
  const [importMode, setImportMode] = useState<"trade" | "position">("position"); // 新增：导入模式
  
  // 方式A：记录交易
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [buyDate, setBuyDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  // 方式B：导入持仓
  const [currentValue, setCurrentValue] = useState<string>(""); // 持仓金额
  const [profitLoss, setProfitLoss] = useState<string>("");     // 持有收益

  const handleSubmit = () => {
    if (!bucket || !subclass) {
      alert("请选择资产类型和子类");
      return;
    }

    const data: any = { bucket, subclass, status };

    // 如果状态是持有中，根据模式添加不同的数据
    if (status === "holding") {
      if (importMode === "trade" && buyAmount) {
        // 方式A：记录交易
        const amount = parseFloat(buyAmount);
        if (isNaN(amount) || amount <= 0) {
          alert("买入金额必须大于0");
          return;
        }
        data.trade = {
          buy_amount: amount,
          buy_date: buyDate,
        };
      } else if (importMode === "position" && currentValue) {
        // 方式B：导入持仓
        const value = parseFloat(currentValue);
        const pnl = parseFloat(profitLoss) || 0;
        
        if (isNaN(value) || value <= 0) {
          alert("持仓金额必须大于0");
          return;
        }
        
        data.position = {
          current_value: value,
          profit_loss: pnl,
        };
      }
    }

    onConfirm(data);
  };

  const subclassOptions = bucket
    ? SUBCLASS_OPTIONS[bucket as keyof typeof SUBCLASS_OPTIONS]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white flex-shrink-0">
          <h3 className="text-xl font-bold mb-2">添加资产到字典</h3>
          <p className="text-sm opacity-90">配置资产分类信息</p>
        </div>

        {/* 内容 - 可滚动 */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 基金信息 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="text-xs text-gray-600 mb-1">基金代码</div>
            <div className="font-mono font-bold text-gray-900">{fundCode}</div>
            <div className="text-sm text-gray-700 mt-2">{fundName}</div>
          </div>

          {/* 资产类型 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              资产类型 *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {BUCKET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setBucket(option.value);
                    setSubclass(""); // 重置子类
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    bucket === option.value
                      ? `bg-gradient-to-r ${option.color} text-white border-transparent shadow-lg scale-105`
                      : "bg-white border-gray-200 hover:border-purple-300"
                  }`}
                >
                  <div className="font-semibold">{option.label}</div>
                  {bucket === option.value && (
                    <div className="absolute top-2 right-2 text-white">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 子类 */}
          {bucket && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                资产子类 *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {subclassOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSubclass(option.value)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      subclass === option.value
                        ? "bg-purple-600 text-white border-purple-600 shadow-md"
                        : "bg-white border-gray-200 text-gray-700 hover:border-purple-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 状态 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              初始状态
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatus(option.value)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    status === option.value
                      ? option.color + " shadow-md"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 初始持仓录入（可选） */}
          {status === "holding" && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <div className="font-semibold text-gray-900">初始持仓录入（可选）</div>
                </div>
              </div>

              {/* 模式切换 */}
              <div className="flex gap-2 mb-4 bg-white rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setImportMode("position")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    importMode === "position"
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  📊 导入持仓
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("trade")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    importMode === "trade"
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  💳 记录交易
                </button>
              </div>

              {/* 方式B：导入持仓 */}
              {importMode === "position" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      持仓金额（元）*
                    </label>
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      placeholder="例如：10000"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 当前市值</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      持有收益（元）
                    </label>
                    <input
                      type="number"
                      value={profitLoss}
                      onChange={(e) => setProfitLoss(e.target.value)}
                      placeholder="例如：500 或 -200"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 盈亏金额（正数为盈利，负数为亏损）</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      📝 系统将根据最新净值自动计算份额和成本
                    </p>
                  </div>
                </div>
              )}

              {/* 方式A：记录交易 */}
              {importMode === "trade" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      买入金额（元）*
                    </label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="例如：10000"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 实际支付金额（含手续费）</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      买入日期
                    </label>
                    <input
                      type="date"
                      value={buyDate}
                      onChange={(e) => setBuyDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      📝 系统将自动创建买入交易记录到默认组合
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 - 固定 */}
        <div className="bg-gray-50 px-6 py-4 space-y-3 flex-shrink-0 border-t border-gray-200">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-lg">⚠️</span>
                <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
              </div>
            </div>
          )}
          
          {/* 按钮 */}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
              取消
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  添加中...
                </span>
              ) : (
                "确认添加"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

