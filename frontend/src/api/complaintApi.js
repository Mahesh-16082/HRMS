import { apiRequest } from "./apiClient";

// ==========================================
// EMPLOYEE COMPLAINT APIS
// ==========================================

export const createComplaint = (data) =>
  apiRequest("/api/complaints", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getMyComplaints = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/complaints/me${queryString ? `?${queryString}` : ""}`);
};

export const getMyComplaint = (id) =>
  apiRequest(`/api/complaints/me/${id}`);

export const updateMyComplaint = (id, data) =>
  apiRequest(`/api/complaints/me/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// ==========================================
// HR COMPLAINT APIS
// ==========================================

export const getComplaints = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.category) query.append("category", params.category);
  if (params.employee_id) query.append("employee_id", params.employee_id);
  if (params.search) query.append("search", params.search);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/complaints${queryString ? `?${queryString}` : ""}`);
};

export const getComplaint = (id) =>
  apiRequest(`/api/complaints/${id}`);

export const updateComplaintStatus = (id, data) =>
  apiRequest(`/api/complaints/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const getComplaintCounts = () =>
  apiRequest("/api/complaints/overview/counts");

export const complaintApi = {
  createComplaint,
  getMyComplaints,
  getMyComplaint,
  updateMyComplaint,
  getComplaints,
  getComplaint,
  updateComplaintStatus,
  getComplaintCounts,
};

export default complaintApi;
