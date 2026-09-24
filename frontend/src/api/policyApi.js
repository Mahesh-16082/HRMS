import { apiRequest } from "./apiClient";

/**
 * Fetch a list of published workplace policies.
 * Read-only endpoint accessible to both HR and Employees.
 *
 * @param {Object} params - Query parameters
 * @param {string} [params.category] - Filter by policy category
 * @param {string} [params.search] - Search across title, description, or content
 * @param {number} [params.skip=0] - Offset for pagination
 * @param {number} [params.limit=100] - Number of records to return
 * @returns {Promise<{total: number, policies: Array, skip: number, limit: number}>}
 */
export const getPolicies = (params = {}) => {
  const query = new URLSearchParams();

  if (params.category && params.category !== "ALL") {
    query.append("category", params.category);
  }
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
  return apiRequest(`/api/policies${queryString ? `?${queryString}` : ""}`);
};

/**
 * Fetch full details for a single workplace policy.
 *
 * @param {number|string} id - Policy ID
 * @returns {Promise<Object>} Policy details
 */
export const getPolicy = (id) => apiRequest(`/api/policies/${id}`);

export const policyApi = {
  getPolicies,
  getPolicy,
};

export default policyApi;
