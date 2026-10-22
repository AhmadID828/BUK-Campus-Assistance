import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import PageHeader from "../components/PageHeader";

const levels = [100, 200, 300, 400, 500, 600];

function responseError(data, fallback) {
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || item).join(", ");
  }
  return typeof data.detail === "string" ? data.detail : fallback;
}

function Profile() {
  const { user, token, updateSession } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [level, setLevel] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseError(data, `Failed to load profile (${response.status})`));
        }

        const updatedUser = data.user || data;
        setProfileData(updatedUser);
        setLevel(updatedUser.level ? String(updatedUser.level) : "");
      } catch (err) {
        setError(err.message || "Unable to load your profile. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const cancelEditing = () => {
    setLevel(profileData?.level ? String(profileData.level) : "");
    setError("");
    setIsEditing(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ level: Number(level) }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseError(data, `Failed to update profile (${response.status})`));
      }

      const updatedUser = data.user || data;
      setProfileData(updatedUser);
      setLevel(updatedUser.level ? String(updatedUser.level) : "");
      updateSession(updatedUser, data.access_token || token);
      setIsEditing(false);
      toast.success("Your level has been updated.");
    } catch (err) {
      const message = err.message || "Unable to update your level. Please try again.";
      setError(message);
      toast.error(message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
      <PageHeader title="My Profile" />

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-blue-700 to-cyan-700 px-5 py-6 text-white sm:px-8">
          <p className="text-sm font-medium text-blue-100">Student account</p>
          <h2 className="mt-1 text-2xl font-bold">{profileData?.full_name || user?.full_name || "My account"}</h2>
          <p className="mt-1 break-all text-sm text-blue-100">{profileData?.registration_number || user?.registration_number}</p>
        </div>

        <form onSubmit={handleSave} className="p-5 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileField label="Full name" value={profileData?.full_name} />
            <ProfileField label="Email address" value={profileData?.email} />
            <ProfileField label="Registration number" value={profileData?.registration_number} />
            <ProfileField label="Faculty" value={profileData?.faculty} />
            <ProfileField label="Department" value={profileData?.department} />

            <div>
              <label htmlFor="profile-level" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Study level
              </label>
              {isEditing ? (
                <select
                  id="profile-level"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="" disabled>Select your level</option>
                  {levels.map((item) => <option key={item} value={item}>{item} Level</option>)}
                </select>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-slate-900 dark:bg-slate-800 dark:text-white">
                  {profileData?.level ? `${profileData.level} Level` : "Not set"}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Account status</p>
              <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                profileData?.is_approved
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {profileData?.is_approved ? "Approved" : "Waiting for approval"}
              </span>
            </div>

            {isEditing ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !level}
                  className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save level"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Edit study level
              </button>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            You can update your study level here. Contact an administrator if any other account details need correction.
          </p>
        </form>
      </section>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="break-words rounded-xl bg-slate-50 px-3.5 py-3 text-slate-900 dark:bg-slate-800 dark:text-white">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export default Profile;
