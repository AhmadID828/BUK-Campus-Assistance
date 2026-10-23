import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../utils/password";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const token = params.get("token");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!token) {
      setError("This reset link is missing its token. Request a new link.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Choose a password that meets all the strength requirements.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.detail === "string"
            ? data.detail
            : "Reset link is invalid or expired. Request a new link and try again.",
        );
      } else {
        setMessage(data.message || "Password reset successfully.");
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h1 className="mb-5 text-xl font-bold text-slate-800 dark:text-slate-100">Set a new password</h1>
          {message && (
            <div role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-300">
              {message} <Link to="/login" className="font-medium underline">Sign in</Link>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}
          {!message && token && (
            <form onSubmit={submit} className="space-y-4">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-live="polite">
                {getPasswordRequirements(password).map((requirement) => (
                  <li
                    key={requirement.label}
                    className={requirement.valid ? "text-green-700 dark:text-green-300" : "text-gray-500 dark:text-gray-400"}
                  >
                    {requirement.valid ? "✓" : "•"} {requirement.label}
                  </li>
                ))}
              </ul>
              {exceedsPasswordByteLimit(password) && (
                <p className="text-xs text-red-600 dark:text-red-300" role="alert">
                  Password is too long. Choose a shorter password.
                </p>
              )}
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                disabled={loading || !isStrongPassword(password) || password !== confirm}
                className="w-full rounded-xl bg-blue-600 py-3.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}
          {!token && (
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline dark:text-blue-300">
              Request a new reset link
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
