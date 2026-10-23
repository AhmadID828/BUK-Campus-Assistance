import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff, HelpCircle, Loader2, MapPin } from "lucide-react";
import { API_BASE_URL, CHIEF_ADMIN_EMAIL } from "../config";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      if (
        email.trim().toLowerCase() === CHIEF_ADMIN_EMAIL &&
        data.user?.role !== "admin"
      ) {
        throw new Error(
          "This account is not configured as an administrator. Please contact the system administrator to restore its admin access."
        );
      }

      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      login(data.user, data.access_token);
      navigate(data.user?.role === "admin" ? "/admin" : "/dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof TypeError
          ? "Cannot reach the server. Check your internet connection, frontend API URL, and backend CORS settings."
          : loginError.message || "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
          <Link to="/" className="inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="BUK Campus Assistant System home">
            <img
              src="/BUk%20logo%202.webp"
              alt="Bayero University Kano logo"
              className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-white/70 p-1 object-contain opacity-90 shadow-md transition-opacity hover:opacity-100"
            />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              BUK Campus Assistant System
            </h1>
          </Link>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            AI study and campus companion
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-blue-100 dark:border-gray-700 p-8">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your.email@buk.edu.ng"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 flex min-h-11 w-12 touch-manipulation items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-gray-600"
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
            </div>

            <div className="-mt-2 text-right">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Do not have an account?{" "}
            <Link to="/signup" className="text-blue-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-xl p-3 border border-blue-100 dark:border-gray-700">
            <BookOpen className="mx-auto text-blue-600 mb-1" size={20} />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              AI Study Help
            </p>
          </div>
          <Link to="/locations" className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-xl p-3 border border-blue-100 dark:border-gray-700 hover:border-blue-300 hover:bg-white transition">
            <MapPin className="mx-auto text-blue-600 mb-1" size={20} />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Explore Campus Map
            </p>
          </Link>
        </div>
        <Link
          to="/faqs"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300"
        >
          <HelpCircle size={16} />
          Browse campus FAQs
        </Link>
      </div>
    </div>
  );
};

export default Login;
