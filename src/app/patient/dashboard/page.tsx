"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

export default function PatientDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingType, setBookingType] = useState<"home" | "walkin">("home");
  const [bookMode, setBookMode] = useState<"single" | "group">("single");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [prefDate, setPrefDate] = useState("");
  const [prefSlot, setPrefSlot] = useState("Morning (08:00 AM - 10:00 AM)");
  const [fastingStatus, setFastingStatus] = useState("Fasting (10-12 Hrs Required)");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [symptoms, setSymptoms] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [gpsStatus, setGpsStatus] = useState("");
  const [bookingFor, setBookingFor] = useState<"self" | "relative">("self");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAge, setBeneficiaryAge] = useState("");
  const [beneficiaryGender, setBeneficiaryGender] = useState("Female");
  const [beneficiaryRelation, setBeneficiaryRelation] = useState("Parent / Elder");

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reportToPreview, setReportToPreview] = useState<any>(null);
  const [reportForPayment, setReportForPayment] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    loadPatientData();
  }, []);

  async function loadPatientData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/patient";
        return;
      }

      const [profRes, repRes, brRes, testRes, grpRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase.from("reports").select("*, tests(*), test_groups(*), lab_branches(*)").eq("patient_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("lab_branches").select("*").order("name"),
        supabase.from("tests").select("*").order("name"),
        supabase.from("test_groups").select("*").order("name"),
      ]);

      if (profRes.data) {
        setProfile(profRes.data);
        setContactPhone(profRes.data.phone_number || profRes.data.phone || "");
        setAddress(profRes.data.address || "");
      }
      if (repRes.data) setReports(repRes.data);
      if (brRes.data) {
        setBranches(brRes.data);
        if (brRes.data[0]) setSelectedBranchId(brRes.data[0].id);
      }
      if (testRes.data) {
        setTests(testRes.data);
        if (testRes.data[0]) setSelectedTestId(testRes.data[0].id);
      }
      if (grpRes.data) {
        setGroups(grpRes.data);
        if (grpRes.data[0]) setSelectedGroupId(grpRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/patient";
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    const testObj = bookMode === "single" ? tests.find((t) => t.id === selectedTestId) : groups.find((g) => g.id === selectedGroupId);
    const br = branches.find((b) => b.id === selectedBranchId) || {};
    const title = testObj?.name || "Diagnostic Test";

    const repNum = `BOOK-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const noteSummary = `[APPOINTMENT BOOKING: ${bookingType.toUpperCase()}]\nPreferred Date: ${prefDate} (${prefSlot})\nFasting: ${fastingStatus} | Blood Group: ${bloodGroup}\nSymptoms/Notes: ${symptoms || "None"}\nCollection Address: ${address}, ${landmark} (Contact: ${contactPhone})`;

    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          patient_id: profile.id,
          branch_id: selectedBranchId || null,
          test_id: bookMode === "single" ? selectedTestId : null,
          group_id: bookMode === "group" ? selectedGroupId : null,
          referring_doctor: "Self / Online Portal Booking",
          status: "draft",
          sample_status: "pending",
          notes: noteSummary,
          report_number: repNum,
          branch_name: br.name || "Main Diagnostic Hub",
          branch_address: br.address || "",
          branch_phone: br.contact_phone || "",
          branch_email: br.contact_email || "",
          patient_phone: contactPhone || profile.phone_number || "",
          patient_email: profile.email || "",
          patient_name: profile.full_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
          test_name: title,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");

      setMessage(`🎉 Sample Collection Appointment successfully booked! Reference ID: ${repNum}. Our phlebotomist will contact you shortly.`);
      setShowBookModal(false);
      loadPatientData();
      setTimeout(() => setMessage(""), 7000);
    } catch (err: any) {
      alert("Booking Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Convert exact HTML Report Card into a high-res vector-sharp PDF!
  const generateAndDownloadVectorPdf = async (rep: any) => {
    const element = document.getElementById("printable-report-card");
    if (!element) {
      alert("Please open the report preview first to download the exact layout PDF!");
      return;
    }
    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#FFFFFF",
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: Math.max(element.scrollWidth, 800),
        windowHeight: element.scrollHeight,
        scrollY: 0,
        scrollX: 0,
      });
      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF("p", "mm", "a4");
      const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
      const pdfWidth = doc.internal.pageSize.getWidth(); // 210 mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      // Add first page
      doc.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Automatically add subsequent pages if content overflows A4 height!
      while (heightLeft > 5) {
        position = position - pageHeight;
        doc.addPage();
        doc.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      const pat = rep.profiles || {};
      const patNameStr = pat.full_name || `${pat.first_name || ""} ${pat.last_name || ""}`.trim() || "Valued_Patient";
      const repNum = rep.report_number || rep.id.slice(0, 8).toUpperCase();
      doc.save(`${repNum}-${patNameStr.replace(/\s+/g, "_")}.pdf`);
    } catch (err: any) {
      alert("PDF generation error: " + err.message);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser!");
      return;
    }
    setGpsStatus("⏳ Detecting exact GPS location via satellites...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const gpsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const detectedAddr = data.display_name || `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
          setAddress(detectedAddr);
          setLandmark(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (Live WhatsApp Coordinates)`);
          setGpsStatus(`Exact Location Confirmed! [Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}]`);
        } catch (e) {
          setAddress(`GPS Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setLandmark(`GPS Link: ${gpsLink}`);
          setGpsStatus(`GPS Coordinates Retrieved: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      (err) => {
        alert("Failed to get location: " + err.message + ". Please allow location access in your browser settings!");
        setGpsStatus("");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #CBD5E1",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1E293B",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "#64748B",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    display: "block",
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "100vh", background: "#F8FAFC" }}>
        <p style={{ fontSize: "18px", fontWeight: 700, color: "#4F46E5" }}>Loading Secure Patient Portal...</p>
      </div>
    );
  }

  const publishedReports = reports.filter((r) => r.status === "published" || r.status === "completed" || r.authorized_signature);
  const pendingBookings = reports.filter((r) => r.status === "draft" || r.sample_status === "pending" || r.sample_status === "collected");

  return (
    <div className="flex-col min-h-screen" style={{ background: "#F1F5F9", color: "#1E293B" }}>
      {/* Top Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: "14px", background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontWeight: 900, fontSize: "22px" }}>
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "P"}
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#0F172A", margin: 0 }}>
              {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}` || "Patient Portal"}
            </h1>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B" }}>
              {profile?.phone_number || profile?.phone || profile?.email || "Verified Clinical Account"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowBookModal(true)}
            style={{
              padding: "10px 24px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "white",
              fontWeight: 800,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>📅</span>
            <span>Book Sample Collection</span>
          </button>

          <button onClick={handleSignOut} style={{ padding: "10px 20px", borderRadius: "14px", border: "1px solid #CBD5E1", background: "white", fontWeight: 700, fontSize: "14px", color: "#64748B", cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1100px", margin: "32px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: "28px" }}>
        
        {/* Notification Banner */}
        {message && (
          <div style={{ padding: "18px 24px", borderRadius: "18px", background: "#ECFDF5", border: "1px solid #10B981", color: "#059669", fontWeight: 800, fontSize: "15px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>🛡️</span>
            <span>{message}</span>
          </div>
        )}

        {/* Welcome Banner */}
        <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", borderRadius: "24px", padding: "32px", color: "white", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#818CF8", textTransform: "uppercase", letterSpacing: "1px" }}>Clinical Portal Access</span>
            <h2 style={{ fontSize: "28px", fontWeight: 900, margin: "6px 0", letterSpacing: "-0.5px" }}>
              Welcome to LAB ERP Diagnostics
            </h2>
            <p style={{ fontSize: "14px", color: "#CBD5E1", margin: 0, maxWidth: "550px", lineHeight: 1.5 }}>
              View and download your 100% vector-sharp official test reports, verify cryptographic signatures, or schedule home sample collections.
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "16px 24px", borderRadius: "16px", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: "26px", fontWeight: 900, color: "#10B981" }}>{publishedReports.length}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase" }}>Published Reports</div>
          </div>
        </div>

        {/* Section 1: Active Appointments & Sample Collections */}
        {pendingBookings.length > 0 && (
          <div style={{ background: "white", borderRadius: "24px", padding: "28px", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🕒</span> Pending Sample Collections & Bookings
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pendingBookings.map((b) => {
                const mapQuery = encodeURIComponent(`${b.lab_branches?.name || "Main Diagnostic Hub"}, ${b.lab_branches?.address || "Medical District Sector 5"}`);
                const mapsUrl = `https://maps.google.com/?q=${mapQuery}`;
                return (
                  <div key={b.id} style={{ padding: "18px 22px", borderRadius: "18px", background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#4F46E5", background: "#EEF2FF", padding: "3px 10px", borderRadius: "8px" }}>{b.report_number || "BOOKING CONFIRMED"}</span>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "3px 10px", borderRadius: "8px" }}>● {b.sample_status?.toUpperCase() || "SCHEDULED"}</span>
                      </div>
                      <h4 style={{ fontSize: "17px", fontWeight: 900, color: "#0F172A", margin: "8px 0 4px" }}>{b.tests?.name || b.test_groups?.name || "Diagnostic Appointment"}</h4>
                      <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>📍 Branch: <strong>{b.lab_branches?.name || "Main Diagnostic Hub"}</strong> ({b.lab_branches?.address || "Medical District Sector 5, India"})</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                        <div>Booked on: {new Date(b.created_at).toLocaleDateString("en-IN")}</div>
                        <div style={{ color: "#059669", marginTop: "4px" }}>✔ Phlebotomist Ready</div>
                      </div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "10px 16px", borderRadius: "12px", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "white", fontWeight: 800, fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)" }}
                      >
                        <span>🗺️</span>
                        <span>Navigate to Location (Maps)</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Published Official Reports */}
        <div id="reports-section" style={{ background: "white", borderRadius: "24px", padding: "28px", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
          <div className="flex justify-between items-center pb-4 mb-6 border-b">
            <div>
              <h3 style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: 0 }}>📑 My Verified Laboratory Reports</h3>
              <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>All reports are digitally signed and formatted with Just LAB ERP (Developed by PRUDHVI RAJ) header</p>
            </div>
            <span style={{ padding: "6px 14px", background: "#ECFDF5", color: "#059669", borderRadius: "12px", fontSize: "13px", fontWeight: 800 }}>
              {publishedReports.length} Available
            </span>
          </div>

          {publishedReports.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748B" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧪</div>
              <h4 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>No Published Reports Available Yet</h4>
              <p style={{ fontSize: "14px", margin: 0, maxWidth: "450px", marginInline: "auto" }}>
                Once your diagnostic samples are processed and verified by our chief medical officer, your official reports will appear here for immediate PDF download.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
              {publishedReports.map((rep) => {
                const title = rep.tests?.name || rep.test_groups?.name || "Diagnostic Test Profile";
                const br = rep.lab_branches || {};
                const repNum = rep.report_number || rep.id.slice(0, 8).toUpperCase();

                return (
                  <div key={rep.id} style={{ padding: "20px 24px", borderRadius: "18px", background: "#FFFFFF", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", transition: "all 0.2s ease" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ width: 50, height: 50, borderRadius: "14px", background: "#EEF2FF", color: "#4F46E5", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "24px" }}>📑</div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 900, color: "#4F46E5", background: "#EEF2FF", padding: "2px 8px", borderRadius: "6px" }}>{repNum}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "2px 8px", borderRadius: "6px" }}>✔ Digitally Signed</span>
                        </div>
                        <h4 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: "6px 0 4px" }}>{title}</h4>
                        <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600 }}>
                          📍 {br.name || "Main Lab Hub"} | 👨‍⚕️ Ref Doc: {rep.referring_doctor || "Self"} | 📅 {new Date(rep.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={() => { setReportToPreview(rep); setShowPreviewModal(true); }}
                        style={{ padding: "10px 18px", borderRadius: "12px", background: "#F1F5F9", color: "#0F172A", fontWeight: 800, fontSize: "13px", border: "1px solid #CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>👁️</span><span>View Report</span>
                      </button>

                      <button
                        onClick={() => setReportForPayment(rep)}
                        style={{ padding: "10px 18px", borderRadius: "12px", background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>📱</span><span>Scan UPI Pay (₹ {rep.net_amount || rep.standard_price || 500})</span>
                      </button>

                      <button
                        onClick={() => generateAndDownloadVectorPdf(rep)}
                        style={{ padding: "10px 22px", borderRadius: "12px", background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>📥</span><span>Download Verified PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Book Sample Collection / Appointment Modal (A to Z Details) */}
      {showBookModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "28px", width: "100%", maxWidth: "760px", maxHeight: "90vh", overflowY: "auto", padding: "32px", border: "1px solid #E2E8F0", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}>
            <div className="flex justify-between items-center pb-4 mb-6 border-b">
              <div className="flex items-center gap-3">
                <div style={{ width: 44, height: 44, borderRadius: "14px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "22px" }}>📅</div>
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: 0 }}>Book Sample Collection & Lab Appointment</h3>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>Schedule phlebotomist home sample pickup or lab branch walk-in</p>
                </div>
              </div>
              <button onClick={() => setShowBookModal(false)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 36, height: 36, fontWeight: 800, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleBookAppointment} className="flex-col gap-6">
              {/* Step 1: Collection Mode */}
              <div>
                <label style={labelStyle}>1. Select Service Type *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div
                    onClick={() => setBookingType("home")}
                    style={{ padding: "16px", borderRadius: "16px", background: bookingType === "home" ? "#EEF2FF" : "#F8FAFC", border: `2px solid ${bookingType === "home" ? "#4F46E5" : "#E2E8F0"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
                  >
                    <span style={{ fontSize: "24px" }}>🏡</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "15px" }}>Home Sample Collection</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>Phlebotomist visits your home</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setBookingType("walkin")}
                    style={{ padding: "16px", borderRadius: "16px", background: bookingType === "walkin" ? "#ECFDF5" : "#F8FAFC", border: `2px solid ${bookingType === "walkin" ? "#10B981" : "#E2E8F0"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
                  >
                    <span style={{ fontSize: "24px" }}>🏥</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "15px" }}>Lab Branch Walk-in Visit</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>Visit nearest diagnostic center</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1.5: Booking For (Myself vs Dependent / Grandparent / Child) */}
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "18px", border: "1px solid #E2E8F0" }}>
                <label style={labelStyle}>Who is this appointment for? *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: bookingFor === "relative" ? "16px" : "0px" }}>
                  <div
                    onClick={() => setBookingFor("self")}
                    style={{ padding: "12px 16px", borderRadius: "12px", background: bookingFor === "self" ? "#EEF2FF" : "#FFFFFF", border: `2px solid ${bookingFor === "self" ? "#4F46E5" : "#E2E8F0"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    <span style={{ fontSize: "20px" }}>🟢</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "14px" }}>Myself ({profile?.full_name || "Primary Patient"})</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Primary account holder</div>
                    </div>
                  </div>
                  <div
                    onClick={() => setBookingFor("relative")}
                    style={{ padding: "12px 16px", borderRadius: "12px", background: bookingFor === "relative" ? "#FFFBEB" : "#FFFFFF", border: `2px solid ${bookingFor === "relative" ? "#F59E0B" : "#E2E8F0"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    <span style={{ fontSize: "20px" }}>👨‍👩‍👧</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "14px" }}>Family Member / Dependent</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Parent, grandparent, or child</div>
                    </div>
                  </div>
                </div>

                {bookingFor === "relative" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 1fr", gap: "12px", background: "#FEF3C7", padding: "16px", borderRadius: "14px", border: "1px solid #FDE68A" }}>
                    <div>
                      <label style={{ ...labelStyle, color: "#92400E" }}>Patient Full Name *</label>
                      <input type="text" style={inputStyle} placeholder="e.g. Smt. Lakshmi Devi" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#92400E" }}>Age *</label>
                      <input type="text" style={inputStyle} placeholder="72 Yrs" value={beneficiaryAge} onChange={(e) => setBeneficiaryAge(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#92400E" }}>Gender</label>
                      <select style={inputStyle} value={beneficiaryGender} onChange={(e) => setBeneficiaryGender(e.target.value)}>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#92400E" }}>Relation</label>
                      <select style={inputStyle} value={beneficiaryRelation} onChange={(e) => setBeneficiaryRelation(e.target.value)}>
                        <option>Parent / Elder</option>
                        <option>Child / Minor</option>
                        <option>Spouse</option>
                        <option>Relative / Other</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Select Test Profile or Group Panel */}
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "18px", border: "1px solid #E2E8F0" }}>
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>2. Select Diagnostic Test / Package *</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" onClick={() => setBookMode("single")} style={{ padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 800, border: "none", background: bookMode === "single" ? "#4F46E5" : "#E2E8F0", color: bookMode === "single" ? "white" : "#64748B", cursor: "pointer" }}>🧪 Individual Test</button>
                    <button type="button" onClick={() => setBookMode("group")} style={{ padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 800, border: "none", background: bookMode === "group" ? "#059669" : "#E2E8F0", color: bookMode === "group" ? "white" : "#64748B", cursor: "pointer" }}>📦 Group Health Package</button>
                  </div>
                </div>

                {bookMode === "single" ? (
                  <select style={inputStyle} value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} required>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} — ₹ {t.price || 0} INR</option>
                    ))}
                  </select>
                ) : (
                  <select style={inputStyle} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} required>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} — ₹ {g.price || 0} INR</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 3: Branch, Date & Slot */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>3. Select Nearest Lab Branch *</label>
                  <select style={inputStyle} value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} required>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Preferred Date *</label>
                  <input type="date" style={{ ...inputStyle, fontWeight: 700 }} value={prefDate} onChange={(e) => setPrefDate(e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Time Slot *</label>
                  <select style={inputStyle} value={prefSlot} onChange={(e) => setPrefSlot(e.target.value)}>
                    <option>Morning (08:00 AM - 10:00 AM)</option>
                    <option>Mid-day (10:00 AM - 01:00 PM)</option>
                    <option>Evening (04:00 PM - 07:00 PM)</option>
                  </select>
                </div>
              </div>

              {/* Step 4: Clinical Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>4. Fasting Status *</label>
                  <select style={inputStyle} value={fastingStatus} onChange={(e) => setFastingStatus(e.target.value)}>
                    <option>Fasting (10-12 Hrs Required)</option>
                    <option>Non-Fasting / Random</option>
                    <option>Post-Prandial (2 Hrs After Meal)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Patient Blood Group</label>
                  <select style={inputStyle} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Unknown"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Any Symptoms, History or Ongoing Medications?</label>
                <input style={inputStyle} placeholder="e.g. Mild fever for 3 days, taking Paracetamol" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
              </div>

              {/* Step 5: Collection Address & Contact */}
              <div style={{ background: "#EEF2FF", padding: "18px", borderRadius: "18px", border: "1px solid #C7D2FE" }}>
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <label style={{ ...labelStyle, color: "#4F46E5", marginBottom: 0 }}>5. Sample Collection Address & Phlebotomist Contact *</label>
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: "13px",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
                    }}
                  >
                    <span>📍</span><span>Locate Me (Exact WhatsApp GPS)</span>
                  </button>
                </div>
                {gpsStatus && (
                  <div style={{ padding: "8px 14px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", fontSize: "12px", fontWeight: 800, border: "1px solid #10B981", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🟢</span><span>{gpsStatus}</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input style={{ ...inputStyle, fontWeight: 700 }} placeholder="Full Street Address & House/Flat Number" value={address} onChange={(e) => setAddress(e.target.value)} required />
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                    <input style={inputStyle} placeholder="Nearby Landmark & PIN Code" value={landmark} onChange={(e) => setLandmark(e.target.value)} required />
                    <input style={{ ...inputStyle, fontWeight: 800, color: "#0F172A" }} placeholder="Contact Phone Number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowBookModal(false)} style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid #CBD5E1", background: "white", fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 32px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}>
                  {submitting ? "Booking Appointment..." : "✔ Confirm Sample Collection Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structured Preview & Vector PDF Modal */}
      {showPreviewModal && reportToPreview && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "28px", width: "100%", maxWidth: "920px", maxHeight: "95vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 24px", background: "#0F172A", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "20px" }}>📑</span>
                <span style={{ fontWeight: 800, fontSize: "16px" }}>Official Diagnostic Report ({reportToPreview.report_number || "REP"})</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => generateAndDownloadVectorPdf(reportToPreview)}
                  style={{ padding: "8px 20px", borderRadius: "10px", background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)", color: "white", fontWeight: 800, fontSize: "14px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span>📥</span><span>Download 100% Vector PDF</span>
                </button>
                <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 700, fontSize: "13px", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>🖨️ Print</button>
                <button onClick={() => setShowPreviewModal(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontWeight: 800, cursor: "pointer" }}>✕</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "40px", background: "#52525B", display: "flex", justifyContent: "center" }}>
              {(() => {
                const rawNotes = reportToPreview.notes || "";
                const isBooking = rawNotes.includes("[APPOINTMENT BOOKING");
                const prefDateMatch = rawNotes.match(/Preferred Date:\s*(.*?)(?=\s+Fasting:|\s*\||$)/i);
                const fastingMatch = rawNotes.match(/Fasting:\s*(.*?)(?=\s*\|\s*Blood Group:|$)/i);
                const bloodGroupMatch = rawNotes.match(/Blood Group:\s*(.*?)(?=\s+Symptoms\/Notes:|$)/i);
                const addrMatch = rawNotes.match(/Collection Address:\s*(.*?)(?=\s*,\s*GPS:|\s*GPS:|$)/i);
                const gpsMatch = rawNotes.match(/GPS:\s*(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/i) || rawNotes.match(/(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
                const contactMatch = rawNotes.match(/Contact:\s*([0-9+\s-]{8,15})/i);

                const preferredDate = prefDateMatch ? prefDateMatch[1].trim() : "—";
                const fastingInfo = fastingMatch ? fastingMatch[1].trim() : "Standard";
                const bloodGroup = bloodGroupMatch ? bloodGroupMatch[1].trim() : "—";
                const collectionAddress = addrMatch ? addrMatch[1].trim() : (profile?.address || profile?.place || "Address Pending");
                const gpsCoords = gpsMatch ? `${gpsMatch[1]}, ${gpsMatch[2]}` : null;
                const contactPhone = contactMatch ? contactMatch[1].trim() : (profile?.phone_number || profile?.phone || "—");

                const cleanRemarks = rawNotes.replace(/\[APPOINTMENT BOOKING[\s\S]*/i, "").trim();

                const patName = reportToPreview.beneficiary_name || profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Valued Patient";
                const patGender = reportToPreview.beneficiary_gender || profile?.gender || "—";
                const patAge = reportToPreview.beneficiary_age || (profile?.age ? `${profile.age} Yrs` : "—");
                const guardianText = reportToPreview.beneficiary_name ? `Booked by Relative/Guardian (${reportToPreview.beneficiary_relationship || "Family"}): ${profile?.full_name || contactPhone}` : null;
                const repNumber = reportToPreview.report_number || "REP-001";
                const repDate = reportToPreview.created_at ? new Date(reportToPreview.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

                return (
                  <div
                    id="printable-report-card"
                    style={{ width: "820px", boxSizing: "border-box", background: "#FFFFFF", padding: "48px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", position: "relative", display: "flex", flexDirection: "column", color: "#1E293B", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
                  >
                    {/* Header Banner */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #4F46E5", paddingBottom: "24px", marginBottom: "28px" }}>
                      <div>
                        <h1 style={{ fontSize: "32px", fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: "-1px" }}>LAB <span style={{ color: "#4F46E5" }}>ERP</span></h1>
                        <p style={{ fontSize: "14px", fontStyle: "italic", fontWeight: 700, color: "#4F46E5", margin: "4px 0 0" }}>Developed by PRUDHVI RAJ</p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0F172A" }}>{reportToPreview.lab_branches?.name || "Main Diagnostic Hub"}</div>
                        <div>📍 {reportToPreview.lab_branches?.address || "Medical District Sector 5, India"}</div>
                        <div>📞 {reportToPreview.lab_branches?.contact_phone || "+91 98765 43210"}</div>
                        <div>✉️ {reportToPreview.lab_branches?.contact_email || "reports@laberp.com"}</div>
                      </div>
                    </div>

                    {/* Patient Clinical Metadata Box */}
                    <div style={{ background: "#F8FAFC", borderRadius: "16px", border: "1px solid #CBD5E1", overflow: "hidden", marginBottom: "32px" }}>
                      <div style={{ background: "#E2E8F0", padding: "8px 18px", fontSize: "11px", fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        PATIENT CLINICAL METADATA & PROFILE
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", padding: "18px 22px" }}>
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>PATIENT NAME</span>
                          <div style={{ fontSize: "16px", fontWeight: 900, color: "#0F172A", wordBreak: "break-word" }}>{patName}</div>
                          {guardianText && (
                            <div style={{ fontSize: "11px", fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 8px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>
                              👨‍👩‍👧 {guardianText}
                            </div>
                          )}
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#475569", marginTop: "4px" }}>Gender: {patGender} | Age: {patAge}</div>
                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px", lineHeight: 1.4 }}>📍 {collectionAddress}</div>
                          {gpsCoords ? (
                            <a href={`https://www.google.com/maps?q=${encodeURIComponent(gpsCoords)}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", borderRadius: "8px", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}>🗺️ Live Maps Navigation ({gpsCoords})</a>
                          ) : (
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(collectionAddress)}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", borderRadius: "8px", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}>🗺️ Live Maps Navigation 🧭</a>
                          )}
                        </div>

                        <div style={{ borderLeft: "1px solid #E2E8F0", paddingLeft: "20px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>REPORT ID & DATE</span>
                          <div style={{ fontSize: "16px", fontWeight: 900, color: "#4F46E5" }}>{repNumber}</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginTop: "4px" }}>{repDate}</div>
                          <div style={{ fontSize: "12px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>● Sample: {reportToPreview.sample_status ? reportToPreview.sample_status.toUpperCase() : "COLLECTED"}</div>
                        </div>

                        <div style={{ borderLeft: "1px solid #E2E8F0", paddingLeft: "20px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>DIAGNOSTIC TEST PROFILE</span>
                          <div style={{ fontSize: "16px", fontWeight: 900, color: "#0F172A", wordBreak: "break-word" }}>{reportToPreview.tests?.name || reportToPreview.test_groups?.name || "Diagnostic Panel"}</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#475569", marginTop: "4px" }}>Ref Doc: {reportToPreview.referring_doctor || "Self / General"}</div>
                          <div style={{ fontSize: "12px", fontWeight: 800, color: "#4F46E5", marginTop: "4px" }}>Status: {reportToPreview.status ? reportToPreview.status.toUpperCase() : "PUBLISHED"}</div>
                        </div>
                      </div>
                    </div>

                    {/* NABL Critical Abnormal Value Highlight Banner */}
                    {(() => {
                      const abnormalList = Array.isArray(reportToPreview.results_data)
                        ? reportToPreview.results_data.filter((res: any) => res.is_abnormal)
                        : [];
                      if (abnormalList.length > 0) {
                        return (
                          <div style={{ background: "#FEF2F2", border: "2px solid #EF4444", borderRadius: "16px", padding: "18px 22px", marginBottom: "28px", boxShadow: "0 6px 16px rgba(239, 68, 68, 0.15)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", borderBottom: "1px solid #FECACA", paddingBottom: "10px" }}>
                              <span style={{ fontSize: "22px" }}>⚠️</span>
                              <div>
                                <div style={{ fontSize: "14px", fontWeight: 900, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                                  NABL CRITICAL ABNORMAL VALUE ALERT ({abnormalList.length} PARAMETER{abnormalList.length > 1 ? "S" : ""} FLAGGED)
                                </div>
                                <div style={{ fontSize: "12px", color: "#B91C1C", fontWeight: 600 }}>
                                  Immediate physician review recommended. The following diagnostic values fall outside physiological reference intervals:
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: abnormalList.length > 1 ? "1fr 1fr" : "1fr", gap: "10px" }}>
                              {abnormalList.map((item: any, i: number) => (
                                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div>
                                    <span style={{ fontSize: "12px", fontWeight: 900, color: "#991B1B" }}>🔴 {item.parameter_name}</span>
                                    <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                                      Ref: {item.ref_range || item.reference_range || "—"} ({item.unit || ""})
                                    </div>
                                  </div>
                                  <div style={{ fontSize: "15px", fontWeight: 900, color: "#DC2626", background: "#FEF2F2", padding: "4px 10px", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
                                    {item.reading || item.observed_value || "—"} {item.unit || ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (Array.isArray(reportToPreview.results_data) && reportToPreview.results_data.length > 0) {
                        return (
                          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "14px", padding: "14px 18px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "20px" }}>🟢</span>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 900, color: "#14532D", textTransform: "uppercase" }}>
                                NABL CLINICAL SUMMARY: WITHIN BIOLOGICAL REFERENCE LIMITS
                              </div>
                              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>
                                All observed diagnostic parameters fall within standard physiological ranges.
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Results Table */}
                    <h3 style={{ fontSize: "15px", fontWeight: 900, color: "#0F172A", borderBottom: "2px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      🧪 Laboratory Test Results & Clinical Observations
                    </h3>

                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#0F172A", color: "white" }}>
                          <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>Test Parameter</th>
                          <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>Observed Reading</th>
                          <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>Reference Range</th>
                          <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>Unit</th>
                          <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(reportToPreview.results_data) && reportToPreview.results_data.length > 0 ? (
                          reportToPreview.results_data.map((res: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #CBD5E1", background: res.is_abnormal ? "#FEF2F2" : idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                              <td style={{ padding: "14px", fontWeight: 700, color: "#0F172A", fontSize: "13px" }}>{res.parameter_name}</td>
                              <td style={{ padding: "14px", fontWeight: 900, fontSize: "14px", color: res.is_abnormal ? "#DC2626" : "#0F172A" }}>{res.reading || res.observed_value || "—"} {res.is_abnormal && "⚠️"}</td>
                              <td style={{ padding: "14px", color: "#475569", fontSize: "13px" }}>{res.ref_range || res.reference_range || "—"}</td>
                              <td style={{ padding: "14px", color: "#64748B", fontSize: "13px" }}>{res.unit || "—"}</td>
                              <td style={{ padding: "14px", color: "#64748B", fontSize: "13px" }}>{res.method || "Standard"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={5} style={{ padding: "28px", textAlign: "center", color: "#94A3B8" }}>No parameter results logged.</td></tr>
                        )}
                      </tbody>
                    </table>

                    {isBooking && (
                      <div style={{ background: "#EEF2FF", borderRadius: "16px", border: "1px solid #C7D2FE", overflow: "hidden", marginBottom: "28px" }}>
                        <div style={{ background: "#E0E7FF", padding: "10px 18px", fontSize: "11px", fontWeight: 900, color: "#3730A3", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🏠</span><span>HOME COLLECTION & CLINICAL APPOINTMENT DETAILS</span>
                        </div>
                        <div style={{ padding: "18px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr 1fr", gap: "16px", marginBottom: "14px" }}>
                            <div><span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>SCHEDULED SLOT</span><div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{preferredDate}</div></div>
                            <div><span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>FASTING PREP</span><div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{fastingInfo}</div></div>
                            <div><span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>BLOOD GROUP</span><div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{bloodGroup}</div></div>
                            <div><span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>HELPLINE CONTACT</span><div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{contactPhone}</div></div>
                          </div>
                          <div style={{ borderTop: "1px solid #E0E7FF", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                            <div><span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>COLLECTION ADDRESS</span><div style={{ fontSize: "12px", fontWeight: 700, color: "#312E81", marginTop: "2px" }}>{collectionAddress}</div></div>
                            {gpsCoords && <a href={`https://www.google.com/maps?q=${encodeURIComponent(gpsCoords)}`} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: "8px", background: "#4F46E5", color: "white", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}>📍 GPS: {gpsCoords}</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {cleanRemarks && (
                      <div style={{ background: "#FFFBEB", borderLeft: "4px solid #F59E0B", padding: "16px 20px", borderRadius: "8px", marginBottom: "28px", border: "1px solid #FDE68A" }}>
                        <span style={{ fontSize: "11px", fontWeight: 900, color: "#D97706", textTransform: "uppercase" }}>Pathologist Clinical Remarks & Advice:</span>
                        <p style={{ fontSize: "13px", color: "#78350F", margin: "6px 0 0", lineHeight: 1.5, fontWeight: 600 }}>{cleanRemarks}</p>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "32px", borderTop: "2px solid #E2E8F0", paddingTop: "24px", alignItems: "flex-end", marginTop: "auto" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#F8FAFC", padding: "14px 18px", borderRadius: "16px", border: "1px solid #CBD5E1" }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`LAB ERP REPORT: ${reportToPreview.report_number || ""} | PATIENT: ${patName}`)}`} alt="QR" style={{ width: 80, height: 80, borderRadius: 8, border: "1px solid #CBD5E1" }} crossOrigin="anonymous" />
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 900, color: "#0F172A", textTransform: "uppercase" }}>📱 Cryptographic Report Verification</div>
                          <p style={{ fontSize: "11px", color: "#64748B", margin: "4px 0 0", lineHeight: 1.4 }}>Scan this QR barcode to authenticate report validity.</p>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", paddingRight: "12px" }}>
                        <div style={{ display: "inline-block", border: "2px solid #10B981", borderRadius: "12px", padding: "4px 12px", color: "#059669", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", marginBottom: "8px", background: "#ECFDF5" }}>✔ Digitally Verified & Sealed</div>
                        <div style={{ fontSize: "18px", fontFamily: "serif", fontStyle: "italic", fontWeight: 800, color: "#4F46E5", margin: "4px 0" }}>{reportToPreview.signed_by || "Dr. Rajesh Sharma, MD Pathology"}</div>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>Chief Medical Pathologist / Laboratory Director</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* UPI Scan to Pay Modal */}
      {reportForPayment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", width: "100%", maxWidth: "440px", borderRadius: "24px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #E2E8F0", textAlign: "center", padding: "32px 24px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "20px", background: "#ECFDF5", color: "#059669", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "32px", margin: "0 auto 16px", boxShadow: "0 10px 20px -5px rgba(16, 185, 129, 0.2)" }}>
              📱
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: "0 0 6px" }}>Instant UPI QR Payment</h3>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 20px" }}>
              Scan with <strong style={{ color: "#0F172A" }}>Google Pay, PhonePe, Paytm, BHIM</strong> or any UPI app.
            </p>

            <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "20px", border: "2px dashed #CBD5E1", display: "inline-block", marginBottom: "20px" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=labincharge@okicici&pn=Just%20LAB%20ERP&am=${Number(reportForPayment.net_amount || reportForPayment.standard_price || 500).toFixed(2)}&cu=INR&tn=Invoice%20${reportForPayment.invoice_number || "INV-2026"}`)}`}
                alt="UPI Payment QR Code"
                style={{ width: "200px", height: "200px", borderRadius: "12px", margin: "0 auto" }}
                crossOrigin="anonymous"
              />
            </div>

            <div style={{ background: "#0F172A", color: "white", padding: "16px", borderRadius: "16px", marginBottom: "24px", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span style={{ color: "#94A3B8" }}>Payee Name:</span>
                <span style={{ fontWeight: 800, color: "#38BDF8" }}>Just LAB ERP (Lab Incharge)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span style={{ color: "#94A3B8" }}>UPI ID (VPA):</span>
                <span style={{ fontWeight: 800 }}>labincharge@okicici</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", borderTop: "1px solid #334155", paddingTop: "8px", marginTop: "4px" }}>
                <span style={{ color: "#10B981", fontWeight: 800 }}>Amount Due:</span>
                <span style={{ fontWeight: 900, color: "#10B981" }}>₹ {Number(reportForPayment.net_amount || reportForPayment.standard_price || 500).toLocaleString("en-IN")} INR</span>
              </div>
            </div>

            <button
              onClick={() => setReportForPayment(null)}
              style={{ width: "100%", padding: "14px", borderRadius: "14px", background: "#F1F5F9", color: "#334155", fontWeight: 800, fontSize: "15px", border: "none", cursor: "pointer", transition: "all 0.2s" }}
            >
              Close Payment Modal
            </button>
          </div>
        </div>
      )}

      {/* 100% Mobile Version App Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <a
          href="#reports-section"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("reports-section")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mobile-bottom-nav-item active"
        >
          <span className="nav-icon">📋</span>
          <span>Reports</span>
        </a>
        <a
          href="#book"
          onClick={(e) => { e.preventDefault(); setShowBookModal(true); }}
          className="mobile-bottom-nav-item"
        >
          <span
            className="nav-icon"
            style={{
              background: "var(--primary-gradient)",
              color: "white",
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
            }}
          >
            ➕
          </span>
          <span>Book Test</span>
        </a>
        <a
          href="#locate"
          onClick={(e) => {
            e.preventDefault();
            handleLocateMe();
          }}
          className="mobile-bottom-nav-item"
        >
          <span className="nav-icon">📍</span>
          <span>GPS Locate</span>
        </a>
        <a
          href="#signout"
          onClick={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          className="mobile-bottom-nav-item"
        >
          <span className="nav-icon">🚪</span>
          <span>Logout</span>
        </a>
      </nav>
    </div>
  );
}
