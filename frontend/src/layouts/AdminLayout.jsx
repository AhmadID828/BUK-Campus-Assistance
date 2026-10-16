import { Outlet, Link } from "react-router-dom";
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
} from "lucide-react";

const AdminLayout = () => {
  const { user, logout } = useAuth();

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Students", path: "/admin/students", icon: Users },
    { name: "Pending Approvals", path: "/admin/pending", icon: Shield },
    { name: "Statistics", path: "/admin/statistics", icon: BarChart3 },
    { name: "Campus Locations", path: "/admin/locations", icon: MapPin },
    { name: "Emergency Contacts", path: "/admin/emergency", icon: Phone },
    { name: "Events", path: "/admin/events", icon: Calendar },
    { name: "FAQs", path: "/admin/faqs", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sky-950 text-white flex flex-col">
        <div className="p-5 border-b border-sky-800">
          <h1 className="text-xl font-bold text-blue-300">BUK Admin</h1>
          <p className="text-xs text-sky-200 mt-1">Control Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sky-100 hover:bg-sky-800 hover:text-white transition"
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sky-800">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium">{user?.full_name}</p>
            <p className="text-xs text-sky-200">Administrator</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-gray-800 dark:text-white">
            Admin Dashboard
          </h2>
        </header>

        <main className="flex-1 p-6 pb-8 overflow-y-auto">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout;
