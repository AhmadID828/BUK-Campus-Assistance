import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "../config";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to send reset email");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message || "Unable to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <Link
              to="/"
              className="mx-auto mb-5 flex w-fit flex-col items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="BUK Campus Assistant System home"
            >
              <img
                src="/BUk%20logo%202.webp"
                alt="Bayero University Kano logo"
                className="h-14 w-14 rounded-xl bg-white/70 p-1 object-contain opacity-90 shadow-md transition-opacity hover:opacity-100"
              />
              <span className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                BUK Campus Assistant System
              </span>
            </Link>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Forgot password?</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your account email to receive a reset link.</p>
          </div>
          {message && (
            <div role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your.email@buk.edu.ng"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-900"
            />
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-medium text-white hover:bg-blue-700 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Send reset link"}
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
            If no email arrives, check your spam folder. Reset emails depend on
            the server's email settings; contact your administrator if the
            problem continues.
          </p>
          <Link to="/login" className="mt-5 block text-center text-sm text-blue-600 hover:underline dark:text-blue-300">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
