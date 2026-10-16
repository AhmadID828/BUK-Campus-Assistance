 /* eslint-disable no-unused-vars */
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
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
} from "lucide-react";

const StudentLayout = () => {
  const { user, logout, isApproved } = useAuth();
  const location = useLocation();

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
    <div className="min-h-screen bg-sky-50 dark:bg-gray-900 flex">
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <PendingApprovalBanner user={user} />

        <header className="bg-white dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Welcome, {user?.full_name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user?.department} • Level {user?.level}
            </p>
          </div>
        </header>

        
        <main className="flex-1 p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 overflow-y-auto">
          <Outlet />
        </main>
        <Footer />
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-blue-100 dark:border-gray-700">
        <div className="flex h-16 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isLocked = item.requireApproved && !isApproved;

            return (
              <Link
                key={item.path}
                to={isLocked ? "#" : item.path}
                onClick={(event) => {
                  if (isLocked) event.preventDefault();
                }}
                className={`min-w-[76px] flex flex-col items-center justify-center gap-1 text-[11px] ${
                  isActive(item.path)
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-500 dark:text-gray-400"
                } ${isLocked ? "opacity-50" : ""}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default StudentLayout;