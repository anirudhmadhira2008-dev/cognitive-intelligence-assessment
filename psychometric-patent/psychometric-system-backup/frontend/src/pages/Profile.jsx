import React, { useState, useEffect } from "react";
import api from "../api/apiClient";
import { getUser } from "../services/authService";
import { 
  User, 
  Lock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  GraduationCap, 
  Building2, 
  BookOpen, 
  Hash, 
  Calendar, 
  Phone, 
  Mail, 
  Loader2, 
  KeyRound 
} from "lucide-react";

export default function Profile() {
  const initialUser = getUser() || {};
  const [profile, setProfile] = useState({
    name: initialUser.name || "",
    email: initialUser.email || "",
    rollNumber: initialUser.rollNumber || "",
    college: initialUser.college || "",
    course: initialUser.course || "B.Tech",
    branch: initialUser.branch || "",
    year: initialUser.year || "",
    phone: initialUser.phone || "",
    role: initialUser.role || "student",
    profilePhoto: initialUser.profilePhoto || null
  });

  const [photoUrl, setPhotoUrl] = useState(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    // Bootstrap profile details from /api/auth/me
    api.auth.getMe()
      .then((res) => {
        if (res.user) {
          setProfile((p) => ({
            ...p,
            name: res.user.name || p.name,
            email: res.user.email || p.email,
            rollNumber: res.user.rollNumber || p.rollNumber,
            college: res.user.college || p.college,
            course: res.user.course || p.course,
            branch: res.user.branch || p.branch,
            year: res.user.year || p.year,
            phone: res.user.phone || p.phone,
            role: res.user.role || p.role,
            profilePhoto: res.user.profilePhoto || p.profilePhoto
          }));

          if (res.user.profilePhoto) {
            const token = localStorage.getItem("token") || "";
            setPhotoUrl(`/api/enrollment/reference-image/${res.user.profilePhoto}?token=${encodeURIComponent(token)}`);
          }

          localStorage.setItem("user", JSON.stringify(res.user));
        }
      })
      .catch(() => {});
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: "", text: "" });

    try {
      const res = await api.auth.updateProfile(profile);
      if (res.user) {
        localStorage.setItem("user", JSON.stringify(res.user));
      }
      setProfileMsg({ type: "success", text: "Profile credentials updated successfully." });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setPasswordMsg({ type: "error", text: "New passwords do not match." });
    }

    if (passwordForm.newPassword.length < 8) {
      return setPasswordMsg({ type: "error", text: "Password must be at least 8 characters long." });
    }

    setSavingPassword(true);
    try {
      await api.auth.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMsg({ type: "success", text: "Password has been updated successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      setSavingPassword(false);
    }
  };

  // Derive candidate initials for fallback avatar
  const getInitials = (name) => {
    if (!name) return "C";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="profile-page-container">
      {/* Sleek Hero Banner */}
      <div className="profile-hero-banner">
        <div className="profile-hero-left">
          <div className="profile-avatar-frame">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={profile.name || "Candidate"} 
                className="profile-avatar-img"
                onError={() => setPhotoUrl(null)}
              />
            ) : (
              <span className="profile-avatar-initials">{getInitials(profile.name)}</span>
            )}
          </div>
          <div className="profile-hero-info">
            <h1>{profile.name || "Candidate Profile"}</h1>
            <div className="profile-hero-meta">
              <span>{profile.email}</span>
              {profile.rollNumber && <span>• Roll: {profile.rollNumber}</span>}
              {profile.college && <span>• {profile.college}</span>}
            </div>
          </div>
        </div>

        <div className="profile-role-pill">
          <ShieldCheck size={14} />
          <span>{profile.role === "admin" ? "System Administrator" : "Enrolled Candidate"}</span>
        </div>
      </div>

      <div className="profile-cards-stack">
        {/* Card 1: Academic & Contact Profile */}
        <div className="clean-profile-card">
          <div className="clean-card-header">
            <div className="clean-card-icon-box bg-indigo-subtle">
              <GraduationCap size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2>Academic & Contact Details</h2>
              <p>Institutional attribution used for assessment benchmarking and verification reports</p>
            </div>
          </div>

          {profileMsg.text && (
            <div className={`clean-alert ${profileMsg.type}`}>
              {profileMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            <div className="clean-form-grid-2col">
              <div className="clean-form-field">
                <label>Full Name</label>
                <div className="clean-input-box">
                  <User size={16} className="input-icon" />
                  <input 
                    type="text" 
                    className="clean-input"
                    value={profile.name} 
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
                    placeholder="e.g. Prayush Sharma"
                    required 
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Email Address</label>
                <div className="clean-input-box">
                  <Mail size={16} className="input-icon" />
                  <input 
                    type="email" 
                    className="clean-input disabled"
                    value={profile.email} 
                    disabled 
                    title="Account email address cannot be changed"
                  />
                  <Lock size={15} className="input-lock-icon" />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Roll Number / Student ID</label>
                <div className="clean-input-box">
                  <Hash size={16} className="input-icon" />
                  <input 
                    type="text" 
                    className="clean-input"
                    value={profile.rollNumber} 
                    onChange={(e) => setProfile({ ...profile, rollNumber: e.target.value })} 
                    placeholder="e.g. 25071A05V8"
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>College / University</label>
                <div className="clean-input-box">
                  <Building2 size={16} className="input-icon" />
                  <input 
                    type="text" 
                    className="clean-input"
                    value={profile.college} 
                    onChange={(e) => setProfile({ ...profile, college: e.target.value })} 
                    placeholder="e.g. VNRVJIET"
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Engineering Branch</label>
                <div className="clean-input-box">
                  <BookOpen size={16} className="input-icon" />
                  <input 
                    type="text" 
                    className="clean-input"
                    value={profile.branch} 
                    onChange={(e) => setProfile({ ...profile, branch: e.target.value })} 
                    placeholder="e.g. CSE / IT / ECE"
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Graduation Year / Year of Study</label>
                <div className="clean-input-box">
                  <Calendar size={16} className="input-icon" />
                  <input 
                    type="text" 
                    className="clean-input"
                    value={profile.year} 
                    onChange={(e) => setProfile({ ...profile, year: e.target.value })} 
                    placeholder="e.g. 4 or 2026"
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Contact Phone Number</label>
                <div className="clean-input-box">
                  <Phone size={16} className="input-icon" />
                  <input 
                    type="tel" 
                    className="clean-input"
                    value={profile.phone} 
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })} 
                    placeholder="e.g. +91 9876543210"
                  />
                </div>
              </div>
            </div>

            <div className="clean-card-footer">
              <button type="submit" className="clean-btn-primary" disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Profile Details</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: Security & Credentials */}
        <div className="clean-profile-card">
          <div className="clean-card-header">
            <div className="clean-card-icon-box bg-purple-subtle">
              <KeyRound size={22} className="text-purple-600" />
            </div>
            <div>
              <h2>Security & Password</h2>
              <p>Keep your account secure with a strong password (minimum 8 characters)</p>
            </div>
          </div>

          {passwordMsg.text && (
            <div className={`clean-alert ${passwordMsg.type}`}>
              {passwordMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="clean-form-grid-2col">
              <div className="clean-form-field" style={{ gridColumn: "1 / -1" }}>
                <label>Current Password</label>
                <div className="clean-input-box">
                  <Lock size={16} className="input-icon" />
                  <input 
                    type="password" 
                    className="clean-input"
                    value={passwordForm.currentPassword} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} 
                    placeholder="Enter your current password"
                    required 
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>New Password</label>
                <div className="clean-input-box">
                  <KeyRound size={16} className="input-icon" />
                  <input 
                    type="password" 
                    className="clean-input"
                    value={passwordForm.newPassword} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} 
                    placeholder="Minimum 8 characters"
                    required 
                  />
                </div>
              </div>

              <div className="clean-form-field">
                <label>Confirm New Password</label>
                <div className="clean-input-box">
                  <KeyRound size={16} className="input-icon" />
                  <input 
                    type="password" 
                    className="clean-input"
                    value={passwordForm.confirmPassword} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} 
                    placeholder="Re-enter new password"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="clean-card-footer">
              <button type="submit" className="clean-btn-secondary" disabled={savingPassword}>
                {savingPassword ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
