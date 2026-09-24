import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/useNotification";
import {
  LogoIcon,
  DashboardIcon,
  DashboardGridIcon,
  UserIcon,
  PerformanceIcon,
  ProjectsIcon,
  AnnouncementsIcon,
  WorkReportsIcon,
  ComplaintsIcon,
  AttendanceIcon,
  LeaveRequestsIcon,
  AuditLogsIcon,
  NotificationsIcon,
  UsersIcon,
  SignOutIcon,
  ChevronLeft,
  ChevronRight,
} from "../icons/Icons";

export default function Sidebar({
  isOpen,
  onCloseMobileMenu,
  isCollapsed,
  onToggleCollapse,
}) {
  const { role, logout } = useAuth();
  const { unreadCount } = useNotification();

  const isHR = role === "hr";

  const handleItemClick = (disabled, e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  const hrNavItems = [
    { label: "Dashboard", to: "/hr/dashboard", icon: DashboardIcon, functional: true },
    { label: "Employees", to: "/hr/employees", icon: UsersIcon, functional: true },
    { label: "Performance", to: "/hr/performance", icon: PerformanceIcon, functional: true },
    { label: "Projects", to: "/hr/projects", icon: ProjectsIcon, functional: true },
    { label: "Announcements", to: "/hr/announcements", icon: AnnouncementsIcon, functional: true },
    { label: "Work Reports", to: "/hr/work-reports", icon: WorkReportsIcon, functional: true },
    { label: "Complaints", to: "/hr/complaints", icon: ComplaintsIcon, functional: true },
    { label: "Attendance", to: "/hr/attendance", icon: AttendanceIcon, functional: true },
    { label: "Leave Requests", to: "/hr/leave-requests", icon: LeaveRequestsIcon, functional: true },
    { label: "Audit Logs", to: "/hr/audit-logs", icon: AuditLogsIcon, functional: true },
    { label: "Notifications", to: "/hr/notifications", icon: NotificationsIcon, functional: true },
  ];

  const employeeNavItems = [
    { label: "Dashboard", to: "/employee/dashboard", icon: DashboardGridIcon, functional: true },
    { label: "My Profile", to: "/employee/profile", icon: UserIcon, functional: true },
    { label: "My Performance", to: "/employee/performance", icon: PerformanceIcon, functional: true },
    { label: "My Projects", to: "/employee/projects", icon: ProjectsIcon, functional: true },
    { label: "Announcements", to: "/employee/announcements", icon: AnnouncementsIcon, functional: true },
    { label: "Work Reports", to: "/employee/work-reports", icon: WorkReportsIcon, functional: true },
    { label: "Complaints", to: "/employee/complaints", icon: ComplaintsIcon, functional: true },
    { label: "Attendance", to: "/employee/attendance", icon: AttendanceIcon, functional: true },
    { label: "Apply for Leave", to: "/employee/apply-leave", icon: LeaveRequestsIcon, functional: true },
    { label: "Notifications", to: "/employee/notifications", icon: NotificationsIcon, functional: true },
  ];

  const items = isHR ? hrNavItems : employeeNavItems;
  const showFullContent = !isCollapsed || isOpen;

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand-group">
          <LogoIcon size={36} />
          {showFullContent && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">HRMS</span>
              <span className="sidebar-brand-subtitle">Enterprise Portal</span>
            </div>
          )}
        </div>

        {/* Desktop collapse toggle button */}
        <button
          type="button"
          className="sidebar-collapse-toggle-btn sidebar-desktop-toggle-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Mobile sidebar collapse/close button */}
        <button
          type="button"
          className="sidebar-collapse-toggle-btn sidebar-mobile-close-btn"
          onClick={onCloseMobileMenu}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {!isHR && showFullContent && <div className="sidebar-section-label">MAIN MENU</div>}

      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          if (!item.functional) {
            return (
              <span
                key={item.label}
                className="sidebar-nav-item disabled"
                title={item.label + " (Coming Soon)"}
                onClick={(e) => handleItemClick(true, e)}
              >
                <Icon size={20} />
                {showFullContent && <span className="nav-item-label">{item.label}</span>}
              </span>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={(e) => handleItemClick(false, e)}
              end={item.to === "/hr/dashboard" || item.to === "/employee/dashboard"}
              title={!showFullContent ? item.label : undefined}
            >
              <Icon size={20} />
              {showFullContent && <span className="nav-item-label">{item.label}</span>}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="sidebar-nav-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sign-out-btn"
          onClick={logout}
          title={!showFullContent ? "Sign Out" : undefined}
        >
          <SignOutIcon size={18} />
          {showFullContent && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
