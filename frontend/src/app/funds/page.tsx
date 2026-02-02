"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import AddAssetModal from "@/components/AddAssetModal";
import { createAssetFromUniverse, quickBuy, importPosition } from "@/lib/api";

type FundRow = {
  code: string;
  name: string;
  fund_type?: string | null;
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function FundsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 250);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<FundRow[]>([]);
  
  // 添加资产相关状态
  const [showModal, setShowModal] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundRow | null>(null);
  const [addingAsset, setAddingAsset] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canSearch = useMemo(() => dq.length >= 1, [dq]);

  useEffect(() => {
    let aborted = false;

    async function run() {
      if (!canSearch) {
        setRows([]);
        setErr(null);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const url = new URL("/universe/funds", API_BASE);
        url.searchParams.set("q", dq);
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!aborted) setRows(data.results || []);
      } catch (e: any) {
        if (!aborted) setErr(e?.message || "请求失败");
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [API_BASE, dq, canSearch]);

  // 处理添加资产
  const handleAddAsset = (fund: FundRow) => {
    setSelectedFund(fund);
    setShowModal(true);
  };

  const handleConfirmAdd = async (data: {
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
  }) => {
    if (!selectedFund) return;

    setAddingAsset(true);
    setErr(null);

    try {
      // 1. 添加资产
      const asset = await createAssetFromUniverse({
        fund_code: selectedFund.code,
        bucket: data.bucket,
        subclass: data.subclass,
        status: data.status,
      });

      // 2. 根据不同模式创建持仓
      if (data.position) {
        // 方式B：导入持仓
        try {
          const result = await importPosition({
            asset_id: asset.id,
            current_value: data.position.current_value,
            profit_loss: data.position.profit_loss,
          });
          setSuccessMsg(`${result.message}`);
        } catch (posErr: any) {
          if (posErr.message.includes("净值数据")) {
            setSuccessMsg(
              `成功添加 ${selectedFund.name}，但持仓导入失败：${posErr.message}`
            );
          } else {
            throw posErr;
          }
        }
      } else if (data.trade) {
        // 方式A：记录交易
        try {
          const result = await quickBuy({
            asset_id: asset.id,
            buy_amount: data.trade.buy_amount,
            buy_date: data.trade.buy_date,
          });
          setSuccessMsg(`${result.message}`);
        } catch (tradeErr: any) {
          if (tradeErr.message.includes("净值数据")) {
            setSuccessMsg(
              `成功添加 ${selectedFund.name}，但交易记录创建失败：${tradeErr.message}`
            );
          } else {
            throw tradeErr;
          }
        }
      } else {
        setSuccessMsg(`成功添加 ${selectedFund.name} 到资产字典！`);
      }

      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErr(e?.message || "添加失败");
    } finally {
      setAddingAsset(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="基金库"
        description="搜索中国公募基金，快速添加到资产字典"
      />

      {/* 搜索区域 */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-purple-50/20 rounded-2xl border border-gray-200 p-6 shadow-lg hover:shadow-2xl transition-all duration-300">
        <div className="relative flex items-center">
          <div className={`absolute left-0 pl-5 flex items-center gap-2 pointer-events-none transition-all duration-300 ${q ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'}`}>
            <span className="text-2xl">🔍</span>
            <span className="text-gray-400 text-sm font-medium">输入基金代码或名称（例如：纳指、513100）</span>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-5 pr-4 py-4 border-2 border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:shadow-md transition-all"
          />
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-gray-500 font-semibold">API:</span>
            <span className="font-mono text-xs bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
              {API_BASE}
            </span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </div>
              <span className="font-semibold">搜索中...</span>
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200">
              <span>⚠️</span>
              <span className="font-semibold">错误: {err}</span>
            </div>
          )}
        </div>
      </div>

      {/* 结果统计 */}
      {rows.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
            <span className="text-gray-600">找到 </span>
            <span className="font-black text-emerald-700">{rows.length}</span>
            <span className="text-gray-600"> 个结果</span>
          </span>
        </div>
      )}

      {/* 搜索结果 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  代码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-6xl mb-4">🔍</div>
                      <p className="text-gray-500 mb-2">
                        {q ? "未找到相关基金" : "输入关键词开始搜索"}
                      </p>
                      <p className="text-sm text-gray-400">
                        支持代码、名称、拼音缩写搜索
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.code} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {r.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{r.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {r.fund_type || "未知"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddAsset(r)}
                      >
                        ✨ 添加到资产
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 提示信息 */}
      {rows.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-200 rounded-2xl shadow-md">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm">
              <p className="font-bold text-blue-900 mb-2">下一步开发计划</p>
              <p className="text-blue-800 leading-relaxed">点击"添加到资产"按钮将调用 <code className="px-2 py-1 bg-white rounded font-mono text-xs border border-blue-200">POST /assets/from_universe</code> 接口，自动添加到资产字典</p>
            </div>
          </div>
        </div>
      )}

      {/* 添加资产弹窗 */}
      {showModal && selectedFund && (
        <AddAssetModal
          fundCode={selectedFund.code}
          fundName={selectedFund.name}
          onConfirm={handleConfirmAdd}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* 加载遮罩 */}
      {addingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg font-semibold text-gray-900">
                正在添加资产...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
