import { apiRequest } from "./apiClient";

export const authApi = {
  getMe: (token) => {
    if (!token || typeof token !== "string" || !token.trim()) {
      return Promise.reject(new Error("No access token provided"));
    }
    const cleanToken = token.trim();
    const options = {
      token: cleanToken,
      headers: { Authorization: `Bearer ${cleanToken}` }
    };
    return apiRequest("/api/auth/me", options);
  },
};

export default authApi;
