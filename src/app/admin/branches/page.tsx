"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface BranchForm {
  id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
}

const emptyBranch: BranchForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  is_active: true,
};

export default function BranchesManager() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<BranchForm>(emptyBranch);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // OTP Verification Security State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<"choose" | "sent" | "verifying">("choose");
  const [otpMethod, setOtpMethod] = useState<"whatsapp" | "email">("whatsapp");
  const [adminContact, setAdminContact] = useState("");
  const [adminEmail, setAdminEmail] = useState("reports@prudhvirajchalapaka.in");
  const [currentUserProfile, setCurrentUserProfile] = useState<{ role?: string; branch_id?: string; email?: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: "create" | "update" | "delete"; payload?: any } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchBranches();
    fetchAdminContact();
  }, []);

  async function fetchAdminContact() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setAdminContact(session.user.phone || session.user.email || "+919876543210");
      if (session.user.email) setAdminEmail(session.user.email);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setCurrentUserProfile({
        role: profile?.role || "admin",
        branch_id: profile?.branch_id || "",
        email: session.user.email,
      });
    }
  }

  async function fetchBranches() {
    setLoading(true);
    const { data } = await supabase
      .from("lab_branches")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setBranches(data);
    setLoading(false);
  };

  const handleInputChange = (field: keyof BranchForm, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setForm(emptyBranch);
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (branch: any) => {
    setIsEditing(true);
    setForm({
      id: branch.id,
      name: branch.name || "",
      code: branch.code || "",
      address: branch.address || "",
      phone: branch.contact_phone || "",
      email: branch.contact_email || "",
      is_active: branch.is_active !== undefined ? branch.is_active : true,
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const initiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.name || !form.code) {
      setErrorMsg("Branch Name and Unique Code are required fields.");
      return;
    }

    // Prepare pending action and trigger OTP Security Check
    setPendingAction({
      type: isEditing ? "update" : "create",
      payload: {
        branchId: form.id,
        name: form.name,
        code: form.code,
        address: form.address,
        contact_phone: form.phone,
        contact_email: form.email,
        is_active: form.is_active,
      },
    });
    setOtpStep("choose");
    setOtpCode("");
    setShowOtpModal(true);
  };

  const initiateDelete = (branch: any) => {
    setPendingAction({
      type: "delete",
      payload: { branchId: branch.id, name: branch.name },
    });
    setOtpStep("choose");
    setOtpCode("");
    setShowOtpModal(true);
  };

  const handleSendOtp = async (method: "whatsapp" | "email") => {
    setOtpMethod(method);
    setSubmitting(true);
    setErrorMsg("");

    try {
      if (method === "whatsapp") {
        const phoneToUse = adminContact.includes("@") ? "+919876543210" : adminContact;
        const res = await fetch("/api/auth/whatsapp-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request", phone: phoneToUse }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg("Failed to send WhatsApp OTP: " + (data.error || "Server error"));
        } else {
          setOtpStep("sent");
          setMessage(`Security OTP sent to WhatsApp number ${phoneToUse}!`);
        }
      } else {
        const targetEmail = adminEmail || (adminContact.includes("@") ? adminContact : "reports@prudhvirajchalapaka.in");
        const res = await fetch("/api/auth/email-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            email: targetEmail,
            reason: pendingAction?.type === "delete" ? "Delete Lab Branch" : "Add/Update Lab Branch",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg("Failed to send Email OTP: " + (data.error || "Server error"));
        } else {
          setOtpStep("sent");
          setMessage(`Security OTP sent to email ${targetEmail}! Check inbox.`);
        }
      }
    } catch (err: any) {
      setErrorMsg("OTP dispatch failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setErrorMsg("Please enter a valid OTP verification code.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      // If WhatsApp OTP, verify against gateway
      if (otpMethod === "whatsapp") {
        const phoneToUse = adminContact.includes("@") ? "+919876543210" : adminContact;
        const verifyRes = await fetch("/api/auth/whatsapp-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", phone: phoneToUse, otp: otpCode }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          setErrorMsg(verifyData.error || "Invalid OTP code. Access denied.");
          setSubmitting(false);
          return;
        }
      } else {
        const targetEmail = adminEmail || (adminContact.includes("@") ? adminContact : "reports@prudhvirajchalapaka.in");
        const verifyRes = await fetch("/api/auth/email-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", email: targetEmail, otp: otpCode }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          setErrorMsg(verifyData.error || "Invalid Email OTP code. Access denied.");
          setSubmitting(false);
          return;
        }
      }

      // Execute verified action!
      if (!pendingAction) return;

      const res = await fetch("/api/admin/branch-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction.type, ...pendingAction.payload }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to execute branch action.");
      } else {
        setMessage(
          pendingAction.type === "delete"
            ? `Branch "${pendingAction.payload.name}" permanently deleted.`
            : `Branch "${form.name}" successfully ${pendingAction.type === "update" ? "updated" : "created"}!`
        );
        setShowOtpModal(false);
        setShowModal(false);
        setForm(emptyBranch);
        fetchBranches();
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (err: any) {
      setErrorMsg("Execution error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBranchStatus = async (branch: any) => {
    const res = await fetch("/api/admin/branch-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", branchId: branch.id, is_active: !branch.is_active }),
    });
    if (res.ok) fetchBranches();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 18px",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    fontSize: "15px",
    background: "#FFFFFF",
    color: "var(--text-main)",
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-main)",
    marginBottom: "6px",
    display: "block",
  };

  const isSuperAdmin = !currentUserProfile || currentUserProfile.role === "super_admin" || currentUserProfile.email === "reports@prudhvirajchalapaka.in" || (!currentUserProfile.branch_id && currentUserProfile.role === "admin");

  return (
    <div className="flex-col gap-8">
      {/* Header Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            🏥 Enterprise Lab Branches
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
            Manage diagnostic locations, branch codes, and high-security OTP authorizations
          </p>
        </div>
        {isSuperAdmin ? (
          <button
            onClick={showModal ? () => setShowModal(false) : openAddModal}
            style={{
              height: "48px",
              padding: "0 28px",
              fontSize: "14px",
              fontWeight: 700,
              borderRadius: "14px",
              background: showModal ? "#FFFFFF" : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: showModal ? "var(--text-main)" : "white",
              border: showModal ? "1px solid var(--border-color)" : "none",
              boxShadow: showModal ? "none" : "0 8px 20px -6px rgba(245, 158, 11, 0.4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "18px" }}>{showModal ? "✕" : "＋"}</span>
            <span>{showModal ? "Close Form" : "Add New Lab Branch"}</span>
          </button>
        ) : (
          <div style={{ background: "#FEF3C7", color: "#B45309", padding: "10px 18px", borderRadius: "14px", fontSize: "13px", fontWeight: 800, border: "1px solid #FDE68A" }}>
            🔒 Branch Admin Role: Only Super Admin can create or delete branches
          </div>
        )}
      </div>

      {/* Success Notification */}
      {message && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "fadeIn 0.3s ease" }}>
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <span>{message}</span>
        </div>
      )}

      {/* Modern White Card Modal for Add/Edit Branch (No dark grey backdrop bugs!) */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "28px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: "620px",
              overflow: "hidden",
              animation: "scaleUp 0.2s ease",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "24px 32px", background: "linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "24px", fontWeight: 800 }}>
                  {isEditing ? "✏️" : "🏥"}
                </div>
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>
                    {isEditing ? "Edit Branch Configuration" : "Create New Lab Branch"}
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Protected by Super Admin WhatsApp & Email OTP authorization
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#F1F5F9", color: "var(--text-muted)", fontSize: "18px", fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={initiateSave} style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {errorMsg && (
                <div style={{ padding: "14px 18px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Branch Name *</label>
                  <input style={inputStyle} placeholder="e.g. Metro Diagnostics Center" value={form.name} onChange={(e) => handleInputChange("name", e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Branch Code *</label>
                  <input style={{ ...inputStyle, textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px" }} placeholder="e.g. MTR-01" value={form.code} onChange={(e) => handleInputChange("code", e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Physical Street Address</label>
                <input style={inputStyle} placeholder="e.g. 45 Healthcare Blvd, Medical District, Sector 5" value={form.address} onChange={(e) => handleInputChange("address", e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Contact Phone Number</label>
                  <input type="tel" style={inputStyle} placeholder="+91 9876543210" value={form.phone} onChange={(e) => handleInputChange("phone", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Contact Email Address</label>
                  <input type="email" style={inputStyle} placeholder="branch@laberp.com" value={form.email} onChange={(e) => handleInputChange("email", e.target.value)} />
                </div>
              </div>

              {/* Status Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", borderRadius: "16px", background: "#F8FAFC", border: "1px solid var(--border-color)", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="branchActive"
                  checked={form.is_active}
                  onChange={(e) => handleInputChange("is_active", e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", accentColor: "var(--primary)" }}
                />
                <label htmlFor="branchActive" style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)", cursor: "pointer", margin: 0 }}>
                  Branch Operational Status: {form.is_active ? <span style={{ color: "#059669" }}>● Active & Accepting Samples</span> : <span style={{ color: "#DC2626" }}>● Offline / Maintenance</span>}
                </label>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "white", fontWeight: 700, fontSize: "14px", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "12px 32px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🛡️</span>
                  <span>{isEditing ? "Verify & Save Changes" : "Verify & Create Branch"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security OTP Verification Modal */}
      {showOtpModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(10px)",
            zIndex: 150,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "28px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              width: "100%",
              maxWidth: "480px",
              padding: "32px",
              textAlign: "center",
              animation: "scaleUp 0.2s ease",
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", fontSize: "32px", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 16px" }}>
              🛡️
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-main)", margin: "0 0 8px" }}>
              High-Security OTP Verification
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 24px", lineHeight: 1.5 }}>
              Enterprise lab branch modification requires dual-channel authorization. Please choose where to send your one-time password (OTP).
            </p>

            {errorMsg && (
              <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "13px", fontWeight: 600, marginBottom: "20px", textAlign: "left" }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {otpStep === "choose" ? (
              <div className="flex-col gap-3">
                <button
                  onClick={() => handleSendOtp("whatsapp")}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#059669",
                    fontWeight: 800,
                    fontSize: "15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: "22px" }}>💬</span>
                  <span>Send OTP via WhatsApp ({adminContact})</span>
                </button>

                <button
                  onClick={() => handleSendOtp("email")}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(79, 70, 229, 0.08)",
                    border: "1px solid rgba(79, 70, 229, 0.2)",
                    color: "var(--primary)",
                    fontWeight: 800,
                    fontSize: "15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: "22px" }}>📧</span>
                  <span>Send OTP via Email Address</span>
                </button>

                <button
                  onClick={() => setShowOtpModal(false)}
                  style={{ marginTop: "12px", border: "none", background: "none", color: "var(--text-light)", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                >
                  Cancel Action
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyAndExecute} className="flex-col gap-4">
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", display: "block" }}>
                    Enter 6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    style={{ ...inputStyle, textAlign: "center", fontSize: "24px", fontWeight: 800, letterSpacing: "8px", padding: "16px" }}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex justify-between items-center mt-2">
                  <button
                    type="button"
                    onClick={() => setOtpStep("choose")}
                    style={{ border: "none", background: "none", color: "var(--primary)", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    &larr; Resend or Change Method
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || otpCode.length < 4}
                    style={{
                      padding: "14px 28px",
                      borderRadius: "14px",
                      background: "var(--primary-gradient)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: "15px",
                      border: "none",
                      cursor: submitting || otpCode.length < 4 ? "not-allowed" : "pointer",
                      boxShadow: "var(--shadow-glow)",
                    }}
                  >
                    {submitting ? "Verifying..." : "Confirm & Execute"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Branches Grid */}
      {loading ? (
        <div style={{ padding: "64px", textAlign: "center" }}>
          <div className="flex justify-center items-center gap-3">
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>Loading Enterprise Branches...</span>
          </div>
        </div>
      ) : branches.length === 0 ? (
        <div style={{ background: "white", borderRadius: "24px", padding: "64px 24px", textAlign: "center", border: "1px solid var(--border-color)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "28px", margin: "0 auto 16px" }}>
            🏥
          </div>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-main)", margin: "0 0 6px" }}>No Lab Branches Configured</p>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 20px" }}>Add your first diagnostic center location to enable sample collection and routing.</p>
          <button onClick={openAddModal} className="btn btn-primary" style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", border: "none", color: "white", fontWeight: 800, padding: "12px 28px", borderRadius: "14px" }}>
            + Create First Branch
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
          {branches
            .filter((b) => isSuperAdmin || b.id === currentUserProfile?.branch_id)
            .map((b) => (
              <div
                key={b.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "24px",
                  border: "1px solid var(--border-color)",
                  padding: "24px",
                  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 28px rgba(15, 23, 42, 0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(15, 23, 42, 0.03)";
                }}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ padding: "6px 12px", borderRadius: "20px", background: "rgba(245, 158, 11, 0.12)", color: "#D97706", fontWeight: 800, fontSize: "12px", letterSpacing: "0.5px" }}>
                      CODE: {b.code}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "20px", background: b.is_active ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: b.is_active ? "#059669" : "#DC2626", fontSize: "12px", fontWeight: 700 }}>
                      ● {b.is_active ? "Active" : "Offline"}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-main)", margin: "0 0 8px" }}>
                    {b.name}
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 16px", minHeight: "38px", lineHeight: 1.5 }}>
                    📍 {b.address || "No physical street address configured."}
                  </p>

                  <div style={{ padding: "12px 14px", borderRadius: "14px", background: "#F8FAFC", border: "1px solid var(--border-color)", fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div className="flex items-center gap-2">
                      <span>📞</span>
                      <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{b.contact_phone || "No phone listed"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>✉️</span>
                      <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{b.contact_email || "No email listed"}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
                  {isSuperAdmin ? (
                    <button
                      onClick={() => toggleBranchStatus(b)}
                      style={{ border: "none", background: "none", fontSize: "12px", fontWeight: 700, color: b.is_active ? "#DC2626" : "#059669", cursor: "pointer", padding: "4px 8px" }}
                    >
                      {b.is_active ? "Deactivate" : "Activate"}
                    </button>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8" }}>Assigned Branch</span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(b)}
                      style={{ padding: "6px 14px", borderRadius: "10px", background: "rgba(79, 70, 229, 0.08)", color: "var(--primary)", border: "1px solid rgba(79, 70, 229, 0.2)", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                    >
                      ✏️ Edit Details
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => initiateDelete(b)}
                        style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.08)", color: "#DC2626", border: "1px solid rgba(239, 68, 68, 0.2)", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
