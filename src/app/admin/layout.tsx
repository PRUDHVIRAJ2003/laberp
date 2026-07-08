"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  useEffect(() => {
    async function loadAdminProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/admin/login";
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*, lab_branches(name)")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!prof || (prof.role !== "admin" && prof.role !== "super_admin")) {
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
        return;
      }

      setProfile(prof);
      setLoading(false);
    }
    loadAdminProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "100vh", background: "var(--bg-gradient)" }}>
        <div className="card p-8 flex-col items-center gap-4 shadow-lg" style={{ borderRadius: "20px", background: "white" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #E2E8F0", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>Verifying Portal Access...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = profile?.role === "super_admin";

  const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "14px",
    fontSize: "14px",
    fontWeight: isActive ? 700 : 500,
    color: isActive ? "#FFFFFF" : "var(--text-muted)",
    background: isActive ? "var(--primary-gradient)" : "transparent",
    boxShadow: isActive ? "var(--shadow-glow)" : "none",
    textDecoration: "none",
    transition: "all 0.2s ease",
  });

  const superAdminLinkStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "14px",
    fontSize: "14px",
    fontWeight: isActive ? 700 : 600,
    color: isActive ? "#FFFFFF" : "#B45309",
    background: isActive ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "rgba(245, 158, 11, 0.08)",
    boxShadow: isActive ? "0 8px 20px -6px rgba(245, 158, 11, 0.5)" : "none",
    textDecoration: "none",
    transition: "all 0.2s ease",
  });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-main)" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: "260px",
          minWidth: "260px",
          background: "#FFFFFF",
          borderRight: "1px solid var(--border-color)",
          boxShadow: "4px 0 24px rgba(15, 23, 42, 0.03)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          zIndex: 30,
        }}
      >
        <div>
          {/* Brand Logo Header */}
          <div className="p-6 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)", background: "linear-gradient(to bottom, #FAFAFE, #FFFFFF)" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: isSuperAdmin ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "var(--primary-gradient)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "white",
                fontWeight: 900,
                fontSize: "20px",
                boxShadow: isSuperAdmin ? "0 6px 16px rgba(245, 158, 11, 0.4)" : "var(--shadow-glow)",
              }}
            >
              {isSuperAdmin ? "★" : "⚡"}
            </div>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                LAB <span style={{ background: "var(--primary-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ERP</span>
              </h2>
              <span style={{ fontSize: "11px", fontWeight: 800, color: isSuperAdmin ? "#D97706" : "var(--primary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                {isSuperAdmin ? "Enterprise Suite" : "Branch Portal"}
              </span>
            </div>
          </div>

          {/* Nav Items — Scrollable */}
          <nav className="flex-col gap-1.5 p-4" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-light)", padding: "8px 12px 4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              General Operations
            </div>
            <Link href="/admin" style={navLinkStyle(pathname === "/admin")}>
              <span style={{ fontSize: "18px" }}>📊</span> Dashboard
            </Link>
            <Link href="/admin/patients" style={navLinkStyle(pathname === "/admin/patients")}>
              <span style={{ fontSize: "18px" }}>👥</span> Patients Manager
            </Link>
            <Link href="/admin/reports" style={navLinkStyle(pathname === "/admin/reports")}>
              <span style={{ fontSize: "18px" }}>📑</span> Lab Reports
            </Link>
            <Link href="/admin/samples" style={navLinkStyle(pathname?.startsWith("/admin/samples") || false)}>
              <span style={{ fontSize: "18px" }}>🔬</span> Sample Tracker & Phlebotomy
            </Link>
            <Link href="/admin/invoices" style={navLinkStyle(pathname?.startsWith("/admin/invoices") || false)}>
              <span style={{ fontSize: "18px" }}>💳</span> Invoices & Contracts
            </Link>
            <Link href="/admin/whatsapp" style={navLinkStyle(pathname?.startsWith("/admin/whatsapp") || false)}>
              <span style={{ fontSize: "18px" }}>💬</span> WhatsApp Gateway
            </Link>
            <Link href="/admin/settings" style={navLinkStyle(pathname?.startsWith("/admin/settings") || false)}>
              <span style={{ fontSize: "18px" }}>⚙️</span> Settings & UPI QR
            </Link>

            <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-light)", padding: "16px 12px 4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Test Management
            </div>
            <Link href="/admin/tests" style={navLinkStyle(pathname?.startsWith("/admin/tests") || false)}>
              <span style={{ fontSize: "18px" }}>🧪</span> Test Master
            </Link>
            <Link href="/admin/groups" style={navLinkStyle(pathname?.startsWith("/admin/groups") || false)}>
              <span style={{ fontSize: "18px" }}>📦</span> Group Panels
            </Link>

            {/* SUPER ADMIN ONLY MENU */}
            {isSuperAdmin && (
              <>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#D97706", padding: "20px 12px 4px", textTransform: "uppercase", letterSpacing: "0.8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>★</span> Super Admin Controls
                </div>
                <Link href="/admin/branches" style={superAdminLinkStyle(pathname?.startsWith("/admin/branches") || false)}>
                  <span style={{ fontSize: "18px" }}>🏥</span> Lab Branches
                </Link>
                <Link href="/admin/users" style={superAdminLinkStyle(pathname?.startsWith("/admin/users") || false)}>
                  <span style={{ fontSize: "18px" }}>🔐</span> User & Role Manager
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Sign Out Footer */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border-color)", background: "#FAFAFE" }}>
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              background: "white",
              color: "#EF4444",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "white")}
          >
            <span>🚪</span> Sign Out Portal
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-main)" }}>
        {/* Top Glass Header */}
        <header
          style={{
            minHeight: "64px",
            padding: "0 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border-color)",
            zIndex: 20,
            flexShrink: 0,
          }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.5px" }}>
                {isSuperAdmin ? "Enterprise Headquarters" : profile?.lab_branches?.name || "Lab Branch Portal"}
              </h2>
              {isSuperAdmin && (
                <span style={{ padding: "3px 10px", borderRadius: "20px", background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)", border: "1px solid #FCD34D", color: "#D97706", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px" }}>
                  ★ GLOBAL ACCESS
                </span>
              )}
            </div>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
              Connected as <strong style={{ color: "var(--text-main)" }}>{profile?.email}</strong>
            </span>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-col text-right">
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                {profile?.first_name || profile?.full_name || "Administrator"}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: isSuperAdmin ? "#D97706" : "var(--primary)" }}>
                {isSuperAdmin ? "System Super Admin" : "Branch Operations"}
              </span>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                background: isSuperAdmin ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "var(--primary-gradient)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "white",
                fontWeight: 800,
                fontSize: "18px",
                boxShadow: isSuperAdmin ? "0 6px 16px rgba(245, 158, 11, 0.3)" : "var(--shadow-glow)",
              }}
            >
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "A"}
            </div>
          </div>
        </header>

        {/* Page Content — Scrollable */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "28px 32px" }}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
