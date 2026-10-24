/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  Mail,
  Hash,
  Building,
  GraduationCap,
  Clock,
} from "lucide-react";

const PendingApprovals = () => {
  const { token } = useAuth();
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [studentToReject, setStudentToReject] = useState(null);
  const fetchRequestId = useRef(0);

  const fetchPending = async ({ silent = false } = {}) => {
    const requestId = ++fetchRequestId.current;
    if (!silent) {
      setLoading(true);
      setError("");
      setSuccessMessage("");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/students/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load pending students");
      }

      const data = await response.json();
      if (requestId === fetchRequestId.current) {
        setPendingStudents(data.students || []);
      }
    } catch (err) {
      if (requestId === fetchRequestId.current && !silent) {
        setError(err.message || "Something went wrong");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const refreshTimer = window.setInterval(
      () => fetchPending({ silent: true }),
      15000,
    );
    return () => window.clearInterval(refreshTimer);
  }, [token]);

  const handleAction = async (studentId, action) => {
    setActionLoading(studentId);
    setError("");
    setSuccessMessage("");

    const url =
      action === "approve"
        ? `/admin/students/${studentId}/approve`
        : `/admin/students/${studentId}/reject`;

    const method = action === "approve" ? "PUT" : "DELETE";

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Action failed");
      }

      const result = await response.json().catch(() => ({}));
      fetchRequestId.current += 1;
      setSuccessMessage(result.message || "Action completed successfully");
      setPendingStudents((students) =>
        students.filter((student) => student.id !== studentId),
      );
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white sm:text-2xl">
            Pending Approvals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review new registrations and approve students for full system access.
          </p>
        </div>

        <button
          onClick={fetchPending}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700 sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {pendingStudents.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800 sm:p-12">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            No Pending Approvals
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            All student registrations have been reviewed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3 sm:gap-5">
          {pendingStudents.map((student) => (
            <div
              key={student.id}
              className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-5"
            >
              {/* Student Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 dark:text-white truncate">
                    {student.full_name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    Awaiting Approval
                  </p>
                </div>
              </div>

              {/* Student Details */}
              <div className="space-y-2.5 text-sm mb-5">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="break-all">{student.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span>{student.registration_number || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span>{student.department || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                  <span>Level {student.level || "—"}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 dark:border-gray-700">
                <button
                  onClick={() => handleAction(student.id, "approve")}
                  disabled={actionLoading === student.id}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => setStudentToReject(student)}
                  disabled={actionLoading === student.id}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(studentToReject)}
        title="Reject student registration?"
        message={`Rejecting ${studentToReject?.full_name || "this student"} will remove the pending registration. This action cannot be undone.`}
        confirmLabel="Reject registration"
        busy={Boolean(actionLoading)}
        onCancel={() => setStudentToReject(null)}
        onConfirm={async () => {
          if (!studentToReject) return;
          const rejected = await handleAction(studentToReject.id, "reject");
          if (rejected) setStudentToReject(null);
        }}
      />
    </div>
  );
};

export default PendingApprovals;
