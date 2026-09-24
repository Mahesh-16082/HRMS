import { useState, useEffect, useCallback, useMemo } from "react";
import { policyApi } from "../../api/policyApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  ShieldIcon,
  SearchIcon,
  ArrowRight,
  FileTextIcon,
  CheckCircleIcon,
} from "../../components/icons/Icons";
import PolicyDetailsModal from "../../components/policies/PolicyDetailsModal";
import "../../styles/policies.css";

const CATEGORIES = [
  { key: "ALL", label: "All" },
  { key: "OFFICE RULES", label: "Office Rules" },
  { key: "LEAVE POLICIES", label: "Leave Policies" },
  { key: "ATTENDANCE", label: "Attendance" },
  { key: "WORKPLACE CONDUCT", label: "Workplace Conduct" },
  { key: "TECHNOLOGY & SECURITY", label: "Technology & Security" },
  { key: "EMPLOYEE GUIDELINES", label: "Employee Guidelines" },
];

const CATEGORY_COLORS = {
  "OFFICE RULES": { bg: "#e0f2fe", color: "#0369a1", badge: "badge-policy-office" },
  "LEAVE POLICIES": { bg: "#fef3c7", color: "#b45309", badge: "badge-policy-leave" },
  "ATTENDANCE": { bg: "#dcfce7", color: "#15803d", badge: "badge-policy-attendance" },
  "WORKPLACE CONDUCT": { bg: "#f3e8ff", color: "#7e22ce", badge: "badge-policy-conduct" },
  "TECHNOLOGY & SECURITY": { bg: "#ede9fe", color: "#4f46e5", badge: "badge-policy-tech" },
  "EMPLOYEE GUIDELINES": { bg: "#ffe4e6", color: "#be123c", badge: "badge-policy-guidelines" },
};

export default function WorkplacePolicies({ role = "employee" }) {
  const [policies, setPolicies] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Policy Details Modal
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load policies from API
  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (selectedCategory && selectedCategory !== "ALL") {
        params.category = selectedCategory;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await policyApi.getPolicies(params);
      const items = Array.isArray(res?.policies) ? res.policies : [];
      setPolicies(items);
      setTotalCount(res?.total ?? items.length);
    } catch (err) {
      console.error("Failed to load workplace policies:", err);
      setError(err.message || "Failed to load workplace policies.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "01 Oct 2026";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getCategoryConfig = (category) => {
    return (
      CATEGORY_COLORS[category] || {
        bg: "#ede9fe",
        color: "#5a4bea",
        badge: "badge-policy-office",
      }
    );
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="policies-page-header">
        <SectionHeader title="Workplace Policies" />
        <p className="policies-subtitle">
          View company policies, workplace rules, and employee guidelines.
        </p>
      </div>

      {/* Top Stat Overview Cards */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <StatCard
          icon={ShieldIcon}
          number={totalCount}
          loading={loading}
          label="Published Policies"
          color="purple"
        />
        <StatCard
          icon={FileTextIcon}
          number={6}
          loading={false}
          label="Policy Categories"
          color="blue"
        />
        <StatCard
          icon={CheckCircleIcon}
          number="Active"
          loading={false}
          label="Compliance Status"
          color="emerald"
        />
      </div>

      {/* Error alert if any */}
      {error && <ErrorAlert message={error} onRetry={loadPolicies} />}

      {/* Filter and Search Controls */}
      <div className="policies-filter-bar">
        <div className="policies-filter-top">
          {/* Search Box */}
          <div className="policies-search-wrap">
            <div className="search-bar" style={{ width: "100%", padding: "7px 14px" }}>
              <SearchIcon size={16} />
              <input
                type="text"
                placeholder="Search policies by title or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search policies"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="policies-category-select-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-select"
              style={{ width: "100%", padding: "7px 12px", fontSize: "13px" }}
              aria-label="Select policy category"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="policies-category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`policies-category-pill ${selectedCategory === cat.key ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Policies Grid */}
      {loading ? (
        <LoadingState message="Loading company policies..." />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={ShieldIcon}
          title="No policies found"
          description={
            search || selectedCategory !== "ALL"
              ? "No workplace policies match your search or filter criteria."
              : "No company policies are currently available."
          }
        />
      ) : (
        <div className="policies-grid">
          {policies.map((policy) => {
            const config = getCategoryConfig(policy.category);
            return (
              <div
                key={policy.id}
                className="policy-card"
                onClick={() => setSelectedPolicy(policy)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPolicy(policy);
                  }
                }}
              >
                <div className="policy-card-top">
                  <div
                    className="policy-card-icon-wrap"
                    style={{ background: config.bg, color: config.color }}
                  >
                    <ShieldIcon size={20} />
                  </div>
                  <span className={`badge ${config.badge}`}>
                    {policy.category}
                  </span>
                </div>

                <h4 className="policy-card-title">{policy.title}</h4>

                <p className="policy-card-desc">
                  {policy.description || policy.content}
                </p>

                <div className="policy-card-footer">
                  <span className="policy-card-effective">
                    Effective from: <strong>{formatDate(policy.effective_date)}</strong>
                  </span>
                  <div className="policy-card-arrow-wrap">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Policy Details Modal */}
      {selectedPolicy && (
        <PolicyDetailsModal
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
        />
      )}
    </div>
  );
}
