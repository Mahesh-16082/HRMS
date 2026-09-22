import { apiRequest } from "./apiClient";

// ==========================================
// EMPLOYEE ANNOUNCEMENT APIS
// ==========================================

export const getMyAnnouncements = (params = {}) => {
  const query = new URLSearchParams();
  if (params.category) query.append("category", params.category);
  if (params.priority) query.append("priority", params.priority);
  if (params.search) query.append("search", params.search);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/announcements/me${queryString ? `?${queryString}` : ""}`);
};

export const getAnnouncement = (id) =>
  apiRequest(`/api/announcements/${id}`);

// ==========================================
// HR ANNOUNCEMENT APIS
// ==========================================

export const getAnnouncements = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append("status", params.status);
  if (params.category) query.append("category", params.category);
  if (params.priority) query.append("priority", params.priority);
  if (params.search) query.append("search", params.search);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/announcements${queryString ? `?${queryString}` : ""}`);
};

export const createAnnouncement = (data) =>
  apiRequest("/api/announcements", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateAnnouncement = (id, data) =>
  apiRequest(`/api/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteAnnouncement = (id) =>
  apiRequest(`/api/announcements/${id}`, {
    method: "DELETE",
  });

export const publishAnnouncement = (id, data = {}) =>
  apiRequest(`/api/announcements/${id}/publish`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const archiveAnnouncement = (id, data = {}) =>
  apiRequest(`/api/announcements/${id}/archive`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const announcementApi = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  getMyAnnouncements,
};

export default announcementApi;
