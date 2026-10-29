import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";
import ConfirmDialog from "../components/ConfirmDialog";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { CHIEF_ADMIN_EMAIL } from "../config";

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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuButtonRef = useRef(null);
  const mobileMenuRef = useRef(null);

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
    ...(user?.email?.trim().toLowerCase() === CHIEF_ADMIN_EMAIL
      ? [{ name: "Register Admin", path: "/admin/register", icon: UserPlus }]
      : []),
  ];
  const currentPage = menuItems.find((item) => location.pathname === item.path);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector("button, a")?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }

      if (event.key !== "Tab" || !mobileMenuRef.current) return;
      const focusableItems = mobileMenuRef.current.querySelectorAll(
        'a[href], button:not([disabled])',
      );
      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem?.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileNavOpen]);

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
    <>
    <div className="flex min-h-screen min-w-0 bg-sky-50 dark:bg-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:m-3 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-blue-700 focus:shadow-lg"
      >
        Skip to main content
      </a>
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sky-950 text-white md:flex">
        <div className="p-5 border-b border-sky-800">
          <Link to="/" className="flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="BUK Campus Assistant System home">
            <img src="/BUk%20logo%202.webp" alt="BUK logo" className="h-10 w-10 rounded-lg bg-white/70 object-contain p-0.5 opacity-90 ring-1 ring-sky-700/80 transition-opacity hover:opacity-100" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-blue-300">BUK Campus Assistant</h1>
              <p className="mt-1 text-xs text-sky-200">Admin control panel</p>
            </div>
          </Link>
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
            onClick={() => setConfirmLogout(true)}
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
          <aside
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Administrator navigation"
            className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-sky-950 text-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-sky-800 p-5">
              <Link to="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="BUK Campus Assistant System home">
                <img src="/BUk%20logo%202.webp" alt="BUK logo" className="h-10 w-10 rounded-lg bg-white/70 object-contain p-0.5 opacity-90 ring-1 ring-sky-700/80 transition-opacity hover:opacity-100" />
                <div>
                  <h1 className="text-lg font-bold leading-tight text-blue-300">BUK Campus Assistant</h1>
                  <p className="mt-1 text-xs text-sky-200">Admin control panel</p>
                </div>
              </Link>
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
                onClick={() => setConfirmLogout(true)}
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
        <header className="flex items-center gap-3 border-b border-blue-100 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            type="button"
            ref={menuButtonRef}
            aria-label="Open admin navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl border border-blue-100 p-2 text-slate-700 hover:bg-blue-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-900 dark:text-white">
              {currentPage?.name || "Admin Dashboard"}
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-gray-400 md:hidden">
              Signed in as {user?.full_name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeSwitcher />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6"
        >
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
    <ConfirmDialog
      open={confirmLogout}
      title="Are you sure you want to log out?"
      message="You'll need to sign in again to continue using the admin panel."
      confirmLabel="Log out"
      onCancel={() => setConfirmLogout(false)}
      onConfirm={logout}
    />
    </>
  );
};

export default AdminLayout;
