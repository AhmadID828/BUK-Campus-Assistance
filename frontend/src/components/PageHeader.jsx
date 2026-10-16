import { RefreshCw } from "lucide-react";

const PageHeader = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  showRefresh = false,
  onRefresh,
  children, // optional extra buttons/content on the right
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      {/* Left: Title + Subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {showRefresh && onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        )}

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition"
          >
            {actionLabel}
          </button>
        )}

        {/* Extra custom content */}
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
