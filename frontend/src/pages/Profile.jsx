import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import PageHeader from "../components/PageHeader";

function Profile() {
  const { user, token, updateSession } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || `Failed to load profile (${response.status})`);
        }

        const updatedUser = data.user || data;
        setProfileData(updatedUser);
        setFormData({ email: updatedUser.email || "", level: updatedUser.level || "" });
      } catch (err) {
        setError(err.message || "Failed to load profile");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          level: formData.level === "" ? null : Number(formData.level),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `Failed to update profile (${response.status})`);
      }

      const updatedUser = data.user || data;
      setProfileData(updatedUser);
      setFormData({ email: updatedUser.email || "", level: updatedUser.level || "" });
      updateSession(updatedUser, data.access_token || token);
      setIsEditing(false);
      alert("Profile updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update profile");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="My Profile" />

      <div className="max-w-2xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user?.full_name}
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              {isEditing ? (
                <p className="text-gray-900 dark:text-white">{profileData?.full_name}</p>
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {profileData?.full_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{profileData?.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Number
              </label>
              <p className="text-gray-900 dark:text-white">
                {profileData?.registration_number || "—"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Faculty
              </label>
              <p className="text-gray-900 dark:text-white">{profileData?.faculty || "—"}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department
              </label>
              <p className="text-gray-900 dark:text-white">{profileData?.department || "—"}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Level
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="level"
                  value={formData.level || ""}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{profileData?.level}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Approval Status
              </label>
              <p
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  profileData?.is_approved
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400"
                    : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                {profileData?.is_approved ? "Approved" : "Pending Approval"}
              </p>
            </div>
          </div>

          {isEditing && (
            <button
              onClick={handleSave}
              className="mt-6 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
