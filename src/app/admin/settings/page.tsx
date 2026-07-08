"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function EnterpriseSettingsPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("default");
  const [allBranchSettings, setAllBranchSettings] = useState<Record<string, any>>({});

  // Current Form Fields
  const [upiId, setUpiId] = useState("justlab.diagnostic@icici");
  const [payeeName, setPayeeName] = useState("Just LAB ERP Diagnostics");
  const [defaultAmount, setDefaultAmount] = useState("1200");
  
  const [invoicePrefix, setInvoicePrefix] = useState("INV-2026-");
  const [reportPrefix, setReportPrefix] = useState("REP-");
  const [defaultTaxRate, setDefaultTaxRate] = useState("5");
  const [defaultCurrency, setDefaultCurrency] = useState("INR (₹)");

  const [labName, setLabName] = useState("Just LAB Diagnostic & Research Center");
  const [labTagline, setLabTagline] = useState("Precision Pathology & Molecular Diagnostics");
  const [contactEmail, setContactEmail] = useState("reports@justlab.com");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");
  const [labAddress, setLabAddress] = useState("101 Medical Health Hub, Healthcare Avenue");

  // New Branch-wise Invoice & Report setup states
  const [activeSectionTab, setActiveSectionTab] = useState<"upi" | "invoice" | "report">("upi");
  const [invoiceNote, setInvoiceNote] = useState("Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims.");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("Authorized Billing Officer");
  const [logoUrl, setLogoUrl] = useState("");
  const [reportPathologistName, setReportPathologistName] = useState("Dr. Prudhvi Raj, MD (Pathology)");
  const [reportDisclaimer, setReportDisclaimer] = useState("Official electronically verified clinical diagnostic report.");

  const [savedMessage, setSavedMessage] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ role?: string; branch_id?: string; email?: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchBranchesAndUser();
  }, []);

  async function fetchBranchesAndUser() {
    setLoadingBranches(true);
    const { data: { user } } = await supabase.auth.getUser();
    let isSuper = true;
    let userBranchId = "";

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const role = profile?.role || "admin";
      isSuper = role === "super_admin" || user.email === "reports@prudhvirajchalapaka.in" || (!profile?.branch_id && role === "admin");
      userBranchId = profile?.branch_id || "";
      setCurrentUserProfile({ role, branch_id: userBranchId, email: user.email });
    }

    const { data } = await supabase.from("lab_branches").select("*").order("name");
    if (data) {
      setBranches(data);
    }

    loadStoredSettings(isSuper, userBranchId);
    setLoadingBranches(false);
  }

  function loadStoredSettings(isSuper: boolean = true, userBranchId: string = "") {
    const targetBranch = (!isSuper && userBranchId) ? userBranchId : "default";
    if (!isSuper && userBranchId) {
      setSelectedBranchId(userBranchId);
    }
    const stored = localStorage.getItem("justlab_erp_settings_v2");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAllBranchSettings(parsed);
        applyBranchSettings(targetBranch, parsed);
      } catch (e) {
        console.error("Failed to parse branch settings:", e);
      }
    } else {
      // Fallback to legacy single setting
      const legacy = localStorage.getItem("justlab_erp_settings");
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          setAllBranchSettings({ default: parsed });
          applyBranchSettings(targetBranch, { default: parsed });
        } catch (e) {}
      }
    }
  }

  function applyBranchSettings(branchId: string, store: Record<string, any> = allBranchSettings) {
    const branchConf = store[branchId] || store["default"] || {};
    setUpiId(branchConf.upiId || "justlab.diagnostic@icici");
    setPayeeName(branchConf.payeeName || "Just LAB ERP Diagnostics");
    setDefaultAmount(branchConf.defaultAmount || "1200");
    setInvoicePrefix(branchConf.invoicePrefix || "INV-2026-");
    setReportPrefix(branchConf.reportPrefix || "REP-");
    setDefaultTaxRate(branchConf.defaultTaxRate || "5");
    setLabName(branchConf.labName || "Just LAB Diagnostic & Research Center");
    setLabTagline(branchConf.labTagline || "Precision Pathology & Molecular Diagnostics");
    setContactEmail(branchConf.contactEmail || "reports@justlab.com");
    setContactPhone(branchConf.contactPhone || "+91 98765 43210");
    setLabAddress(branchConf.labAddress || "101 Medical Health Hub, Healthcare Avenue");
    setInvoiceNote(branchConf.invoiceNote || "Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims.");
    setAuthorizedSignatory(branchConf.authorizedSignatory || "Authorized Billing Officer");
    setLogoUrl(branchConf.logoUrl || "");
    setReportPathologistName(branchConf.reportPathologistName || "Dr. Prudhvi Raj, MD (Pathology)");
    setReportDisclaimer(branchConf.reportDisclaimer || "Official electronically verified clinical diagnostic report.");
  }

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    applyBranchSettings(newBranchId);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const branchPayload = {
      upiId,
      payeeName,
      defaultAmount,
      invoicePrefix,
      reportPrefix,
      defaultTaxRate,
      defaultCurrency,
      labName,
      labTagline,
      contactEmail,
      contactPhone,
      labAddress,
      invoiceNote,
      authorizedSignatory,
      logoUrl,
      reportPathologistName,
      reportDisclaimer,
      updatedAt: new Date().toISOString()
    };

    const updatedStore = {
      ...allBranchSettings,
      [selectedBranchId]: branchPayload
    };

    setAllBranchSettings(updatedStore);
    localStorage.setItem("justlab_erp_settings_v2", JSON.stringify(updatedStore));
    // Keep default synced for backward compatibility
    if (selectedBranchId === "default") {
      localStorage.setItem("justlab_erp_settings", JSON.stringify(branchPayload));
    }

    const currentBranchObj = branches.find(b => b.id === selectedBranchId);
    const label = currentBranchObj ? currentBranchObj.name : "Global Default";

    setSavedMessage(`✅ Settings & UPI Payment QR updated for branch: ${label}!`);
    setTimeout(() => setSavedMessage(""), 4500);
  };

  const upiQrString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(defaultAmount || "0")}&cu=INR`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiQrString)}`;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    background: "#FFFFFF",
    color: "var(--text-main)",
    fontSize: "14px",
    fontWeight: 600,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 800,
    color: "var(--text-muted)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const currentBranchName = selectedBranchId === "default"
    ? "🌐 Global / Default Branch"
    : branches.find(b => b.id === selectedBranchId)?.name || "Selected Branch";

  const isSuperAdmin = !currentUserProfile || currentUserProfile.role === "super_admin" || currentUserProfile.email === "reports@prudhvirajchalapaka.in" || (!currentUserProfile.branch_id && currentUserProfile.role === "admin");

  return (
    <div className="flex-col gap-8">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.6px", margin: 0 }}>
            ⚙️ Branch-Specific Enterprise Settings & UPI QR
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "6px 0 0", fontWeight: 500 }}>
            Configure custom UPI payment QR credentials, numbering rules, and headers independently for every branch
          </p>
        </div>
        {!isSuperAdmin && (
          <div style={{ background: "#FEF3C7", color: "#B45309", padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 800, border: "1px solid #FDE68A" }}>
            🔒 Branch Admin Mode: Locked to your assigned branch
          </div>
        )}
      </div>

      {/* Branch Selector Bar */}
      <div style={{ background: "white", padding: "20px 24px", borderRadius: "20px", border: "1px solid var(--border-color)", boxShadow: "0 4px 14px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>🏥</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Active Configuration Target
            </div>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--primary)" }}>
              {currentBranchName}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-main)" }}>
            {isSuperAdmin ? "Select Branch to Configure:" : "Assigned Branch:"}
          </label>
          <select
            value={selectedBranchId}
            disabled={!isSuperAdmin}
            onChange={(e) => handleBranchChange(e.target.value)}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "2px solid var(--primary)",
              background: !isSuperAdmin ? "#F1F5F9" : "#EEF2FF",
              color: !isSuperAdmin ? "#475569" : "var(--primary)",
              fontWeight: 800,
              fontSize: "14px",
              cursor: !isSuperAdmin ? "not-allowed" : "pointer",
              outline: "none",
            }}
          >
            {isSuperAdmin && <option value="default">🌐 Global Default Settings</option>}
            {branches
              .filter((b) => isSuperAdmin || b.id === selectedBranchId || b.id === currentUserProfile?.branch_id)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  🏥 {b.name} ({b.code || "Branch"})
                </option>
              ))}
          </select>
        </div>
      </div>

      {savedMessage && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "#ECFDF5", color: "#059669", fontWeight: 800, fontSize: "14px", border: "1px solid #10B981", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>🛡️</span><span>{savedMessage}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", background: "#F1F5F9", padding: "8px", borderRadius: "16px", border: "1px solid #E2E8F0", marginBottom: "24px" }}>
        <button
          type="button"
          onClick={() => setActiveSectionTab("upi")}
          style={{
            flex: 1,
            padding: "12px 20px",
            borderRadius: "12px",
            border: "none",
            background: activeSectionTab === "upi" ? "white" : "transparent",
            color: activeSectionTab === "upi" ? "#0F172A" : "#64748B",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeSectionTab === "upi" ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
          }}
        >
          💳 Branch UPI & Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveSectionTab("invoice")}
          style={{
            flex: 1,
            padding: "12px 20px",
            borderRadius: "12px",
            border: "none",
            background: activeSectionTab === "invoice" ? "white" : "transparent",
            color: activeSectionTab === "invoice" ? "#0F172A" : "#64748B",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeSectionTab === "invoice" ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
          }}
        >
          🧾 Branch Invoice Setup (Logos & Notes)
        </button>
        <button
          type="button"
          onClick={() => setActiveSectionTab("report")}
          style={{
            flex: 1,
            padding: "12px 20px",
            borderRadius: "12px",
            border: "none",
            background: activeSectionTab === "report" ? "white" : "transparent",
            color: activeSectionTab === "report" ? "#0F172A" : "#64748B",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeSectionTab === "report" ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
          }}
        >
          🧪 Branch Report Setup (Signatory & Footer)
        </button>
      </div>

      <form onSubmit={handleSaveSettings}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "28px" }}>
          
          {/* TAB 1: UPI & Branch Profile */}
          {activeSectionTab === "upi" && (
            <>
              {/* CARD 1: UPI & Instant Payment QR Preview */}
              <div style={{ background: "white", borderRadius: "24px", padding: "28px", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: "24px" }}>💳</span>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>
                      Branch UPI Payment Gateway & QR
                    </h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                      Unique scannable payment QR for {currentBranchName}
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>UPI Virtual Payment Address (VPA)</label>
                      <input
                        style={inputStyle}
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. branchpay@icici"
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Payee Legal Name (on Bank Account)</label>
                      <input
                        style={inputStyle}
                        value={payeeName}
                        onChange={(e) => setPayeeName(e.target.value)}
                        placeholder="Just LAB Diagnostics"
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Default QR Reference Amount (₹)</label>
                      <input
                        type="number"
                        style={inputStyle}
                        value={defaultAmount}
                        onChange={(e) => setDefaultAmount(e.target.value)}
                        placeholder="1200"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F8FAFC", borderRadius: "20px", padding: "24px", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase" }}>
                      LIVE UPI QR PREVIEW
                    </div>
                    {upiQrUrl ? (
                      <img
                        src={upiQrUrl}
                        alt="UPI Payment QR Code"
                        style={{ width: "160px", height: "160px", borderRadius: "12px", border: "4px solid white", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                      />
                    ) : (
                      <div style={{ width: "160px", height: "160px", borderRadius: "12px", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: "12px", fontWeight: 700 }}>
                        No UPI VPA entered
                      </div>
                    )}
                    <div style={{ marginTop: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: "14px", fontWeight: 900, color: "var(--text-main)" }}>{payeeName || "Payee Name"}</div>
                      <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700 }}>{upiId || "vpa@bank"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Branch Profile Information */}
              <div style={{ background: "white", borderRadius: "24px", padding: "28px", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: "24px" }}>🏥</span>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>Branch Profile Header Details</h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Printed on clinical reports & tax invoices issued by this branch</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                  <div>
                    <label style={labelStyle}>Branch Legal Header Title</label>
                    <input
                      style={inputStyle}
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="Just LAB Diagnostic Center"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Sub-title / Accreditation Tagline</label>
                    <input
                      style={inputStyle}
                      value={labTagline}
                      onChange={(e) => setLabTagline(e.target.value)}
                      placeholder="NABL Accredited & Molecular Diagnostics"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Branch Official Email</label>
                    <input
                      type="email"
                      style={inputStyle}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="reports@justlab.com"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Branch Phone Helpline</label>
                    <input
                      style={inputStyle}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Branch Physical Address</label>
                    <input
                      style={inputStyle}
                      value={labAddress}
                      onChange={(e) => setLabAddress(e.target.value)}
                      placeholder="101 Medical Health Hub, Healthcare Avenue"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Branch Invoice Configuration */}
          {activeSectionTab === "invoice" && (
            <div style={{ background: "white", borderRadius: "24px", padding: "32px", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.03)", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", paddingBottom: "18px", borderBottom: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: "28px" }}>🧾</span>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>
                    Branch Invoice Setup (Logo, Prefix, Notes & Signature)
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                    Configure how Tax Invoices appear when printed or downloaded for {currentBranchName}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
                <div>
                  <label style={labelStyle}>Invoice Number Prefix</label>
                  <input
                    style={inputStyle}
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="INV-2026-"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Preview: {invoicePrefix}10042</span>
                </div>

                <div>
                  <label style={labelStyle}>Authorized Signatory Title</label>
                  <input
                    style={inputStyle}
                    value={authorizedSignatory}
                    onChange={(e) => setAuthorizedSignatory(e.target.value)}
                    placeholder="Authorized Billing Officer / Cashier"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Branch Logo Image URL (Optional)</label>
                  <input
                    style={inputStyle}
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://your-domain.com/logo.png"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Invoice Note Container / Terms & Conditions</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "100px", fontFamily: "inherit" }}
                    value={invoiceNote}
                    onChange={(e) => setInvoiceNote(e.target.value)}
                    placeholder="Custom notes or agreement terms displayed at bottom of Tax Invoices"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Branch Report Configuration */}
          {activeSectionTab === "report" && (
            <div style={{ background: "white", borderRadius: "24px", padding: "32px", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.03)", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", paddingBottom: "18px", borderBottom: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: "28px" }}>🧪</span>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>
                    Branch Diagnostic Report PDF Setup
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                    Configure Report ID prefix, Pathologist sign-off & legal disclaimers for {currentBranchName}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
                <div>
                  <label style={labelStyle}>Report ID Numbering Prefix</label>
                  <input
                    style={inputStyle}
                    value={reportPrefix}
                    onChange={(e) => setReportPrefix(e.target.value)}
                    placeholder="REP-"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Preview: {reportPrefix}5098</span>
                </div>

                <div>
                  <label style={labelStyle}>Chief Pathologist / Signatory Title</label>
                  <input
                    style={inputStyle}
                    value={reportPathologistName}
                    onChange={(e) => setReportPathologistName(e.target.value)}
                    placeholder="Dr. Prudhvi Raj, MD (Pathology)"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Footer Legal Disclaimer Container</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "90px", fontFamily: "inherit" }}
                    value={reportDisclaimer}
                    onChange={(e) => setReportDisclaimer(e.target.value)}
                    placeholder="Official electronically verified clinical diagnostic report."
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Save Bar */}
        <div style={{ marginTop: "28px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            style={{
              padding: "16px 36px",
              borderRadius: "16px",
              background: "var(--primary-gradient)",
              color: "white",
              fontWeight: 900,
              fontSize: "15px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(79, 70, 229, 0.3)",
            }}
          >
            💾 Save Settings for {currentBranchName}
          </button>
        </div>
      </form>
    </div>
  );
}
