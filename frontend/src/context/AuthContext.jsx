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
  const [loading, setLoading] = useState(false);

  // Initialization flag: true on startup ONLY IF a valid token exists in storage
  const [isInitializing, setIsInitializing] = useState(() => !!getAuthToken());

  // Deduplication refs
  const isSyncingRef = useRef(false);
  const fetchPromiseRef = useRef(null);

  const fetchUserData = useCallback(async (explicitToken) => {
    const currentToken = explicitToken || getAuthToken();

    // IF there is NO access token:
    // - Do NOT call /api/auth/me
    // - Set user to null
    // - Set loading to false
    if (!currentToken) {
      setUser(null);
      setProfile(null);
      setRole(null);
      setToken(null);
      setLoading(false);
      return null;
    }

    // Deduplicate concurrent fetch requests for the same token
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setLoading(true);

        // Verify token with GET /api/auth/me (Authorization: Bearer <token>)
        const userData = await authApi.getMe(currentToken);

        if (userData) {
          setUser(userData);
          const resolvedRole = userData.role || "employee";
          setRole(resolvedRole);
          setToken(currentToken);

          // Fetch profile details (non-fatal if absent)
          try {
            const profileData = await employeeApi.getMyProfile();
            if (profileData) {
              setProfile(profileData);
            }
          } catch {
            // Profile not yet provisioned
          }

          return { success: true, user: userData, role: resolvedRole };
        } else {
          throw new Error("No user returned from /api/auth/me");
        }
      } catch (err) {
        console.error("Failed to verify user session via /api/auth/me:", err);
        // On 401 or any verification failure:
        // - Treat user as unauthenticated
        // - Remove invalid/expired access token from storage
        // - Clear current user and auth state
        clearAuthSession();
        setToken(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        return { success: false, error: err };
      } finally {
        setLoading(false);
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = promise;
    return promise;
  }, []);

  // Initial startup verification: verify stored token once if present
  useEffect(() => {
    let isMounted = true;
    const storedToken = getAuthToken();

    if (storedToken) {
      fetchUserData(storedToken)
        .catch((err) => {
          console.error("Startup auth verification failed:", err);
        })
        .finally(() => {
          if (isMounted) {
            setIsInitializing(false);
            setLoading(false);
          }
        });
    } else {
      // No access token in localStorage:
      // - Do NOT call /api/auth/me
      // - Set authenticated user to null
      // - Set loading state to false
      // - Exit initialization immediately
      setUser(null);
      setProfile(null);
      setRole(null);
      setToken(null);
      setLoading(false);
      setIsInitializing(false);
    }

    return () => {
      isMounted = false;
    };
  }, [fetchUserData]);

  // Synchronous + async auth update invoked right after OTP verification
  const loginWithToken = useCallback(
    async (accessToken, tokenType = "bearer") => {
      if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
        return { success: false, error: new Error("No access token provided") };
      }

      const cleanToken = accessToken.trim();

      // 1. Store in localStorage
      localStorage.setItem("hrms_access_token", cleanToken);
      localStorage.setItem("hrms_token_type", tokenType);

      // 2. Immediate state updates
      setToken(cleanToken);
      setLoading(true);

      // 3. Broadcast login event to all other tabs (no credentials in payload)
      broadcastAuthEvent(AUTH_EVENTS.LOGIN);

      // 4. Verify session via GET /api/auth/me
      const result = await fetchUserData(cleanToken);

      if (result && result.success) {
        return { success: true, role: result.role, user: result.user };
      }

      // Fallback: decode role from JWT payload if /api/auth/me had a transient error
      try {
        const parts = cleanToken.split(".");
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
    if (newProfileData) {
      setUser((prev) => {
        if (!prev) return prev;
        const updatedFullName =
          newProfileData.first_name !== undefined || newProfileData.last_name !== undefined
            ? `${newProfileData.first_name || ""} ${newProfileData.last_name || ""}`.trim()
            : prev.full_name;

        return {
          ...prev,
          email: newProfileData.email || prev.email,
          full_name: updatedFullName || prev.full_name,
        };
      });
    }
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
    setLoading(false);
    setIsInitializing(false);

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
        // Clear auth state on receiving logout event
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
          setLoading(false);
          setIsInitializing(false);
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
