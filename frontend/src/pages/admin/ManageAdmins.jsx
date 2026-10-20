import { useState } from "react";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../context/AuthContext";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../../utils/password";

export default function ManageAdmins() {
  const { token, user } = useAuth();
  const isSystemAdmin = user?.email?.trim().toLowerCase() === "admin@buk.edu.ng";
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!isSystemAdmin) {
      setError("Only admin@buk.edu.ng can create administrator accounts.");
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
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <ShieldCheck size={14} />
          Restricted system administration
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
          Add an administrator
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
          Create administrator accounts for trusted staff. Only the system
          administrator account can use this page.
        </p>
      </div>

      {!isSystemAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Administrator creation is restricted to <strong>admin@buk.edu.ng</strong>.
        </div>
      ) : (
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
      )}
    </section>
  );
}
