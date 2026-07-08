"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function SampleTrackerPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<"pending" | "collected" | "processing" | "completed">("pending");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [techNotes, setTechNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*, profiles(*), tests(*), test_groups(*), lab_branches(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("Error loading sample data:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const notifySampleStatusWhatsApp = async (rep: any, statusStr: string) => {
    const phone = rep?.patient_phone || rep?.profiles?.phone_number || rep?.profiles?.phone;
    if (!phone) return;
    const patName = rep?.patient_name || rep?.profiles?.full_name || "Patient";
    const repNum = rep?.report_number || rep?.id?.slice(0, 8).toUpperCase();
    const testTitle = rep?.test_name || rep?.tests?.name || "Laboratory Test";
    const statusMsg =
      statusStr === "collected"
        ? `🧪 Hello ${patName},\nYour sample for *${testTitle}* (Ref: ${repNum}) has been *COLLECTED & BARCODED*. It is now entering diagnostic processing.\n– Main Diagnostic Laboratory`
        : statusStr === "processing"
        ? `🔬 Hello ${patName},\nYour diagnostic sample (Ref: ${repNum}) for *${testTitle}* is currently *UNDER ANALYSER PROCESSING* in our laboratory.\n– Main Diagnostic Laboratory`
        : `✅ Hello ${patName},\nYour laboratory test readings (Ref: ${repNum}) for *${testTitle}* have been *COMPLETED* and sent for senior pathologist review.\n– Main Diagnostic Laboratory`;

    try {
      await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify_whatsapp_custom",
          patient_phone: phone,
          message: statusMsg
        })
      });
    } catch (e) {
      console.warn("Could not dispatch WhatsApp status notification", e);
    }
  };

  const updateSampleStatus = async (repId: string, newStatus: string, additionalProps = {}) => {
    try {
      const repObj = reports.find((r) => r.id === repId);
      const { error } = await supabase
        .from("reports")
        .update({ sample_status: newStatus, ...additionalProps })
        .eq("id", repId);
      if (error) throw error;

      if (repObj) {
        notifySampleStatusWhatsApp(repObj, newStatus);
      }

      setMessage(`✅ Sample status updated to ${newStatus.toUpperCase()} & WhatsApp alert sent!`);
      setTimeout(() => setMessage(""), 4000);
      loadReports();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  const openProcessingModal = (rep: any) => {
    setSelectedReport(rep);
    let initialResults = rep.results_data;
    if (!Array.isArray(initialResults) || initialResults.length === 0) {
      if (rep.tests?.parameters && Array.isArray(rep.tests.parameters)) {
        initialResults = rep.tests.parameters.map((p: any) => ({
          parameter_name: p.name || "Parameter",
          observed_value: "",
          reference_range: p.range || "Standard Range",
          unit: p.unit || "unit",
          method: p.method || "Automated Analyser",
          is_abnormal: false,
        }));
      } else {
        initialResults = [
          { parameter_name: "Primary Clinical Parameter", observed_value: "", reference_range: "Standard", unit: "mg/dL", method: "Automated Analyser", is_abnormal: false }
        ];
      }
    }
    setResultsData(initialResults);
    setTechNotes(rep.notes || "");
    setShowResultsModal(true);
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("reports")
        .update({
          results_data: resultsData,
          notes: techNotes,
          sample_status: "completed",
          status: "completed"
        })
        .eq("id", selectedReport.id);
      if (error) throw error;
      notifySampleStatusWhatsApp(selectedReport, "completed");
      setMessage("✅ Laboratory readings saved & WhatsApp status alert sent to patient!");
      setTimeout(() => setMessage(""), 5000);
      setShowResultsModal(false);
      loadReports();
    } catch (err: any) {
      alert("Error saving readings: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stageReports = reports.filter((r) => {
    const st = r.sample_status || "pending";
    return st === activeStage;
  });

  const badgeStyle = (st: string) => {
    if (st === "pending") return { background: "#FEF3C7", color: "#D97706", border: "1px solid #F59E0B" };
    if (st === "collected") return { background: "#E0E7FF", color: "#4F46E5", border: "1px solid #6366F1" };
    if (st === "processing") return { background: "#EDE9FE", color: "#7C3AED", border: "1px solid #8B5CF6" };
    return { background: "#D1FAE5", color: "#059669", border: "1px solid #10B981" };
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    fontSize: "14px",
    fontWeight: 600,
  };

  return (
    <div className="flex-col gap-6">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.2 }}>
            🔬 Sample Tracker & Phlebotomy
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
            Track sample collection, barcoding, analyzer testing, and pathologist sign-off workflow
          </p>
        </div>
        <button onClick={loadReports} style={{ height: "44px", padding: "0 20px", borderRadius: "12px", background: "var(--primary-light)", color: "var(--primary)", border: "1px solid rgba(79, 70, 229, 0.2)", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", flexShrink: 0 }}>
          🔄 Refresh Queue
        </button>
      </div>


      {message && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "#ECFDF5", color: "#059669", fontWeight: 800, fontSize: "14px", border: "1px solid #10B981", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>🚀</span><span>{message}</span>
        </div>
      )}

      {/* Stage Navigation Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveStage("pending")}
          style={{ padding: "12px 24px", borderRadius: "16px", fontWeight: 800, fontSize: "14px", border: "1px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", background: activeStage === "pending" ? "#FEF3C7" : "var(--bg-card)", color: activeStage === "pending" ? "#D97706" : "var(--text-muted)", borderColor: activeStage === "pending" ? "#F59E0B" : "var(--border-color)" }}
        >
          <span>🕒</span><span>1. Pending Collection Queue ({reports.filter((r) => (!r.sample_status || r.sample_status === "pending")).length})</span>
        </button>
        <button
          onClick={() => setActiveStage("collected")}
          style={{ padding: "12px 24px", borderRadius: "16px", fontWeight: 800, fontSize: "14px", border: "1px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", background: activeStage === "collected" ? "#E0E7FF" : "var(--bg-card)", color: activeStage === "collected" ? "#4F46E5" : "var(--text-muted)", borderColor: activeStage === "collected" ? "#6366F1" : "var(--border-color)" }}
        >
          <span>🧪</span><span>2. Sampled & Barcoded ({reports.filter((r) => r.sample_status === "collected").length})</span>
        </button>
        <button
          onClick={() => setActiveStage("processing")}
          style={{ padding: "12px 24px", borderRadius: "16px", fontWeight: 800, fontSize: "14px", border: "1px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", background: activeStage === "processing" ? "#EDE9FE" : "var(--bg-card)", color: activeStage === "processing" ? "#7C3AED" : "var(--text-muted)", borderColor: activeStage === "processing" ? "#8B5CF6" : "var(--border-color)" }}
        >
          <span>🔬</span><span>3. In-Lab Testing ({reports.filter((r) => r.sample_status === "processing").length})</span>
        </button>
        <button
          onClick={() => setActiveStage("completed")}
          style={{ padding: "12px 24px", borderRadius: "16px", fontWeight: 800, fontSize: "14px", border: "1px solid", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", background: activeStage === "completed" ? "#D1FAE5" : "var(--bg-card)", color: activeStage === "completed" ? "#059669" : "var(--text-muted)", borderColor: activeStage === "completed" ? "#10B981" : "var(--border-color)" }}
        >
          <span>🛡️</span><span>4. Ready for Sign-off ({reports.filter((r) => r.sample_status === "completed").length})</span>
        </button>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", fontSize: "16px", fontWeight: 700 }}>
          ⏳ Loading medical sample queues...
        </div>
      ) : stageReports.length === 0 ? (
        <div style={{ background: "var(--bg-card)", borderRadius: "24px", padding: "60px", textAlign: "center", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>✨</span>
          <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)", margin: "0 0 8px" }}>No Samples in This Stage</h3>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>All patient samples for this workflow stage have been processed!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {stageReports.map((rep) => {
            const pat = rep.profiles || {};
            const br = rep.lab_branches || {};
            const testTitle = rep.tests?.name || rep.test_groups?.name || "Diagnostic Profile";
            const fullText = `${rep.notes || ""} ${pat.address || ""} ${pat.place || ""}`;
            const isGps = fullText.includes("GPS:") || fullText.includes("http");
            
            // Smart GPS coordinates extractor
            const coordMatch = fullText.match(/(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
            let mapsUrl = "";
            if (coordMatch) {
              mapsUrl = `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`;
            } else {
              // Try extracting Collection Address
              const addrMatch = fullText.match(/Collection Address:\s*(.*?)(?=\s*,\s*GPS:|\s*GPS:|$)/i);
              const targetAddr = addrMatch ? addrMatch[1].trim() : (pat.address || pat.place || pat.full_name || "Medical District");
              mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetAddr)}`;
            }

            const isExpanded = expandedCardId === rep.id;

            return (
              <div
                key={rep.id}
                onClick={() => setExpandedCardId(isExpanded ? null : rep.id)}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  border: isExpanded ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isExpanded ? "0 8px 24px rgba(79, 70, 229, 0.1)" : "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                {/* Compact Summary Row — Always Visible */}
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: "12px", flexShrink: 0,
                    background: pat.gender === "Female" ? "rgba(236, 72, 153, 0.1)" : "rgba(79, 70, 229, 0.1)",
                    color: pat.gender === "Female" ? "#EC4899" : "#4F46E5",
                    display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 900, fontSize: "16px",
                  }}>
                    {(pat.full_name || "P").charAt(0).toUpperCase()}
                  </div>

                  {/* Name + Test */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {pat.full_name || "Patient"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      🧪 {testTitle}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{ ...badgeStyle(rep.sample_status || "pending"), padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", flexShrink: 0 }}>
                    {(rep.sample_status || "pending").toUpperCase()}
                  </span>

                  {/* Chevron */}
                  <span style={{ fontSize: "14px", color: "var(--text-light)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>▼</span>
                </div>

                {/* Expandable Detail — Only when clicked */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    {/* Report ID + Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "14px 0" }}>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: "2px" }}>Report ID</div>
                        <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--primary)", fontFamily: "monospace" }}>{rep.report_number || rep.id.slice(0, 10).toUpperCase()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: "2px" }}>Branch</div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>📍 {br.name || "Main Lab"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: "2px" }}>Patient Info</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{pat.gender || "—"} · {pat.age ? `${pat.age} Yrs` : "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", marginBottom: "2px" }}>Phone</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>📞 {pat.phone_number || pat.phone || "—"}</div>
                      </div>
                    </div>

                    {/* Location / GPS */}
                    <div style={{ background: "#F0FDF4", padding: "12px", borderRadius: "12px", border: "1px solid #BBF7D0", marginBottom: "14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 900, color: "#15803D", textTransform: "uppercase", marginBottom: "4px" }}>
                        📍 {isGps ? "GPS Location" : "Collection Address"}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#0F172A", lineHeight: 1.4, marginBottom: "8px", maxHeight: "48px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {rep.notes || pat.address || pat.place || "Routine Sample / Walk-in"}
                      </div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          padding: "8px", background: "linear-gradient(135deg, #10B981, #059669)",
                          color: "white", fontWeight: 800, fontSize: "12px", borderRadius: "8px",
                          textDecoration: "none",
                        }}
                      >
                        🗺️ Navigate on Google Maps
                      </a>
                    </div>

                    {/* Stage Action Button */}
                    {(!rep.sample_status || rep.sample_status === "pending") && (
                      <button onClick={() => updateSampleStatus(rep.id, "collected")} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg, #4F46E5, #6366F1)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer" }}>
                        🟢 Mark Sample Collected & Barcoded
                      </button>
                    )}
                    {rep.sample_status === "collected" && (
                      <button onClick={() => updateSampleStatus(rep.id, "processing")} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg, #7C3AED, #8B5CF6)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer" }}>
                        🔬 Load into Analyser & Start Testing
                      </button>
                    )}
                    {rep.sample_status === "processing" && (
                      <button onClick={() => openProcessingModal(rep)} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer" }}>
                        📝 Record Parameter Readings & Submit
                      </button>
                    )}
                    {rep.sample_status === "completed" && (
                      <a href="/admin/reports" style={{ display: "block", width: "100%", padding: "12px", borderRadius: "12px", background: "#F1F5F9", color: "#1E293B", fontWeight: 800, fontSize: "13px", textAlign: "center", textDecoration: "none" }}>
                        🛡️ Go to Lab Reports for Sign-off
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Enter Analyser Readings Modal */}
      {showResultsModal && selectedReport && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", zIndex: 150, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "24px", padding: "32px", maxWidth: "800px", width: "100%", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)" }}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "28px" }}>🔬</span>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>Log Laboratory Analyser Readings</h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>For Report <strong>{selectedReport.report_number || selectedReport.id}</strong> | Patient: <strong>{selectedReport.profiles?.full_name || "Patient"}</strong></p>
                </div>
              </div>
              <button onClick={() => setShowResultsModal(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", color: "var(--text-main)", border: "none", fontWeight: 800, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleSaveResults} className="flex-col gap-6">
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "var(--text-main)", marginBottom: "12px", textTransform: "uppercase" }}>Test Parameters & Readings</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {resultsData.map((res: any, idx: number) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr 1.2fr 0.8fr auto", gap: "10px", alignItems: "center", background: res.is_abnormal ? "#FEF2F2" : "white", padding: "12px", borderRadius: "12px", border: "1px solid #CBD5E1" }}>
                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>Parameter</label>
                        <input style={{ ...inputStyle, padding: "6px 10px" }} value={res.parameter_name} onChange={(e) => { const copy = [...resultsData]; copy[idx].parameter_name = e.target.value; setResultsData(copy); }} required />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 800, color: res.is_abnormal ? "#DC2626" : "#4F46E5" }}>Observed Reading *</label>
                        <input style={{ ...inputStyle, padding: "6px 10px", fontWeight: 900, borderColor: res.is_abnormal ? "#DC2626" : "var(--border-color)", background: res.is_abnormal ? "#FEE2E2" : "white" }} placeholder="e.g. 14.5" value={res.observed_value} onChange={(e) => { const copy = [...resultsData]; copy[idx].observed_value = e.target.value; setResultsData(copy); }} required />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>Ref Range</label>
                        <input style={{ ...inputStyle, padding: "6px 10px" }} value={res.reference_range} onChange={(e) => { const copy = [...resultsData]; copy[idx].reference_range = e.target.value; setResultsData(copy); }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>Unit</label>
                        <input style={{ ...inputStyle, padding: "6px 10px" }} value={res.unit} onChange={(e) => { const copy = [...resultsData]; copy[idx].unit = e.target.value; setResultsData(copy); }} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <label style={{ fontSize: "11px", fontWeight: 800, color: res.is_abnormal ? "#DC2626" : "#64748B", display: "block" }}>Abnormal?</label>
                        <input type="checkbox" checked={res.is_abnormal || false} onChange={(e) => { const copy = [...resultsData]; copy[idx].is_abnormal = e.target.checked; setResultsData(copy); }} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#DC2626" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Technician Clinical Notes / Observations</label>
                <textarea style={{ ...inputStyle, height: 70 }} placeholder="e.g. Sample clear, mild hemolysis observed, re-verified twice." value={techNotes} onChange={(e) => setTechNotes(e.target.value)} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowResultsModal(false)} style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid #CBD5E1", background: "white", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 32px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}>
                  {submitting ? "⏳ Saving Readings..." : "📤 Submit to Pathologist for Signature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
