/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Shield,
  ShieldOff,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

const StudentsPage = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all | pending
  const [actionLoading, setActionLoading] = useState(null);
  const [canEditStudentDetails, setCanEditStudentDetails] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState(null);
  const [savingStudent, setSavingStudent] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [studentsRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/students`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/admin/students/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!studentsRes.ok) {
        throw new Error("Failed to load students");
      }

      const studentsData = await studentsRes.json();
      const pendingData = pendingRes.ok ? await pendingRes.json() : { students: [] };

      setStudents(studentsData.students || []);
      setCanEditStudentDetails(studentsData.can_edit_student_details === true);
      setPending(pendingData.students || []);
    } catch (err) {
      setError(err.message || "Something went wrong while loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleAction = async (url, method = "PUT", options = {}) => {
    setActionLoading(url);
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        ...options,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Action failed");
      }

      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteStudent = async (student) => {
    const confirmed = window.confirm(
      `Delete ${student.full_name || "this student"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    await handleAction(`/admin/students/${student.id}`, "DELETE");
  };

  const openStudentEditor = (student) => {
    setEditingStudent(student);
    setStudentForm({
      full_name: student.full_name || "",
      email: student.email || "",
      registration_number: student.registration_number || "",
      faculty: student.faculty || "",
      department: student.department || "",
      level: student.level ? String(student.level) : "",
    });
  };

  const handleSaveStudent = async (event) => {
    event.preventDefault();
    if (!editingStudent || !studentForm) return;
    setSavingStudent(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/students/${editingStudent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          ...studentForm,
          level: studentForm.level ? Number(studentForm.level) : null,
          registration_number: studentForm.registration_number || null,
          faculty: studentForm.faculty || null,
          department: studentForm.department || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to update student details");
      setEditingStudent(null);
      setStudentForm(null);
      await fetchData();
    } catch (saveError) {
      setError(saveError.message || "Failed to update student details");
    } finally {
      setSavingStudent(false);
    }
  };

  const filteredStudents =
    activeTab === "pending"
      ? pending
      : students.filter(
          (s) =>
            s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            s.email?.toLowerCase().includes(search.toLowerCase()) ||
            s.registration_number?.toLowerCase().includes(search.toLowerCase())
        );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            User Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage students and approvals
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "all"
              ? "bg-amber-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          All Students ({students.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "pending"
              ? "bg-amber-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          Pending Approval ({pending.length})
        </button>
      </div>

      {activeTab === "all" && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or reg number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            No students found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Reg Number</th>
                  <th className="text-left px-4 py-3 font-medium">Department</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                      {student.full_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {student.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {student.registration_number || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {student.department || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded-full">
                          <ClockIcon /> Pending
                        </span>
                      ) : student.is_active === false ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded-full">
                          <UserX className="w-3 h-3" /> Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                          <UserCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEditStudentDetails && (
                          <button
                            type="button"
                            onClick={() => openStudentEditor(student)}
                            disabled={Boolean(actionLoading)}
                            className="rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Edit student details"
                            aria-label={`Edit details for ${student.full_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {activeTab === "pending" ? (
                          <>
                            <button
                              onClick={() =>
                                handleAction(`/admin/students/${student.id}/approve`)
                              }
                              disabled={actionLoading}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleAction(`/admin/students/${student.id}/reject`, "DELETE")
                              }
                              disabled={actionLoading}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {student.is_active === false ? (
                              <button
                                onClick={() =>
                                  handleAction(`/admin/students/${student.id}/activate`)
                                }
                                disabled={actionLoading}
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                title="Activate"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleAction(`/admin/students/${student.id}/deactivate`)
                                }
                                disabled={actionLoading}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                                title="Deactivate"
                              >
                                <ShieldOff className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              disabled={actionLoading}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStudent && studentForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingStudent) {
              setEditingStudent(null);
              setStudentForm(null);
            }
          }}
        >
          <form
            onSubmit={handleSaveStudent}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit student details</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  Update account and academic information for {editingStudent.full_name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setStudentForm(null);
                }}
                disabled={savingStudent}
                aria-label="Close student editor"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["full_name", "Full name"],
                ["email", "Email address"],
                ["registration_number", "Registration number"],
                ["faculty", "Faculty"],
                ["department", "Department"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {label}
                  <input
                    required={field === "full_name" || field === "email"}
                    type={field === "email" ? "email" : "text"}
                    value={studentForm[field]}
                    onChange={(event) => setStudentForm({ ...studentForm, [field]: event.target.value })}
                    className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Study level
                <select
                  value={studentForm.level}
                  onChange={(event) => setStudentForm({ ...studentForm, level: event.target.value })}
                  className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Not set</option>
                  {[100, 200, 300, 400, 500, 600].map((level) => (
                    <option key={level} value={level}>{level} Level</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setStudentForm(null);
                }}
                disabled={savingStudent}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStudent}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {savingStudent ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const ClockIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);

export default StudentsPage;
