"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function WhatsAppGatewayPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ role?: string; branch_id?: string; email?: string } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Hello from Just LAB ERP! Your WhatsApp notification gateway is active.");
  const [selectedBranchForTest, setSelectedBranchForTest] = useState("default");
  const [actionMessage, setActionMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const supabase = createClient();
  const GATEWAY_URL = process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://laberp.onrender.com";

  useEffect(() => {
    fetchBranchesAndUser();
    const interval = setInterval(fetchGatewayState, 3000);
    fetchGatewayState();
    return () => clearInterval(interval);
  }, []);

  async function fetchBranchesAndUser() {
    setLoading(true);
    const { data } = await supabase.from("lab_branches").select("*").order("name");
    if (data) {
      setBranches(data);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      const userProf = {
        role: profile?.role || "admin",
        branch_id: profile?.branch_id || "",
        email: session.user.email,
      };
      setCurrentUserProfile(userProf);
      if (userProf.role !== "super_admin" && userProf.branch_id) {
        setSelectedBranchForTest(userProf.branch_id);
      }
    }
    setLoading(false);
  }

  async function fetchGatewayState() {
    try {
      const res = await fetch(`${GATEWAY_URL}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }

      const logRes = await fetch(`${GATEWAY_URL}/logs`);
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs || []);
      }
    } catch (err) {
      setServerOnline(false);
    }
  }

  const startSession = async (branchId: string, branchName: string) => {
    setActionMessage(`⏳ Initiating WhatsApp link sequence for ${branchName}...`);
    try {
      const res = await fetch(`${GATEWAY_URL}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, branchName }),
      });
      if (res.ok) {
        setActionMessage(`✔ QR Code generated for ${branchName}. Please scan below!`);
        fetchGatewayState();
        [1000, 2500, 4500].forEach((ms) => setTimeout(fetchGatewayState, ms));
      } else {
        setActionMessage(`❌ Failed to start session for ${branchName}`);
      }
    } catch (e) {
      setActionMessage(`❌ Gateway offline. Please ensure 'npm run whatsapp-server' is running.`);
    }
    setTimeout(() => setActionMessage(""), 5000);
  };

  const logoutSession = async (branchId: string, branchName: string) => {
    if (!confirm(`Are you sure you want to disconnect WhatsApp for ${branchName}? You will need to scan QR again.`)) return;
    try {
      await fetch(`${GATEWAY_URL}/sessions/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      setActionMessage(`✔ Disconnected ${branchName} successfully.`);
      fetchGatewayState();
    } catch (e) {
      setActionMessage("❌ Error disconnecting session.");
    }
    setTimeout(() => setActionMessage(""), 4000);
  };

  const sendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return alert("Please enter a destination phone number");
    setSendingTest(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          message: testMsg,
          branchId: selectedBranchForTest,
          branchName: branches.find(b => b.id === selectedBranchForTest)?.name || "Main Lab"
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionMessage(`🚀 Test notification sent successfully to ${testPhone}!`);
        setTestPhone("");
        fetchGatewayState();
      } else {
        alert(`Failed to send: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert("Error sending test message: Gateway server offline.");
    }
    setSendingTest(false);
    setTimeout(() => setActionMessage(""), 5000);
  };

  const isSuperAdmin = !currentUserProfile || currentUserProfile.role === "super_admin" || currentUserProfile.email === "reports@prudhvirajchalapaka.in" || (!currentUserProfile.branch_id && currentUserProfile.role === "admin");

  // Combine default + DB branches or isolate to normal admin's branch
  const allBranches = isSuperAdmin
    ? [
        { id: "default", name: "Main Laboratory / HQ", code: "MAIN", phone: "Default" },
        ...branches
      ]
    : branches.filter((b) => b.id === currentUserProfile?.branch_id).length > 0
      ? branches.filter((b) => b.id === currentUserProfile?.branch_id)
      : [{ id: currentUserProfile?.branch_id || "default", name: "Assigned Laboratory Branch", code: "BRANCH", phone: "Default" }];

  return (
    <div className="flex-1 p-8 overflow-y-auto" style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b flex-wrap gap-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
            💬
          </div>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
              {isSuperAdmin ? "Multi-Branch WhatsApp Gateway" : "Branch WhatsApp Notification Gateway"}
            </h1>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0", fontWeight: 600 }}>
              Scan live QR barcodes for your branch, manage active sessions, and inspect real-time delivery logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ padding: "8px 16px", borderRadius: "12px", background: serverOnline ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${serverOnline ? "#A7F3D0" : "#FECACA"}`, color: serverOnline ? "#059669" : "#DC2626", fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: serverOnline ? "#10B981" : "#EF4444", display: "inline-block" }}></span>
            <span>Gateway Server: {serverOnline ? "ONLINE (Port 3005)" : "OFFLINE"}</span>
          </div>

          {isSuperAdmin ? (
            <button
              onClick={() => allBranches.forEach(b => startSession(b.id, b.name))}
              style={{ padding: "10px 20px", borderRadius: "12px", background: "#0F172A", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>🔄</span><span>Initialize All Branches</span>
            </button>
          ) : (
            <div style={{ background: "#FEF3C7", color: "#B45309", padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 800, border: "1px solid #FDE68A" }}>
              🔒 Branch Admin Mode: Viewing Assigned WhatsApp Gateway
            </div>
          )}
        </div>
      </div>

      {actionMessage && (
        <div style={{ padding: "14px 20px", borderRadius: "14px", background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#4338CA", fontWeight: 700, fontSize: "14px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.1)" }}>
          <span>🔔</span>
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Branch Sessions Grid */}
      <h2 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        🏥 Branch WhatsApp Accounts ({allBranches.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {allBranches.map((branch) => {
          const sess = sessions.find((s) => s.branchId === branch.id) || { status: "DISCONNECTED", qr: null, phone: null };
          const isConn = sess.status === "CONNECTED";
          const isWait = sess.status === "WAITING_FOR_QR";

          let statusStyle = { bg: "#F1F5F9", col: "#475569", text: "🔴 Offline / Disconnected", border: "#CBD5E1" };
          if (isConn) statusStyle = { bg: "#ECFDF5", col: "#059669", text: `🟢 Connected (${sess.phone || "Active"})`, border: "#A7F3D0" };
          else if (isWait) statusStyle = { bg: "#FEF9C3", col: "#CA8A04", text: "🟡 Waiting for QR Scan", border: "#FDE047" };

          return (
            <div key={branch.id} style={{ background: "white", borderRadius: "24px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 800, background: "#EEF2FF", color: "#4F46E5", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase", display: "inline-block", marginBottom: "6px" }}>
                      Branch ID: {branch.code || branch.id?.slice(0, 8).toUpperCase()}
                    </span>
                    <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: 0 }}>{branch.name}</h3>
                  </div>
                </div>

                <div style={{ padding: "8px 14px", borderRadius: "12px", background: statusStyle.bg, color: statusStyle.col, fontWeight: 800, fontSize: "13px", border: `1px solid ${statusStyle.border}`, marginBottom: "20px", display: "inline-block" }}>
                  {statusStyle.text}
                </div>

                {/* QR Code Display Box */}
                {isWait && sess.qr && (
                  <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "20px", border: "2px dashed #CBD5E1", textAlign: "center", marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 900, color: "#0F172A", textTransform: "uppercase", marginBottom: "10px" }}>
                      📱 Scan with WhatsApp on phone
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sess.qr)}`}
                      alt="WhatsApp QR Code"
                      style={{ width: "220px", height: "220px", borderRadius: "12px", margin: "0 auto", background: "white", padding: "8px", border: "1px solid #E2E8F0" }}
                    />
                    <p style={{ fontSize: "11px", color: "#64748B", margin: "10px 0 0", lineHeight: 1.4 }}>
                      WhatsApp → Linked Devices → <strong>Link a Device</strong> → Point phone camera at monitor.
                    </p>
                  </div>
                )}

                {isConn && (
                  <div style={{ background: "#F0FDF4", padding: "16px", borderRadius: "16px", border: "1px solid #BBF7D0", marginBottom: "20px" }}>
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                      <span>✔ Active Dispatch Channel</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#15803D", margin: 0 }}>
                      All patient report PDFs and billing receipts from this branch will automatically route through this WhatsApp number.
                    </p>
                  </div>
                )}

                {!isConn && !isWait && (
                  <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0", textAlign: "center", color: "#64748B", fontSize: "13px", marginBottom: "20px" }}>
                    Session offline. Click below to generate a scannable QR link.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t" style={{ borderColor: "#F1F5F9" }}>
                {!isConn ? (
                  <button
                    onClick={() => startSession(branch.id, branch.name)}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}
                  >
                    ▶️ {isWait ? "Refresh QR" : "Start Session"}
                  </button>
                ) : (
                  <button
                    onClick={() => logoutSession(branch.id, branch.name)}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#FEF2F2", color: "#DC2626", fontWeight: 800, fontSize: "13px", border: "1px solid #FECACA", cursor: "pointer" }}
                  >
                    ⏹️ Disconnect & Logout
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedBranchForTest(branch.id);
                    alert(`Selected ${branch.name} for testing. Scroll down to send a test message!`);
                  }}
                  style={{ padding: "12px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#334155", fontWeight: 800, fontSize: "13px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                  title="Select for Test Dispatch"
                >
                  🧪 Test
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Test Message Form */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid #E2E8F0", padding: "32px", marginBottom: "40px", boxShadow: "0 10px 30px -5px rgba(0,0,0,0.03)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: "0 0 6px" }}>🧪 Send Instant Test WhatsApp Notification</h3>
        <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 20px" }}>Verify your branch connection by dispatching a test message to any mobile number.</p>

        <form onSubmit={sendTestNotification} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Select Dispatch Branch *</label>
            <select
              value={selectedBranchForTest}
              onChange={(e) => setSelectedBranchForTest(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, background: "#F8FAFC" }}
            >
              {allBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Destination Mobile Number *</label>
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="e.g. 9876543210 (10 digits)"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, background: "#F8FAFC" }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Message Content *</label>
            <input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 600, background: "#F8FAFC" }}
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={sendingTest}
              style={{ width: "100%", padding: "12px 24px", borderRadius: "12px", background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", color: "white", fontWeight: 800, fontSize: "14px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)", opacity: sendingTest ? 0.7 : 1 }}
            >
              {sendingTest ? "⏳ Dispatching..." : "🚀 Send Test SMS"}
            </button>
          </div>
        </form>
      </div>

      {/* Real-Time Dispatch Logs Table */}
      <div style={{ background: "#0F172A", borderRadius: "24px", border: "1px solid #334155", padding: "32px", color: "white", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)" }}>
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "24px" }}>📡</span>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 900, color: "white", margin: 0 }}>Live WhatsApp Dispatch & Error Logs</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Real-time audit trail of all automated patient report PDFs and billing receipts dispatched across branches.</p>
            </div>
          </div>
          <span style={{ fontSize: "12px", background: "#1E293B", padding: "6px 14px", borderRadius: "20px", color: "#38BDF8", fontWeight: 800, border: "1px solid #334155" }}>
            Total Recorded: {logs.length}
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>
            No dispatch logs recorded since server startup. Send a test message or publish a report!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full border-collapse" style={{ textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94A3B8", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px" }}>Branch Used</th>
                  <th style={{ padding: "12px 16px" }}>Recipient Phone</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Message Preview</th>
                  <th style={{ padding: "12px 16px" }}>Error Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #1E293B", transition: "all 0.1s" }} className="hover:bg-slate-800/50">
                    <td style={{ padding: "14px 16px", color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 800, color: "#38BDF8" }}>
                      {item.branchName}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "white" }}>
                      {item.phone}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {item.status === "SENT" ? (
                        <span style={{ background: "#065F46", color: "#34D399", padding: "4px 10px", borderRadius: "8px", fontWeight: 800, fontSize: "11px" }}>✅ SENT</span>
                      ) : (
                        <span style={{ background: "#7F1D1D", color: "#F87171", padding: "4px 10px", borderRadius: "8px", fontWeight: 800, fontSize: "11px" }}>❌ FAILED</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#CBD5E1", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.message}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#F87171", fontSize: "12px" }}>
                      {item.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
