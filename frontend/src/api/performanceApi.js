import { apiRequest } from "./apiClient";

// ==========================================
// EMPLOYEE PERFORMANCE APIS (VIEW ONLY)
// ==========================================

export const getMyPerformanceReviews = (params = {}) => {
  const query = new URLSearchParams();
  if (params.review_period) query.append("review_period", params.review_period);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const qs = query.toString();
  return apiRequest(`/api/performance/reviews/me${qs ? `?${qs}` : ""}`);
};

export const getMyPerformanceReview = (id) =>
  apiRequest(`/api/performance/reviews/me/${id}`);

export const getMyPerformanceAnalytics = () =>
  apiRequest("/api/performance/analytics/me");

export const getMyPerformanceTrend = () =>
  apiRequest("/api/performance/analytics/me/trend");

// ==========================================
// HR PERFORMANCE MANAGEMENT APIS
// ==========================================

export const getHRPerformanceReviews = (params = {}) => {
  const query = new URLSearchParams();
  if (params.employee_id) query.append("employee_id", params.employee_id);
  if (params.status) query.append("status", params.status);
  if (params.review_period) query.append("review_period", params.review_period);
  if (params.start_date) query.append("start_date", params.start_date);
  if (params.end_date) query.append("end_date", params.end_date);
  if (params.skip !== undefined) query.append("skip", params.skip);
  if (params.limit !== undefined) query.append("limit", params.limit);
  const qs = query.toString();
  return apiRequest(`/api/performance/reviews${qs ? `?${qs}` : ""}`);
};

export const getHRPerformanceReview = (id) =>
  apiRequest(`/api/performance/reviews/${id}`);

export const createPerformanceReview = (data) =>
  apiRequest("/api/performance/reviews", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updatePerformanceReview = (id, data) =>
  apiRequest(`/api/performance/reviews/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const completePerformanceReview = (id, data = {}) =>
  apiRequest(`/api/performance/reviews/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deletePerformanceReview = (id) =>
  apiRequest(`/api/performance/reviews/${id}`, {
    method: "DELETE",
  });

export const getHRPerformanceAnalyticsOverview = () =>
  apiRequest("/api/performance/analytics/overview");

export const getHRPerformanceCategoryAverages = () =>
  apiRequest("/api/performance/analytics/category-averages");

export const getHRPerformanceTrend = () =>
  apiRequest("/api/performance/analytics/trend");
