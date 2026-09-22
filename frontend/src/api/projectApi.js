import { apiRequest } from "./apiClient";

export const projectApi = {
  // Employee & HR: Get current user's project assignments
  getMyProjectAssignments: () => apiRequest("/api/project-assignments/me"),

  // HR only: List projects with optional status filter
  getProjects: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    const queryString = query.toString();
    return apiRequest(`/api/projects${queryString ? `?${queryString}` : ""}`);
  },

  // HR only: Project count by status
  getProjectCount: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    const queryString = query.toString();
    return apiRequest(`/api/projects/dashboard/count${queryString ? `?${queryString}` : ""}`);
  },

  // HR only: Get single project details
  getProjectById: (id) => apiRequest(`/api/projects/${id}`),

  // HR only: Create new project
  createProject: (data) =>
    apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // HR only: Update project details
  updateProject: (id, data) =>
    apiRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // HR only: Update project status
  updateProjectStatus: (id, status) =>
    apiRequest(`/api/projects/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // HR only: Archive project
  archiveProject: (id) =>
    apiRequest(`/api/projects/${id}`, {
      method: "DELETE",
    }),

  // HR only: Get assignments for a specific project
  getProjectAssignments: (projectId) =>
    apiRequest(`/api/project-assignments/project/${projectId}`),

  // HR only: Assign employee to project
  assignEmployee: (projectId, employeeId) =>
    apiRequest("/api/project-assignments", {
      method: "POST",
      body: JSON.stringify({
        project_id: Number(projectId),
        employee_id: Number(employeeId),
      }),
    }),

  // HR only: Remove employee from project
  removeAssignment: (assignmentId) =>
    apiRequest(`/api/project-assignments/${assignmentId}`, {
      method: "DELETE",
    }),
};

export default projectApi;
