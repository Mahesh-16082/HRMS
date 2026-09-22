import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LogoIcon,
  DashboardIcon,
  DashboardGridIcon,
  UserIcon,
  PerformanceIcon,
  ProjectsIcon,
  ProjectRolesIcon,
  AnnouncementsIcon,
  WorkReportsIcon,
  ComplaintsIcon,
  AttendanceIcon,
  LeaveRequestsIcon,
  LeaveTypesIcon,
  LeaveBalancesIcon,
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
    { label: "Dashboard", to: "/hr-dashboard", icon: DashboardIcon, functional: true },
    { label: "Employees", to: "/hr/employees", icon: UsersIcon, functional: true },
    { label: "Performance", to: "#", icon: PerformanceIcon, functional: false },
    { label: "Projects", to: "/hr/projects", icon: ProjectsIcon, functional: true },
    { label: "Project Roles", to: "#", icon: ProjectRolesIcon, functional: false },
    { label: "Announcements", to: "#", icon: AnnouncementsIcon, functional: false },
    { label: "Work Reports", to: "#", icon: WorkReportsIcon, functional: false },
    { label: "Complaints", to: "#", icon: ComplaintsIcon, functional: false },
    { label: "Attendance", to: "/hr/attendance", icon: AttendanceIcon, functional: true },
    { label: "Leave Requests", to: "/hr/leave-requests", icon: LeaveRequestsIcon, functional: true },
    { label: "Leave Types", to: "/hr/leave-types", icon: LeaveTypesIcon, functional: true },
    { label: "Leave Balances", to: "/hr/leave-balances", icon: LeaveBalancesIcon, functional: true },
    { label: "Audit Logs", to: "#", icon: AuditLogsIcon, functional: false },
    { label: "Notifications", to: "#", icon: NotificationsIcon, functional: false },
  ];

  const employeeNavItems = [
    { label: "Dashboard", to: "/employee-dashboard", icon: DashboardGridIcon, functional: true },
    { label: "My Profile", to: "/employee/profile", icon: UserIcon, functional: true },
    { label: "My Performance", to: "#", icon: PerformanceIcon, functional: false },
    { label: "My Projects", to: "/employee/projects", icon: ProjectsIcon, functional: true },
    { label: "Announcements", to: "#", icon: AnnouncementsIcon, functional: false },
    { label: "Work Reports", to: "#", icon: WorkReportsIcon, functional: false },
    { label: "Complaints", to: "#", icon: ComplaintsIcon, functional: false },
    { label: "Attendance", to: "/employee/attendance", icon: AttendanceIcon, functional: true },
    { label: "Apply for Leave", to: "/employee/apply-leave", icon: LeaveRequestsIcon, functional: true },
    { label: "Notifications", to: "#", icon: NotificationsIcon, functional: false },
  ];

  const items = isHR ? hrNavItems : employeeNavItems;

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand-group">
          <LogoIcon size={36} />
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">HRMS</span>
              <span className="sidebar-brand-subtitle">Enterprise Portal</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="sidebar-collapse-toggle-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!isHR && !isCollapsed && <div className="sidebar-section-label">MAIN MENU</div>}

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
                {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
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
              end={item.to === "/hr-dashboard" || item.to === "/employee-dashboard"}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sign-out-btn"
          onClick={logout}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <SignOutIcon size={18} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
