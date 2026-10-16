/* eslint-disable react-hooks/static-components */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import PageHeader from "../../components/PageHeader";

function StatisticsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    approvedStudents: 0,
    pendingApprovals: 0,
    totalEvents: 0,
    totalMaterials: 0,
    averageQuizScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/statistics`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setStats((currentStats) => ({ ...currentStats, ...data }));
        } else {
          throw new Error(`Failed to load statistics (${response.status})`);
        }
      } catch (err) {
        setError(err.message || "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStatistics();
    }
  }, [token]);

  const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
            {title}
          </p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        </div>
        <div className={`text-3xl ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Statistics Dashboard" />

      <div className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon="👥"
            color="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Approved Students"
            value={stats.approvedStudents}
            icon="✅"
            color="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon="⏳"
            color="text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            icon="📅"
            color="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            title="Study Materials"
            value={stats.totalMaterials}
            icon="📚"
            color="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            title="Avg Quiz Score"
            value={`${stats.averageQuizScore}%`}
            icon="📊"
            color="text-pink-600 dark:text-pink-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Student Approval Status
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Approved</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {stats.totalStudents
                      ? Math.round((stats.approvedStudents / stats.totalStudents) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${stats.totalStudents
                        ? (stats.approvedStudents / stats.totalStudents) * 100
                        : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Pending</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {stats.totalStudents
                      ? Math.round((stats.pendingApprovals / stats.totalStudents) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full"
                    style={{
                      width: `${stats.totalStudents
                        ? (stats.pendingApprovals / stats.totalStudents) * 100
                        : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button onClick={() => navigate("/admin/students")} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                View All Students
              </button>
              <button onClick={() => navigate("/admin/events")} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Manage Events
              </button>
              <button onClick={() => navigate("/admin/pending")} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                Review Approvals
              </button>
              <button onClick={() => window.print()} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatisticsPage;
