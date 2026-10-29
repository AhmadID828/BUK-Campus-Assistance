import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const isDark = resolvedTheme === "dark";
  const ThemeIcon = isDark ? Sun : Moon;

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      {isOpen && (
        <div
          id="theme-menu"
          role="group"
          aria-label="Choose appearance"
          className="absolute bottom-full right-0 mb-2 w-40 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90"
        >
          {[
            { value: "light", label: "Light", Icon: Sun },
            { value: "dark", label: "Dark", Icon: Moon },
            { value: "system", label: "System", Icon: Monitor },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                theme === value
                  ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {theme === value && <span className="sr-only">selected</span>}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={`Choose appearance. Current setting: ${theme}.`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "theme-menu" : undefined}
        title={`Appearance: ${theme}`}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:border-blue-200/80 hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-300 dark:hover:border-blue-800/80 dark:hover:bg-slate-800/70 dark:focus-visible:ring-offset-slate-900 sm:h-10 sm:w-10"
      >
        <ThemeIcon
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          className="text-blue-600 dark:text-blue-400 sm:h-[18px] sm:w-[18px]"
        />
      </button>
    </div>
  );
}
