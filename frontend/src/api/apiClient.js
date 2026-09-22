import { broadcastAuthEvent, AUTH_EVENTS } from "../utils/authSync";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const getAuthToken = () => {
  return localStorage.getItem("hrms_access_token");
};

export const clearAuthSession = () => {
  localStorage.removeItem("hrms_access_token");
  localStorage.removeItem("hrms_token_type");
  sessionStorage.removeItem("hrms_login_email");
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
      const currentPath = window.location.pathname;
      // Do not clear session or force-redirect if we are in the middle of login or OTP verification
      if (token && currentPath !== "/login" && currentPath !== "/verify-otp" && currentPath !== "/") {
        clearAuthSession();
        broadcastAuthEvent(AUTH_EVENTS.LOGOUT);
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }

    // Attempt to parse JSON
    const contentType = response.headers.get("content-type");
    let data = null;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
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
