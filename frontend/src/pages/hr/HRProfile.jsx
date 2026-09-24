import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { employeeApi } from "../../api/employeeApi";
import SectionHeader from "../../components/common/SectionHeader";
import ProfilePhotoViewer from "../../components/common/ProfilePhotoViewer";
import { LoadingState, ErrorAlert } from "../../components/common/FeedbackStates";
import {
  CameraIcon,
  CheckCircleIcon,
  EditIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from "../../components/icons/Icons";

export default function HRProfile() {
  const { profile, user, updateProfileState, refreshProfile } = useAuth();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!profile);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: user?.email || profile.email || "",
        phone: profile.phone || "",
      });
      setInitialLoading(false);
    } else {
      refreshProfile().then((data) => {
        if (data) {
          setFormData({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            email: user?.email || data.email || "",
            phone: data.phone || "",
          });
        }
        setInitialLoading(false);
      });
    }
  }, [profile, user, refreshProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveError("");
    setSaveSuccess("");
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: user?.email || profile?.email || "",
      phone: profile?.phone || "",
    });
    setSaveError("");
    setIsEditing(false);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
      };

      const updated = await employeeApi.updateMyProfile(payload);
      updateProfileState(updated);
      setIsEditing(false);
      setSaveSuccess("Profile details updated successfully.");
    } catch (err) {
      setSaveError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    setPhotoError("");

    try {
      const updated = await employeeApi.uploadProfilePhoto(file);
      updateProfileState(updated);
      setSaveSuccess("Profile photo updated successfully!");
    } catch (err) {
      setPhotoError(err.message || "Failed to upload photo.");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="page-container">
        <LoadingState message="Loading HR administrator profile..." />
      </div>
    );
  }

  const currentPhoto = photoPreview || profile?.profile_photo_url;
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.full_name || "HR Administrator";
  const initial = (fullName.charAt(0) || "H").toUpperCase();

  return (
    <div className="page-container">
      <SectionHeader title="HR Administrator Profile" />

      {saveSuccess && (
        <div className="alert alert-success">
          <CheckCircleIcon size={18} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && <ErrorAlert message={saveError} />}
      {photoError && <ErrorAlert message={photoError} />}

      <div className="profile-layout-container">
        {/* ========================================================
            PROFILE IDENTITY SECTION (Left Panel)
        ======================================================== */}
        <aside className="profile-identity-panel">
          <div className="profile-identity-card">
            {/* Clickable Profile Photo with Viewer Hint */}
            <div className="profile-avatar-wrapper">
              <button
                type="button"
                className="profile-avatar-btn"
                onClick={() => setPhotoViewerOpen(true)}
                title="Click to view full-size photo"
                aria-label="View full-size profile photo"
              >
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt={fullName}
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-fallback">{initial}</div>
                )}
                <div className="profile-avatar-overlay">
                  <span>View</span>
                </div>
              </button>

              {uploadingPhoto && (
                <div className="profile-avatar-uploading">
                  <div className="spinner" style={{ width: "24px", height: "24px", borderWidth: "2.5px" }} />
                </div>
              )}
            </div>

            <div className="profile-meta-info">
              <h2 className="profile-name-text">{fullName}</h2>
              <span className="profile-code-text">
                {profile?.employee_code || "HR Admin"}
              </span>
              <div style={{ marginTop: "6px" }}>
                <span className={`badge badge-${(profile?.employment_status || "ACTIVE").toLowerCase()}`}>
                  {profile?.employment_status || "ACTIVE"}
                </span>
              </div>
            </div>

            {/* Change Photo Action */}
            <div className="profile-photo-control">
              <div className="photo-upload-btn-wrap" style={{ width: "100%" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%" }}
                  disabled={uploadingPhoto}
                >
                  <CameraIcon size={15} />
                  <span>{uploadingPhoto ? "Uploading..." : "Change Photo"}</span>
                </button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="photo-upload-input"
                  disabled={uploadingPhoto}
                  title="Upload profile photo (JPEG, PNG, WebP)"
                />
              </div>
              <span className="photo-upload-hint">
                JPEG, PNG, WebP (Max 5MB)
              </span>
            </div>
          </div>
        </aside>

        {/* ========================================================
            PROFILE DETAILS SECTION (Right Main Content)
        ======================================================== */}
        <main className="profile-details-main">
          <form onSubmit={handleProfileSubmit} className="profile-details-form">
            {/* Section 1: Personal & Contact Details */}
            <section className="profile-form-section">
              <div className="profile-section-header">
                <div className="section-accent-bar" />
                <div style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 className="profile-section-title">Personal &amp; Contact Details</h3>
                    <p className="profile-section-desc">Manage your administrative personal credentials and contact info.</p>
                  </div>
                  {!isEditing && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setIsEditing(true);
                        setSaveSuccess("");
                        setSaveError("");
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <EditIcon size={14} />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    First Name {isEditing && <span style={{ color: "#ef4444" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    readOnly={!isEditing}
                    disabled={!isEditing}
                    required={isEditing}
                    maxLength={100}
                    className={`form-input ${!isEditing ? "readonly" : ""}`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Last Name {isEditing && <span style={{ color: "#ef4444" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    readOnly={!isEditing}
                    disabled={!isEditing}
                    required={isEditing}
                    maxLength={100}
                    className={`form-input ${!isEditing ? "readonly" : ""}`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address
                    <span className="readonly-tag">Read-only</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    readOnly={!isEditing}
                    disabled={!isEditing}
                    maxLength={20}
                    placeholder={isEditing ? "+1 (555) 000-0000" : "—"}
                    className={`form-input ${!isEditing ? "readonly" : ""}`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Employee Code
                    <span className="readonly-tag">System Assigned</span>
                  </label>
                  <input
                    type="text"
                    value={profile?.employee_code || "—"}
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>
              </div>

              {isEditing && (
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>

            {/* Section 2: Organizational Privileges & Governance (Permanently Read-Only) */}
            <section className="profile-form-section">
              <div className="profile-section-header">
                <div className="section-accent-bar" />
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div>
                    <h3 className="profile-section-title">Organizational Privileges &amp; Status</h3>
                    <p className="profile-section-desc">Access rights, active status, and corporate onboarding records.</p>
                  </div>
                  <span className="readonly-tag" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <ShieldIcon size={12} /> Elevated Role
                  </span>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Role Designation
                    <span className="readonly-tag">System Governed</span>
                  </label>
                  <input
                    type="text"
                    value="HR Administrator"
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Employment Status
                    <span className="readonly-tag">HR Governed</span>
                  </label>
                  <input
                    type="text"
                    value={profile?.employment_status || "ACTIVE"}
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Joining Date
                    <span className="readonly-tag">Contract Date</span>
                  </label>
                  <input
                    type="text"
                    value={profile?.joining_date || "—"}
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Administrative Scope</label>
                  <input
                    type="text"
                    value="Full Human Resources Governance, Employee Directory, Project Assignments, & Attendance Records"
                    readOnly
                    disabled
                    className="form-input readonly"
                  />
                </div>
              </div>
            </section>
          </form>
        </main>
      </div>

      {/* ========================================================
          FULL-SIZE PROFILE PHOTO VIEWER MODAL
      ======================================================== */}
      <ProfilePhotoViewer
        isOpen={photoViewerOpen}
        onClose={() => setPhotoViewerOpen(false)}
        photoUrl={currentPhoto}
        userName={fullName}
      />
    </div>
  );
}
