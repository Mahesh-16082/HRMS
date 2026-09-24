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
  ArrowRight,
} from "../../components/icons/Icons";
import {
  LoadingState,
  EmptyState,
  ErrorAlert,
} from "../../components/common/FeedbackStates";
import "../../styles/notifications.css";

export default function NotificationsPage({ role = "employee" }) {
  const navigate = useNavigate();
  const {
    unreadCount,
    fetchUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
  } = useNotification();

  const [notifications, setNotifications] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "unread" | "read"
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = { limit: 100 };
      if (filter === "unread") params.is_read = false;
      if (filter === "read") params.is_read = true;

      const data = await notificationApi.getNotifications(params);
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);
      setTotalCount(data?.total ?? list.length);

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
  }, [filter, fetchUnreadCount]);

  useEffect(() => {
    let ignore = false;
    const params = { limit: 100 };
    if (filter === "unread") params.is_read = false;
    if (filter === "read") params.is_read = true;

    notificationApi
      .getNotifications(params)
      .then((data) => {
        if (ignore) return;
        const list = Array.isArray(data?.notifications) ? data.notifications : [];
        setNotifications(list);
        setTotalCount(data?.total ?? list.length);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        const errMsg =
          typeof err?.data?.detail === "string"
            ? err.data.detail
            : err.message || "Failed to load notifications.";
        setError(errMsg);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filter]);

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

  // Confirm and execute single notification delete
  const confirmDelete = async () => {
    if (!deleteTargetId || actionLoading) return;

    const targetItem = notifications.find((n) => n.id === deleteTargetId);
    const wasUnread = targetItem ? !targetItem.is_read : false;

    try {
      setActionLoading(true);
      await notificationApi.deleteNotification(deleteTargetId);

      // Remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== deleteTargetId));
      setTotalCount((prev) => Math.max(0, prev - 1));

      if (wasUnread) {
        decrementUnreadCount(1);
      }
      setDeleteTargetId(null);
    } catch (err) {
      const errMsg =
        typeof err?.data?.detail === "string"
          ? err.data.detail
          : err.message || "Failed to delete notification.";
      setError(errMsg);
    } finally {
      setActionLoading(false);
    }
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

      {/* Filter Bar */}
      <div className="notifications-filter-bar">
        <div className="notifications-filter-pills">
          <button
            type="button"
            className={`filter-pill-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
            <span className="filter-pill-count">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Unread
            {unreadCount > 0 && (
              <span className="filter-pill-count">{unreadCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${filter === "read" ? "active" : ""}`}
            onClick={() => setFilter("read")}
          >
            Read
          </button>
        </div>

        <div className="notifications-count-summary">
          Showing {notifications.length} of {totalCount} notifications
        </div>
      </div>

      {/* Notification List / Loading / Empty State */}
      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={NotificationsIcon}
          title="No notifications"
          description={
            filter === "unread"
              ? "You have no unread notifications."
              : filter === "read"
              ? "You have no read notifications."
              : "You're all caught up! No notifications have arrived yet."
          }
        />
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => {
            const meta = getNotificationMeta(item.notification_type);
            const Icon = meta.icon;
            const targetRoute = resolveNavigationTarget(item, role);

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

                    {targetRoute && (
                      <span className="notification-nav-cue">
                        <span>View details</span>
                        <ArrowRight size={12} />
                      </span>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(item.id);
                    }}
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom HRMS Delete Confirmation Modal */}
      {deleteTargetId && (
        <div
          className="modal-overlay"
          onClick={() => !actionLoading && setDeleteTargetId(null)}
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
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
