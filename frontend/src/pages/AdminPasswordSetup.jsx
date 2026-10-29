import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "../config";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../utils/password";

export default function AdminPasswordSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setupToken = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!setupToken) {
      setError("The password setup link is missing or invalid. Sign in again to get a new link.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Choose a password that meets all the strength requirements.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/complete-admin-password-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_token: setupToken, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not set your password. Sign in again to retry.");
      }

      navigate("/login", {
        replace: true,
        state: { passwordSetupComplete: true },
      });
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Unable to reach the server. Check your connection and try again."
          : requestError.message || "Could not set your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <section className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Secure your administrator account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your chief administrator gave you a temporary password. Set a personal
          password before accessing administrator features.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {setupToken ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              New password
              <span className="relative mt-1.5 block">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-live="polite">
              {getPasswordRequirements(password).map((requirement) => (
                <li
                  key={requirement.label}
                  className={requirement.valid ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}
                >
                  {requirement.valid ? "✓" : "•"} {requirement.label}
                </li>
              ))}
            </ul>
            {exceedsPasswordByteLimit(password) && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-300">
                Password is too long. Choose a shorter password.
              </p>
            )}

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirm new password
              <span className="relative mt-1.5 block">
                <input
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"}
                  className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !isStrongPassword(password) || password !== confirmation}
              className="min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving password..." : "Set my password"}
            </button>
          </form>
        ) : (
          <Link
            to="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
          >
            Sign in to get a new setup link
          </Link>
        )}
      </section>
    </main>
  );
}
