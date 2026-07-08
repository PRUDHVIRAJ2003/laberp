"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function PatientPortal() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);


  // Signup specific fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [verifyOption, setVerifyOption] = useState<"whatsapp" | "email">("whatsapp");

  const supabase = createClient();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");


    try {
      if (activeTab === "signin") {
        if (method === "email") {
          const { error } = await supabase.auth.signInWithOtp({
            email: identifier,
            options: { shouldCreateUser: false },
          });
          if (error) setMessage("Error: " + error.message);
          else {
            setMessage("OTP sent to your email address!");
            setStep("verify");
          }
        } else {
          // Signin with WhatsApp OTP via our custom Baileys/fallback route
          const res = await fetch("/api/auth/whatsapp-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "request", phone: identifier }),
          });
          const data = await res.json();
          if (!res.ok) setMessage("Error: " + (data.error || "Failed to send WhatsApp OTP"));
          else {
            setMessage(data.message || "OTP sent to your WhatsApp!");
            setStep("verify");
          }
        }
      } else {
        // SIGNUP FLOW
        if (!firstName || !lastName || !age || !phone || !email) {
          setMessage("Please fill in all mandatory fields.");
          setLoading(false);
          return;
        }

        const metadata = {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          gender,
          age: parseInt(age, 10),
          phone_number: phone,
          email,
          role: "patient",
        };

        if (verifyOption === "email") {
          const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: { data: metadata, shouldCreateUser: true },
          });
          if (error) setMessage("Error: " + error.message);
          else {
            setIdentifier(email);
            setMethod("email");
            setMessage("Verification OTP sent to your Email!");
            setStep("verify");
          }
        } else {
          // WhatsApp OTP verification for Signup
          const res = await fetch("/api/auth/whatsapp-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "request", phone, metadata }),
          });
          const data = await res.json();
          if (!res.ok) setMessage("Error: " + (data.error || "Failed to send WhatsApp OTP"));
          else {
            setIdentifier(phone);
            setMethod("phone");
            setMessage(data.message || "Verification OTP sent via WhatsApp!");
            setStep("verify");
          }
        }
      }
    } catch (err: any) {
      setMessage("An unexpected error occurred: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (method === "email") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: identifier,
          token: otp,
          type: "email",
        });
        if (error) {
          setMessage("Invalid OTP code. Please try again.");
        } else if (data.session) {
          localStorage.setItem("patient_portal_session", JSON.stringify({
            userId: data.session.user.id,
            email: identifier,
            loggedInAt: Date.now()
          }));
          window.location.href = "/patient/dashboard";
        }
      } else {
        // WhatsApp verification
        const res = await fetch("/api/auth/whatsapp-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", phone: identifier, otp }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage("Error: " + (data.error || "Verification failed."));
        } else {
          localStorage.setItem("patient_portal_session", JSON.stringify({
            userId: data.userId || null,
            phone: identifier,
            loggedInAt: Date.now()
          }));
          setMessage("Verification successful! Redirecting...");
          window.location.href = "/patient/dashboard";
        }
      }
    } catch (err: any) {
      setMessage("Verification error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12 px-4" style={{ minHeight: "100vh", backgroundColor: "var(--md-sys-color-background)" }}>
      <div className="card p-8 flex-col gap-6 w-full max-w-lg shadow-lg" style={{ borderRadius: "24px", borderTop: "6px solid var(--google-blue)" }}>
        
        {/* Header Title */}
        <div className="text-center">
          <h2 style={{ fontSize: "28px", fontWeight: 800, color: "var(--md-sys-color-on-background)", letterSpacing: "-0.5px" }}>
            Patient Portal
          </h2>
          <p style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: "15px", marginTop: "4px" }}>
            Securely access your diagnostic reports & history
          </p>
        </div>

        {/* Navigation Tabs */}
        {step === "request" && (
          <div className="flex p-1 gap-1" style={{ backgroundColor: "var(--md-sys-color-surface-variant)", borderRadius: "14px" }}>
            <button
              type="button"
              className={`btn ${activeTab === "signin" ? "btn-primary shadow-sm" : "btn-text"}`}
              style={{ flex: 1, borderRadius: "12px", height: "42px", fontWeight: 600, fontSize: "15px" }}
              onClick={() => { setActiveTab("signin"); setMessage(""); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "signup" ? "btn-primary shadow-sm" : "btn-text"}`}
              style={{ flex: 1, borderRadius: "12px", height: "42px", fontWeight: 600, fontSize: "15px" }}
              onClick={() => { setActiveTab("signup"); setMessage(""); }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Step 1: Request OTP Form */}
        {step === "request" ? (
          <form onSubmit={handleRequestOtp} className="flex-col gap-4">
            
            {activeTab === "signin" ? (
              /* SIGN IN SECTION */
              <div className="flex-col gap-4 animate-fade-in-up">
                <div className="flex justify-center gap-2" style={{ backgroundColor: "rgba(66, 133, 244, 0.08)", padding: "4px", borderRadius: "10px" }}>
                  <button
                    type="button"
                    className={`btn ${method === "email" ? "btn-primary" : "btn-text"}`}
                    style={{ flex: 1, height: "36px", fontSize: "14px", borderRadius: "8px" }}
                    onClick={() => setMethod("email")}
                  >
                    Email Login
                  </button>
                  <button
                    type="button"
                    className={`btn ${method === "phone" ? "btn-primary" : "btn-text"}`}
                    style={{ flex: 1, height: "36px", fontSize: "14px", borderRadius: "8px" }}
                    onClick={() => setMethod("phone")}
                  >
                    WhatsApp Login
                  </button>
                </div>

                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>
                    {method === "email" ? "Registered Email Address" : "Registered WhatsApp Mobile Number"}
                  </label>
                  <input
                    type={method === "email" ? "email" : "tel"}
                    className="input-field"
                    placeholder={method === "email" ? "e.g. patient@gmail.com" : "e.g. +91 9876543210"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              /* SIGN UP SECTION */
              <div className="flex-col gap-4 animate-fade-in-up">
                <div className="grid grid-cols-2 gap-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Name *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Surname *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Gender *</label>
                    <select
                      className="input-field"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ height: "48px", backgroundColor: "var(--md-sys-color-surface)" }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Age *</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="Years"
                      min="1"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Mobile No (with Country Code) *</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="flex-col gap-1">
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)" }}>Email Address *</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="e.g. patient@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="flex-col gap-2 mt-2 p-3" style={{ backgroundColor: "rgba(52, 168, 83, 0.08)", borderRadius: "12px", border: "1px solid rgba(52, 168, 83, 0.2)" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--google-green)" }}>
                    Choose OTP Verification Method:
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "14px", fontWeight: 500 }}>
                      <input
                        type="radio"
                        name="verifyOption"
                        value="whatsapp"
                        checked={verifyOption === "whatsapp"}
                        onChange={() => setVerifyOption("whatsapp")}
                        style={{ accentColor: "var(--google-green)" }}
                      />
                      💬 WhatsApp OTP (Baileys)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "14px", fontWeight: 500 }}>
                      <input
                        type="radio"
                        name="verifyOption"
                        value="email"
                        checked={verifyOption === "email"}
                        onChange={() => setVerifyOption("email")}
                        style={{ accentColor: "var(--google-blue)" }}
                      />
                      ✉️ Email OTP
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary mt-2"
              style={{
                height: "52px",
                fontSize: "16px",
                fontWeight: 700,
                borderRadius: "14px",
                backgroundColor: activeTab === "signin" ? "var(--google-blue)" : "var(--google-green)",
                boxShadow: `0 6px 16px ${activeTab === "signin" ? "rgba(66, 133, 244, 0.35)" : "rgba(52, 168, 83, 0.35)"}`,
              }}
              disabled={loading}
            >
              {loading ? "Sending Code..." : activeTab === "signin" ? "Send Login OTP" : "Send Verification OTP"}
            </button>
          </form>
        ) : (
          /* Step 2: Verify OTP Form */
          <form onSubmit={handleVerifyOtp} className="flex-col gap-4 animate-fade-in-up">
            <div className="text-center p-4 mb-2" style={{ backgroundColor: "rgba(66, 133, 244, 0.06)", borderRadius: "12px" }}>
              <p style={{ fontSize: "14px", color: "var(--md-sys-color-on-surface-variant)" }}>
                We sent a 6-digit verification code to:
              </p>
              <strong style={{ fontSize: "16px", color: "var(--google-blue)" }}>{identifier}</strong>
            </div>



            <input
              type="text"
              className="input-field text-center"
              style={{ fontSize: "24px", letterSpacing: "8px", fontWeight: "bold", height: "60px" }}
              placeholder="••••••"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: "52px", fontSize: "16px", fontWeight: 700, borderRadius: "14px" }}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify & Enter Portal"}
            </button>

            <button
              type="button"
              className="btn btn-text"
              onClick={() => { setStep("request"); setOtp(""); setMessage(""); }}
              style={{ marginTop: "4px" }}
            >
              ← Change {method === "email" ? "Email" : "Mobile Number"}
            </button>
          </form>
        )}

        {/* Status Message Display */}
        {message && (
          <div
            className="p-3 mt-2 text-center animate-fade-in-up"
            style={{
              borderRadius: "10px",
              backgroundColor: message.startsWith("Error") || message.startsWith("Invalid") ? "rgba(234, 67, 53, 0.1)" : "rgba(52, 168, 83, 0.1)",
              color: message.startsWith("Error") || message.startsWith("Invalid") ? "var(--google-red)" : "var(--google-green)",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
