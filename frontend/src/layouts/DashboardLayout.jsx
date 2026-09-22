import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Header from "../components/common/Header";
import "../styles/dashboard.css";
import "../styles/forms.css";

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("hrms_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileMenuOpen]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hrms_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="app-layout">
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sticky / Fixed Sidebar */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main Content Area */}
      <div className={`main-wrapper ${isCollapsed ? "sidebar-collapsed" : ""}`}>
        <Header onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />
        <Outlet />
      </div>
    </div>
  );
}
