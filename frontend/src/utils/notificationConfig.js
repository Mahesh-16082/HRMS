import {
  LeaveRequestsIcon,
  ComplaintsIcon,
  ProjectsIcon,
  ProjectRolesIcon,
  AnnouncementsIcon,
  PerformanceIcon,
  WorkReportsIcon,
  AttendanceIcon,
  NotificationsIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from "../components/icons/Icons";

/**
 * Metadata configuration for backend NotificationType enum values.
 */
export const NOTIFICATION_CONFIG = {
  LEAVE_REQUEST_SUBMITTED: {
    category: "Leave",
    badgeLabel: "Leave Request",
    variant: "amber",
    icon: LeaveRequestsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/leave-requests" : "/employee/apply-leave"),
  },
  LEAVE_REQUEST_APPROVED: {
    category: "Leave",
    badgeLabel: "Leave Approved",
    variant: "green",
    icon: CheckCircleIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/leave-requests" : "/employee/apply-leave"),
  },
  LEAVE_REQUEST_REJECTED: {
    category: "Leave",
    badgeLabel: "Leave Rejected",
    variant: "red",
    icon: AlertCircleIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/leave-requests" : "/employee/apply-leave"),
  },
  LEAVE_REQUEST_REVOKED: {
    category: "Leave",
    badgeLabel: "Leave Revoked",
    variant: "amber",
    icon: ClockIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/leave-requests" : "/employee/apply-leave"),
  },
  COMPLAINT_SUBMITTED: {
    category: "Complaint",
    badgeLabel: "Complaint Submitted",
    variant: "amber",
    icon: ComplaintsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/complaints" : "/employee/complaints"),
  },
  COMPLAINT_UPDATED: {
    category: "Complaint",
    badgeLabel: "Complaint Updated",
    variant: "blue",
    icon: ComplaintsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/complaints" : "/employee/complaints"),
  },
  COMPLAINT_RESOLVED: {
    category: "Complaint",
    badgeLabel: "Complaint Resolved",
    variant: "green",
    icon: CheckCircleIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/complaints" : "/employee/complaints"),
  },
  PROJECT_ASSIGNED: {
    category: "Project",
    badgeLabel: "Project Assigned",
    variant: "blue",
    icon: ProjectsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/projects" : "/employee/projects"),
  },
  PROJECT_ROLE_ASSIGNED: {
    category: "Project Role",
    badgeLabel: "Project Role",
    variant: "purple",
    icon: ProjectRolesIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/project-roles" : "/employee/projects"),
  },
  ANNOUNCEMENT_PUBLISHED: {
    category: "Announcement",
    badgeLabel: "Announcement",
    variant: "blue",
    icon: AnnouncementsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/announcements" : "/employee/announcements"),
  },
  PERFORMANCE_REVIEW_COMPLETED: {
    category: "Performance",
    badgeLabel: "Performance Review",
    variant: "purple",
    icon: PerformanceIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/performance" : "/employee/performance"),
  },
  WORK_REPORT_SUBMITTED: {
    category: "Work Report",
    badgeLabel: "Work Report Submitted",
    variant: "amber",
    icon: WorkReportsIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/work-reports" : "/employee/work-reports"),
  },
  WORK_REPORT_APPROVED: {
    category: "Work Report",
    badgeLabel: "Report Approved",
    variant: "green",
    icon: CheckCircleIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/work-reports" : "/employee/work-reports"),
  },
  WORK_REPORT_REJECTED: {
    category: "Work Report",
    badgeLabel: "Report Rejected",
    variant: "red",
    icon: AlertCircleIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/work-reports" : "/employee/work-reports"),
  },
  ATTENDANCE_RELATED: {
    category: "Attendance",
    badgeLabel: "Attendance",
    variant: "blue",
    icon: AttendanceIcon,
    getTargetRoute: (role) => (role === "hr" ? "/hr/attendance" : "/employee/attendance"),
  },
  GENERAL: {
    category: "General",
    badgeLabel: "General Notification",
    variant: "neutral",
    icon: NotificationsIcon,
    getTargetRoute: () => null,
  },
};

const DEFAULT_CONFIG = {
  category: "Notification",
  badgeLabel: "Update",
  variant: "neutral",
  icon: NotificationsIcon,
  getTargetRoute: () => null,
};

/**
 * Returns configuration metadata for a given notification type.
 */
export function getNotificationMeta(notificationType) {
  if (!notificationType || !NOTIFICATION_CONFIG[notificationType]) {
    return DEFAULT_CONFIG;
  }
  return NOTIFICATION_CONFIG[notificationType];
}

/**
 * Safe navigation target resolver based on notification data and role.
 */
export function resolveNavigationTarget(notification, role) {
  if (!notification) return null;
  const meta = getNotificationMeta(notification.notification_type);
  if (typeof meta.getTargetRoute === "function") {
    return meta.getTargetRoute(role);
  }
  return null;
}

/**
 * Returns formatted relative time string (e.g., "Just now", "5m ago", "2h ago", "Yesterday").
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) {
    return "Just now";
  }
  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  // Format as readable date e.g. "Oct 24, 2026"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
