import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  MoonIcon,
  SunIcon,
  NotificationsIcon,
  ChevronDown,
  UserIcon,
  SignOutIcon,
  MenuIcon,
} from "../icons/Icons";

export default function Header({ onToggleMobileMenu }) {
  const { user, profile, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.full_name || (role === "hr" ? "HR Admin" : "Employee");

  const initial = (fullName.charAt(0) || "U").toUpperCase();

  const profileLink = role === "hr" ? "/hr/profile" : "/employee/profile";

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          title="Toggle navigation menu"
          aria-label="Toggle navigation menu"
        >
          <MenuIcon size={24} />
        </button>
      </div>

      <div className="header-actions">
        {/* Dark / Light Mode Toggle */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          <span>{isDark ? "Light" : "Dark"}</span>
        </button>

        {/* Notification Bell with red dot */}
        <button className="notification-bell-btn" title="Notifications" aria-label="Notifications">
          <NotificationsIcon size={18} />
          <span className="notification-dot" />
        </button>

        {/* User Profile Widget */}
        <div className="user-profile-widget" ref={dropdownRef}>
          <button
            className="user-profile-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
          >
            <div className="header-avatar-wrap">
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={fullName}
                  className="user-avatar-circle"
                />
              ) : (
                <div className="user-avatar-circle">{initial}</div>
              )}
              <span className="online-indicator header-online-indicator" aria-label="Online" />
            </div>

            <div className="user-info-text">
              <span className="user-name-line">{fullName}</span>
              <span className="user-role-badge">
                {role === "hr" ? "HR" : "EMPLOYEE"}
              </span>
            </div>

            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <div className="profile-dropdown-menu">
              <Link
                to={profileLink}
                className="dropdown-item"
                onClick={() => setMenuOpen(false)}
              >
                <UserIcon size={16} />
                <span>My Profile</span>
              </Link>
              <button
                className="dropdown-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                <SignOutIcon size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
