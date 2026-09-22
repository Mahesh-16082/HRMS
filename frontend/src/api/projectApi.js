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

  // HR only: Assign employee to project with project role
  assignEmployee: (projectId, employeeId, roleId) =>
    apiRequest("/api/project-assignments", {
      method: "POST",
      body: JSON.stringify({
        project_id: Number(projectId),
        employee_id: Number(employeeId),
        role_id: Number(roleId),
      }),
    }),

  // HR only: Remove employee from project
  removeAssignment: (assignmentId) =>
    apiRequest(`/api/project-assignments/${assignmentId}`, {
      method: "DELETE",
    }),

  // ==========================================
  // PROJECT ROLES API
  // ==========================================

  // HR only: Get all project roles
  getProjectRoles: (params = {}) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append("skip", params.skip);
    if (params.limit !== undefined) query.append("limit", params.limit);
    const queryString = query.toString();
    return apiRequest(`/api/project-roles${queryString ? `?${queryString}` : ""}`);
  },

  // HR & Employee: Get active project roles for selectors
  getActiveProjectRoles: () => apiRequest("/api/project-roles/active"),

  // HR only: Get single project role
  getProjectRoleById: (id) => apiRequest(`/api/project-roles/${id}`),

  // HR only: Create new project role
  createProjectRole: (data) =>
    apiRequest("/api/project-roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // HR only: Update project role
  updateProjectRole: (id, data) =>
    apiRequest(`/api/project-roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // HR only: Activate project role
  activateProjectRole: (id) =>
    apiRequest(`/api/project-roles/${id}/activate`, {
      method: "PATCH",
    }),

  // HR only: Deactivate project role
  deactivateProjectRole: (id) =>
    apiRequest(`/api/project-roles/${id}/deactivate`, {
      method: "PATCH",
    }),

  // HR only: Delete project role
  deleteProjectRole: (id) =>
    apiRequest(`/api/project-roles/${id}`, {
      method: "DELETE",
    }),
};

export default projectApi;
