"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export interface TestComponentItem {
  id?: string;
  type: "title" | "component";
  name: string;
  unit?: string;
  result_type?: "text" | "select";
  options?: string; // comma-separated options if result_type is select
  reference_range?: string;
  is_separated?: boolean;
  separate_price?: string;
  status?: boolean;
}

interface TestForm {
  id?: string;
  name: string;
  shortcut: string;
  sample_type: string;
  price: string;
  precautions: string;
  components: TestComponentItem[];
}

const emptyComponent: TestComponentItem = {
  type: "component",
  name: "",
  unit: "",
  result_type: "text",
  options: "",
  reference_range: "",
  is_separated: false,
  separate_price: "",
  status: true,
};

const emptyTitle: TestComponentItem = {
  type: "title",
  name: "",
  status: true,
};

const emptyForm: TestForm = {
  name: "",
  shortcut: "",
  sample_type: "Blood",
  price: "",
  precautions: "",
  components: [{ ...emptyComponent }],
};

export default function TestMasterList() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<TestForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    const { data } = await supabase.from("tests").select("*").order("name");
    if (data) setTests(data);
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete test "${name}" from the catalog?`)) return;
    await supabase.from("tests").delete().eq("id", id);
    setSuccessMsg(`Test "${name}" deleted.`);
    fetchTests();
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const openAddModal = () => {
    setIsEditing(false);
    setForm({ ...emptyForm, components: [{ ...emptyComponent }] });
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (t: any) => {
    setIsEditing(true);
    setForm({
      id: t.id,
      name: t.name || "",
      shortcut: t.shortcut || "",
      sample_type: t.sample_type || "Blood",
      price: t.price ? String(t.price) : "",
      precautions: t.precautions || "",
      components: Array.isArray(t.components) && t.components.length > 0
        ? t.components.map((c: any) => ({
            type: c.type || "component",
            name: c.name || "",
            unit: c.unit || "",
            result_type: c.result_type || "text",
            options: c.options || "",
            reference_range: c.reference_range || (c.normal_range_min && c.normal_range_max ? `${c.normal_range_min} - ${c.normal_range_max}` : ""),
            is_separated: !!c.is_separated,
            separate_price: c.separate_price ? String(c.separate_price) : "",
            status: c.status !== undefined ? c.status : true,
          }))
        : [{ ...emptyComponent }],
    });
    setFormError("");
    setShowForm(true);
  };

  const addComponentRow = (type: "title" | "component") => {
    setForm((prev) => ({
      ...prev,
      components: [...prev.components, type === "title" ? { ...emptyTitle } : { ...emptyComponent }],
    }));
  };

  const removeComponentRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const updateComponentRow = (index: number, field: keyof TestComponentItem, value: any) => {
    setForm((prev) => {
      const updated = [...prev.components];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, components: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!form.name.trim()) {
      setFormError("Test Name is a required field.");
      return;
    }

    setSaving(true);
    try {
      // Filter out empty rows
      const validComponents = form.components.filter((c) => c.name.trim() !== "");

      const payload = {
        name: form.name.trim(),
        shortcut: form.shortcut ? form.shortcut.trim() : null,
        sample_type: form.sample_type || null,
        price: form.price ? parseFloat(form.price) : null,
        precautions: form.precautions ? form.precautions.trim() : null,
        components: validComponents,
      };

      if (isEditing && form.id) {
        const { error } = await supabase.from("tests").update(payload).eq("id", form.id);
        if (error) throw error;
        setSuccessMsg(`Test "${form.name}" updated successfully in catalog!`);
      } else {
        const { error } = await supabase.from("tests").insert(payload);
        if (error) throw error;
        setSuccessMsg(`Test "${form.name}" created with INR pricing & parameters!`);
      }

      setShowForm(false);
      setForm(emptyForm);
      fetchTests();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to save test definition.");
    } finally {
      setSaving(false);
    }
  };

  const filteredTests = tests.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.shortcut || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.sample_type || "").toLowerCase().includes(searchTerm.toLowerCase())
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
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
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
      {/* Top Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            🧪 Clinical Test Master & Report Feasibility
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
            Configure diagnostic profiles, section headers, reference ranges, and separate INR (₹) billings
          </p>
        </div>
        <button
          onClick={showForm ? () => setShowForm(false) : openAddModal}
          style={{
            height: "48px",
            padding: "0 24px",
            fontSize: "14px",
            fontWeight: 700,
            borderRadius: "14px",
            background: showForm ? "#FFFFFF" : "var(--primary-gradient)",
            color: showForm ? "var(--text-main)" : "white",
            border: showForm ? "1px solid var(--border-color)" : "none",
            boxShadow: showForm ? "none" : "var(--shadow-glow)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "18px" }}>{showForm ? "✕" : "＋"}</span>
          <span>{showForm ? "Close Form" : "Create New Test Profile"}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "fadeIn 0.3s ease" }}>
          <span style={{ fontSize: "20px" }}>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Test Creation / Editing Form Card (Styled with our premium theme + INR!) */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            animation: "fadeIn 0.3s ease",
          }}
        >
          {/* Accent Header */}
          <div style={{ padding: "24px 32px", background: "linear-gradient(to right, #FAFAFE, #FFFFFF)", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "14px", background: isEditing ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "20px", fontWeight: 800 }}>
              {isEditing ? "✏️" : "🧪"}
            </div>
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                {isEditing ? `Edit Test Definition — "${form.name}"` : "Create New Lab Test & Report Profile"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                All prices and component billing are configured strictly in Indian Rupees (₹ INR)
              </p>
            </div>
          </div>

          <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px" }}>
            {formError && (
              <div style={{ padding: "14px 18px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Top Row: Name, Shortcut, Sample Type, Price in INR */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.3fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Test Name *</label>
                <input style={inputStyle} placeholder="e.g. Complete Blood Count (CBC) Panel" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label style={labelStyle}>Shortcut / Code</label>
                <input style={inputStyle} placeholder="e.g. CBC" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Sample Type</label>
                <select style={inputStyle} value={form.sample_type} onChange={(e) => setForm({ ...form, sample_type: e.target.value })}>
                  <option>Blood</option>
                  <option>Urine</option>
                  <option>Serum</option>
                  <option>Plasma</option>
                  <option>Stool</option>
                  <option>Sputum</option>
                  <option>Swab</option>
                  <option>Any Specimen</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>General Price *</label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <input
                    type="number"
                    style={{ ...inputStyle, paddingRight: "70px", fontWeight: 800, color: "#059669", fontSize: "16px" }}
                    placeholder="650"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                  <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", padding: "4px 10px", borderRadius: "8px", background: "#F1F5F9", color: "var(--text-muted)", fontSize: "12px", fontWeight: 800, letterSpacing: "0.5px" }}>
                    ₹ INR
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Precautions */}
            <div>
              <label style={labelStyle}>Patient Precautions / Fasting Instructions</label>
              <input style={inputStyle} placeholder="e.g. 10-12 hours overnight fasting strictly required prior to sample collection." value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} />
            </div>

            {/* Test Components Builder Section (Reference UI Theme + INR!) */}
            <div style={{ background: "#F8FAFC", borderRadius: "20px", border: "1px solid var(--border-color)", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h4 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                    📋 Test Components & Report Layout
                  </h4>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Add section headers or clinical measurement parameters with INR (₹) separate pricing feasibility
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => addComponentRow("title")}
                    style={{ padding: "10px 18px", borderRadius: "12px", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", border: "1px solid rgba(79, 70, 229, 0.25)", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <span>＋ Title Section</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponentRow("component")}
                    style={{ padding: "10px 18px", borderRadius: "12px", background: "var(--primary-gradient)", color: "white", border: "none", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)" }}
                  >
                    <span>＋ Add Parameter</span>
                  </button>
                </div>
              </div>

              {/* Components Table */}
              <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid var(--border-color)", background: "white" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left", width: "240px" }}>Name / Header Title</th>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left", width: "120px" }}>Unit</th>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left", width: "160px" }}>Result Feasibility</th>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left" }}>Reference Range</th>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left", width: "190px" }}>Separated Billing (₹ INR)</th>
                      <th style={{ padding: "14px 18px", fontWeight: 800, fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center", width: "70px" }}>Status</th>
                      <th style={{ padding: "14px 18px", width: "60px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.components.map((comp, idx) => {
                      if (comp.type === "title") {
                        // Section Header Title Row
                        return (
                          <tr key={idx} style={{ background: "rgba(79, 70, 229, 0.04)", borderBottom: "1px solid var(--border-color)" }}>
                            <td colSpan={5} style={{ padding: "12px 18px" }}>
                              <div className="flex items-center gap-3">
                                <span style={{ padding: "4px 8px", borderRadius: "6px", background: "var(--primary)", color: "white", fontSize: "11px", fontWeight: 800 }}>TITLE</span>
                                <input
                                  style={{ ...inputStyle, fontWeight: 800, color: "var(--primary)", fontSize: "15px", background: "white" }}
                                  placeholder="e.g. GENERAL BLOOD BIOCHEMISTRY SECTION"
                                  value={comp.name}
                                  onChange={(e) => updateComponentRow(idx, "name", e.target.value)}
                                />
                              </div>
                            </td>
                            <td style={{ padding: "12px 18px", textAlign: "center" }}>
                              <input type="checkbox" checked={comp.status !== false} onChange={(e) => updateComponentRow(idx, "status", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                            </td>
                            <td style={{ padding: "12px 18px", textAlign: "center" }}>
                              {form.components.length > 1 && (
                                <button type="button" onClick={() => removeComponentRow(idx)} style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#DC2626", fontSize: "16px", fontWeight: 800 }}>✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      // Normal Component Parameter Row
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)", background: idx % 2 === 0 ? "white" : "#FAFAFE" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <input style={{ ...inputStyle, fontWeight: 600 }} placeholder="e.g. Hemoglobin" value={comp.name} onChange={(e) => updateComponentRow(idx, "name", e.target.value)} />
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <input style={inputStyle} placeholder="e.g. g/dL" value={comp.unit} onChange={(e) => updateComponentRow(idx, "unit", e.target.value)} />
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <div className="flex-col gap-2">
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1" style={{ fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                                  <input type="radio" name={`res_type_${idx}`} checked={comp.result_type !== "select"} onChange={() => updateComponentRow(idx, "result_type", "text")} style={{ accentColor: "var(--primary)" }} /> Text
                                </label>
                                <label className="flex items-center gap-1" style={{ fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                                  <input type="radio" name={`res_type_${idx}`} checked={comp.result_type === "select"} onChange={() => updateComponentRow(idx, "result_type", "select")} style={{ accentColor: "var(--primary)" }} /> Select
                                </label>
                              </div>
                              {comp.result_type === "select" && (
                                <input
                                  style={{ ...inputStyle, fontSize: "12px", padding: "6px 10px" }}
                                  placeholder="Options: Negative, Positive"
                                  value={comp.options || ""}
                                  onChange={(e) => updateComponentRow(idx, "options", e.target.value)}
                                />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <input style={inputStyle} placeholder="e.g. 13.0 - 17.0 g/dL" value={comp.reference_range || ""} onChange={(e) => updateComponentRow(idx, "reference_range", e.target.value)} />
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <div className="flex-col gap-2">
                              <label className="flex items-center gap-2" style={{ fontSize: "13px", fontWeight: 700, cursor: "pointer", color: comp.is_separated ? "var(--primary)" : "var(--text-muted)" }}>
                                <input type="checkbox" checked={comp.is_separated || false} onChange={(e) => updateComponentRow(idx, "is_separated", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                                <span>☑ Separate Price</span>
                              </label>
                              {comp.is_separated && (
                                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                                  <input
                                    type="number"
                                    style={{ ...inputStyle, paddingRight: "60px", paddingLeft: "10px", fontWeight: 800, color: "#059669", fontSize: "14px" }}
                                    placeholder="Price"
                                    value={comp.separate_price || ""}
                                    onChange={(e) => updateComponentRow(idx, "separate_price", e.target.value)}
                                  />
                                  <div style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", padding: "3px 8px", borderRadius: "6px", background: "#E2E8F0", color: "#0F172A", fontSize: "11px", fontWeight: 800 }}>
                                    ₹ INR
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "center" }}>
                            <input type="checkbox" checked={comp.status !== false} onChange={(e) => updateComponentRow(idx, "status", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "center" }}>
                            {form.components.length > 1 && (
                              <button type="button" onClick={() => removeComponentRow(idx)} style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#DC2626", fontSize: "16px", fontWeight: 800 }}>✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div style={{ padding: "20px 32px", background: "#F8FAFC", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "white", fontWeight: 700, fontSize: "14px", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 32px",
                borderRadius: "12px",
                background: isEditing ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "var(--primary-gradient)",
                color: "white",
                fontWeight: 800,
                fontSize: "14px",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "var(--shadow-glow)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{saving ? "⏳" : "✓"}</span>
              <span>{saving ? "Saving..." : (isEditing ? "Update Test Definition" : "Save Test Profile & INR Pricing")}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div style={{ background: "white", borderRadius: "20px", padding: "16px 24px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.02)" }}>
        <span style={{ fontSize: "20px", color: "var(--text-light)" }}>🔍</span>
        <input
          type="text"
          style={{ width: "100%", border: "none", background: "transparent", fontSize: "15px", outline: "none", color: "var(--text-main)", fontWeight: 500 }}
          placeholder="Search test profiles by name, shortcut code, or sample type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} style={{ border: "none", background: "#F1F5F9", color: "var(--text-muted)", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}>
            ✕
          </button>
        )}
      </div>

      {/* Catalog Table */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid var(--border-color)", boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.03)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "850px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Test Name & Code</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sample Type</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Price (INR)</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Parameters</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Precautions</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", width: "170px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>
                    <div className="flex justify-center items-center gap-3">
                      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>Loading Clinical Test Master...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>
                    <div className="flex-col items-center gap-3">
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "28px", margin: "0 auto" }}>
                        🧪
                      </div>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>No Tests Found</p>
                      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Click "+ Create New Test Profile" above to configure your lab catalog.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTests.map((test, i) => (
                  <React.Fragment key={test.id}>
                    <tr
                      style={{ borderBottom: "1px solid var(--border-color)", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFE", transition: "background 0.15s" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                      onMouseOut={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : "#FAFAFE")}
                    >
                      <td style={{ padding: "16px 24px" }}>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 40, height: 40, borderRadius: "12px", background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontWeight: 800, fontSize: "16px" }}>
                            🧪
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "15px" }}>{test.name}</div>
                            {test.shortcut && <span style={{ padding: "2px 8px", borderRadius: "10px", background: "#F1F5F9", fontSize: "11px", fontWeight: 800, color: "var(--primary)" }}>{test.shortcut}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ padding: "5px 12px", borderRadius: "20px", background: "#F1F5F9", color: "var(--text-muted)", fontSize: "12px", fontWeight: 700 }}>
                          {test.sample_type || "Any Specimen"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", fontWeight: 900, color: "#059669", fontSize: "16px" }}>
                        {test.price ? `₹ ${test.price.toLocaleString()} INR` : "—"}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span>📋</span>
                          <span>{(test.components || []).length} {(test.components || []).length === 1 ? "row" : "rows"}</span>
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: "13px", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {test.precautions || <span style={{ color: "var(--text-light)" }}>None required</span>}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                            style={{ padding: "6px 10px", borderRadius: "8px", background: "white", border: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                          >
                            {expandedTest === test.id ? "Hide" : "View"}
                          </button>
                          <button
                            onClick={() => openEditModal(test)}
                            style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.1)", color: "#D97706", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(test.id, test.name)}
                            style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", color: "#DC2626", display: "flex", justifyContent: "center", alignItems: "center", border: "none", cursor: "pointer", fontWeight: 700 }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Parameters Table */}
                    {expandedTest === test.id && (test.components || []).length > 0 && (
                      <tr style={{ background: "linear-gradient(to right, rgba(79, 70, 229, 0.03), rgba(255,255,255,1))" }}>
                        <td colSpan={6} style={{ padding: "16px 32px 24px 64px" }}>
                          <div style={{ background: "white", borderRadius: "16px", border: "1px solid rgba(79, 70, 229, 0.15)", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)", overflow: "hidden" }}>
                            <div style={{ padding: "12px 20px", background: "rgba(79, 70, 229, 0.05)", borderBottom: "1px solid rgba(79, 70, 229, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div className="flex items-center gap-2">
                                <span>📋</span>
                                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Report Layout & Parameters for {test.name}
                                </span>
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>Base Price: ₹ {test.price || 0} INR</span>
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                                  <th style={{ padding: "10px 20px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left" }}>Parameter / Section</th>
                                  <th style={{ padding: "10px 20px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left" }}>Unit</th>
                                  <th style={{ padding: "10px 20px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left" }}>Reference Range / Options</th>
                                  <th style={{ padding: "10px 20px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "left" }}>Separate Billing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {test.components.map((c: any, ci: number) => {
                                  if (c.type === "title") {
                                    return (
                                      <tr key={ci} style={{ background: "rgba(79, 70, 229, 0.06)", borderBottom: "1px solid var(--border-color)" }}>
                                        <td colSpan={4} style={{ padding: "10px 20px", fontWeight: 900, color: "var(--primary)", fontSize: "13px", letterSpacing: "0.5px" }}>
                                          🔹 {c.name}
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={ci} style={{ borderBottom: ci < test.components.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                                      <td style={{ padding: "12px 20px", fontWeight: 700, color: "var(--text-main)", fontSize: "13px" }}>
                                        {c.name} {c.result_type === "select" && <span style={{ fontSize: "11px", color: "var(--primary)", background: "rgba(79,70,229,0.1)", padding: "2px 6px", borderRadius: "4px", marginLeft: "6px" }}>Select Options</span>}
                                      </td>
                                      <td style={{ padding: "12px 20px", fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>{c.unit || "—"}</td>
                                      <td style={{ padding: "12px 20px", fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {c.reference_range || (c.options ? `Options: ${c.options}` : (c.normal_range_min || c.normal_range_max ? `${c.normal_range_min || "?"} - ${c.normal_range_max || "?"}` : "—"))}
                                      </td>
                                      <td style={{ padding: "12px 20px", fontSize: "13px", fontWeight: 800, color: c.is_separated && c.separate_price ? "#059669" : "var(--text-light)" }}>
                                        {c.is_separated && c.separate_price ? `+ ₹ ${c.separate_price} INR` : "Included in Base"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
