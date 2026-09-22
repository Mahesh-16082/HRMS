import { apiRequest } from "./apiClient";

export const leaveApi = {
  // ==========================================
  // EMPLOYEE LEAVE APIS
  // ==========================================

  // Get current employee's leave balances
  getMyBalances: (year = null) => {
    const query = new URLSearchParams();
    if (year) query.append("year", year);
    const queryString = query.toString();
    return apiRequest(`/api/leave/balances/me${queryString ? `?${queryString}` : ""}`);
  },

  // Get current employee's leave requests
  getMyRequests: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.skip !== undefined) query.append("skip", params.skip);
    if (params.limit !== undefined) query.append("limit", params.limit);
    const queryString = query.toString();
    return apiRequest(`/api/leave/requests/me${queryString ? `?${queryString}` : ""}`);
  },

  // Get a single leave request belonging to the employee
  getMyRequest: (requestId) =>
    apiRequest(`/api/leave/requests/me/${requestId}`),

  // Employee applies for a new leave
  applyLeave: (data) =>
    apiRequest("/api/leave/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Employee cancels an eligible pending request
  cancelMyRequest: (requestId) =>
    apiRequest(`/api/leave/requests/me/${requestId}/cancel`, {
      method: "PATCH",
    }),

  // Get active leave types available to choose from
  getActiveLeaveTypes: () =>
    apiRequest("/api/leave/types/active"),

  // ==========================================
  // HR LEAVE APIS
  // ==========================================

  // HR lists all leave requests
  getAllRequests: (params = {}) => {
    const query = new URLSearchParams();
    if (params.employee_id) query.append("employee_id", params.employee_id);
    if (params.leave_type_id) query.append("leave_type_id", params.leave_type_id);
    if (params.status) query.append("status", params.status);
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.skip !== undefined) query.append("skip", params.skip);
    if (params.limit !== undefined) query.append("limit", params.limit);
    const queryString = query.toString();
    return apiRequest(`/api/leave/requests${queryString ? `?${queryString}` : ""}`);
  },

  // HR gets a specific leave request
  getRequestById: (requestId) =>
    apiRequest(`/api/leave/requests/${requestId}`),

  // HR approves a pending leave request
  approveRequest: (requestId) =>
    apiRequest(`/api/leave/requests/${requestId}/approve`, {
      method: "PATCH",
    }),

  // HR rejects a pending leave request
  rejectRequest: (requestId, rejectionReason) =>
    apiRequest(`/api/leave/requests/${requestId}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),

  // HR lists all leave balances
  getAllBalances: (params = {}) => {
    const query = new URLSearchParams();
    if (params.employee_id) query.append("employee_id", params.employee_id);
    if (params.year) query.append("year", params.year);
    if (params.skip !== undefined) query.append("skip", params.skip);
    if (params.limit !== undefined) query.append("limit", params.limit);
    const queryString = query.toString();
    return apiRequest(`/api/leave/balances${queryString ? `?${queryString}` : ""}`);
  },

  // HR views a specific employee's balances
  getEmployeeBalances: (employeeId, year = null) => {
    const query = new URLSearchParams();
    if (year) query.append("year", year);
    const queryString = query.toString();
    return apiRequest(`/api/leave/balances/${employeeId}${queryString ? `?${queryString}` : ""}`);
  },

  // HR creates or allocates a balance
  createBalance: (data) =>
    apiRequest("/api/leave/balances", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // HR updates a balance
  updateBalance: (balanceId, data) =>
    apiRequest(`/api/leave/balances/${balanceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ==========================================
  // HR LEAVE TYPE MANAGEMENT
  // ==========================================

  getAllLeaveTypes: () =>
    apiRequest("/api/leave/types"),

  getLeaveTypeById: (leaveTypeId) =>
    apiRequest(`/api/leave/types/${leaveTypeId}`),

  createLeaveType: (data) =>
    apiRequest("/api/leave/types", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLeaveType: (leaveTypeId, data) =>
    apiRequest(`/api/leave/types/${leaveTypeId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  activateLeaveType: (leaveTypeId) =>
    apiRequest(`/api/leave/types/${leaveTypeId}/activate`, {
      method: "PATCH",
    }),

  deactivateLeaveType: (leaveTypeId) =>
    apiRequest(`/api/leave/types/${leaveTypeId}/deactivate`, {
      method: "PATCH",
    }),

  deleteLeaveType: (leaveTypeId) =>
    apiRequest(`/api/leave/types/${leaveTypeId}`, {
      method: "DELETE",
    }),
};
