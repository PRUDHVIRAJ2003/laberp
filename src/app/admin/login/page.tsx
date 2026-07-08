"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Invalid credentials.");
    } else if (data.session) {
      // Validate role (support both 'admin' and 'super_admin')
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (profile?.role === "admin" || profile?.role === "super_admin") {
        window.location.href = "/admin";
      } else {
        setMessage("Access denied. Admin or Super Admin role required.");
        // Sign them out since they aren't an admin
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center py-12 px-4" style={{ minHeight: "100vh", backgroundColor: "var(--md-sys-color-background)" }}>
      <div className="card p-8 flex-col gap-6 w-full max-w-md shadow-lg" style={{ borderRadius: "24px", borderTop: "6px solid var(--google-red)" }}>
        
        <div className="text-center">
          <div className="inline-flex justify-center items-center mb-3" style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(234, 67, 53, 0.1)", color: "var(--google-red)", fontSize: "28px" }}>
            🛡️
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "var(--md-sys-color-on-background)", letterSpacing: "-0.5px" }}>
            Admin & Super Admin
          </h2>
          <p style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: "14px", marginTop: "4px" }}>
            LAB ERP Enterprise Management Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex-col gap-4">
          <div className="flex-col gap-1">
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Admin Email</label>
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
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary mt-2"
            style={{
              height: "52px",
              fontSize: "16px",
              fontWeight: 700,
              borderRadius: "14px",
              backgroundColor: "var(--google-red)",
              boxShadow: "0 6px 16px rgba(234, 67, 53, 0.35)",
            }}
            disabled={loading}
          >
            {loading ? "Verifying Access..." : "Sign In to Portal"}
          </button>
        </form>

        {message && (
          <div className="p-3 mt-2 text-center" style={{ borderRadius: "10px", backgroundColor: "rgba(234, 67, 53, 0.1)", color: "var(--google-red)", fontWeight: 600, fontSize: "14px" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
