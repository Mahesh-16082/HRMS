import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { employeeApi } from "../api/employeeApi";
import { authApi } from "../api/authApi";
import { clearAuthSession, getAuthToken } from "../api/apiClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(() => {
    const savedToken = getAuthToken();
    if (!savedToken) return null;
    try {
      const parts = savedToken.split(".");
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      return payload.role || null;
    } catch {
      return null;
    }
  });

  // If there's an existing token in localStorage, loading stays true until /api/auth/me resolves
  const [loading, setLoading] = useState(() => !!getAuthToken());

  const fetchUserData = useCallback(async (explicitToken) => {
    const currentToken = explicitToken || getAuthToken();
    if (!currentToken) {
      setUser(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);

      // Verify token with GET /api/auth/me
      const userData = await authApi.getMe(currentToken);

      if (userData) {
        setUser(userData);
        const resolvedRole = userData.role || "employee";
        setRole(resolvedRole);
        setToken(currentToken);

        // Fetch employee profile details for name and photo (non-fatal if absent)
        try {
          const profileData = await employeeApi.getMyProfile();
          if (profileData) {
            setProfile(profileData);
          }
        } catch {
          // Normal if profile hasn't been provisioned yet
        }

        return { success: true, user: userData, role: resolvedRole };
      }
    } catch (err) {
      console.error("Failed to verify user session via /api/auth/me:", err);
      if (err.status === 401) {
        clearAuthSession();
        setToken(null);
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: verify token if present in localStorage
  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) {
      fetchUserData(storedToken);
    } else {
      setLoading(false);
    }
  }, [fetchUserData]);

  // Synchronous + async auth update invoked right after OTP verification
  const loginWithToken = useCallback(
    async (accessToken, tokenType = "bearer") => {
      // 1. Store in localStorage
      localStorage.setItem("hrms_access_token", accessToken);
      localStorage.setItem("hrms_token_type", tokenType);

      // 2. Immediate state updates
      setToken(accessToken);
      setLoading(true);

      // 3. Verify session via GET /api/auth/me
      const result = await fetchUserData(accessToken);

      if (result && result.success) {
        return { success: true, role: result.role, user: result.user };
      }

      // Fallback: decode role from JWT payload if /api/auth/me had a transient error
      try {
        const parts = accessToken.split(".");
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        if (payload.role) {
          setRole(payload.role);
          return { success: true, role: payload.role };
        }
      } catch {
        // ignore
      }

      return { success: false, error: result?.error };
    },
    [fetchUserData]
  );

  const updateProfileState = useCallback((newProfileData) => {
    setProfile((prev) => ({
      ...prev,
      ...newProfileData,
    }));
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profileData = await employeeApi.getMyProfile();
      setProfile(profileData);
      return profileData;
    } catch (err) {
      console.error("Failed to refresh profile", err);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    window.location.href = "/login";
  }, []);

  const value = {
    token,
    user,
    profile,
    role,
    loading,
    logout,
    loginWithToken,
    fetchUserData,
    updateProfileState,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
