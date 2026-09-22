import { apiRequest } from "./apiClient";

export const authApi = {
  getMe: (token) => {
    const options = token
      ? { token, headers: { Authorization: `Bearer ${token}` } }
      : {};
    return apiRequest("/api/auth/me", options);
  },
};

export default authApi;
