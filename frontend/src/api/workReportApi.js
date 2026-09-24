import { apiRequest } from "./apiClient";

// ==========================================
// EMPLOYEE WORK REPORT APIS
// ==========================================

export const createWorkReport = (data) =>
  apiRequest("/api/work-reports", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getMyWorkReports = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append("status", params.status);
  if (params.project_id) query.append("project_id", params.project_id);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/work-reports/me${queryString ? `?${queryString}` : ""}`);
};

export const getTodayWorkReportStatus = () =>
  apiRequest("/api/work-reports/me/today");

export const getMyWorkReport = (id) =>
  apiRequest(`/api/work-reports/me/${id}`);

export const updateMyWorkReport = (id, data) =>
  apiRequest(`/api/work-reports/me/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const submitMyWorkReport = (id) =>
  apiRequest(`/api/work-reports/me/${id}/submit`, {
    method: "PATCH",
  });

export const deleteMyWorkReport = (id) =>
  apiRequest(`/api/work-reports/me/${id}`, {
    method: "DELETE",
  });

// ==========================================
// WORK REPORT ATTACHMENT APIS
// Note: Backend supports:
// POST   /api/work-reports/{report_id}/attachments
// GET    /api/work-reports/{report_id}/attachments
// GET    /api/work-reports/{report_id}/attachments/{id}
// DELETE /api/work-reports/{report_id}/attachments/{id}
// ==========================================

export const uploadAttachment = (reportId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`/api/work-reports/${reportId}/attachments`, {
    method: "POST",
    body: formData,
  });
};

export const getAttachments = (reportId) =>
  apiRequest(`/api/work-reports/${reportId}/attachments`);

export const getAttachmentById = (reportId, attachmentId) =>
  apiRequest(`/api/work-reports/${reportId}/attachments/${attachmentId}`);

export const deleteAttachment = (reportId, attachmentId) =>
  apiRequest(`/api/work-reports/${reportId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });

// ==========================================
// HR WORK REPORT APIS
// ==========================================

export const getWorkReportsHR = (params = {}) => {
  const query = new URLSearchParams();
  if (params.employee_id) query.append("employee_id", params.employee_id);
  if (params.project_id) query.append("project_id", params.project_id);
  if (params.status) query.append("status", params.status);
  if (params.work_date) query.append("work_date", params.work_date);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.search) query.append("search", params.search);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const queryString = query.toString();
  return apiRequest(`/api/work-reports${queryString ? `?${queryString}` : ""}`);
};

export const getWorkReportDetailsHR = (id) =>
  apiRequest(`/api/work-reports/${id}`);

export const reviewWorkReportHR = (id, data) =>
  apiRequest(`/api/work-reports/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const revokeWorkReportHR = (id) =>
  apiRequest(`/api/work-reports/${id}/revoke`, {
    method: "PATCH",
  });

export const workReportApi = {
  createWorkReport,
  getMyWorkReports,
  getTodayWorkReportStatus,
  getMyWorkReport,
  updateMyWorkReport,
  submitMyWorkReport,
  deleteMyWorkReport,
  uploadAttachment,
  getAttachments,
  getAttachmentById,
  deleteAttachment,
  getWorkReportsHR,
  getWorkReportDetailsHR,
  reviewWorkReportHR,
  revokeWorkReportHR,
};

export default workReportApi;
