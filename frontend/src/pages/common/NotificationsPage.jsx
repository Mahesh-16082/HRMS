import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notificationApi } from "../../api/notificationApi";
import { useNotification } from "../../context/useNotification";
import {
  getNotificationMeta,
  resolveNavigationTarget,
  formatRelativeTime,
} from "../../utils/notificationConfig";
import {
  NotificationsIcon,
  CheckCircleIcon,
  TrashIcon,
  ClockIcon,
} from "../../components/icons/Icons";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import "../../styles/notifications.css";

const HR_TABS = [
  { id: "all", label: "All" },
  { id: "work_reports", label: "Work Reports", categoryKey: "WORK_REPORTS" },
  { id: "complaints", label: "Complaints", categoryKey: "COMPLAINTS" },
  { id: "leave_requests", label: "Leave Requests", categoryKey: "LEAVE_REQUESTS" },
];

const EMPLOYEE_TABS = [
  { id: "all", label: "All" },
  { id: "work_reports", label: "Work Reports", categoryKey: "WORK_REPORTS" },
  { id: "complaints", label: "Complaints", categoryKey: "COMPLAINTS" },
  { id: "leave_requests", label: "Leave Requests", categoryKey: "LEAVE_REQUESTS" },
  { id: "announcements", label: "Announcements", categoryKey: "ANNOUNCEMENTS" },
  { id: "projects", label: "Projects", categoryKey: "PROJECTS" },
];

function getNotificationCategory(item, role) {
  const type = item?.notification_type || "";
  const refType = item?.reference_type || "";

  // 1. Work Reports
  if (
    type === "WORK_REPORT_SUBMITTED" ||
    type === "WORK_REPORT_APPROVED" ||
    type === "WORK_REPORT_REJECTED" ||
    type.startsWith("WORK_REPORT_") ||
    refType === "work_report"
  ) {
    return "WORK_REPORTS";
  }

  // 2. Complaints
  if (
    type === "COMPLAINT_SUBMITTED" ||
    type === "COMPLAINT_UPDATED" ||
    type === "COMPLAINT_RESOLVED" ||
    type.startsWith("COMPLAINT_") ||
    refType === "complaint"
  ) {
    return "COMPLAINTS";
  }

  // 3. Leave Requests
  if (
    type === "LEAVE_REQUEST_SUBMITTED" ||
    type === "LEAVE_REQUEST_APPROVED" ||
    type === "LEAVE_REQUEST_REJECTED" ||
    type === "LEAVE_REQUEST_REVOKED" ||
    type.startsWith("LEAVE_REQUEST_") ||
    refType === "leave"
  ) {
    return "LEAVE_REQUESTS";
  }

  // 4. Announcements (only for Employee role)
  if (
    role === "employee" &&
    (type === "ANNOUNCEMENT_PUBLISHED" ||
      type.startsWith("ANNOUNCEMENT_") ||
      refType === "announcement")
  ) {
    return "ANNOUNCEMENTS";
  }

  // 5. Projects (only for Employee role)
  if (
    role === "employee" &&
    (type === "PROJECT_ASSIGNED" ||
      type === "PROJECT_ROLE_ASSIGNED" ||
      type.startsWith("PROJECT_") ||
      refType === "project" ||
      refType === "project_role")
  ) {
    return "PROJECTS";
  }

  return null;
}

