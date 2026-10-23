import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PendingApprovalBanner from "../components/PendingApprovalBanner";
import Footer from "../components/Footer";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Map,
  Calendar,
  CalendarDays,
  Phone,
  LogOut,
  User,
  ClipboardCheck,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";

const StudentLayout = () => {
  const { user, logout, isApproved } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    {
      name: "Study Materials",
      path: "/materials",
      icon: BookOpen,
      requireApproved: true,
    },
    {
      name: "AI Chat",
      path: "/chat",
      icon: Brain,
      requireApproved: true,
    },
    {
      name: "Study Planner",
      path: "/planner",
      icon: Calendar,
      requireApproved: true,
    },
    {
      name: "Quiz Center",
      path: "/quiz",
      icon: ClipboardCheck,
      requireApproved: true,
    },
    { name: "FAQs", path: "/faqs", icon: HelpCircle },
    { name: "Campus Map", path: "/campus-map", icon: Map },
    { name: "Profile", path: "/profile", icon: User },
    { name: "Emergency Contacts", path: "/emergency", icon: Phone },
    { name: "Events", path: "/events", icon: CalendarDays },
  ];

  const isActive = (path) => location.pathname === path;
  const currentPage = menuItems.find((item) => isActive(item.path));
  const firstName = user?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-sky-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="flex min-h-0 w-64 flex-col border-r border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-800 hidden md:flex">
        <div className="p-5 border-b border-blue-100 dark:border-gray-700">
          <Link to="/" className="flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="BUK Campus Assistant System home">
            <img src="/BUk%20logo%202.webp" alt="BUK logo" className="h-11 w-11 rounded-xl bg-white/70 object-contain p-0.5 opacity-90 shadow-sm ring-1 ring-blue-100/80 transition-opacity hover:opacity-100" />
            <div>
              <h1 className="text-lg font-bold text-blue-700">BUK Campus</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Student Portal</p>
            </div>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isLocked = item.requireApproved && !isApproved;

            return (
              <Link
                key={item.path}
                to={isLocked ? "#" : item.path}
                aria-current={isActive(item.path) ? "page" : undefined}
                onClick={(e) => {
                  if (isLocked) e.preventDefault();
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                  ${
                    isLocked
                      ? "text-gray-400 cursor-not-allowed"
                      : isActive(item.path)
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700"
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
                {isLocked && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Locked
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-100 dark:border-gray-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-white text-slate-800 shadow-2xl dark:bg-gray-800 dark:text-white">
            <div className="flex items-start justify-between border-b border-blue-100 p-5 dark:border-gray-700">
              <Link to="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="BUK Campus Assistant System home">
                  <img src="/BUk%20logo%202.webp" alt="BUK logo" className="h-10 w-10 rounded-lg bg-white/70 object-contain p-0.5 opacity-90 ring-1 ring-blue-100/80 transition-opacity hover:opacity-100" />
                  <div>
                    <h1 className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      BUK Campus Assistant
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                      Student Portal
                    </p>
                  </div>
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-2 hover:bg-blue-50 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isLocked = item.requireApproved && !isApproved;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={isLocked ? "#" : item.path}
                    onClick={(event) => {
                      if (isLocked) {
                        event.preventDefault();
                      } else {
                        setMobileNavOpen(false);
                      }
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                      isLocked
                        ? "cursor-not-allowed text-slate-400"
                        : active
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-slate-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.name}</span>
                    {isLocked && (
                      <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                        Locked
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-blue-100 p-4 dark:border-gray-700">
              <p className="truncate px-3 text-sm font-medium">{user?.full_name}</p>
              <p className="mb-3 px-3 text-xs text-slate-500 dark:text-gray-400">
                Student
              </p>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-0 isolate flex min-h-0 min-w-0 flex-1 flex-col">
        <PendingApprovalBanner user={user} />

        <header className="flex items-center gap-3 border-b border-blue-100 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            type="button"
            aria-label="Open student navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl border border-blue-100 p-2 text-slate-700 hover:bg-blue-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 md:hidden"
          >
            <Menu size={20} />
          </button>
          <Link to="/" aria-label="BUK Campus Assistant System home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <img src="/BUk%20logo%202.webp" alt="BUK logo" className="h-9 w-9 rounded-lg bg-white/70 object-contain p-0.5 opacity-90 ring-1 ring-blue-100/80 transition-opacity hover:opacity-100" />
          </Link>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900 dark:text-white">
              {location.pathname === "/dashboard"
                ? `Welcome back${firstName ? `, ${firstName}` : ""}`
                : currentPage?.name || "Student Portal"}
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-gray-400">
              {[user?.department, user?.level && `Level ${user.level}`]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        </header>

        
        <main
          className={`min-h-0 flex-1 ${
            location.pathname === "/chat"
              ? "overflow-hidden p-0"
              : "overflow-y-auto p-4 pb-8 sm:p-6 lg:p-8"
          }`}
        >
          <Outlet />
        </main>
        {location.pathname !== "/chat" && <Footer />}
      </div>

    </div>
  );
};

export default StudentLayout;