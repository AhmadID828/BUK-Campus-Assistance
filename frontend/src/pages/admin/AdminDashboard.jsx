import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import { toast } from "react-hot-toast";
import {
  Users,
  UserCheck,
  Brain,
  BarChart3,
  Clock,
} from "lucide-react";

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
          Overview of the BUK Campus Assistance system
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
      <div className="mt-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <a
              href="/admin/pending"
              className="block w-full text-left px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition text-sm"
            >
              Review Pending Approvals
            </a>
            <a
              href="/admin/students"
              className="block w-full text-left px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm"
            >
              Manage Students
            </a>
            <button
              type="button"
              onClick={handleSendReminders}
              disabled={sendingReminders}
              className="block w-full text-left px-4 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition text-sm"
            >
              {sendingReminders ? "Sending Reminders..." : "Send Daily Reminders"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
