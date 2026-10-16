import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <BookOpen className="mx-auto mb-3 text-blue-600" size={36} />
          <h1 className="text-xl font-bold text-slate-800">Forgot password?</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your account email to receive a reset link.</p>
        </div>
        {message && <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your.email@buk.edu.ng"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-medium text-white hover:bg-blue-700 disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Send reset link"}
          </button>
        </form>
        <Link to="/login" className="mt-5 block text-center text-sm text-blue-600 hover:underline">Back to login</Link>
      </div>
    </div>
  );
}
