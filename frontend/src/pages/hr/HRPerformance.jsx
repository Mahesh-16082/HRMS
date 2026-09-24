import { useState, useEffect, useCallback } from "react";
import { employeeApi } from "../../api/employeeApi";
import { getHRPerformanceReviews } from "../../api/performanceApi";
import SectionHeader from "../../components/common/SectionHeader";
import { LoadingState, EmptyState, ErrorAlert } from "../../components/common/FeedbackStates";
import HREmployeePerformanceDetails from "../../components/performance/HREmployeePerformanceDetails";
import PerformanceReviewModal from "../../components/performance/PerformanceReviewModal";
import {
  UsersIcon,
  SearchIcon,
  PlusIcon,
  EyeIcon,
} from "../../components/icons/Icons";
import "../../styles/performance.css";

export default function HRPerformance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Employees & Reviews Data
  const [employees, setEmployees] = useState([]);
  const [completedReviewsByEmp, setCompletedReviewsByEmp] = useState({});

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL"); // ALL, RATED, UNRATED

  // Selected Employee for Drilldown Details
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Create Review Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      // 1. Fetch active employees
      // 2. Fetch all completed reviews
      const [empRes, reviewsRes] = await Promise.all([
        employeeApi.listEmployees({ limit: 100, employment_status: "ACTIVE" }),
        getHRPerformanceReviews({ status: "COMPLETED", limit: 100 }),
      ]);

      const empList = Array.isArray(empRes?.employees)
        ? empRes.employees
        : Array.isArray(empRes)
        ? empRes
        : [];
      setEmployees(empList);

      const reviewsList = Array.isArray(reviewsRes?.reviews) ? reviewsRes.reviews : [];

      // Map employees to their latest completed review (authoritative backend overall_rating)
      const empReviewMap = {};
      reviewsList.forEach((rev) => {
        if (!empReviewMap[rev.employee_id]) {
          empReviewMap[rev.employee_id] = rev;
        }
      });
      setCompletedReviewsByEmp(empReviewMap);
    } catch (err) {
      console.error("Failed to load HR performance data:", err);
      setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load performance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [empRes, reviewsRes] = await Promise.all([
          employeeApi.listEmployees({ limit: 100, employment_status: "ACTIVE" }),
          getHRPerformanceReviews({ status: "COMPLETED", limit: 100 }),
        ]);
        if (ignore) return;
        const empList = Array.isArray(empRes?.employees) ? empRes.employees : [];
        setEmployees(empList);

        const reviewsList = Array.isArray(reviewsRes?.reviews) ? reviewsRes.reviews : [];
        const empReviewMap = {};
        reviewsList.forEach((rev) => {
          if (!empReviewMap[rev.employee_id]) {
            empReviewMap[rev.employee_id] = rev;
          }
        });
        setCompletedReviewsByEmp(empReviewMap);
      } catch (err) {
        if (!ignore) {
          setError(typeof err?.data?.detail === "string" ? err.data.detail : err.message || "Failed to load performance data.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, []);

  // Filter employees based on search term and rating filter
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
    const code = (emp.employee_code || "").toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || code.includes(searchTerm.toLowerCase());

    const hasRating = !!completedReviewsByEmp[emp.id];
    if (ratingFilter === "RATED") return matchesSearch && hasRating;
    if (ratingFilter === "UNRATED") return matchesSearch && !hasRating;
    return matchesSearch;
  });

  const handleModalSuccess = (msg) => {
    setSuccessMsg(msg);
    loadData();
  };

  // If HR has selected an employee to view details, render the details view
  if (selectedEmployee) {
    return (
      <div className="page-container perf-page-content">
        <HREmployeePerformanceDetails
          employee={selectedEmployee}
          onBack={() => setSelectedEmployee(null)}
          onReviewUpdated={loadData}
        />
      </div>
    );
  }

  return (
    <div className="page-container perf-page-content">
      <div className="perf-page-header-row">
        <div>
          <SectionHeader title="Performance Management" />
          <p className="perf-page-subtitle">
            Manage employee evaluations, track organization performance trends, and complete reviews.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary perf-create-btn"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <PlusIcon size={16} />
          <span>+ Create Performance Review</span>
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadData} />}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: "16px" }}>
          {successMsg}
        </div>
      )}

      {/* Requirement 9: HR EMPLOYEE PERFORMANCE LIST */}
      <div className="perf-list-card">
        <div className="perf-list-header">
          <div>
            <h3 className="perf-list-title">Employee Performance Directory</h3>
            <span className="perf-list-subtitle">
              Showing {filteredEmployees.length} of {employees.length} employees
            </span>
          </div>

          {/* Filters & Search */}
          <div className="perf-filter-controls">
            <div className="perf-search-input-wrap">
              <SearchIcon size={16} className="perf-search-icon" />
              <input
                type="text"
                className="form-input perf-search-input"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="form-input form-select perf-status-select"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="ALL">All Employees</option>
              <option value="RATED">Rated Only</option>
              <option value="UNRATED">Not Rated Yet</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading employee performance records..." />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No matching employees found"
            description={
              searchTerm
                ? "No employees match your search query."
                : "No employee performance records to display."
            }
          />
        ) : (
          <div className="perf-table-wrapper">
            <table className="data-table perf-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Latest Rating</th>
                  <th>Last Evaluated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const latestReview = completedReviewsByEmp[emp.id];
                  // Clarification 2: Display latest completed review's backend overall_rating.
                  // If none, display "Not rated yet".
                  const hasRating = latestReview?.overall_rating !== null && latestReview?.overall_rating !== undefined;

                  return (
                    <tr
                      key={emp.id}
                      className="perf-clickable-row"
                      onClick={() => setSelectedEmployee(emp)}
                      title={`View ${emp.first_name}'s performance details`}
                    >
                      <td>
                        <div className="perf-emp-cell">
                          <div className="perf-avatar">
                            {emp.first_name?.[0]?.toUpperCase() || "E"}
                          </div>
                          <div>
                            <span className="perf-emp-name">
                              {emp.first_name} {emp.last_name}
                            </span>
                            <span className="perf-emp-role">{emp.designation_name || "Employee"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="perf-code-pill">{emp.employee_code}</span>
                      </td>
                      <td>{emp.department_name || "General"}</td>
                      <td>
                        {hasRating ? (
                          <span className="perf-rating-pill rated">
                            <strong>{latestReview.overall_rating}</strong> / 5
                          </span>
                        ) : (
                          <span className="perf-rating-pill unrated">
                            Not rated yet
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="perf-date-text">
                          {latestReview?.review_date ? latestReview.review_date : "—"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm perf-view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(emp);
                          }}
                        >
                          <EyeIcon size={14} /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Performance Review Modal */}
      <PerformanceReviewModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
