import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import { toast } from "react-hot-toast";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  Users,
  UserCheck,
  Brain,
  BarChart3,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/statistics?scope=dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.detail || `Failed to load statistics (${response.status})`
          );
        }

        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [token]);

  const handleSendReminders = async () => {
    setSendingReminders(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/send-reminders-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to send reminders");
      }

      toast.success(`${data.message} (${data.sent} sent)`);
    } catch (sendError) {
      setError(sendError.message);
      toast.error(sendError.message);
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl">
        {error}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Students",
      value: stats?.users?.total_students || 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Total Admins",
      value: stats?.users?.total_admins || 0,
      icon: UserCheck,
      color: "bg-green-500",
    },
    {
      title: "Total Quizzes",
      value: stats?.content?.total_quizzes || 0,
      icon: Brain,
      color: "bg-amber-500",
    },
    {
      title: "Quiz Attempts",
      value: stats?.content?.total_quiz_attempts || 0,
      icon: BarChart3,
      color: "bg-indigo-500",
    },
    {
      title: "Average Score",
      value: `${stats?.performance?.average_quiz_score || 0}%`,
      icon: Clock,
      color: "bg-rose-500",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Overview of the BUK Campus Assistant System
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.color} p-3 rounded-xl text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Common admin tasks, ready when you need them.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            to="/admin/pending"
            className="group rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/40 dark:from-amber-900/20 dark:to-gray-800"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <span className="flex items-center justify-between gap-2 font-semibold text-gray-900 dark:text-white">
              Review approvals <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
            <span className="mt-1 block text-sm text-gray-500 dark:text-gray-300">Check and approve pending student accounts.</span>
          </Link>
          <Link
            to="/admin/students"
            className="group rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-blue-900/40 dark:from-blue-900/20 dark:to-gray-800"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              <Users className="h-5 w-5" />
            </span>
            <span className="flex items-center justify-between gap-2 font-semibold text-gray-900 dark:text-white">
              Manage students <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
            <span className="mt-1 block text-sm text-gray-500 dark:text-gray-300">Review academic details and account status.</span>
          </Link>
          <button
            type="button"
            onClick={handleSendReminders}
            disabled={sendingReminders}
            className="group rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60 dark:border-emerald-900/40 dark:from-emerald-900/20 dark:to-gray-800"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="flex items-center justify-between gap-2 font-semibold text-gray-900 dark:text-white">
              {sendingReminders ? "Sending reminders..." : "Send study reminders"}
              {!sendingReminders && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
            </span>
            <span className="mt-1 block text-sm text-gray-500 dark:text-gray-300">Email today&apos;s study schedule to approved students.</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
