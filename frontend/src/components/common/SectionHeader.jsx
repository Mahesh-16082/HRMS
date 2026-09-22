import { Link } from "react-router-dom";
import { ArrowRight } from "../icons/Icons";

export default function SectionHeader({
  title,
  actionText,
  actionTo,
  onActionClick,
}) {
  return (
    <div className="section-header-row">
      <div className="section-header-title-group">
        <div className="section-accent-bar" />
        <h2 className="section-title">{title}</h2>
      </div>

      {actionText && (
        actionTo ? (
          <Link to={actionTo} className="section-link-btn">
            <span>{actionText}</span>
            <ArrowRight size={14} />
          </Link>
        ) : (
          <button
            onClick={onActionClick}
            className="section-link-btn"
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span>{actionText}</span>
            <ArrowRight size={14} />
          </button>
        )
      )}
    </div>
  );
}
