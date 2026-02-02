type StatCardProps = {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: string;
  subtitle?: string;
};

export default function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  subtitle,
}: StatCardProps) {
  const changeColors = {
    positive: "text-emerald-700 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200",
    negative: "text-rose-700 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200",
    neutral: "text-slate-700 bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200",
  };

  const cardGradients = {
    positive: "from-emerald-50/50 via-white to-white",
    negative: "from-rose-50/50 via-white to-white",
    neutral: "from-white via-white to-slate-50/30",
  };

  return (
    <div className={`relative group bg-gradient-to-br ${cardGradients[changeType || "neutral"]} rounded-2xl border border-gray-200 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden`}>
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">{title}</p>
          <h3 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            {value}
          </h3>
          {subtitle && <p className="text-xs text-gray-500 font-medium">{subtitle}</p>}
        </div>
        {icon && (
          <div className="text-4xl group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg">
            {icon}
          </div>
        )}
      </div>
      {change && (
        <div className="relative mt-4 pt-4 border-t border-gray-200">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${changeColors[changeType]} shadow-sm`}
          >
            {changeType === "positive" && "↑ "}
            {changeType === "negative" && "↓ "}
            {change}
          </span>
        </div>
      )}
    </div>
  );
}

