/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../config";

const AuthContext = createContext();

const readStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

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
    toast.success("You have been signed out.");
    navigate("/login", { replace: true });
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
        clearSession();
        toast.error("Your session expired. Please sign in again.");
        return null;
      }

      const data = await response.json();
      if (!data?.access_token) {
        clearSession();
        return null;
      }

      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      return data.access_token;
    } catch (error) {
      clearSession();
      toast.error("We couldn't refresh your session. Please sign in again.");
      return null;
    }
  }, [clearSession]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const requestHeaders = new Headers(options.headers || {});
      let activeToken = token || localStorage.getItem("access_token");

      if (!activeToken) {
        clearSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      requestHeaders.set("Authorization", `Bearer ${activeToken}`);

      let response = await fetch(url, {
        ...options,
        headers: requestHeaders,
      });

      if (response.status === 401) {
        const refreshedToken = await refreshAccessToken();
        if (!refreshedToken) {
            toast.error("Your session has expired. Please sign in again.");
            throw new Error("Your session has expired. Please sign in again.");
          }

        requestHeaders.set("Authorization", `Bearer ${refreshedToken}`);
        response = await fetch(url, {
          ...options,
          headers: requestHeaders,
        });
      }

      return response;
    },
    [clearSession, refreshAccessToken, token],
  );

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("access_token");
      const storedUser = readStoredUser();

      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      try {
        setToken(storedToken);
        setUser(storedUser);

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

        if (!profileResponse.ok) {
          throw new Error("Unable to restore session");
        }

        const currentUser = await profileResponse.json();
        localStorage.setItem("user", JSON.stringify(currentUser));
        setToken(activeToken);
        setUser(currentUser);
      } catch (error) {
        clearSession();
        toast.error("Your saved session was invalid. Please sign in again.");
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [clearSession, refreshAccessToken]);

  const login = useCallback((userData, accessToken, refreshToken = localStorage.getItem("refresh_token")) => {
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      setToken(accessToken);
    }

    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    }

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const updateSession = useCallback((userData, accessToken = token) => {
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      setToken(accessToken);
    }
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }, [token]);

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
    authFetch,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
