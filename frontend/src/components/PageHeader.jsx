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
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      {/* Left: Title + Subtitle */}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {showRefresh && onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        )}

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-blue-600"
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
