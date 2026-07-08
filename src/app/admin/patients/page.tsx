"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface PatientForm {
  id?: string;
  first_name: string;
  last_name: string;
  gender: string;
  age: string;
  height: string;
  weight: string;
  place: string;
  email: string;
  phone_number: string;
  address: string;
  guardian_name?: string;
  guardian_phone?: string;
}

const emptyForm: PatientForm = {
  first_name: "",
  last_name: "",
  gender: "Male",
  age: "",
  height: "",
  weight: "",
  place: "",
  email: "",
  phone_number: "",
  address: "",
  guardian_name: "",
  guardian_phone: "",
};

export default function PatientsManager() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState("ALL");
  const [placeFilter, setPlaceFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "patient")
      .order("created_at", { ascending: false });
    if (data) setPatients(data);
    setLoading(false);
  };

  const handleInputChange = (field: keyof PatientForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (patient: any) => {
    setIsEditing(true);
    setForm({
      id: patient.id,
      first_name: patient.first_name || (patient.full_name ? patient.full_name.split(" ")[0] : ""),
      last_name: patient.last_name || (patient.full_name ? patient.full_name.split(" ").slice(1).join(" ") : ""),
      gender: patient.gender || "Male",
      age: patient.age ? String(patient.age) : "",
      height: patient.height || "",
      weight: patient.weight || "",
      place: patient.place || "",
      email: patient.email || "",
      phone_number: patient.phone_number || "",
      address: patient.address || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleDeletePatient = async (patient: any) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete patient "${patient.full_name || patient.first_name || "Unnamed"}" from the database?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/admin/delete-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patient.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error deleting patient: " + (data.error || "Unknown error"));
      } else {
        setSuccessMsg("Patient deleted successfully from database.");
        fetchPatients();
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const handleSubmitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!form.first_name || !form.last_name || !form.phone_number || !form.email) {
      setFormError("First Name, Surname, Mobile Number, and Email are required fields.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = isEditing ? "/api/admin/update-patient" : "/api/admin/create-patient";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || `Failed to ${isEditing ? "update" : "create"} patient account.`);
      } else {
        setSuccessMsg(isEditing ? `Patient ${form.first_name} updated successfully!` : `Patient ${form.first_name} ${form.last_name} registered! Welcome SMS & Email sent.`);
        setForm(emptyForm);
        setShowForm(false);
        fetchPatients();
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Extract unique places for dropdown
  const uniquePlaces = Array.from(new Set(patients.map((p) => (p.place || "").trim()).filter(Boolean))).sort();

  const filteredPatients = patients.filter((p) => {
    // Search term check
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (p.full_name || "").toLowerCase().includes(term) ||
      (p.first_name || "").toLowerCase().includes(term) ||
      (p.last_name || "").toLowerCase().includes(term) ||
      (p.phone_number || "").includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.place || "").toLowerCase().includes(term);

    // Gender filter check
    const matchesGender = genderFilter === "ALL" || (p.gender || "").toLowerCase() === genderFilter.toLowerCase();

    // Place filter check
    const matchesPlace = placeFilter === "ALL" || (p.place || "").trim().toLowerCase() === placeFilter.toLowerCase();

    return matchesSearch && matchesGender && matchesPlace;
  });

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
      {/* Header Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            Patients Directory
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
            Manage registered patients, clinical history, and edit database profiles
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
            boxShadow: showForm ? "0 2px 6px rgba(0,0,0,0.05)" : "var(--shadow-glow)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "18px" }}>{showForm ? "✕" : "＋"}</span>
          <span>{showForm ? "Close Form" : "Register New Patient"}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "fadeIn 0.3s ease" }}>
          <span style={{ fontSize: "20px" }}>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Modern Add/Edit Patient Card */}
      {showForm && (
        <form
          onSubmit={handleSubmitPatient}
          style={{
            background: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            animation: "fadeIn 0.3s ease",
          }}
        >
          {/* Card Top Accent Header */}
          <div style={{ padding: "24px 32px", background: "linear-gradient(to right, #FAFAFE, #FFFFFF)", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "14px", background: isEditing ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "var(--primary-gradient)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "20px", fontWeight: 800 }}>
              {isEditing ? "✏️" : "👤"}
            </div>
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                {isEditing ? `Edit Patient Details — ID: ${form.id ? form.id.substring(0, 8) : ""}` : "Patient Registration Form"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                {isEditing ? "Update clinical records and contact information in real-time" : "Enter patient clinical details and trigger automated WhatsApp & Email notifications"}
              </p>
            </div>
          </div>

          <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {formError && (
              <div style={{ padding: "14px 18px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Names */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input style={inputStyle} placeholder="e.g. Prudhvi" value={form.first_name} onChange={(e) => handleInputChange("first_name", e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Surname *</label>
                <input style={inputStyle} placeholder="e.g. Raj" value={form.last_name} onChange={(e) => handleInputChange("last_name", e.target.value)} required />
              </div>
            </div>

            {/* Section 2: Biometrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Gender *</label>
                <select style={inputStyle} value={form.gender} onChange={(e) => handleInputChange("gender", e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Age (Yrs)</label>
                <input type="number" style={inputStyle} placeholder="e.g. 32" value={form.age} onChange={(e) => handleInputChange("age", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Height</label>
                <input style={inputStyle} placeholder="e.g. 5'8 or 172cm" value={form.height} onChange={(e) => handleInputChange("height", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Weight</label>
                <input style={inputStyle} placeholder="e.g. 70kg" value={form.weight} onChange={(e) => handleInputChange("weight", e.target.value)} />
              </div>
            </div>

            {/* Section 3: Contact Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Mobile Number (WhatsApp) *</label>
                <input type="tel" style={inputStyle} placeholder="+91 9876543210" value={form.phone_number} onChange={(e) => handleInputChange("phone_number", e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" style={inputStyle} placeholder="patient@example.com" value={form.email} onChange={(e) => handleInputChange("email", e.target.value)} required />
              </div>
            </div>

            {/* Section 3.5: Guardian / Family Relative (For dependents/grandparents without personal mobile) */}
            <div style={{ background: "#FEF3C7", padding: "16px 20px", borderRadius: "14px", border: "1px solid #FDE68A" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#92400E", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                👨‍👩‍👧 Family Guardian / Primary Account Holder (Optional)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ ...labelStyle, color: "#92400E" }}>Guardian Name / Relationship</label>
                  <input style={inputStyle} placeholder="e.g. Son / Sri Ram Kumar" value={form.guardian_name || ""} onChange={(e) => handleInputChange("guardian_name", e.target.value)} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "#92400E" }}>Guardian Phone Number</label>
                  <input type="tel" style={inputStyle} placeholder="e.g. +91 9876543210" value={form.guardian_phone || ""} onChange={(e) => handleInputChange("guardian_phone", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Section 4: Location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
              <div>
                <label style={labelStyle}>City / Town / Place</label>
                <input style={inputStyle} placeholder="e.g. Hyderabad" value={form.place} onChange={(e) => handleInputChange("place", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Full Residential Address</label>
                <input style={inputStyle} placeholder="House No, Street Name, Area, Postal Code" value={form.address} onChange={(e) => handleInputChange("address", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Form Footer Buttons */}
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
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{saving ? "⏳" : "✓"}</span>
              <span>{saving ? (isEditing ? "Updating Database..." : "Registering...") : (isEditing ? "Save Patient Changes" : "Complete Registration & Send SMS")}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Multi-Filter Bar */}
      <div style={{ background: "white", borderRadius: "20px", padding: "16px 24px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.02)" }}>
        {/* Search Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexGrow: 1, minWidth: "260px" }}>
          <span style={{ fontSize: "20px", color: "var(--text-light)" }}>🔍</span>
          <input
            type="text"
            style={{ width: "100%", border: "none", background: "transparent", fontSize: "15px", outline: "none", color: "var(--text-main)", fontWeight: 500 }}
            placeholder="Search patients by name, mobile, email, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={{ border: "none", background: "#F1F5F9", color: "var(--text-muted)", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}>
              ✕
            </button>
          )}
        </div>

        {/* Gender Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid var(--border-color)", paddingLeft: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>Gender:</span>
          <select
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "13px", fontWeight: 600, background: "#FAFAFE", outline: "none" }}
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="ALL">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Place (City) Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>Place:</span>
          <select
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "13px", fontWeight: 600, background: "#FAFAFE", outline: "none", maxWidth: "160px" }}
            value={placeFilter}
            onChange={(e) => setPlaceFilter(e.target.value)}
          >
            <option value="ALL">All Places</option>
            {uniquePlaces.map((pl) => (
              <option key={pl} value={pl}>{pl}</option>
            ))}
          </select>
        </div>

        {/* Result count pill */}
        <div style={{ padding: "6px 14px", borderRadius: "20px", background: "#F1F5F9", color: "var(--text-muted)", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "auto" }}>
          {filteredPatients.length} {filteredPatients.length === 1 ? "Patient" : "Patients"}
        </div>
      </div>

      {/* Modern Patients Table with Edit / Delete Actions */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid var(--border-color)", boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.03)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "950px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Patient Profile</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Biometrics</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contact Number</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email Address</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Address & GPS Map</th>
                <th style={{ padding: "16px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", width: "140px" }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 24px", textAlign: "center" }}>
                    <div className="flex justify-center items-center gap-3">
                      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>Loading Patients Directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "64px 24px", textAlign: "center" }}>
                    <div className="flex-col items-center gap-3">
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "28px", margin: "0 auto" }}>
                        👥
                      </div>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>No Patients Found</p>
                      <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "400px", margin: "0 auto" }}>
                        {searchTerm || genderFilter !== "ALL" || placeFilter !== "ALL"
                          ? "No patient matching your active filter criteria was found."
                          : "Click '+ Register New Patient' above to add your first clinical patient account."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p, i) => {
                  const initials = p.full_name ? p.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "P";
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: "1px solid var(--border-color)", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFE", transition: "background 0.15s" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                      onMouseOut={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : "#FAFAFE")}
                    >
                      <td style={{ padding: "16px 24px" }}>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 40, height: 40, borderRadius: "12px", background: p.gender === "Female" ? "rgba(236, 72, 153, 0.1)" : "rgba(79, 70, 229, 0.1)", color: p.gender === "Female" ? "#EC4899" : "#4F46E5", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 800, fontSize: "14px" }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "15px" }}>
                              {p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unnamed Patient"}
                            </div>
                            <span style={{ fontSize: "12px", color: "var(--text-light)" }}>ID: {p.id ? p.id.substring(0, 8) : "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: p.gender === "Male" ? "rgba(79, 70, 229, 0.08)" : p.gender === "Female" ? "rgba(236, 72, 153, 0.08)" : "rgba(100, 116, 139, 0.08)",
                              color: p.gender === "Male" ? "#4F46E5" : p.gender === "Female" ? "#EC4899" : "#64748B",
                            }}
                          >
                            {p.gender || "Unknown"}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>
                            {p.age ? `${p.age} Yrs` : "—"}
                          </span>
                        </div>
                        {(p.height || p.weight) && (
                          <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "3px" }}>
                            {p.height && `${p.height} `} {p.weight && `• ${p.weight}`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px 24px", fontWeight: 700, color: "var(--text-main)", fontSize: "14px" }}>
                        {p.phone_number || "—"}
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                        {p.email || "—"}
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--text-main)", fontSize: "13px", fontWeight: 600 }}>
                        <div style={{ marginBottom: "4px" }}>{p.address || p.place || <span style={{ color: "var(--text-light)", fontWeight: 400 }}>Not Specified</span>}</div>
                        {p.place && p.address && <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>City: {p.place}</div>}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address || p.place || p.full_name || "Medical District")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "6px", padding: "6px 12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", borderRadius: "8px", fontSize: "11px", fontWeight: 800, textDecoration: "none", boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)" }}
                        >
                          🗺️ Live Maps Direction 🧭
                        </a>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(p)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "rgba(245, 158, 11, 0.1)",
                              color: "#D97706",
                              border: "1px solid rgba(245, 158, 11, 0.2)",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(245, 158, 11, 0.2)")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)")}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeletePatient(p)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "#DC2626",
                              border: "1px solid rgba(239, 68, 68, 0.2)",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
                          >
                            🗑 Delete
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
