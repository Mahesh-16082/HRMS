import { apiRequest } from "./apiClient";

/**
 * Notifications API Service
 * Integrates with FastAPI /api/notifications backend endpoints.
 */

export const getNotifications = (params = {}) => {
  const query = new URLSearchParams();
  if (params.skip !== undefined && params.skip !== null) {
    query.append("skip", params.skip);
  }
  if (params.limit !== undefined && params.limit !== null) {
    query.append("limit", params.limit);
  }
  if (params.is_read !== undefined && params.is_read !== null && params.is_read !== "") {
    query.append("is_read", params.is_read);
  }
  if (params.notification_type) {
    query.append("notification_type", params.notification_type);
  }

  const queryString = query.toString();
  return apiRequest(`/api/notifications${queryString ? `?${queryString}` : ""}`);
};

export const getUnreadNotificationCount = () => {
  return apiRequest("/api/notifications/unread-count");
};

export const markNotificationAsRead = (notificationId) => {
  return apiRequest(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
};

export const markAllNotificationsAsRead = () => {
  return apiRequest("/api/notifications/read-all", {
    method: "PATCH",
  });
};

export const deleteNotification = (notificationId) => {
  return apiRequest(`/api/notifications/${notificationId}`, {
    method: "DELETE",
  });
};

export const notificationApi = {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};

export default notificationApi;
