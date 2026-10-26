import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { CheckCircle, Eye, EyeOff, Loader2, MapPin, XCircle } from "lucide-react";
import {
  exceedsPasswordByteLimit,
  getPasswordRequirements,
  isStrongPassword,
} from "../utils/password";
import { faculties, facultyDepartments } from "../data/bukFaculties";

const OTHER_DEPARTMENT = "__other_department__";
const inputClasses =
  "w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400";

function getFieldErrors(form) {
  const errors = {};
  if (!form.full_name.trim()) errors.full_name = "Enter your full name.";
  if (!form.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.reg_number.trim()) errors.reg_number = "Enter your registration number.";
  if (!form.faculty) errors.faculty = "Select your faculty.";
  if (!form.department) errors.department = "Select your department.";
  if (
    form.department === OTHER_DEPARTMENT &&
    !form.otherDepartment.trim()
  ) {
    errors.otherDepartment = "Enter your department name.";
  }
  if (!form.level) errors.level = "Select your level.";
  if (!form.password) errors.password = "Create a password.";
  else if (!isStrongPassword(form.password)) {
    errors.password = "Meet all password requirements.";
  } else if (exceedsPasswordByteLimit(form.password)) {
    errors.password = "Choose a shorter password.";
  }
  if (!form.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

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
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resultPopup, setResultPopup] = useState(null);
  const handleChange = (event) => {
    const { name, value } = event.target;
    const updatedForm = {
      ...form,
      [name]: value,
      ...(name === "faculty"
        ? { department: "", otherDepartment: "" }
        : {}),
    };
    setForm(updatedForm);
    if (submitted) setFieldErrors(getFieldErrors(updatedForm));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    const nextFieldErrors = getFieldErrors(form);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("You're almost there—please check the fields marked below.");
      return;
    }

    const department =
      form.department === OTHER_DEPARTMENT
        ? form.otherDepartment.trim()
        : form.department;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data.detail === "string"
            ? data.detail
            : "Registration failed. Check your details and try again.";
        setError(message);
        setResultPopup({
          type: "error",
          title: "Account creation failed",
          message,
        });
        return;
      }

      setResultPopup({
        type: "success",
        title: "Registration successful!",
        message: "Your account has been created and is waiting for administrator approval. You can sign in once it has been reviewed.",
      });
    } catch (err) {
      const message = err instanceof TypeError
        ? "Cannot reach the server. Check your internet connection and try again."
        : "An error occurred while creating your account. Please try again.";
      setError(message);
      setResultPopup({
        type: "error",
        title: "Account creation failed",
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (name) =>
    `${inputClasses} ${
      fieldErrors[name]
        ? "border-red-500 focus:ring-red-500 dark:border-red-400"
        : ""
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8 pb-28 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-lg px-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <Link to="/" className="mx-auto mb-3 flex w-fit flex-col items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="BUK Campus Assistant System home">
            <img
              src="/BUk%20logo%202.webp"
              alt="Bayero University Kano logo"
              className="h-14 w-14 rounded-xl bg-white/70 p-1 object-contain opacity-90 transition-opacity hover:opacity-100"
            />
            <span className="mt-2 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
              BUK Campus Assistant System
            </span>
          </Link>
          <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Create Account
          </h1>

          {error && !resultPopup && (
            <div role="alert" aria-live="assertive" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/30">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="signup-full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                id="signup-full-name"
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={fieldErrors.full_name ? "signup-full-name-error" : undefined}
                className={fieldClass("full_name")}
                placeholder="Ahmad Idris Dauda"
              />
              {fieldErrors.full_name && <p id="signup-full-name-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name}</p>}
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                className={fieldClass("email")}
                placeholder="your.email@buk.edu.ng"
              />
              {fieldErrors.email && <p id="signup-email-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="signup-registration-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Number
              </label>
              <input
                id="signup-registration-number"
                type="text"
                name="reg_number"
                value={form.reg_number}
                onChange={handleChange}
                required
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.reg_number)}
                aria-describedby={fieldErrors.reg_number ? "signup-registration-number-error" : undefined}
                className={fieldClass("reg_number")}
                placeholder="CST/20/COM/00001"
              />
              {fieldErrors.reg_number && <p id="signup-registration-number-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.reg_number}</p>}
            </div>

            <div>
              <label htmlFor="signup-faculty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Faculty
              </label>
              <select
                id="signup-faculty"
                name="faculty"
                value={form.faculty}
                onChange={handleChange}
                required
                aria-invalid={Boolean(fieldErrors.faculty)}
                aria-describedby={fieldErrors.faculty ? "signup-faculty-error" : undefined}
                className={`${fieldClass("faculty")} bg-white dark:bg-gray-700`}
              >
                <option value="">Select your faculty</option>
                {faculties.map((faculty) => (
                  <option key={faculty} value={faculty}>
                    {faculty}
                  </option>
                ))}
              </select>
              {fieldErrors.faculty && <p id="signup-faculty-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.faculty}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signup-department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department
                </label>
                <select
                  id="signup-department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                  disabled={!form.faculty}
                  aria-invalid={Boolean(fieldErrors.department)}
                  aria-describedby={fieldErrors.department ? "signup-department-error" : undefined}
                  className={`${fieldClass("department")} bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700`}
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
                {fieldErrors.department && <p id="signup-department-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.department}</p>}
                {form.department === OTHER_DEPARTMENT && (
                  <>
                    <input
                      id="signup-other-department"
                      type="text"
                      name="otherDepartment"
                      value={form.otherDepartment}
                      onChange={handleChange}
                      required
                      maxLength={120}
                      aria-invalid={Boolean(fieldErrors.otherDepartment)}
                      aria-label="Other department name"
                      aria-describedby={fieldErrors.otherDepartment ? "signup-other-department-error" : undefined}
                      className={`mt-2 ${fieldClass("otherDepartment")}`}
                      placeholder="Enter your department name"
                    />
                    {fieldErrors.otherDepartment && <p id="signup-other-department-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.otherDepartment}</p>}
                  </>
                )}
              </div>

              <div>
                <label htmlFor="signup-level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Level
                </label>
                <select
                  id="signup-level"
                  name="level"
                  value={form.level}
                  onChange={handleChange}
                  required
                  aria-invalid={Boolean(fieldErrors.level)}
                  aria-describedby={fieldErrors.level ? "signup-level-error" : undefined}
                  className={`${fieldClass("level")} bg-white dark:bg-gray-700`}
                >
                  <option value="">Select</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                </select>
                {fieldErrors.level && <p id="signup-level-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.level}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={[
                    "signup-password-requirements",
                    fieldErrors.password ? "signup-password-error" : null,
                  ].filter(Boolean).join(" ")}
                  className={`${fieldClass("password")} pr-12`}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 flex min-h-11 w-12 touch-manipulation items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
              {fieldErrors.password && <p id="signup-password-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>}
              <ul id="signup-password-requirements" className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-live="polite">
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
              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
                  className={`${fieldClass("confirmPassword")} pr-12`}
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-1 flex min-h-11 w-12 touch-manipulation items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p id="signup-confirm-password-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Creating account…
                </>
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
      {resultPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setResultPopup(null);
          }}
        >
          <section
            role={resultPopup.type === "success" ? "dialog" : "alertdialog"}
            aria-modal="true"
            aria-labelledby="signup-result-title"
            aria-describedby="signup-result-message"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800"
          >
            {resultPopup.type === "success" ? (
              <CheckCircle className="mx-auto mb-3 text-green-600 dark:text-green-400" size={42} />
            ) : (
              <XCircle className="mx-auto mb-3 text-red-600 dark:text-red-400" size={42} />
            )}
            <h2 id="signup-result-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {resultPopup.title}
            </h2>
            <p id="signup-result-message" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {resultPopup.message}
            </p>
            {resultPopup.type === "success" ? (
              <Link
                to="/login"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
              >
                Go to sign in
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setResultPopup(null)}
                className="mt-5 min-h-11 w-full rounded-xl bg-slate-100 px-4 font-semibold text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
              >
                Close and try again
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default Signup;
