import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { notificationApi } from "../api/notificationApi";

const NotificationContext = createContext({
  unreadCount: 0,
  loadingCount: false,
  fetchUnreadCount: async () => {},
  decrementUnreadCount: () => {},
  resetUnreadCount: () => {},
  setUnreadCount: () => {},
});

export function NotificationProvider({ children }) {
  const { token, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!token || !user) {
      setUnreadCount(0);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoadingCount(true);
      const res = await notificationApi.getUnreadNotificationCount();
      if (res && typeof res.unread_count === "number") {
        setUnreadCount(res.unread_count);
      }
    } catch {
      // Non-fatal background fetch
    } finally {
      setLoadingCount(false);
      isFetchingRef.current = false;
    }
  }, [token, user]);

  const decrementUnreadCount = useCallback((amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Fetch unread count on mount and when authentication changes
  useEffect(() => {
    let ignore = false;
    if (!token || !user) {
      return;
    }

    notificationApi
      .getUnreadNotificationCount()
      .then((res) => {
        if (!ignore && res && typeof res.unread_count === "number") {
          setUnreadCount(res.unread_count);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [token, user]);

  // Periodic polling & tab visibility / focus sync
  useEffect(() => {
    if (!token || !user) return;

    // Refresh count when user returns to window/tab
    const handleSync = () => {
      if (!document.hidden) {
        fetchUnreadCount();
      }
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    // Periodic 60-second background refresh
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchUnreadCount();
      }
    }, 60000);

    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      clearInterval(interval);
    };
  }, [token, user, fetchUnreadCount]);

  const value = {
    unreadCount,
    loadingCount,
    fetchUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
    setUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
