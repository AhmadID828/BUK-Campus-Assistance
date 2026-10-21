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

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-sky-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-blue-100 dark:border-gray-700 hidden md:flex flex-col">
        <div className="p-5 border-b border-blue-100 dark:border-gray-700">
          <h1 className="text-xl font-bold text-blue-700">BUK Campus</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Student Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isLocked = item.requireApproved && !isApproved;

            return (
              <Link
                key={item.path}
                to={isLocked ? "#" : item.path}
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
              <div>
                <h1 className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  BUK Campus Assistant
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                  Student Portal
                </p>
              </div>
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PendingApprovalBanner user={user} />

        <header className="bg-white dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 px-4 py-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl border border-blue-100 p-2 text-slate-700 hover:bg-blue-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 md:hidden"
          >
            <Menu size={20} />
          </button>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Welcome, {user?.full_name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user?.department} • Level {user?.level}
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