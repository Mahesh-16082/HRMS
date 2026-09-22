export function LoadingState({ message = "Loading data..." }) {
  return (
    <div className="loading-state-wrap">
      <div className="spinner" />
      <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>
        {message}
      </span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title = "No records found",
  description = "There are currently no items to display.",
  action,
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={26} />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && <div style={{ marginTop: "8px" }}>{action}</div>}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" style={{ marginBottom: "16px" }}>
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary btn-sm"
          style={{ padding: "4px 8px", fontSize: "11px" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
