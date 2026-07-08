"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface DashboardStats {
  totalPatients: number;
  totalTests: number;
  testsDone: number;
  testsPending: number;
  samplesPending: number;
  totalBranches: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalTests: 0,
    testsDone: 0,
    testsPending: 0,
    samplesPending: 0,
    totalBranches: 0,
  });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const [
      { count: patientCount },
      { count: testCatalogCount },
      { count: publishedCount },
      { count: draftCount },
      { count: samplePendingCount },
      { count: branchCount },
      { data: recent },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "patient"),
      supabase.from("tests").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("sample_status", "pending"),
      supabase.from("lab_branches").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*, profiles(full_name, phone_number)").order("created_at", { ascending: false }).limit(8),
    ]);

    setStats({
      totalPatients: patientCount || 0,
      totalTests: testCatalogCount || 0,
      testsDone: publishedCount || 0,
      testsPending: draftCount || 0,
      samplesPending: samplePendingCount || 0,
      totalBranches: branchCount || 0,
    });
    setRecentReports(recent || []);
    setLoading(false);
  };

  const statCards = [
    {
      label: "Total Patients",
      value: stats.totalPatients,
      icon: "👥",
      gradient: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
      lightBg: "rgba(79, 70, 229, 0.08)",
      color: "#4F46E5",
      link: "/admin/patients",
      subtitle: "Registered in database",
    },
    {
      label: "Reports Completed",
      value: stats.testsDone,
      icon: "✅",
      gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
      lightBg: "rgba(16, 185, 129, 0.08)",
      color: "#059669",
      link: "/admin/reports",
      subtitle: "Verified & published",
    },
    {
      label: "Reports Pending",
      value: stats.testsPending,
      icon: "⏳",
      gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      lightBg: "rgba(245, 158, 11, 0.08)",
      color: "#D97706",
      link: "/admin/reports",
      subtitle: "Awaiting results",
    },
    {
      label: "Samples Pending",
      value: stats.samplesPending,
      icon: "🧫",
      gradient: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
      lightBg: "rgba(239, 68, 68, 0.08)",
      color: "#DC2626",
      link: "/admin/reports",
      subtitle: "To be collected",
    },
    {
      label: "Test Master Catalog",
      value: stats.totalTests,
      icon: "🧪",
      gradient: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
      lightBg: "rgba(139, 92, 246, 0.08)",
      color: "#7C3AED",
      link: "/admin/tests",
      subtitle: "Active test types",
    },
    {
      label: "Lab Branches",
      value: stats.totalBranches,
      icon: "🏥",
      gradient: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
      lightBg: "rgba(6, 182, 212, 0.08)",
      color: "#0891B2",
      link: "/admin/branches",
      subtitle: "Connected centers",
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "50vh" }}>
        <div className="flex items-center gap-3 p-6 rounded-2xl bg-white shadow-md border border-slate-100">
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>Loading Realtime Analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-8">
      {/* Page Welcome Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            Dashboard Overview
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 500 }}>
            Real-time analytics and laboratory workflow monitoring
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/patients"
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: "white",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              transition: "all 0.2s",
            }}
          >
            + Register Patient
          </Link>
          <Link
            href="/admin/reports"
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              background: "var(--primary-gradient)",
              color: "white",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
              boxShadow: "var(--shadow-glow)",
              transition: "all 0.2s",
            }}
          >
            + New Lab Report
          </Link>
        </div>
      </div>

      {/* Modern Stat Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.link}
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "24px",
              border: "1px solid var(--border-color)",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "16px",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)",
              transition: "all 0.25s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 16px 32px -8px rgba(15, 23, 42, 0.08)";
              e.currentTarget.style.borderColor = card.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.03)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            {/* Top row: Label + Gradient Icon Box */}
            <div className="flex justify-between items-start">
              <div>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  {card.label}
                </span>
                <p style={{ fontSize: "12px", color: "var(--text-light)", fontWeight: 500, marginTop: "2px" }}>
                  {card.subtitle}
                </p>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "16px",
                  background: card.lightBg,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "24px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                }}
              >
                {card.icon}
              </div>
            </div>

            {/* Bottom row: Value + Arrow */}
            <div className="flex justify-between items-baseline mt-2">
              <span style={{ fontSize: "42px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", lineHeight: 1 }}>
                {card.value.toLocaleString()}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: card.color, display: "flex", alignItems: "center", gap: "4px" }}>
                Explore &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Reports Section */}
      <div
        style={{
          background: "white",
          borderRadius: "24px",
          border: "1px solid var(--border-color)",
          boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.03)",
          overflow: "hidden",
        }}
      >
        <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border-color)", background: "#FAFAFE" }}>
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-main)" }}>Recent Lab Reports</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>Latest test evaluations generated across branches</p>
          </div>
          <Link
            href="/admin/reports"
            style={{
              padding: "8px 16px",
              borderRadius: "10px",
              background: "white",
              border: "1px solid var(--border-color)",
              color: "var(--primary)",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
              transition: "all 0.2s",
            }}
          >
            View All Reports &rarr;
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "14px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Patient Name</th>
                <th style={{ padding: "14px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contact</th>
                <th style={{ padding: "14px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Report Status</th>
                <th style={{ padding: "14px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sample Status</th>
                <th style={{ padding: "14px 24px", fontWeight: 700, fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "64px 24px", textAlign: "center" }}>
                    <div className="flex-col items-center gap-3">
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "28px", margin: "0 auto" }}>
                        📑
                      </div>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>No Reports Generated Yet</p>
                      <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "400px", margin: "0 auto" }}>
                        When lab technicians or branch administrators create test reports for patients, they will show up here instantly.
                      </p>
                      <Link
                        href="/admin/reports"
                        style={{
                          marginTop: "8px",
                          padding: "10px 20px",
                          borderRadius: "12px",
                          background: "var(--primary-gradient)",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "13px",
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        Create First Report &rarr;
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s" }} onMouseOver={(e) => (e.currentTarget.style.background = "#FAFAFE")} onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "16px 24px" }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: 36, height: 36, borderRadius: "10px", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 800, fontSize: "14px" }}>
                          {report.profiles?.full_name ? report.profiles.full_name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "14px" }}>
                          {report.profiles?.full_name || "Unknown Patient"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                      {report.profiles?.phone_number || "—"}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span
                        style={{
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: report.status === "published" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                          color: report.status === "published" ? "#059669" : "#D97706",
                          border: `1px solid ${report.status === "published" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: report.status === "published" ? "#059669" : "#D97706" }} />
                        {report.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span
                        style={{
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: report.sample_status === "completed" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: report.sample_status === "completed" ? "#059669" : "#DC2626",
                        }}
                      >
                        {report.sample_status ? report.sample_status.toUpperCase() : "PENDING"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500 }}>
                      {new Date(report.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
