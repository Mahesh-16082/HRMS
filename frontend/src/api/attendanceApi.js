import { apiRequest } from "./apiClient";

export const attendanceApi = {
  // Employee check-in
  checkIn: (remarks = null) =>
    apiRequest("/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ remarks }),
    }),

  // Employee check-out
  checkOut: (remarks = null) =>
    apiRequest("/api/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({ remarks }),
    }),

  // Employee: Today's attendance record
  getMyTodayAttendance: () => apiRequest("/api/attendance/me/today"),

  // Employee: Attendance history
  getMyAttendance: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);

    const queryString = query.toString();
    return apiRequest(`/api/attendance/me${queryString ? `?${queryString}` : ""}`);
  },

  // HR only: All employee attendance
  getAllAttendance: (params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);

    const queryString = query.toString();
    return apiRequest(`/api/attendance/${queryString ? `?${queryString}` : ""}`);
  },

  // HR only: Specific employee attendance
  getEmployeeAttendance: (employeeId, params = {}) => {
    const query = new URLSearchParams();
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);

    const queryString = query.toString();
    return apiRequest(
      `/api/attendance/employee/${employeeId}${queryString ? `?${queryString}` : ""}`
    );
  },

  // HR only: Attendance count
  getAttendanceCount: (params = {}) => {
    const query = new URLSearchParams();
    if (params.employee_id) query.append("employee_id", params.employee_id);
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);

    const queryString = query.toString();
    return apiRequest(`/api/attendance/count${queryString ? `?${queryString}` : ""}`);
  },
};

export default attendanceApi;
