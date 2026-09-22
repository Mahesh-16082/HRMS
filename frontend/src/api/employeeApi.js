import { apiRequest } from "./apiClient";

export const employeeApi = {
  // Self profile (Employee & HR)
  getMyProfile: () => apiRequest("/api/employees/me/profile"),

  // Employee update self profile (Only first_name, last_name, phone, date_of_birth, address)
  updateMyProfile: (data) =>
    apiRequest("/api/employees/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Upload profile photo via Cloudinary endpoint (multipart/form-data)
  uploadProfilePhoto: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/api/employees/me/profile/photo", {
      method: "POST",
      body: formData,
    });
  },

  // HR only: Dashboard counts
  getEmployeeCounts: () => apiRequest("/api/employees/dashboard/counts"),

  // HR only: List employees with pagination and filters
  listEmployees: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.limit) query.append("limit", params.limit);
    if (params.search) query.append("search", params.search);
    if (params.department_id) query.append("department_id", params.department_id);
    if (params.designation_id) query.append("designation_id", params.designation_id);
    if (params.employment_status) query.append("employment_status", params.employment_status);

    const queryString = query.toString();
    return apiRequest(`/api/employees${queryString ? `?${queryString}` : ""}`);
  },

  // HR only: Get single employee
  getEmployeeById: (id) => apiRequest(`/api/employees/${id}`),

  // HR only: Update employee
  updateEmployee: (id, data) =>
    apiRequest(`/api/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // HR only: Update employment status
  updateEmployeeStatus: (id, employment_status) =>
    apiRequest(`/api/employees/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ employment_status }),
    }),

  // HR only: Activate employee
  activateEmployee: (id) =>
    apiRequest(`/api/employees/${id}/activate`, {
      method: "PATCH",
    }),

  // HR only: Deactivate employee
  deactivateEmployee: (id) =>
    apiRequest(`/api/employees/${id}/deactivate`, {
      method: "PATCH",
    }),

  // HR only: Archive employee
  archiveEmployee: (id) =>
    apiRequest(`/api/employees/${id}`, {
      method: "DELETE",
    }),
};

export default employeeApi;
