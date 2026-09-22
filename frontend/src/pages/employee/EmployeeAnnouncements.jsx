import { useState, useEffect, useCallback } from "react";
import { announcementApi } from "../../api/announcementApi";
import SectionHeader from "../../components/common/SectionHeader";
import StatCard from "../../components/common/StatCard";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import {
  AnnouncementsIcon,
  SearchIcon,
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
} from "../../components/icons/Icons";
import AnnouncementDetails from "../../components/announcements/AnnouncementDetails";
import "../../styles/announcements.css";

export default function EmployeeAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Details Modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load announcements from employee endpoint /api/announcements/me
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const data = await announcementApi.getMyAnnouncements(params);
      const list = Array.isArray(data?.announcements) ? data.announcements : [];
      setAnnouncements(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case "POLICY":
        return "badge badge-cat-policy";
      case "EVENT":
        return "badge badge-cat-event";
      case "HOLIDAY":
        return "badge badge-cat-holiday";
      case "IMPORTANT":
        return "badge badge-cat-important";
      case "GENERAL":
      default:
        return "badge badge-cat-general";
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case "URGENT":
        return "badge badge-pri-urgent";
      case "HIGH":
        return "badge badge-pri-high";
      case "MEDIUM":
        return "badge badge-pri-medium";
      case "LOW":
      default:
        return "badge badge-pri-low";
    }
  };

  const getPriorityStripClass = (priority) => {
    switch (priority) {
      case "URGENT":
        return "priority-strip-urgent";
      case "HIGH":
        return "priority-strip-high";
      case "MEDIUM":
        return "priority-strip-medium";
      case "LOW":
      default:
        return "priority-strip-low";
    }
  };

  const urgentCount = announcements.filter(
    (a) => a.priority === "URGENT" || a.priority === "HIGH"
  ).length;

  return (
    <div className="page-container">
      {/* Header */}
      <SectionHeader title="Company Announcements" />

      {/* Stat Cards */}
      <div
        className="stats-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <StatCard
          icon={AnnouncementsIcon}
          number={totalCount}
          loading={loading}
          label="Active Announcements"
          color="blue"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={urgentCount}
          loading={loading}
          label="High / Urgent Priority"
          color="amber"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadAnnouncements} />}

      {/* Main Container Card */}
      <div className="table-card" style={{ padding: "20px" }}>
        {/* Search & Filters */}
        <div
          className="table-header-bar"
          style={{
            flexWrap: "wrap",
            gap: "12px",
            padding: 0,
            marginBottom: "20px",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "16px",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              minWidth: "260px",
            }}
          >
            <div
              className="search-bar"
              style={{ padding: "6px 14px", width: "100%" }}
            >
              <SearchIcon size={15} />
              <input
                type="text"
                placeholder="Search announcements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div
            className="table-actions-group"
            style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
          >
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Categories</option>
              <option value="GENERAL">General</option>
              <option value="POLICY">Policy</option>
              <option value="EVENT">Event</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="IMPORTANT">Important</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {/* Content Section: Announcement Cards Grid */}
        {loading ? (
          <LoadingState message="Loading announcements..." />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={AnnouncementsIcon}
            title="No announcements available"
            description={
              search || categoryFilter || priorityFilter
                ? "No active announcements match your filter criteria."
                : "There are currently no company announcements posted."
            }
          />
        ) : (
          <div className="announcement-grid">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="announcement-card"
                onClick={() => setSelectedAnnouncement(item)}
                style={{ cursor: "pointer" }}
              >
                {/* Top Priority Strip */}
                <div
                  className={`announcement-priority-strip ${getPriorityStripClass(
                    item.priority
                  )}`}
                />

                <div>
                  {/* Category and Priority Badges */}
                  <div className="announcement-card-header">
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span className={getCategoryBadgeClass(item.category)}>
                        {item.category}
                      </span>
                      <span className={getPriorityBadgeClass(item.priority)}>
                        {item.priority}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="announcement-card-title">{item.title}</h4>

                  {/* Description snippet */}
                  <p className="announcement-card-description">
                    {item.description}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div>
                  <div className="announcement-card-meta">
                    <span className="announcement-meta-item">
                      <ClockIcon size={14} />
                      <span>Published: {formatDate(item.published_at)}</span>
                    </span>

                    {item.expires_at && (
                      <span className="announcement-meta-item">
                        <CalendarIcon size={14} />
                        <span>Expires: {formatDate(item.expires_at)}</span>
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--primary, #5746E8)",
                      }}
                    >
                      Read full announcement →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal (Employee Read-Only View) */}
      {selectedAnnouncement && (
        <AnnouncementDetails
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          isHR={false}
        />
      )}
    </div>
  );
}
