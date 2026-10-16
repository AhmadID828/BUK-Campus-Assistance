/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";


const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();


  const clearSession = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login");
  }, [clearSession, navigate]);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      clearSession();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        logout();
        return null;
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      return data.access_token;
    } catch (error) {
      clearSession();
      return null;
    }
  }, [clearSession, logout]);

  // Load user from localStorage on app start
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("access_token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        let activeToken = storedToken;
        let profileResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (profileResponse.status === 401) {
          activeToken = await refreshAccessToken();
          if (!activeToken) return;

          profileResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
        }

        if (!profileResponse.ok) throw new Error("Unable to restore session");

        const currentUser = await profileResponse.json();
        localStorage.setItem("user", JSON.stringify(currentUser));
        setToken(activeToken);
        setUser(currentUser);
      } catch (error) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        localStorage.removeItem("refresh_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [refreshAccessToken]);

  // login expects (userData, accessToken)
  const login = (userData, accessToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const updateSession = (userData, accessToken = token) => {
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      setToken(accessToken);
    }
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // Helpers
  const isLoggedIn = !!user && !!token;
  const isApproved = user?.is_approved === true;
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const isActive = user?.is_active !== false;

  const value = {
    user,
    token,
    loading,
    isLoggedIn,
    isApproved,
    isAdmin,
    isStudent,
    isActive,
    login,
    updateSession,
    logout,
    setUser,
    refreshAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
