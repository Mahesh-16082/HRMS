const AUTH_CHANNEL_NAME = "hrms_auth_sync_channel";

export const AUTH_EVENTS = {
  LOGIN: "AUTH_LOGIN",
  LOGOUT: "AUTH_LOGOUT",
  SESSION_UPDATED: "AUTH_SESSION_UPDATED",
};

let broadcastChannel = null;

function getChannel() {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    if (!broadcastChannel) {
      try {
        broadcastChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      } catch (err) {
        console.warn("BroadcastChannel initialization warning:", err);
      }
    }
  }
  return broadcastChannel;
}

/**
 * Broadcast an authentication event to all other tabs.
 *
 * STRICT SECURITY REQUIREMENT:
 * Never broadcast access tokens, JWTs, passwords, OTPs, or user secrets.
 * Only broadcast event metadata.
 */
export function broadcastAuthEvent(type) {
  const channel = getChannel();
  if (channel) {
    try {
      channel.postMessage({
        type,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn("Failed to broadcast auth event:", err);
    }
  }
}

/**
 * Subscribe to cross-tab auth events.
 * Listens to BroadcastChannel and window "storage" event as a fallback.
 *
 * @param {Function} onEvent - Callback taking { type, timestamp }
 * @returns {Function} Unsubscribe cleanup function
 */
export function subscribeToAuthSync(onEvent) {
  const channel = getChannel();

  const handleBroadcastMessage = (event) => {
    if (event?.data?.type) {
      onEvent(event.data);
    }
  };

  const handleStorageEvent = (event) => {
    // Storage event fires in other tabs when localStorage is modified
    if (event.key === "hrms_access_token") {
      if (event.newValue) {
        onEvent({ type: AUTH_EVENTS.LOGIN, timestamp: Date.now() });
      } else {
        onEvent({ type: AUTH_EVENTS.LOGOUT, timestamp: Date.now() });
      }
    }
  };

  if (channel) {
    channel.addEventListener("message", handleBroadcastMessage);
  }
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleBroadcastMessage);
    }
    window.removeEventListener("storage", handleStorageEvent);
  };
}
