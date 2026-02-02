type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="relative">
      <div className="flex items-start justify-between">
        <div className="relative">
          <div className="absolute -left-3 top-0 w-1.5 h-12 bg-gradient-to-b from-violet-600 via-purple-600 to-fuchsia-600 rounded-full"></div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-2">
            {title}
          </h1>
          {description && (
            <p className="text-gray-600 text-sm font-medium">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

