"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function GroupPanelsManager() {
  const [groups, setGroups] = useState<any[]>([]);
  const [allTests, setAllTests] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Form Fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("999");
  const [description, setDescription] = useState("");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [testSearchQuery, setTestSearchQuery] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchGroupsAndTests();
  }, []);

  async function fetchGroupsAndTests() {
    setLoading(true);
    try {
      const [gRes, tRes, mRes] = await Promise.all([
        supabase.from("test_groups").select("*").order("name"),
        supabase.from("tests").select("*").order("name"),
        supabase.from("test_group_mapping").select("*"),
      ]);
      if (gRes.data) setGroups(gRes.data);
      if (tRes.data) setAllTests(tRes.data);
      if (mRes.data) setMappings(mRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentGroupId(null);
    setCode(`PKG-${Math.floor(100 + Math.random() * 900)}`);
    setName("");
    setPrice("1499");
    setDescription("");
    setSelectedTestIds([]);
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (grp: any) => {
    setIsEditing(true);
    setCurrentGroupId(grp.id);
    setCode(grp.code || "");
    setName(grp.name || "");
    setPrice(grp.price ? String(grp.price) : "0");
    setDescription(grp.description || "");

    const linkedIds = mappings.filter((m) => m.group_id === grp.id).map((m) => m.test_id);
    setSelectedTestIds(linkedIds);
    setErrorMsg("");
    setShowModal(true);
  };

  const toggleTestSelection = (testId: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Group Package Name is required.");
      return;
    }
    if (selectedTestIds.length === 0) {
      setErrorMsg("Please select at least one test profile for this group package.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        code: code.trim().toUpperCase() || `PKG-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        price: parseFloat(price) || 0,
        description: description.trim(),
      };

      let groupIdToMap = currentGroupId;

      if (isEditing && currentGroupId) {
        const { error: updErr } = await supabase.from("test_groups").update(payload).eq("id", currentGroupId);
        if (updErr) throw new Error(updErr.message);

        // Clear existing mappings
        await supabase.from("test_group_mapping").delete().eq("group_id", currentGroupId);
      } else {
        const { data: newGrp, error: insErr } = await supabase.from("test_groups").insert([payload]).select().single();
        if (insErr) throw new Error(insErr.message);
        groupIdToMap = newGrp.id;
      }

      // Insert new group mappings
      if (groupIdToMap && selectedTestIds.length > 0) {
        const mapRows = selectedTestIds.map((tid) => ({
          group_id: groupIdToMap,
          test_id: tid,
        }));
        const { error: mapErr } = await supabase.from("test_group_mapping").insert(mapRows);
        if (mapErr) console.warn("Mapping insert warning:", mapErr.message);
      }

      setMessage(`Group Test Panel "${name}" successfully ${isEditing ? "updated" : "created"}!`);
      setShowModal(false);
      fetchGroupsAndTests();
      setTimeout(() => setMessage(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (grp: any) => {
    if (!confirm(`Are you sure you want to delete Group Panel "${grp.name}"?`)) return;
    try {
      await supabase.from("test_group_mapping").delete().eq("group_id", grp.id);
      const { error } = await supabase.from("test_groups").delete().eq("id", grp.id);
      if (error) alert("Delete error: " + error.message);
      else {
        setMessage(`Group Panel "${grp.name}" deleted.`);
        fetchGroupsAndTests();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "var(--text-main)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-muted)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    display: "block",
  };

  return (
    <div className="flex-col gap-8">
      {/* Header Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            📦 Diagnostic Group Panels & Packages
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
            Create multi-test health packages (e.g. Master Health Checkup, Fever Panel) and link individual profiles in INR
          </p>
        </div>
        <button
          onClick={showModal ? () => setShowModal(false) : openCreateModal}
          style={{
            height: "48px",
            padding: "0 28px",
            fontSize: "14px",
            fontWeight: 800,
            borderRadius: "14px",
            background: showModal ? "#FFFFFF" : "var(--primary-gradient)",
            color: showModal ? "var(--text-main)" : "white",
            border: showModal ? "1px solid var(--border-color)" : "none",
            boxShadow: showModal ? "none" : "var(--shadow-glow)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "18px" }}>{showModal ? "✕" : "＋"}</span>
          <span>{showModal ? "Close Form" : "Create Group Panel"}</span>
        </button>
      </div>

      {/* Notification Banner */}
      {message && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "fadeIn 0.3s ease" }}>
          <span style={{ fontSize: "20px" }}>✔</span>
          <span>{message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex justify-end">
        <div style={{ background: "white", borderRadius: "14px", padding: "8px 16px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "10px", width: "340px" }}>
          <span>🔍</span>
          <input
            type="text"
            style={{ width: "100%", border: "none", outline: "none", fontSize: "14px" }}
            placeholder="Search by package name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", borderRadius: "28px", border: "1px solid var(--border-color)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", width: "100%", maxWidth: "780px", maxHeight: "90vh", overflowY: "auto", padding: "32px" }}>
              <div className="flex justify-between items-center pb-4 mb-6 border-b" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "24px", boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)" }}>📦</div>
                  <div>
                    <h3 style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: 0 }}>
                      {isEditing ? `Edit Group Panel Package — ${code}` : "Create Group Test Package"}
                    </h3>
                    <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>Select multiple individual clinical test profiles to bundle into a discounted diagnostic package</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowModal(false)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 38, height: 38, fontWeight: 800, cursor: "pointer", fontSize: "16px", color: "#64748B" }}>✕</button>
              </div>

              {errorMsg && <div style={{ padding: "14px 18px", borderRadius: "14px", background: "#FEF2F2", color: "#DC2626", fontWeight: 700, marginBottom: "20px", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: "10px" }}><span>⚠️</span> {errorMsg}</div>}

              <form onSubmit={handleSaveGroup} className="flex-col gap-6">
                <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "20px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 900, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px" }}>📌 STEP 1: PACKAGE IDENTIFICATION & PRICING</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Package Code *</label>
                      <input style={{ ...inputStyle, fontWeight: 800, color: "#059669", background: "white" }} placeholder="e.g. PKG-948" value={code} onChange={(e) => setCode(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Group Package Name *</label>
                      <input style={{ ...inputStyle, fontWeight: 700, background: "white" }} placeholder="e.g. Master Health Checkup Panel" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Package Price (INR) *</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: 12, fontWeight: 800, color: "#059669" }}>₹</span>
                        <input type="number" style={{ ...inputStyle, paddingLeft: "30px", fontWeight: 800, background: "white" }} placeholder="1499" value={price} onChange={(e) => setPrice(e.target.value)} required />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Clinical Summary / Package Description</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: "75px", resize: "vertical", background: "white", fontSize: "14px", fontWeight: 500 }}
                      placeholder="Comprehensive evaluation covering Complete Blood Count, Liver function, Kidney screening, and Glucose."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Multi-Select Test Checkboxes */}
                <div style={{ background: "white", padding: "20px", borderRadius: "20px", border: "1px solid #CBD5E1", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                  <div className="flex justify-between items-center mb-4 pb-3 border-b flex-wrap gap-2" style={{ borderColor: "#E2E8F0" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 900, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px" }}>🧪 STEP 2: SELECT INCLUDED DIAGNOSTIC PROFILES *</div>
                      <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>Select the individual tests that will be performed under this group package deal.</span>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 800, padding: "4px 14px", borderRadius: "20px", background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>{selectedTestIds.length} tests selected</span>
                  </div>

                  {/* Instant Filter Bar */}
                  <div style={{ marginBottom: "14px", position: "relative" }}>
                    <span style={{ position: "absolute", left: "14px", top: "11px", fontSize: "14px" }}>🔍</span>
                    <input
                      placeholder="Type to filter tests instantly by name or code..."
                      value={testSearchQuery}
                      onChange={(e) => setTestSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "12px",
                        border: "1px solid #CBD5E1",
                        fontSize: "13px",
                        fontWeight: 600,
                        outline: "none",
                        background: "#F8FAFC",
                      }}
                    />
                    {testSearchQuery && (
                      <span onClick={() => setTestSearchQuery("")} style={{ position: "absolute", right: "14px", top: "11px", fontSize: "12px", color: "#64748B", cursor: "pointer", fontWeight: 800 }}>✕</span>
                    )}
                  </div>

                  <div style={{ border: "1px solid #CBD5E1", borderRadius: "16px", padding: "16px", maxHeight: "300px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F8FAFC" }}>
                    {allTests.filter(t => t.name.toLowerCase().includes(testSearchQuery.toLowerCase()) || (t.code && t.code.toLowerCase().includes(testSearchQuery.toLowerCase()))).length === 0 ? (
                      <p style={{ gridColumn: "span 2", textAlign: "center", color: "#64748B", padding: "24px", margin: 0, fontWeight: 600 }}>⚠️ No test profiles match "{testSearchQuery}". Try typing a different keyword.</p>
                    ) : (
                      allTests.filter(t => t.name.toLowerCase().includes(testSearchQuery.toLowerCase()) || (t.code && t.code.toLowerCase().includes(testSearchQuery.toLowerCase()))).map((t) => {
                        const isSelected = selectedTestIds.includes(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => toggleTestSelection(t.id)}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "14px",
                              background: isSelected ? "#ECFDF5" : "white",
                              border: `2px solid ${isSelected ? "#10B981" : "#E2E8F0"}`,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              transition: "all 0.15s ease",
                              boxShadow: isSelected ? "0 4px 12px rgba(16, 185, 129, 0.15)" : "0 1px 3px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div className="flex items-center gap-3.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by div click
                                style={{ width: 18, height: 18, accentColor: "#10B981", cursor: "pointer" }}
                              />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: "14px", color: isSelected ? "#065F46" : "#0F172A" }}>{t.name}</div>
                                <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, marginTop: "2px" }}>Code: {t.code || "—"} | {Array.isArray(t.components) ? t.components.length : 0} parameters</div>
                              </div>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 800, padding: "4px 10px", borderRadius: "8px", background: isSelected ? "#D1FAE5" : "#F1F5F9", color: isSelected ? "#065F46" : "#475569" }}>
                              {t.price ? `₹ ${Number(t.price).toLocaleString("en-IN")} INR` : "Standard"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "white", fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 32px", borderRadius: "12px", background: "var(--primary-gradient)", color: "white", fontWeight: 800, border: "none", cursor: "pointer" }}>
                  {submitting ? "Saving Panel..." : "✔ Save Group Panel Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Catalog Table */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid var(--border-color)", boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.03)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "850px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Package Code</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Group Panel Name</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Included Test Profiles</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Package Price (INR)</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", width: "140px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "64px", textAlign: "center", fontWeight: 700 }}>Loading Group Panels Catalog...</td></tr>
              ) : filteredGroups.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>No group panels found. Click "+ Create Group Panel" above!</td></tr>
              ) : (
                filteredGroups.map((grp, i) => {
                  const linkedTestIds = mappings.filter((m) => m.group_id === grp.id).map((m) => m.test_id);
                  const linkedTests = allTests.filter((t) => linkedTestIds.includes(t.id));

                  return (
                    <tr key={grp.id} style={{ borderBottom: "1px solid var(--border-color)", background: i % 2 === 0 ? "white" : "#FAFAFE" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: "13px", background: "rgba(79,70,229,0.08)", padding: "4px 10px", borderRadius: "8px" }}>
                          {grp.code || "PKG-001"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "15px" }}>{grp.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{grp.description || "Comprehensive clinical test package"}</div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {linkedTests.length === 0 ? (
                            <span style={{ fontSize: "12px", color: "var(--text-light)", fontStyle: "italic" }}>No tests mapped</span>
                          ) : (
                            linkedTests.map((t) => (
                              <span key={t.id} style={{ fontSize: "11px", fontWeight: 700, background: "#F1F5F9", color: "var(--text-main)", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                                🧪 {t.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 900, color: "#059669" }}>₹ {grp.price ? Number(grp.price).toLocaleString("en-IN") : "0"} INR</span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(grp)} style={{ padding: "6px 12px", borderRadius: "8px", background: "#F1F5F9", color: "var(--text-main)", border: "1px solid var(--border-color)", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleDeleteGroup(grp)} style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", color: "#DC2626", border: "none", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
