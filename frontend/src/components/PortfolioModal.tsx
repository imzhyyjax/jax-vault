"use client";

import { useState, useEffect } from "react";
import Button from "./Button";

type PortfolioModalProps = {
  portfolio?: {
    id: number;
    name: string;
    include_in_overall: boolean;
  } | null;
  onConfirm: (data: { name: string; include_in_overall: boolean }) => void;
  onCancel: () => void;
};

export default function PortfolioModal({
  portfolio,
  onConfirm,
  onCancel,
}: PortfolioModalProps) {
  const [name, setName] = useState("");
  const [includeInOverall, setIncludeInOverall] = useState(true);

  useEffect(() => {
    if (portfolio) {
      setName(portfolio.name);
      setIncludeInOverall(portfolio.include_in_overall);
    }
  }, [portfolio]);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("请输入组合名称");
      return;
    }
    onConfirm({ name: name.trim(), include_in_overall: includeInOverall });
  };

  const isEdit = !!portfolio;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white">
          <h3 className="text-xl font-bold mb-2">
            {isEdit ? "编辑投资组合" : "创建投资组合"}
          </h3>
          <p className="text-sm opacity-90">
            {isEdit ? "修改组合信息" : "创建一个新的投资组合来管理您的资产"}
          </p>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 组合名称 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              组合名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的主组合、美股组合、稳健组合"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-2">
              {name.length}/50 字符
            </p>
          </div>

          {/* 计入整体统计 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border-2 border-purple-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <button
                  onClick={() => setIncludeInOverall(!includeInOverall)}
                  className={`w-12 h-6 rounded-full transition-all duration-200 relative ${
                    includeInOverall
                      ? "bg-gradient-to-r from-purple-600 to-violet-600"
                      : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                      includeInOverall ? "transform translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 mb-1">
                  计入整体统计
                </div>
                <p className="text-sm text-gray-600">
                  启用后，此组合的持仓和收益将计入首页的整体统计数据
                </p>
              </div>
            </div>
          </div>

          {/* 提示信息 */}
          {!isEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 text-lg">💡</span>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">使用建议</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>可以按策略创建组合（如：美股组合、债券组合）</li>
                    <li>可以按账户创建组合（如：券商A、券商B）</li>
                    <li>测试组合可以不计入整体统计</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEdit ? "保存修改" : "创建组合"}
          </Button>
        </div>
      </div>
    </div>
  );
}

