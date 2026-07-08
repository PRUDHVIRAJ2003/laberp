"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UsersManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // New user form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("admin");
  const [branchId, setBranchId] = useState("");

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    // Fetch users with their branch names
    const { data: userData } = await supabase
      .from("profiles")
      .select("*, lab_branches(name, code)")
      .order("created_at", { ascending: false });

    if (userData) setUsers(userData);

    // Fetch branches for assignment dropdown
    const { data: branchData } = await supabase
      .from("lab_branches")
      .select("id, name, code")
      .eq("is_active", true);

    if (branchData) {
      setBranches(branchData);
      if (branchData.length > 0 && !branchId) setBranchId(branchData[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    if (!email || !password || !fullName) {
      setMessage("Email, Password, and Full Name are required.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          branch_id: role === "super_admin" ? null : branchId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        const errStr =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || "Failed to create user");
        setMessage("Error creating user: " + errStr);
      } else {
        setMessage("User account created successfully! They can log in immediately.");
        setShowModal(false);
        setEmail("");
        setPassword("");
        setFullName("");
        loadData();
      }
    } catch (err: any) {
      setMessage("Error creating user: " + err.message);
    }
    setSubmitting(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    loadData();
  };

  const handleBranchChange = async (userId: string, newBranchId: string) => {
    await supabase
      .from("profiles")
      .update({ branch_id: newBranchId || null })
      .eq("id", userId);
    loadData();
  };

  const filteredUsers = filterRole === "all" ? users : users.filter((u) => u.role === filterRole);

  return (
    <div className="flex-col gap-6 animate-fade-in-up">
      {/* Header Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--md-sys-color-on-surface)" }}>
            🔐 Enterprise User & Role Manager
          </h1>
          <p style={{ fontSize: "14px", color: "var(--md-sys-color-on-surface-variant)" }}>
            Manage permissions for Super Admins, Branch Admins, Staff, and Patients
          </p>
        </div>

        <button
          onClick={() => { setShowModal(true); setMessage(""); }}
          className="btn btn-primary shadow-sm"
          style={{
            height: "48px",
            padding: "0 24px",
            borderRadius: "14px",
            backgroundColor: "var(--google-blue)",
            color: "white",
            fontWeight: 800,
            fontSize: "15px",
          }}
        >
          + Add New Administrator
        </button>
      </div>

      {message && (
        <div className="p-4 rounded-xl font-semibold" style={{ backgroundColor: message.startsWith("Error") ? "rgba(234, 67, 53, 0.1)" : "rgba(52, 168, 83, 0.1)", color: message.startsWith("Error") ? "var(--google-red)" : "var(--google-green)" }}>
          {message}
        </div>
      )}

      {/* Role Filter Tabs */}
      <div className="flex gap-2 p-1" style={{ backgroundColor: "var(--md-sys-color-surface-variant)", borderRadius: "14px", width: "fit-content" }}>
        {[
          { id: "all", label: "All Users" },
          { id: "super_admin", label: "★ Super Admins" },
          { id: "admin", label: "🛡️ Branch Admins" },
          { id: "patient", label: "👥 Patients" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterRole(tab.id)}
            className={`btn ${filterRole === tab.id ? "btn-primary shadow-sm" : "btn-text"}`}
            style={{ borderRadius: "10px", height: "38px", fontSize: "13px", fontWeight: 700, padding: "0 16px" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden shadow-sm" style={{ borderRadius: "20px" }}>
        {loading ? (
          <div className="text-center py-16 font-bold text-lg" style={{ color: "var(--google-blue)" }}>
            Loading System Users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">No users found for this filter.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "rgba(66, 133, 244, 0.08)", borderBottom: "2px solid var(--md-sys-color-outline)", fontSize: "13px", color: "var(--md-sys-color-on-surface-variant)" }}>
                <th style={{ padding: "16px 20px" }}>User & Contact</th>
                <th style={{ padding: "16px 20px" }}>Role Access</th>
                <th style={{ padding: "16px 20px" }}>Assigned Lab Branch</th>
                <th style={{ padding: "16px 20px" }}>Registered Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--md-sys-color-outline)", fontSize: "14px" }}>
                  <td style={{ padding: "16px 20px" }}>
                    <div className="font-bold text-base" style={{ color: "var(--md-sys-color-on-surface)" }}>
                      {u.full_name || "Unnamed User"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--md-sys-color-on-surface-variant)" }}>
                      {u.email || u.phone_number || u.id}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        fontWeight: 700,
                        fontSize: "13px",
                        border: "1px solid var(--md-sys-color-outline)",
                        backgroundColor: u.role === "super_admin" ? "rgba(251, 188, 5, 0.2)" : u.role === "admin" ? "rgba(234, 67, 53, 0.15)" : "var(--md-sys-color-surface)",
                        color: u.role === "super_admin" ? "#9a6f00" : u.role === "admin" ? "var(--google-red)" : "var(--md-sys-color-on-surface)",
                      }}
                    >
                      <option value="super_admin">★ Super Admin</option>
                      <option value="admin">🛡️ Branch Admin</option>
                      <option value="patient">👥 Patient</option>
                    </select>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    {u.role === "super_admin" ? (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--google-blue)" }}>All Branches (Global Access)</span>
                    ) : (
                      <select
                        value={u.branch_id || ""}
                        onChange={(e) => handleBranchChange(u.id, e.target.value)}
                        style={{ padding: "6px 12px", borderRadius: "10px", fontSize: "13px", border: "1px solid var(--md-sys-color-outline)", backgroundColor: "var(--md-sys-color-surface)" }}
                      >
                        <option value="">-- Unassigned --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px", color: "var(--md-sys-color-on-surface-variant)", fontSize: "13px" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add New Administrator Modal */}
      {showModal && (
        <div className="fixed inset-0 flex justify-center items-center p-4 animate-fade-in-up" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50, backdropFilter: "blur(4px)" }}>
          <div className="card p-8 flex-col gap-5 w-full max-w-lg shadow-2xl" style={{ borderRadius: "24px", backgroundColor: "var(--md-sys-color-surface)", borderTop: "6px solid var(--google-blue)" }}>
            
            <div className="flex justify-between items-center">
              <h3 style={{ fontSize: "22px", fontWeight: 800 }}>Create New Administrator</h3>
              <button onClick={() => setShowModal(false)} style={{ fontSize: "20px", fontWeight: "bold", border: "none", background: "none", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="flex-col gap-4">
              <div className="flex-col gap-1">
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Email Address *</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="admin@laberp.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Login Password *</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Role Access *</label>
                  <select
                    className="input-field"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ height: "48px", backgroundColor: "var(--md-sys-color-surface)", fontWeight: 700 }}
                  >
                    <option value="admin">🛡️ Branch Admin</option>
                    <option value="super_admin">★ Super Admin</option>
                  </select>
                </div>
                {role !== "super_admin" && (
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Assign to Branch *</label>
                    <select
                      className="input-field"
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      style={{ height: "48px", backgroundColor: "var(--md-sys-color-surface)" }}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--md-sys-color-outline)" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-text" style={{ borderRadius: "12px" }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: "var(--google-blue)",
                    color: "white",
                    fontWeight: 800,
                    borderRadius: "12px",
                    padding: "0 24px",
                    height: "44px",
                  }}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
