import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { getPasswordRequirements, isStrongPassword } from "../utils/password";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Choose a password that meets all the strength requirements.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.get("token"), password }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.detail || "Reset link is invalid or expired");
    else setMessage(data.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-5 text-xl font-bold text-slate-800">Set a new password</h1>
        {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message} <Link to="/login" className="font-medium underline">Sign in</Link></div>}
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!message && <form onSubmit={submit} className="space-y-4">
          <input type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-live="polite">
            {getPasswordRequirements(password).map((requirement) => (
              <li key={requirement.label} className={requirement.valid ? "text-green-700" : "text-gray-500"}>
                {requirement.valid ? "✓" : "•"} {requirement.label}
              </li>
            ))}
          </ul>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          <button disabled={!isStrongPassword(password) || password !== confirm} className="w-full rounded-xl bg-blue-600 py-3.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Reset password</button>
        </form>}
      </div>
    </div>
  );
}
