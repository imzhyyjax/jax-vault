"use client";

import { useState, useEffect } from "react";
import Button from "./Button";
import type { Asset } from "@/lib/api";

type EditAssetModalProps = {
  asset: Asset;
  onConfirm: (data: {
    name?: string;
    bucket?: string;
    subclass?: string;
    status?: string;
    trade?: {
      buy_amount: number;
      buy_date: string;
    };
  }) => void;
  onCancel: () => void;
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

export default function EditAssetModal({
  asset,
  onConfirm,
  onCancel,
}: EditAssetModalProps) {
  const [name, setName] = useState(asset.name);
  const [bucket, setBucket] = useState(asset.bucket);
  const [subclass, setSubclass] = useState(asset.subclass);
  const [status, setStatus] = useState(asset.status);

  // 交易信息（可选）
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [buyDate, setBuyDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const handleSubmit = () => {
    // 只提交修改过的字段
    const updates: any = {};
    if (name !== asset.name) updates.name = name;
    if (bucket !== asset.bucket) updates.bucket = bucket;
    if (subclass !== asset.subclass) updates.subclass = subclass;
    if (status !== asset.status) updates.status = status;

    // 如果状态是持有中且填写了买入金额，添加交易信息
    if (status === "holding" && buyAmount) {
      const amount = parseFloat(buyAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("买入金额必须大于0");
        return;
      }

      updates.trade = {
        buy_amount: amount,
        buy_date: buyDate,
      };
    }

    // 检查是否有任何修改（包括交易信息）
    if (Object.keys(updates).length === 0) {
      alert("没有修改任何内容");
      return;
    }

    onConfirm(updates);
  };

  const subclassOptions = bucket
    ? SUBCLASS_OPTIONS[bucket as keyof typeof SUBCLASS_OPTIONS]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex-shrink-0">
          <h3 className="text-xl font-bold mb-2">编辑资产</h3>
          <p className="text-sm opacity-90">修改资产信息</p>
        </div>

        {/* 内容 - 可滚动 */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 资产信息 */}
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">市场 / 代码</div>
            <div className="font-mono font-bold text-gray-900">
              {asset.market} / {asset.code}
            </div>
          </div>

          {/* 资产名称 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              资产名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 资产类型 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              资产类型
            </label>
            <div className="grid grid-cols-2 gap-3">
              {BUCKET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setBucket(option.value);
                    // 如果切换类型，重置子类为该类型的第一个选项
                    const newSubclassOptions = SUBCLASS_OPTIONS[option.value as keyof typeof SUBCLASS_OPTIONS];
                    setSubclass(newSubclassOptions[0].value);
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    bucket === option.value
                      ? `bg-gradient-to-r ${option.color} text-white border-transparent shadow-lg scale-105`
                      : "bg-white border-gray-200 hover:border-blue-300"
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              资产子类
            </label>
            <div className="grid grid-cols-2 gap-2">
              {subclassOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSubclass(option.value)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    subclass === option.value
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              状态
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

          {/* 记录交易（可选） */}
          {status === "holding" && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💰</span>
                <div className="font-semibold text-gray-900">记录买入交易（可选）</div>
              </div>
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    📝 系统将自动创建买入交易记录到默认组合
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 - 固定 */}
        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end flex-shrink-0 border-t border-gray-200">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            保存修改
          </Button>
        </div>
      </div>
    </div>
  );
}

