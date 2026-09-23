import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAuthToken } from "../../api/apiClient";

export default function PublicAuthRoute({ children }) {
  const { token, role, loading, isInitializing, user } = useAuth();
  const storedToken = getAuthToken();

  // While checking authentication for an existing stored session, show lightweight loading state
  if (isInitializing || (storedToken && loading)) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #eef2ff 0%, #fdf2f8 50%, #f0fdf4 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid #e2e8f0",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>Loading session...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const effectiveToken = token || storedToken;
  const verifiedRole = user?.role || role;

  // If already authenticated with a verified role, redirect to the appropriate dashboard
  if (effectiveToken && user && verifiedRole) {
    if (verifiedRole === "hr") {
      return <Navigate to="/hr/dashboard" replace />;
    } else {
      return <Navigate to="/employee/dashboard" replace />;
    }
  }

  // Not authenticated: allow the public page to render
  return children;
}
