import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Loader2, MapPin } from "lucide-react";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../utils/password";
import { faculties, facultyDepartments } from "../data/bukFaculties";

const OTHER_DEPARTMENT = "__other_department__";

function Signup() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    reg_number: "",
    faculty: "",
    department: "",
    otherDepartment: "",
    level: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "faculty"
        ? { department: "", otherDepartment: "" }
        : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isStrongPassword(form.password)) {
      setError("Choose a password that meets all the strength requirements.");
      return;
    }

    const department =
      form.department === OTHER_DEPARTMENT
        ? form.otherDepartment.trim()
        : form.department;
    if (!department) {
      setError("Select or enter your department.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`,  {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          registration_number: form.reg_number,
          faculty: form.faculty,
          department,
          level: parseInt(form.level) || 100,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || "Registration failed");
        return;
      }

      setSuccess("Account created successfully! Waiting for admin approval. Redirecting to login...");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot reach the server. Check your internet connection, frontend API URL, and backend CORS settings."
          : "An error occurred. Please try again."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="w-full max-w-lg px-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <Link to="/" className="mx-auto mb-3 flex w-fit flex-col items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="BUK Campus Assistant System home">
            <img
              src="/BUk%20logo%202.webp"
              alt="Bayero University Kano logo"
              className="h-14 w-14 rounded-xl bg-white p-1 object-contain"
            />
            <span className="mt-2 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
              BUK Campus Assistant System
            </span>
          </Link>
          <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Create Account
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            Create your BUK student account
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
              <p className="text-green-700 dark:text-green-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                placeholder="Ahmad Idris Dauda"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                placeholder="your.email@buk.edu.ng"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                name="reg_number"
                value={form.reg_number}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                placeholder="CST/20/COM/00001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Faculty
              </label>
              <select
                name="faculty"
                value={form.faculty}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select your faculty</option>
                {faculties.map((faculty) => (
                  <option key={faculty} value={faculty}>
                    {faculty}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                  disabled={!form.faculty}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">
                    {!form.faculty
                      ? "Select a faculty first"
                      : facultyDepartments[form.faculty]?.length
                        ? "Select your department"
                        : "Enter your department"}
                  </option>
                  {(facultyDepartments[form.faculty] || []).map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                  <option value={OTHER_DEPARTMENT}>Other / not listed</option>
                </select>
                {form.department === OTHER_DEPARTMENT && (
                  <input
                    type="text"
                    name="otherDepartment"
                    value={form.otherDepartment}
                    onChange={handleChange}
                    required
                    maxLength={120}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                    placeholder="Enter your department name"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Level
                </label>
                <select
                  name="level"
                  value={form.level}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                placeholder="Create a strong password"
              />
              <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-live="polite">
                {getPasswordRequirements(form.password).map((requirement) => (
                  <li key={requirement.label} className={requirement.valid ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}>
                    {requirement.valid ? "✓" : "•"} {requirement.label}
                  </li>
                ))}
              </ul>
              {exceedsPasswordByteLimit(form.password) && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  Password is too long. Choose a shorter password.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                placeholder="Repeat password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isStrongPassword(form.password) || form.password !== form.confirmPassword}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : "Sign Up"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Login
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-slate-500">
            Need help?{" "}
            <Link to="/faqs" className="font-medium text-blue-600 hover:text-blue-700">
              Browse campus FAQs
            </Link>
          </p>
          <Link
            to="/locations"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <MapPin size={17} />
            Explore campus locations
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