export default function NotificationsPage({ role = "employee" }) {
  const navigate = useNavigate();
  const {
    unreadCount,
    fetchUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
  } = useNotification();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = { limit: 100 };
      const data = await notificationApi.getNotifications(params);
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);

      // Keep unread count synchronized
      fetchUnreadCount();
    } catch (err) {
      const errMsg =
        typeof err?.data?.detail === "string"
          ? err.data.detail
          : err.message || "Failed to load notifications.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [fetchUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark a single notification as read
  const handleMarkAsRead = async (notification, e) => {
    if (e) e.stopPropagation();
    if (notification.is_read) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    );
    decrementUnreadCount(1);

    try {
      await notificationApi.markNotificationAsRead(notification.id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      // Revert if request failed
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: false } : n
        )
      );
      fetchUnreadCount();
    }
  };

  // Card click: mark as read and navigate if destination exists
  const handleCardClick = async (notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification);
    }

    const targetRoute = resolveNavigationTarget(notification, role);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (actionLoading || unreadCount === 0) return;

    try {
      setActionLoading(true);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      resetUnreadCount();

      await notificationApi.markAllNotificationsAsRead();
    } catch (err) {
      const errMsg =
        typeof err?.data?.detail === "string"
          ? err.data.detail
          : err.message || "Failed to mark all notifications as read.";
      setError(errMsg);
      // Reload on failure to restore accurate state
      loadNotifications();
    } finally {
      setActionLoading(false);
    }
  };

  // Modal open/close handlers
  const openDeleteModal = (notificationId, e) => {
    if (e) e.stopPropagation();
    setDeleteTargetId(notificationId);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteTargetId(null);
    setDeleteError("");
  };

  // Confirm and execute single notification delete
  const confirmDelete = async () => {
    if (!deleteTargetId || deleteLoading) return;

    const targetId = deleteTargetId;
    const targetItem = notifications.find((n) => n.id === targetId);
    const wasUnread = targetItem ? !targetItem.is_read : false;

    try {
      setDeleteLoading(true);
      setDeleteError("");
      await notificationApi.deleteNotification(targetId);

      // Remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== targetId));

      if (wasUnread) {
        decrementUnreadCount(1);
      }

      // Close modal and reset all delete state on success
      setDeleteTargetId(null);
      setDeleteError("");
    } catch (err) {
      const errMsg =
        typeof err?.data?.detail === "string"
          ? err.data.detail
          : err.message || "Failed to delete notification.";
      setDeleteError(errMsg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter notifications belonging to the user's role categories
  const roleValidNotifications = notifications.filter(
    (n) => getNotificationCategory(n, role) !== null
  );

  const tabs = role === "hr" ? HR_TABS : EMPLOYEE_TABS;

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  const displayedNotifications =
    activeTab === "all"
      ? roleValidNotifications
      : roleValidNotifications.filter(
          (n) => getNotificationCategory(n, role) === currentTab.categoryKey
        );

  const getTabCount = (tab) => {
    if (tab.id === "all") {
      return roleValidNotifications.length;
    }
    return roleValidNotifications.filter(
      (n) => getNotificationCategory(n, role) === tab.categoryKey
    ).length;
  };

  const renderNotificationCard = (item) => {
    const meta = getNotificationMeta(item.notification_type);
    const Icon = meta.icon;

    return (
      <div
        key={item.id}
        className={`notification-card ${
          item.is_read ? "read" : "unread"
        }`}
        onClick={() => handleCardClick(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(item);
          }
        }}
      >
        {/* Icon Wrap */}
        <div className={`notification-icon-wrap ${meta.variant}`}>
          <Icon size={20} />
        </div>

        {/* Content */}
        <div className="notification-content">
          <div className="notification-content-header">
            <h3 className="notification-card-title">{item.title}</h3>
            <span
              className={`notification-badge-category ${meta.variant}`}
            >
              {meta.badgeLabel}
            </span>
          </div>

          <p className="notification-card-message">{item.message}</p>

          <div className="notification-meta-row">
            <span className="notification-time-tag">
              <ClockIcon size={13} />
              {formatRelativeTime(item.created_at)}
            </span>

            {!item.is_read && (
              <span
                className="notification-unread-dot"
                title="Unread notification"
              />
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div
          className="notification-card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {!item.is_read && (
            <button
              type="button"
              className="notification-action-btn mark-read-btn"
              onClick={(e) => handleMarkAsRead(item, e)}
              title="Mark as read"
              aria-label="Mark as read"
            >
              <CheckCircleIcon size={16} />
            </button>
          )}

          <button
            type="button"
            className="notification-action-btn delete-btn"
            onClick={(e) => openDeleteModal(item.id, e)}
            title="Delete notification"
            aria-label="Delete notification"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="notifications-page-container">
      {/* Header */}
      <div className="notifications-header">
        <div className="notifications-title-group">
          <div className="notifications-title-row">
            <h1 className="notifications-title">Notifications</h1>
            {unreadCount > 0 && (
              <span className="notifications-unread-pill">
                <span className="notification-unread-dot" />
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="notifications-subtitle">
            Stay updated with important HRMS activities and status updates.
          </p>
        </div>

        <div className="notifications-header-actions">
          <button
            type="button"
            className="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
            disabled={actionLoading || unreadCount === 0}
            title={
              unreadCount === 0
                ? "No unread notifications"
                : "Mark all notifications as read"
            }
          >
            <CheckCircleIcon size={15} />
            <span>Mark all as read</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && <ErrorAlert message={error} onRetry={loadNotifications} />}

      {/* Category Filter Bar */}
      <div className="notifications-filter-bar">
        <div className="notifications-filter-pills">
          {tabs.map((tab) => {
            const count = getTabCount(tab);
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={`filter-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="filter-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="notifications-count-summary">
          Showing {displayedNotifications.length} of {roleValidNotifications.length} notifications
        </div>
      </div>

      {/* Notification List / Loading / Empty State */}
      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : displayedNotifications.length === 0 ? (
        <EmptyState
          icon={NotificationsIcon}
          title="No notifications"
          description={
            activeTab === "all"
              ? "You're all caught up! No notifications have arrived yet."
              : `No ${currentTab.label.toLowerCase()} notifications found.`
          }
        />
      ) : (
        <div className="notifications-list">
          {displayedNotifications.map((item) => renderNotificationCard(item))}
        </div>
      )}

      {/* Custom HRMS Delete Confirmation Modal */}
      {deleteTargetId && (
        <div
          className="modal-overlay"
          onClick={closeDeleteModal}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modal-header">
              <h3
                className="modal-title"
                style={{ color: "var(--danger, #ef4444)" }}
              >
                Delete Notification
              </h3>
            </div>
            <div className="modal-body">
              {deleteError && (
                <div
                  className="delete-modal-error"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid var(--danger, #ef4444)",
                    color: "var(--danger, #ef4444)",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    marginBottom: "12px",
                  }}
                >
                  {deleteError}
                </div>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--text-main)",
                }}
              >
                Are you sure you want to remove this notification? This action
                cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
