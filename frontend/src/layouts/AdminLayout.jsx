import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

import {
  LayoutDashboard,
  Users,
  BarChart3,
  LogOut,
  Shield,
  Phone,
  Calendar,
  MapPin,
  HelpCircle,
  Menu,
  X,
  UserPlus,
} from "lucide-react";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Students", path: "/admin/students", icon: Users },
    { name: "Pending Approvals", path: "/admin/pending", icon: Shield },
    { name: "Statistics", path: "/admin/statistics", icon: BarChart3 },
    { name: "Campus Locations", path: "/admin/locations", icon: MapPin },
    { name: "Emergency Contacts", path: "/admin/emergency", icon: Phone },
    { name: "Events", path: "/admin/events", icon: Calendar },
    { name: "FAQs", path: "/admin/faqs", icon: HelpCircle },
    { name: "Campus FAQs", path: "/admin/campus-faqs", icon: HelpCircle },
    ...(user?.email?.trim().toLowerCase() === "admin@buk.edu.ng"
      ? [{ name: "Register Admin", path: "/admin/register", icon: UserPlus }]
      : []),
  ];

  const renderMenuItems = () =>
    menuItems.map((item) => {
      const Icon = item.icon;
      const active = location.pathname === item.path;
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileNavOpen(false)}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
            active
              ? "bg-blue-600 text-white shadow-sm"
              : "text-sky-100 hover:bg-sky-800 hover:text-white"
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{item.name}</span>
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen min-w-0 bg-sky-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sky-950 text-white md:flex">
        <div className="p-5 border-b border-sky-800">
          <h1 className="text-lg font-bold leading-tight text-blue-300">BUK Campus Assistant</h1>
          <p className="mt-1 text-xs text-sky-200">Admin control panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {renderMenuItems()}
        </nav>

        <div className="p-4 border-t border-sky-800">
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium">{user?.full_name}</p>
            <p className="text-xs text-sky-200">Administrator</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-300 transition hover:bg-red-900/30"
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
            aria-label="Close admin navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-sky-950 text-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-sky-800 p-5">
              <div>
                <h1 className="text-lg font-bold leading-tight text-blue-300">BUK Campus Assistant</h1>
                <p className="mt-1 text-xs text-sky-200">Admin control panel</p>
              </div>
              <button
                type="button"
                aria-label="Close admin navigation"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-2 text-sky-100 hover:bg-sky-800"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {renderMenuItems()}
            </nav>
            <div className="border-t border-sky-800 p-4">
              <p className="truncate px-3 text-sm font-medium">{user?.full_name}</p>
              <p className="mb-3 px-3 text-xs text-sky-200">Administrator</p>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-300 transition hover:bg-red-900/30"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-blue-100 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-4">
          <button
            type="button"
            aria-label="Open admin navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl border border-blue-100 p-2 text-slate-700 hover:bg-blue-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-gray-800 dark:text-white">
              Admin Dashboard
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-gray-400 md:hidden">
              {user?.full_name}
            </p>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout;
