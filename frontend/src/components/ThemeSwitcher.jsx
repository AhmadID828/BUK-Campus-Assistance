import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <div>
      <button
        type="button"
        aria-label={`Switch to ${nextTheme} appearance`}
        title={`Switch to ${nextTheme} appearance`}
        onClick={() => setTheme(nextTheme)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:border-blue-200/80 hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-300 dark:hover:border-blue-800/80 dark:hover:bg-slate-800/70 dark:focus-visible:ring-offset-slate-900 sm:h-10 sm:w-10"
      >
        {isDark ? (
          <Sun
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          className="text-blue-600 dark:text-blue-400 sm:h-[18px] sm:w-[18px]"
          />
        ) : (
          <Moon
            aria-hidden="true"
            size={16}
            strokeWidth={2}
            className="text-blue-600 dark:text-blue-400 sm:h-[18px] sm:w-[18px]"
          />
        )}
      </button>
    </div>
  );
}
