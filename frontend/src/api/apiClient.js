import { broadcastAuthEvent, AUTH_EVENTS } from "../utils/authSync";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const getAuthToken = () => {
  try {
    const token = localStorage.getItem("hrms_access_token");
    if (!token || token === "undefined" || token === "null" || typeof token !== "string" || !token.trim()) {
      return null;
    }
    return token.trim();
  } catch {
    return null;
  }
};

export const clearAuthSession = () => {
  try {
    localStorage.removeItem("hrms_access_token");
    localStorage.removeItem("hrms_token_type");
    sessionStorage.removeItem("hrms_login_email");
  } catch (e) {
    console.warn("Failed to clear auth session:", e);
  }
};

export async function apiRequest(endpoint, options = {}) {
  const token = options.token || getAuthToken();
  const headers = { ...options.headers };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If body is NOT FormData, set application/json
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Always remove invalid/expired token from storage on 401
      clearAuthSession();
      broadcastAuthEvent(AUTH_EVENTS.LOGOUT);

      const currentPath = window.location.pathname;
      if (token && currentPath !== "/login" && currentPath !== "/verify-otp" && currentPath !== "/") {
        window.location.href = "/login";
      }

      const error = new Error("Session expired. Please log in again.");
      error.status = 401;
      error.data = null;
      throw error;
    }

    // Attempt to parse JSON
    let data = null;
    if (response.status === 204 || response.status === 205) {
      data = null;
    } else {
      const contentType = response.headers.get("content-type");
      const text = await response.text();
      if (text && text.trim()) {
        if (contentType && contentType.includes("application/json")) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        } else {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
      }
    }

    if (!response.ok) {
      let errorMessage = "An unexpected error occurred.";
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          // FastAPI validation errors
          errorMessage = data.detail
            .map((err) => `${err.loc?.slice(1).join(".") || "field"}: ${err.msg}`)
            .join(", ");
        } else if (data.message) {
          errorMessage = data.message;
        }
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      const networkError = new Error("Unable to connect to the server. Please verify the backend is running.");
      networkError.status = 0;
      throw networkError;
    }
    throw err;
  }
}

export default apiRequest;
