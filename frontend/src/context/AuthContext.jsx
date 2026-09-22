import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { employeeApi } from "../api/employeeApi";
import { authApi } from "../api/authApi";
import { clearAuthSession, getAuthToken } from "../api/apiClient";
import { broadcastAuthEvent, subscribeToAuthSync, AUTH_EVENTS } from "../utils/authSync";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

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

  // Loading flag for network operations
  const [loading, setLoading] = useState(() => !!getAuthToken());

  // Initialization flag: true on boot when stored token is present, false once resolved
  const [isInitializing, setIsInitializing] = useState(() => !!getAuthToken());

  // Guard ref to deduplicate simultaneous BroadcastChannel and storage events
  const isSyncingRef = useRef(false);

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
      if (err.status === 401 || err.status === 403) {
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

  // Initial startup verification: verify stored token once
  useEffect(() => {
    let isMounted = true;
    const storedToken = getAuthToken();
    if (storedToken) {
      fetchUserData(storedToken).finally(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      });
    } else {
      setLoading(false);
      setIsInitializing(false);
    }
    return () => {
      isMounted = false;
    };
  }, [fetchUserData]);

  // Synchronous + async auth update invoked right after OTP verification on login tab
  const loginWithToken = useCallback(
    async (accessToken, tokenType = "bearer") => {
      // 1. Store in localStorage
      localStorage.setItem("hrms_access_token", accessToken);
      localStorage.setItem("hrms_token_type", tokenType);

      // 2. Immediate state updates
      setToken(accessToken);
      setLoading(true);

      // 3. Broadcast login event to all other tabs (no credentials in payload)
      broadcastAuthEvent(AUTH_EVENTS.LOGIN);

      // 4. Verify session via GET /api/auth/me
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

  // Logout executed on the current tab
  const logout = useCallback(() => {
    // 1. Broadcast logout to all other open tabs
    broadcastAuthEvent(AUTH_EVENTS.LOGOUT);

    // 2. Clear local storage
    clearAuthSession();

    // 3. Clear in-memory auth state
    setToken(null);
    setUser(null);
    setProfile(null);
    setRole(null);

    // 4. Navigate to /login
    navigate("/login", { replace: true });
  }, [navigate]);

  // Cross-tab synchronization listener (BroadcastChannel + storage event fallback)
  useEffect(() => {
    const unsubscribe = subscribeToAuthSync(async (event) => {
      if (event.type === AUTH_EVENTS.LOGIN || event.type === AUTH_EVENTS.SESSION_UPDATED) {
        const currentStoredToken = getAuthToken();
        if (!currentStoredToken) return;

        // Deduplicate: guard against parallel execution
        if (isSyncingRef.current) return;
        if (token === currentStoredToken && user) return;

        isSyncingRef.current = true;
        try {
          setToken(currentStoredToken);
          const result = await fetchUserData(currentStoredToken);
          const verifiedRole = result?.user?.role || result?.role;

          // If this tab is currently on a public auth page, auto-redirect to verified dashboard
          const currentPath = location.pathname;
          if (currentPath === "/" || currentPath === "/login" || currentPath === "/verify-otp") {
            if (verifiedRole === "hr") {
              navigate("/hr/dashboard", { replace: true });
            } else if (verifiedRole === "employee") {
              navigate("/employee/dashboard", { replace: true });
            }
          }
        } finally {
          isSyncingRef.current = false;
        }
      } else if (event.type === AUTH_EVENTS.LOGOUT) {
        // Clear auth state on receiving logout event (DO NOT broadcast again, DO NOT call backend logout API)
        clearAuthSession();
        setToken(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        setIsInitializing(false);

        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
        }
      }
    });

    return unsubscribe;
  }, [token, user, fetchUserData, location.pathname, navigate]);

  // Tab visibility / focus handler: check if session was terminated while inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentStoredToken = getAuthToken();
        // If tab was previously authenticated, but the token has been cleared in another tab:
        if (token && !currentStoredToken) {
          clearAuthSession();
          setToken(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          if (location.pathname !== "/login") {
            navigate("/login", { replace: true });
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token, location.pathname, navigate]);

  const value = {
    token,
    user,
    profile,
    role,
    loading,
    isInitializing,
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
