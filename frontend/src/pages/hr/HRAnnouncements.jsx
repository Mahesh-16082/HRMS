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
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  EditIcon,
  TrashIcon,
} from "../../components/icons/Icons";
import AnnouncementDetails from "../../components/announcements/AnnouncementDetails";
import AnnouncementFormModal from "../../components/announcements/AnnouncementFormModal";
import "../../styles/announcements.css";

export default function HRAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Modals state
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Debounce search by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load announcements
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const data = await announcementApi.getAnnouncements(params);
      const list = Array.isArray(data?.announcements) ? data.announcements : [];
      setAnnouncements(list);
      setTotalCount(data?.total ?? list.length);
    } catch (err) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  // Stat computations
  const draftCount = announcements.filter((a) => a.status === "DRAFT").length;
  const publishedCount = announcements.filter((a) => a.status === "PUBLISHED").length;
  const archivedCount = announcements.filter((a) => a.status === "ARCHIVED").length;

  // Handle Create / Edit Submit
  const handleFormSubmit = async (payload) => {
    try {
      setActionLoading(true);
      setError("");
      if (editingAnnouncement) {
        const updated = await announcementApi.updateAnnouncement(
          editingAnnouncement.id,
          payload
        );
        showSuccess(`Announcement "${updated.title}" updated successfully.`);
      } else {
        const created = await announcementApi.createAnnouncement(payload);
        showSuccess(`Announcement "${created.title}" created as DRAFT.`);
      }
      setIsFormModalOpen(false);
      setEditingAnnouncement(null);
      loadAnnouncements();
    } catch (err) {
      setError(err.message || "Failed to save announcement.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Publish
  const handlePublish = async (id) => {
    try {
      setActionLoading(true);
      setError("");
      const updated = await announcementApi.publishAnnouncement(id);
      showSuccess(`Announcement "${updated.title}" is now PUBLISHED.`);
      if (selectedAnnouncement?.id === id) {
        setSelectedAnnouncement(updated);
      }
      loadAnnouncements();
    } catch (err) {
      setError(err.message || "Failed to publish announcement.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Archive
  const handleArchive = async (id) => {
    try {
      setActionLoading(true);
      setError("");
      const updated = await announcementApi.archiveAnnouncement(id);
      showSuccess(`Announcement "${updated.title}" has been ARCHIVED.`);
      if (selectedAnnouncement?.id === id) {
        setSelectedAnnouncement(updated);
      }
      loadAnnouncements();
    } catch (err) {
      setError(err.message || "Failed to archive announcement.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setActionLoading(true);
      setError("");
      await announcementApi.deleteAnnouncement(deleteTargetId);
      showSuccess("Announcement deleted successfully.");
      if (selectedAnnouncement?.id === deleteTargetId) {
        setSelectedAnnouncement(null);
      }
      setDeleteTargetId(null);
      loadAnnouncements();
    } catch (err) {
      setError(err.message || "Failed to delete announcement.");
    } finally {
      setActionLoading(false);
    }
  };

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

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "DRAFT":
        return "badge badge-status-draft";
      case "PUBLISHED":
        return "badge badge-status-published";
      case "ARCHIVED":
        return "badge badge-status-archived";
      default:
        return "badge";
    }
  };

  return (
    <div className="page-container hr-announcements-page">
      {/* Header with Create Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <SectionHeader title="Announcements Management" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingAnnouncement(null);
            setIsFormModalOpen(true);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <PlusIcon size={16} />
          <span>Create Announcement</span>
        </button>
      </div>

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
          label="Total Announcements"
          color="blue"
        />
        <StatCard
          icon={ClockIcon}
          number={draftCount}
          loading={loading}
          label="Drafts"
          color="amber"
        />
        <StatCard
          icon={CheckCircleIcon}
          number={publishedCount}
          loading={loading}
          label="Published"
          color="green"
        />
        <StatCard
          icon={ClockIcon}
          number={archivedCount}
          loading={loading}
          label="Archived"
          color="purple"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadAnnouncements} />}

      {successMsg && (
        <div className="announcement-success-alert">
          <CheckCircleIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="table-card">
        {/* Filter and Search Bar */}
        <div
          className="table-header-bar"
          style={{ flexWrap: "wrap", gap: "12px" }}
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
                placeholder="Search title, description..."
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
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: "auto", padding: "6px 12px", fontSize: "12.5px" }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>

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

        {/* Announcements Table */}
        {loading ? (
          <LoadingState message="Loading announcements..." />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={AnnouncementsIcon}
            title="No announcements found"
            description={
              search || statusFilter || categoryFilter || priorityFilter
                ? "No announcements match your search and filter criteria."
                : "There are currently no announcements in the system."
            }
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingAnnouncement(null);
                  setIsFormModalOpen(true);
                }}
              >
                Create First Announcement
              </button>
            }
          />
        ) : (
          <div className="table-responsive-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "45px" }}>#</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Expires</th>
                  <th style={{ textAlign: "right", minWidth: "220px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((item) => {
                  const isExpired =
                    item.expires_at &&
                    new Date(item.expires_at).getTime() <= Date.now();

                  return (
                    <tr key={item.id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontWeight: "600",
                          fontSize: "12px",
                        }}
                      >
                        #{item.id}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span
                            className="announcement-table-title"
                            style={{
                              fontWeight: "600",
                              color: "var(--text-heading)",
                              cursor: "pointer",
                            }}
                            onClick={() => setSelectedAnnouncement(item)}
                            title="Click to view details"
                          >
                            {item.title}
                          </span>
                          <span
                            className="announcement-table-desc"
                            style={{
                              fontSize: "12px",
                              color: "var(--text-muted)",
                              maxWidth: "320px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.description}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={getCategoryBadgeClass(item.category)}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <span className={getPriorityBadgeClass(item.priority)}>
                          {item.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span className={getStatusBadgeClass(item.status)}>
                            {item.status}
                          </span>
                          {isExpired && (
                            <span className="badge badge-expired">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {formatDate(item.published_at)}
                      </td>
                      <td className={`announcement-date-cell ${isExpired ? "is-expired" : ""}`} style={{ fontSize: "12.5px" }}>
                        {formatDate(item.expires_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {/* View details */}
                          <button
                            type="button"
                            className="table-action-btn btn-view"
                            onClick={() => setSelectedAnnouncement(item)}
                            title="View Announcement Details"
                          >
                            View
                          </button>

                          {/* Publish button if DRAFT */}
                          {item.status === "DRAFT" && (
                            <button
                              type="button"
                              className="table-action-btn btn-publish"
                              onClick={() => handlePublish(item.id)}
                              disabled={actionLoading}
                              title="Publish Announcement"
                            >
                              <CheckCircleIcon size={13} />
                              <span>Publish</span>
                            </button>
                          )}

                          {/* Archive button if PUBLISHED */}
                          {item.status === "PUBLISHED" && (
                            <button
                              type="button"
                              className="table-action-btn btn-archive"
                              onClick={() => handleArchive(item.id)}
                              disabled={actionLoading}
                              title="Archive Announcement"
                            >
                              <ClockIcon size={13} />
                              <span>Archive</span>
                            </button>
                          )}

                          {/* Edit button if not ARCHIVED */}
                          {item.status !== "ARCHIVED" && (
                            <button
                              type="button"
                              className="table-action-btn btn-view btn-edit"
                              onClick={() => {
                                setEditingAnnouncement(item);
                                setIsFormModalOpen(true);
                              }}
                              disabled={actionLoading}
                              title="Edit Announcement"
                            >
                              <EditIcon size={13} />
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            className="table-action-btn btn-delete"
                            onClick={() => setDeleteTargetId(item.id)}
                            disabled={actionLoading}
                            title="Delete Announcement"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Announcement Details Modal */}
      {selectedAnnouncement && (
        <AnnouncementDetails
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          isHR={true}
          onEdit={(ann) => {
            setSelectedAnnouncement(null);
            setEditingAnnouncement(ann);
            setIsFormModalOpen(true);
          }}
          onPublish={handlePublish}
          onArchive={handleArchive}
          onDelete={(id) => {
            setDeleteTargetId(id);
          }}
          actionLoading={actionLoading}
        />
      )}

      {/* Create / Edit Form Modal */}
      <AnnouncementFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingAnnouncement(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingAnnouncement}
        isSubmitting={actionLoading}
      />

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="modal-overlay" onClick={() => !actionLoading && setDeleteTargetId(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--danger, #ef4444)" }}>
                Delete Announcement
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-main)" }}>
                Are you sure you want to permanently delete announcement{" "}
                <strong>#{deleteTargetId}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTargetId(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
