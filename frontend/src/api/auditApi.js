import { apiRequest } from "./apiClient";

/**
 * Fetch a paginated and filtered list of audit logs.
 * Restricted to HR users on backend.
 *
 * @param {Object} params - Query parameters
 * @param {string} [params.action] - 'LOGIN' | 'LOGOUT' | 'OTP_VERIFICATION'
 * @param {string} [params.status] - 'SUCCESS' | 'FAILED'
 * @param {number} [params.user_id] - Filter by specific User ID
 * @param {string} [params.email] - Filter by Email
 * @param {string} [params.start_date] - Filter by start timestamp (ISO 8601)
 * @param {string} [params.end_date] - Filter by end timestamp (ISO 8601)
 * @param {string} [params.search] - Search across email, details, or IP
 * @param {number} [params.skip=0] - Offset for pagination
 * @param {number} [params.limit=20] - Number of records to return
 * @returns {Promise<{total: number, audit_logs: Array, skip: number, limit: number}>}
 */
export const getAuditLogs = (params = {}) => {
  const query = new URLSearchParams();

  if (params.action) query.append("action", params.action);
  if (params.status) query.append("status", params.status);
  if (params.user_id !== undefined && params.user_id !== null && params.user_id !== "") {
    query.append("user_id", params.user_id);
  }
  if (params.email && params.email.trim()) {
    query.append("email", params.email.trim());
  }
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.search && params.search.trim()) {
    query.append("search", params.search.trim());
  }
  if (params.skip !== undefined && params.skip !== null) {
    query.append("skip", params.skip);
  }
  if (params.limit !== undefined && params.limit !== null) {
    query.append("limit", params.limit);
  }

  const queryString = query.toString();
  return apiRequest(`/api/audit-logs${queryString ? `?${queryString}` : ""}`);
};

/**
 * Fetch a single audit log entry by ID.
 * Restricted to HR users on backend.
 *
 * @param {number|string} id - Audit log record ID
 * @returns {Promise<Object>} Single audit log response
 */
export const getAuditLog = (id) =>
  apiRequest(`/api/audit-logs/${id}`);

export const auditApi = {
  getAuditLogs,
  getAuditLog,
};

export default auditApi;
