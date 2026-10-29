import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import { API_BASE_URL, CHIEF_ADMIN_EMAIL } from "../../config";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../../utils/password";

export default function ManageAdmins() {
  const { token, user } = useAuth();
  const isSystemAdmin = user?.email?.trim().toLowerCase() === CHIEF_ADMIN_EMAIL;
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [updatingAdminId, setUpdatingAdminId] = useState(null);
  const [adminAccessToUpdate, setAdminAccessToUpdate] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAdmins = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/admins`, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load administrators");
      setAdmins(data.admins || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load administrators.");
    } finally {
      setLoadingAdmins(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isSystemAdmin || !token) return undefined;

    let cancelled = false;
    const fetchAdmins = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/admins`, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load administrators");
        if (!cancelled) setAdmins(data.admins || []);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "Could not load administrators.");
        }
      } finally {
        if (!cancelled) setLoadingAdmins(false);
      }
    };
    fetchAdmins();

    return () => {
      cancelled = true;
    };
  }, [isSystemAdmin, token]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!isSystemAdmin) {
      setError(`Only ${CHIEF_ADMIN_EMAIL} can create administrator accounts.`);
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError("Choose a password that meets all the requirements.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not create administrator");
      setMessage(data.message || "Administrator account created.");
      setForm({ full_name: "", email: "", password: "" });
      await loadAdmins();
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const updateAdminAccess = async (account) => {
    const isActive = account.is_active;
    setError("");
    setMessage("");
    setUpdatingAdminId(account.id);
    try {
      const response = await fetch(
        isActive
          ? `${API_BASE_URL}/admin/admins/${account.id}`
          : `${API_BASE_URL}/admin/admins/${account.id}/reactivate`,
        {
          method: isActive ? "DELETE" : "POST",
          headers: { Authorization: "Bearer " + token },
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not update administrator");
      setMessage(data.message || "Administrator access updated.");
      setAdminAccessToUpdate(null);
      await loadAdmins();
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server.");
    } finally {
      setUpdatingAdminId(null);
    }
  };

  return (
    <>
    <ConfirmDialog
      open={Boolean(adminAccessToUpdate)}
      title={adminAccessToUpdate?.is_active ? "Remove administrator access?" : "Restore administrator access?"}
      message={
        adminAccessToUpdate?.is_active
          ? `Remove administrator access for ${adminAccessToUpdate.email}? Their account and records will be retained.`
          : adminAccessToUpdate
            ? `Restore administrator access for ${adminAccessToUpdate.email}?`
            : ""
      }
      confirmLabel={
        updatingAdminId
          ? "Updating access..."
          : adminAccessToUpdate?.is_active
            ? "Remove access"
            : "Restore access"
      }
      busy={Boolean(updatingAdminId)}
      onCancel={() => setAdminAccessToUpdate(null)}
      onConfirm={() => {
        if (adminAccessToUpdate) void updateAdminAccess(adminAccessToUpdate);
      }}
    />
    <section className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <ShieldCheck size={14} />
          Restricted system administration
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
          Register and manage administrators
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
          Create administrator accounts for trusted staff. Only the system
          administrator account can use this page. New administrators must set
          their own password at first sign-in.
        </p>
      </div>

      {!isSystemAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Administrator creation is restricted to <strong>{CHIEF_ADMIN_EMAIL}</strong>.
        </div>
      ) : (
        <>
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-7"
        >
          {message && (
            <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">
            Administrator name
            <input
              required
              autoComplete="name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">
            Administrator email
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">
            Temporary password
            <span className="relative mt-1.5 block">
              <KeyRound
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                required
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className="min-h-12 w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </span>
          </label>

          <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-live="polite">
            {getPasswordRequirements(form.password).map((requirement) => (
              <li
                key={requirement.label}
                className={requirement.valid ? "text-emerald-700" : "text-slate-500"}
              >
                {requirement.valid ? "✓" : "•"} {requirement.label}
              </li>
            ))}
          </ul>
          {exceedsPasswordByteLimit(form.password) && (
            <p className="text-xs text-red-600" role="alert">
              Password is too long. Choose a shorter password.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isStrongPassword(form.password)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <UserPlus size={18} />
            {loading ? "Creating account..." : "Create administrator"}
          </button>
        </form>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-7">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Administrator accounts
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
              Remove access when an administrator no longer needs it. Their records are kept.
            </p>
          </div>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </p>
          )}
          {loadingAdmins ? (
            <p className="text-sm text-slate-500">Loading administrator accounts...</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-slate-500">No administrator accounts found.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-gray-700">
              {admins.map((account) => {
                const isChief = account.email?.trim().toLowerCase() === CHIEF_ADMIN_EMAIL;
                return (
                  <li
                    key={account.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {account.full_name}
                        {isChief && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            Chief admin
                          </span>
                        )}
                      </p>
                      <p className="break-all text-sm text-slate-500">{account.email}</p>
                      <p className={`mt-1 text-xs ${account.is_active ? "text-emerald-700" : "text-slate-500"}`}>
                        {account.is_active ? "Active" : "Access removed"}
                      </p>
                    </div>
                    {!isChief && (
                      <button
                        type="button"
                          onClick={() => setAdminAccessToUpdate(account)}
                        disabled={updatingAdminId === account.id}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                          account.is_active
                            ? "border border-red-200 text-red-700 hover:bg-red-50"
                            : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {account.is_active ? <UserRoundX size={16} /> : <RotateCcw size={16} />}
                        {updatingAdminId === account.id
                          ? "Updating..."
                          : account.is_active
                            ? "Remove access"
                            : "Reactivate"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        </>
      )}
    </section>
    </>
  );
}
