import { useEffect, useCallback } from "react";
import { CloseIcon } from "../icons/Icons";

export default function ProfilePhotoViewer({ isOpen, onClose, photoUrl, userName }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const initial = (userName?.charAt(0) || "U").toUpperCase();

  return (
    <div
      className="photo-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full-size Profile Photo Viewer"
    >
      <div
        className="photo-lightbox-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="photo-lightbox-close-btn"
          onClick={onClose}
          aria-label="Close photo viewer"
          title="Close (Esc)"
        >
          <CloseIcon size={20} />
        </button>

        <div className="photo-lightbox-content">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={userName ? `${userName}'s profile photo` : "Profile photo"}
              className="photo-lightbox-img"
            />
          ) : (
            <div className="photo-lightbox-placeholder">
              <span>{initial}</span>
            </div>
          )}
        </div>

        {userName && (
          <div className="photo-lightbox-footer">
            <span className="photo-lightbox-name">{userName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
