export default function StatCard({
  icon: Icon,
  number,
  label,
  color = "blue",
  loading = false,
  onClick,
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`stat-card ${color} ${isClickable ? "clickable" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="stat-icon-circle">
        <Icon size={24} />
      </div>
      <div className="stat-info">
        <span className="stat-number">
          {loading ? "..." : number !== undefined && number !== null ? number : "—"}
        </span>
        <span className="stat-label">{label}</span>
        <div className="stat-accent-bar" />
      </div>
    </div>
  );
}
