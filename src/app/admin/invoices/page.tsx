"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function InvoicesAndContractsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit Billing / Contract Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [specimenName, setSpecimenName] = useState("Whole Blood (EDTA)");
  const [sampleType, setSampleType] = useState("Routine Blood / Serum");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [standardPrice, setStandardPrice] = useState("500");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [contractName, setContractName] = useState("Standard Patient Rate");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [activeTab, setActiveTab] = useState<"list" | "settings">("list");
  const [labInchargeUpi, setLabInchargeUpi] = useState("labincharge@okicici");
  const [payeeName, setPayeeName] = useState("Just LAB ERP");
  const [invPrefix, setInvPrefix] = useState("INV-");
  const [repPrefix, setRepPrefix] = useState("REP-");
  const [idFormatStyle, setIdFormatStyle] = useState("year");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [activeDropdownInvoice, setActiveDropdownInvoice] = useState<{ id: string; x: number; y: number } | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  // Branch-Wise Invoice Setup States
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("default");
  const [allBranchConfigs, setAllBranchConfigs] = useState<Record<string, any>>({});
  const [setupLogoUrl, setSetupLogoUrl] = useState("");
  const [setupLabName, setSetupLabName] = useState("Just LAB Diagnostic & Research Center");
  const [setupLabTagline, setSetupLabTagline] = useState("Precision Pathology & Molecular Diagnostics");
  const [setupInvoiceNote, setSetupInvoiceNote] = useState(
    "Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims."
  );
  const [setupSignatoryName, setSetupSignatoryName] = useState("Authorized Billing Officer");
  const [setupSignatoryDesignation, setSetupSignatoryDesignation] = useState("Head Cashier / Billing In-charge");
  const [setupSignatureImg, setSetupSignatureImg] = useState("");

  const [currentUserProfile, setCurrentUserProfile] = useState<{ role?: string; branch_id?: string; email?: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownInvoice(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchBranchesAndUser();
    loadStoredSettings();
  }, []);

  async function fetchBranchesAndUser() {
    const { data } = await supabase.from("lab_branches").select("*").order("name");
    if (data) setBranches(data);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setCurrentUserProfile({
        role: profile?.role || "admin",
        branch_id: profile?.branch_id || "",
        email: session.user.email,
      });
      if (profile?.role !== "super_admin" && profile?.branch_id) {
        setSelectedBranchId(profile.branch_id);
      }
    }
  }

  const loadStoredSettings = () => {
    try {
      const stored = localStorage.getItem("lab_erp_invoice_setup_branches");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAllBranchConfigs(parsed);
        applyBranchConfig("default", parsed);
      } else {
        const savedUpi = localStorage.getItem("lab_erp_upi_config") || "labincharge@okicici";
        const savedPayee = localStorage.getItem("lab_erp_payee_config") || "Just LAB ERP";
        applyBranchConfig("default", {
          default: {
            upiId: savedUpi,
            payeeName: savedPayee,
            labName: "Just LAB Diagnostic & Research Center",
            labTagline: "Precision Pathology & Molecular Diagnostics",
            invoiceNote: "Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims.",
            signatoryName: "Authorized Billing Officer",
            signatoryDesignation: "Head Cashier / Billing In-charge",
            logoUrl: "",
            signatureImg: ""
          }
        });
      }
    } catch (e) {}
  };

  const applyBranchConfig = (bId: string, store: Record<string, any> = allBranchConfigs) => {
    const conf = store[bId] || store["default"] || {};
    setLabInchargeUpi(conf.upiId || "labincharge@okicici");
    setPayeeName(conf.payeeName || "Just LAB ERP");
    setSetupLogoUrl(conf.logoUrl || "");
    setSetupLabName(conf.labName || "Just LAB Diagnostic & Research Center");
    setSetupLabTagline(conf.labTagline || "Precision Pathology & Molecular Diagnostics");
    setSetupInvoiceNote(
      conf.invoiceNote ||
        "Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims."
    );
    setSetupSignatoryName(conf.signatoryName || "Authorized Billing Officer");
    setSetupSignatoryDesignation(conf.signatoryDesignation || "Head Cashier / Billing In-charge");
    setSetupSignatureImg(conf.signatureImg || "");
  };

  const handleBranchSelectChange = (bId: string) => {
    setSelectedBranchId(bId);
    applyBranchConfig(bId);
  };

  const saveBranchInvoiceSetup = () => {
    const updated = {
      ...allBranchConfigs,
      [selectedBranchId]: {
        upiId: labInchargeUpi,
        payeeName: payeeName,
        logoUrl: setupLogoUrl,
        labName: setupLabName,
        labTagline: setupLabTagline,
        invoiceNote: setupInvoiceNote,
        signatoryName: setupSignatoryName,
        signatoryDesignation: setupSignatoryDesignation,
        signatureImg: setupSignatureImg,
      },
    };
    setAllBranchConfigs(updated);
    localStorage.setItem("lab_erp_invoice_setup_branches", JSON.stringify(updated));
    setMessage(`✔ Invoice & UPI configuration saved for ${selectedBranchId === "default" ? "All Branches (Default)" : "selected branch"}!`);
    setTimeout(() => setMessage(""), 4000);
  };

  const getInvoiceConfigForBranch = (bId?: string) => {
    const key = bId || "default";
    const conf = allBranchConfigs[key] || allBranchConfigs["default"] || {};
    return {
      logoUrl: conf.logoUrl || setupLogoUrl,
      labName: conf.labName || setupLabName || "Just LAB Diagnostic & Research Center",
      labTagline: conf.labTagline || setupLabTagline || "Precision Pathology & Molecular Diagnostics",
      invoiceNote:
        conf.invoiceNote ||
        setupInvoiceNote ||
        "Thank you for choosing LAB ERP for your diagnostic healthcare needs. This electronic receipt is valid for tax reimbursement and insurance claims.",
      signatoryName: conf.signatoryName || setupSignatoryName || "Authorized Billing Officer",
      signatoryDesignation: conf.signatoryDesignation || setupSignatoryDesignation || "Head Cashier / Billing In-charge",
      signatureImg: conf.signatureImg || setupSignatureImg,
      upiId: conf.upiId || labInchargeUpi || "labincharge@okicici",
      payeeName: conf.payeeName || payeeName || "Just LAB ERP",
    };
  };

  const handleImageUpload = (file: File, setter: (val: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*, profiles(*), tests(*), test_groups(*), lab_branches(*)")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReports(data);
    }
    setLoading(false);
  }

  const openEditModal = (rep: any) => {
    setCurrentReport(rep);
    setSpecimenName(rep.specimen_name || "Whole Blood (EDTA)");
    setSampleType(rep.sample_type || "Routine Blood / Serum");
    
    let generatedInv = rep.invoice_number;
    if (!generatedInv) {
      const yr = new Date().getFullYear();
      const code = rep.id?.slice(0, 6).toUpperCase() || Math.floor(100000 + Math.random() * 900000);
      if (idFormatStyle === "short") generatedInv = `${invPrefix}${code}`;
      else if (idFormatStyle === "branch") generatedInv = `${invPrefix}LAB-${yr}-${code}`;
      else generatedInv = `${invPrefix}${yr}-${code}`;
    }
    setInvoiceNumber(generatedInv);
    
    // Default price from test or group
    const defPrice = rep.standard_price || rep.tests?.price || rep.test_groups?.price || 500;
    setStandardPrice(String(defPrice));
    setDiscountAmount(String(rep.discount_amount || 0));
    setContractName(rep.contract_name || "Standard Patient Rate");
    setPaymentStatus(rep.payment_status || "paid");
    setShowEditModal(true);
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReport) return;
    setSubmitting(true);

    const std = Number(standardPrice) || 0;
    const disc = Number(discountAmount) || 0;
    const net = Math.max(0, std - disc);

    const { error } = await supabase
      .from("reports")
      .update({
        specimen_name: specimenName,
        sample_type: sampleType,
        invoice_number: invoiceNumber,
        standard_price: std,
        discount_amount: disc,
        net_amount: net,
        contract_name: contractName,
        payment_status: paymentStatus,
      })
      .eq("id", currentReport.id);

    setSubmitting(false);
    if (error) {
      alert("Error saving billing: " + error.message);
    } else {
      setMessage("✅ Billing, Invoice & Contract details successfully updated!");
      setShowEditModal(false);
      fetchInvoices();
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Generate & Download Official Tax Invoice PDF
  const downloadInvoicePdf = async (rep: any) => {
    const doc = new jsPDF("p", "mm", "a4");
    const invNum = rep.invoice_number || `INV-${new Date().getFullYear()}-${rep.id?.slice(0, 6).toUpperCase()}`;
    const patName = rep.profiles?.full_name || `${rep.profiles?.first_name || ""} ${rep.profiles?.last_name || ""}`.trim() || "Valued Patient";
    const branchId = rep.branch_id || rep.lab_branches?.id;
    let branchUpi = labInchargeUpi || "labincharge@okicici";
    let branchPayee = "Just LAB ERP";
    try {
      const storedV2 = localStorage.getItem("justlab_erp_settings_v2");
      if (storedV2) {
        const parsedV2 = JSON.parse(storedV2);
        const bSet = (branchId && parsedV2[branchId]) || parsedV2["default"];
        if (bSet?.upiId) branchUpi = bSet.upiId;
        if (bSet?.payeeName) branchPayee = bSet.payeeName;
      } else {
        const storedV1 = localStorage.getItem("justlab_erp_settings");
        if (storedV1) {
          const parsedV1 = JSON.parse(storedV1);
          if (parsedV1?.upiId) branchUpi = parsedV1.upiId;
          if (parsedV1?.payeeName) branchPayee = parsedV1.payeeName;
        }
      }
    } catch (e) {}

    const brName = rep.lab_branches?.name || "Main Diagnostic Hub";
    const brAddr = rep.lab_branches?.address || "Medical District Sector 5, India";
    const brPhone = rep.lab_branches?.contact_phone || "+91 98765 43210";

    const std = Number(rep.standard_price || rep.tests?.price || rep.test_groups?.price || 500);
    const disc = Number(rep.discount_amount || 0);
    const net = rep.net_amount !== undefined && rep.net_amount !== null ? Number(rep.net_amount) : Math.max(0, std - disc);

    // Fetch UPI QR Code Image buffer from api.qrserver.com
    let qrBase64 = "";
    try {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(branchUpi)}&pn=${encodeURIComponent(branchPayee)}&am=${net.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invNum}`)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;
      const qrRes = await fetch(qrUrl);
      const qrBuf = await qrRes.arrayBuffer();
      const base64 = btoa(new Uint8Array(qrBuf).reduce((data, byte) => data + String.fromCharCode(byte), ""));
      qrBase64 = `data:image/png;base64,${base64}`;
    } catch (e) {
      console.warn("Could not fetch UPI QR code for client PDF:", e);
    }

    // Header Banner
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text("Just LAB ERP", 14, 20);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text("Official Clinical & Tax Receipt", 14, 26);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(brName, 196, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(brAddr, 196, 23, { align: "right" });
    doc.text(`Phone: ${brPhone}`, 196, 28, { align: "right" });

    // Divider Line
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.8);
    doc.line(14, 33, 196, 33);

    // Left Box: Patient & Billing To
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 38, 92, 34, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("BILLED TO (PATIENT)", 18, 45);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(patName, 18, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${rep.profiles?.phone_number || rep.profiles?.phone || "—"}`, 18, 58);
    doc.text(`Specimen: ${rep.specimen_name || "Whole Blood (EDTA)"}`, 18, 64);

    // Right Box: Invoice Record Metadata
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(110, 38, 86, 34, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("INVOICE RECORD & STATUS", 114, 45);
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text(invNum, 114, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date: ${new Date(rep.created_at || Date.now()).toLocaleDateString("en-IN")}`, 114, 58);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`Payment Status: ${(rep.payment_status || "PAID").toUpperCase()}`, 114, 64);

    const afterMetaY = 80;

    // Billing Line Items Table
    autoTable(doc, {
      startY: afterMetaY,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9.5, cellPadding: 5, textColor: [30, 41, 59], fontStyle: "bold" },
      head: [["Description / Diagnostic Profile", "Contract Agreement Rate", "Standard Price", "Discount / Adjustment", "Net Payable Amount"]],
      body: [
        [
          rep.tests?.name || rep.test_groups?.name || "Laboratory Diagnostic Service",
          rep.contract_name || "Standard Patient Rate",
          `Rs. ${std.toFixed(2)}`,
          disc > 0 ? `- Rs. ${disc.toFixed(2)}` : "Rs. 0.00",
          `Rs. ${net.toFixed(2)}`
        ]
      ],
      foot: [
        ["", "", "", "TOTAL NET AMOUNT:", `Rs. ${net.toFixed(2)} INR`]
      ],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 10 }
    });

    const afterTableY = Math.max((doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 14 : 140, 140);

    // UPI Payment Box with Real QR Code
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, afterTableY - 4, 115, 30, 3, 3, "F");

    if (qrBase64) {
      try {
        doc.addImage(qrBase64, "PNG", 17, afterTableY - 1, 24, 24);
      } catch (err) {
        console.warn("Error adding QR image to PDF:", err);
      }
    }

    const textX = qrBase64 ? 45 : 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text("INSTANT UPI PAYMENT (GPay / PhonePe / Paytm)", textX, afterTableY + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Payee UPI ID: ${branchUpi}`, textX, afterTableY + 9);
    doc.text(`Amount Due: Rs. ${net.toFixed(2)} INR`, textX, afterTableY + 15);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Scan QR with any UPI app to pay instantly.", textX, afterTableY + 21);

    // Footer & Signature (Separated cleanly below the UPI box!)
    const footerY = afterTableY + 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text("[SEALED] OFFICIAL TAX INVOICE — DIGITALLY VERIFIED", 14, footerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Thank you for choosing LAB ERP for your diagnostic healthcare needs.", 14, footerY + 6);
    doc.text("This electronic receipt is valid for tax reimbursement and insurance claims.", 14, footerY + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text("Authorized Billing Signatory", 196, footerY + 4, { align: "right" });
    doc.setFont("times", "italic");
    doc.setFontSize(12);
    doc.text(brName, 196, footerY + 10, { align: "right" });

    doc.save(`${invNum}-${patName.replace(/\s+/g, "_")}.pdf`);
  };

  // Send Merged Report + Invoice via Email & WhatsApp
  const sendMergedNotifications = async (rep: any) => {
    setMessage("⏳ Dispatching Merged PDF (Clinical Report + Official Invoice) to Patient Email & WhatsApp...");
    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify_both",
          reportId: rep.id,
          patient_name: rep.profiles?.full_name || `${rep.profiles?.first_name || ""} ${rep.profiles?.last_name || ""}`.trim() || "Valued Patient",
          patient_email: rep.profiles?.email || "",
          patient_phone: rep.profiles?.phone_number || rep.profiles?.phone || "",
          report_number: rep.report_number || rep.id?.slice(0, 8).toUpperCase(),
          branch_name: rep.lab_branches?.name || "Main Diagnostic Hub",
          invoice_number: rep.invoice_number || `INV-${rep.id?.slice(0, 6).toUpperCase()}`,
          net_amount: rep.net_amount || rep.standard_price || 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send notifications");
      setMessage("🎉 Merged Report + Official Tax Invoice PDF successfully dispatched to patient's Email & WhatsApp!");
      setTimeout(() => setMessage(""), 7000);
    } catch (e: any) {
      alert("Notification Error: " + e.message);
      setMessage("");
    }
  };

  const isSuperAdmin = !currentUserProfile || currentUserProfile.role === "super_admin" || currentUserProfile.email === "reports@prudhvirajchalapaka.in" || (!currentUserProfile.branch_id && currentUserProfile.role === "admin");

  const filteredReports = reports.filter((r) => {
    if (!isSuperAdmin && currentUserProfile?.branch_id && r.branch_id !== currentUserProfile.branch_id) {
      return false;
    }
    const name = r.profiles?.full_name || `${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}`.trim() || "";
    const inv = r.invoice_number || r.report_number || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || inv.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterStatus === "all") return matchesSearch;
    return matchesSearch && (r.payment_status || "paid") === filterStatus;
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #CBD5E1",
    fontSize: "13px",
    background: "#F8FAFC",
    outline: "none",
    fontWeight: 600,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 800,
    color: "#64748B",
    marginBottom: "5px",
    display: "block",
    textTransform: "uppercase",
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto" style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Header Banner */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b flex-wrap gap-4" style={{ borderColor: "#E2E8F0" }}>
        <div>
          <div className="flex items-center gap-3">
            <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
              💳
            </div>
            <div>
              <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
                Invoices, Specimens & Contracts
              </h1>
              <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0", fontWeight: 600 }}>
                Manage specimen details, apply rate discounts, corporate agreements, and dispatch merged billing receipts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <input
            placeholder="🔍 Search patient name or invoice ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: "10px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", width: "260px", background: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, background: "white", cursor: "pointer" }}
          >
            <option value="all">⚡ All Payment Statuses</option>
            <option value="paid">✅ Paid Invoices</option>
            <option value="unpaid">⚠️ Unpaid / Pending</option>
            <option value="partial">⏳ Partial Payment</option>
            <option value="waived">🎁 Waived / Contract Free</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab("list")}
          style={{
            padding: "12px 24px",
            borderRadius: "14px",
            border: "none",
            background: activeTab === "list" ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" : "white",
            color: activeTab === "list" ? "white" : "#475569",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeTab === "list" ? "0 10px 20px -5px rgba(15, 23, 42, 0.3)" : "0 2px 5px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <span>📑</span><span>Invoices & Billing Receipts</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          style={{
            padding: "12px 24px",
            borderRadius: "14px",
            border: "none",
            background: activeTab === "settings" ? "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)" : "white",
            color: activeTab === "settings" ? "white" : "#475569",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeTab === "settings" ? "0 10px 20px -5px rgba(79, 70, 229, 0.3)" : "0 2px 5px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <span>⚙️</span><span>Invoice Setup & Configuration (Branch-wise)</span>
        </button>
      </div>

      {message && (
        <div style={{ padding: "14px 20px", borderRadius: "14px", background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", fontWeight: 700, fontSize: "14px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.1)" }}>
          <span>🔔</span>
          <span>{message}</span>
        </div>
      )}

      {/* Invoices List Table */}
      {activeDropdownInvoice && (() => {
        const inv = filteredReports.find((item: any) => item.id === activeDropdownInvoice.id);
        if (!inv) return null;
        return (
          <div
            style={{
              position: "fixed",
              top: activeDropdownInvoice.y,
              left: activeDropdownInvoice.x,
              width: "220px",
              background: "#FFFFFF",
              borderRadius: "14px",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.25)",
              border: "1px solid #E2E8F0",
              zIndex: 9999,
              overflow: "hidden",
              padding: "6px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setActiveDropdownInvoice(null);
                setPreviewInvoice(inv);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#1E293B",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              👁️ Preview Official Invoice
            </button>
            <button
              onClick={() => {
                setActiveDropdownInvoice(null);
                downloadInvoicePdf(inv);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#059669",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              📄 Download Tax Invoice PDF
            </button>
            <button
              onClick={() => {
                setActiveDropdownInvoice(null);
                openEditModal(inv);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              ✏️ Edit Billing & Specimen
            </button>
            <div style={{ height: "1px", background: "#E2E8F0", margin: "4px 0" }} />
            <button
              onClick={() => {
                setActiveDropdownInvoice(null);
                sendMergedNotifications(inv);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#7C3AED",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              🚀 Send Merged Receipt
            </button>
          </div>
        );
      })()}

      {/* Official Tax Invoice Preview Modal (Full A4 Hospital Layout) */}
      {previewInvoice && (() => {
        const invNum = previewInvoice.invoice_number || `INV-${new Date().getFullYear()}-${previewInvoice.id?.slice(0, 6).toUpperCase()}`;
        const patName = previewInvoice.profiles?.full_name || `${previewInvoice.profiles?.first_name || ""} ${previewInvoice.profiles?.last_name || ""}`.trim() || "Valued Patient";
        const brName = previewInvoice.lab_branches?.name || "Main Diagnostic Hub";
        const brAddr = previewInvoice.lab_branches?.address || "Medical District Sector 5, India";
        const brPhone = previewInvoice.lab_branches?.contact_phone || "+91 98765 43210";
        const std = Number(previewInvoice.standard_price || previewInvoice.tests?.price || previewInvoice.test_groups?.price || 500);
        const disc = Number(previewInvoice.discount_amount || 0);
        const net = previewInvoice.net_amount !== undefined && previewInvoice.net_amount !== null ? Number(previewInvoice.net_amount) : Math.max(0, std - disc);
        const conf = getInvoiceConfigForBranch(previewInvoice.branch_id || previewInvoice.lab_branches?.id);

        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.82)", backdropFilter: "blur(12px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "24px" }}>
            <div style={{ background: "#FFFFFF", borderRadius: "24px", width: "100%", maxWidth: "860px", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 60px -15px rgba(0,0,0,0.6)", border: "1px solid #E2E8F0" }}>
              {/* Header Action Bar */}
              <div style={{ padding: "18px 26px", background: "#0F172A", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1E293B" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "24px" }}>🧾</span>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 900, margin: 0 }}>Official Tax Invoice Preview ({invNum})</h3>
                    <span style={{ fontSize: "12px", color: "#94A3B8" }}>Hospital Diagnostic & Clinical Testing Receipt</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => downloadInvoicePdf(previewInvoice)}
                    style={{ padding: "10px 20px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}
                  >
                    📄 Download PDF
                  </button>
                  <button
                    onClick={() => setPreviewInvoice(null)}
                    style={{ width: 38, height: 38, borderRadius: "50%", background: "#1E293B", color: "#94A3B8", border: "none", cursor: "pointer", fontWeight: 800, fontSize: "16px" }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Sheet (Simulating A4 Paper Document) */}
              <div style={{ padding: "36px", overflowY: "auto", flex: 1, background: "#F1F5F9" }}>
                <div style={{ background: "white", borderRadius: "16px", padding: "40px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #E2E8F0" }}>
                  {/* Brand Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #4F46E5", paddingBottom: "24px", marginBottom: "28px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {conf.logoUrl && (
                        <img src={conf.logoUrl} alt="Lab Logo" style={{ height: 64, width: 64, objectFit: "contain" }} />
                      )}
                      <div>
                        <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
                          {conf.labName}
                        </h1>
                        <span style={{ fontSize: "13px", color: "#4F46E5", fontWeight: 700 }}>
                          {conf.labTagline}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: 900, color: "#0F172A" }}>{brName}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>{brAddr}</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>📞 {brPhone}</div>
                    </div>
                  </div>

                  {/* Two Clean Side-by-Side Blocks */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>BILLED TO (PATIENT)</span>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A" }}>{patName}</div>
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>📞 {previewInvoice.profiles?.phone_number || previewInvoice.profiles?.phone || "No Phone Recorded"}</div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>TAX INVOICE DETAILS</span>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: "#4F46E5" }}>{invNum}</div>
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>📅 Date: {new Date(previewInvoice.created_at || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <div style={{ marginTop: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 900, background: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: "6px" }}>PAID & VERIFIED RECEIPT</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
                    <thead>
                      <tr style={{ background: "#0F172A", color: "white" }}>
                        <th style={{ padding: "14px 18px", textAlign: "left", fontSize: "12px", fontWeight: 800 }}>Diagnostic Test / Profile</th>
                        <th style={{ padding: "14px 18px", textAlign: "left", fontSize: "12px", fontWeight: 800 }}>Rate Contract</th>
                        <th style={{ padding: "14px 18px", textAlign: "right", fontSize: "12px", fontWeight: 800 }}>Standard</th>
                        <th style={{ padding: "14px 18px", textAlign: "right", fontSize: "12px", fontWeight: 800 }}>Discount</th>
                        <th style={{ padding: "14px 18px", textAlign: "right", fontSize: "12px", fontWeight: 800 }}>Net Payable</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "18px", fontWeight: 800, color: "#0F172A" }}>{previewInvoice.tests?.name || previewInvoice.test_groups?.name || "Diagnostic Panel"}</td>
                        <td style={{ padding: "18px", color: "#475569", fontSize: "13px", fontWeight: 600 }}>{previewInvoice.contract_name || "Standard Patient Rate"}</td>
                        <td style={{ padding: "18px", textAlign: "right", fontWeight: 700 }}>₹ {std.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "18px", textAlign: "right", color: "#DC2626", fontWeight: 700 }}>{disc > 0 ? `- ₹ ${disc}` : "₹ 0"}</td>
                        <td style={{ padding: "18px", textAlign: "right", fontWeight: 900, color: "#10B981", fontSize: "16px" }}>₹ {net.toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#F8FAFC" }}>
                        <td colSpan={4} style={{ padding: "16px 18px", textAlign: "right", fontWeight: 800, color: "#475569", fontSize: "14px" }}>NET AMOUNT PAID:</td>
                        <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 900, color: "#0F172A", fontSize: "18px" }}>₹ {net.toLocaleString("en-IN")} INR</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Note Container Box + UPI QR + Digital Signature Box */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "20px", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "28px" }}>
                    {/* Note Container Box */}
                    <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 900, color: "#4F46E5", textTransform: "uppercase", marginBottom: "6px" }}>ℹ️ Terms & Clinical Note</div>
                      <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.5 }}>
                        {conf.invoiceNote}
                      </div>
                    </div>

                    {/* Instant UPI QR */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "#F0FDF4", padding: "14px", borderRadius: "14px", border: "1px solid #BBF7D0" }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${conf.upiId}&pn=${encodeURIComponent(conf.payeeName)}&am=${net.toFixed(2)}&cu=INR&tn=Invoice-${invNum}`)}`}
                        alt="UPI Payment QR"
                        style={{ width: 68, height: 68, borderRadius: 8, background: "white", padding: 4 }}
                      />
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 900, color: "#15803D", textTransform: "uppercase" }}>UPI QR Payment</div>
                        <div style={{ fontSize: "11px", color: "#0F172A", fontWeight: 700, marginTop: "2px" }}>{conf.payeeName}</div>
                        <div style={{ fontSize: "10px", color: "#166534" }}>VPA: {conf.upiId}</div>
                      </div>
                    </div>

                    {/* Authorized Signatory Box */}
                    <div style={{ textAlign: "right" }}>
                      {conf.signatureImg && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                          <img src={conf.signatureImg} alt="Signature" style={{ height: 42, objectFit: "contain" }} />
                        </div>
                      )}
                      <div style={{ fontSize: "13px", fontWeight: 900, color: "#0F172A" }}>{conf.signatoryName}</div>
                      <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{conf.signatoryDesignation}</div>
                      <div style={{ fontSize: "11px", color: "#10B981", fontWeight: 800, marginTop: "4px" }}>✔ Digitally Signed & Stamp Verified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Billing & Specimen Modal */}
      {showEditModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", borderRadius: "24px", width: "100%", maxWidth: "680px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", border: "1px solid #E2E8F0" }}>
            <div style={{ padding: "24px 28px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 44, height: 44, borderRadius: "12px", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>💳</div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: 0 }}>Edit Specimen & Billing Agreement</h3>
                  <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Reference Invoice: {invoiceNumber || "INV-XXXX"}</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ background: "#F1F5F9", border: "none", color: "#64748B", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontWeight: 800, fontSize: "16px" }}>✕</button>
            </div>

            <form onSubmit={handleSaveBilling} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Specimen Name *</label>
                  <input value={specimenName} onChange={(e) => setSpecimenName(e.target.value)} style={inputStyle} placeholder="e.g. Whole Blood (EDTA), Serum" required />
                </div>
                <div>
                  <label style={labelStyle}>Sample Type / Collection *</label>
                  <input value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={inputStyle} placeholder="e.g. Fasting Blood, Post-Prandial" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Invoice Number (Auto-Generated)</label>
                  <div className="flex gap-2">
                    <input value={invoiceNumber} readOnly style={{ ...inputStyle, background: "#F8FAFC", color: "#334155", fontWeight: 800 }} placeholder="INV-2026-XXXX" />
                    <button
                      type="button"
                      onClick={() => setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                      style={{ padding: "0 14px", borderRadius: "10px", background: "#F1F5F9", color: "#475569", border: "1px solid #CBD5E1", fontWeight: 800, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Rate Contract / Corporate Agreement *</label>
                  <select value={contractName} onChange={(e) => setContractName(e.target.value)} style={{ ...inputStyle, cursor: "pointer", fontWeight: 700 }}>
                    <option value="Standard Patient Rate">Standard Patient Rate</option>
                    <option value="Corporate Partner Agreement (10% Off)">Corporate Partner Agreement (10% Off)</option>
                    <option value="Hospital B2B Referral Contract">Hospital B2B Referral Contract</option>
                    <option value="Insurance Health Panel Agreement">Insurance Health Panel Agreement</option>
                    <option value="Senior Citizen Special Rate">Senior Citizen Special Rate</option>
                  </select>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "18px 20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: "14px", letterSpacing: "0.5px" }}>💰 Pricing & Discount Provision</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label style={labelStyle}>Standard Price (INR)</label>
                    <input type="number" value={standardPrice} onChange={(e) => setStandardPrice(e.target.value)} style={{ ...inputStyle, fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tester Discount (INR)</label>
                    <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} style={{ ...inputStyle, borderColor: "#10B981", background: "#ECFDF5", fontWeight: 800, color: "#065F46" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Net Payable Amount</label>
                    <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", fontWeight: 900, fontSize: "16px", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", height: "42px" }}>
                      ₹ {Math.max(0, (Number(standardPrice) || 0) - (Number(discountAmount) || 0)).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Preview UPI QR Box */}
              <div style={{ background: "#FFFFFF", padding: "14px 18px", borderRadius: "16px", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ padding: "6px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`upi://pay?pa=${labInchargeUpi || "labincharge@okicici"}&pn=Just%20LAB%20ERP&am=${Math.max(0, (Number(standardPrice) || 0) - (Number(discountAmount) || 0)).toFixed(2)}&cu=INR&tn=Invoice%20${invoiceNumber || "INV-2026"}`)}`}
                    alt="UPI Preview QR"
                    style={{ width: "80px", height: "80px", borderRadius: "6px" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: "13px", fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>📱</span> <span>Live UPI QR Preview</span>
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 800, background: "#EEF2FF", color: "#4F46E5", padding: "2px 8px", borderRadius: "6px", border: "1px solid #C7D2FE" }}>VPA: {labInchargeUpi || "Configured in Settings"}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                    Scannable via GPay, PhonePe or Paytm. Embeds directly into final Invoice & Report PDF.
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#059669" }}>
                    ⚡ Auto-prefills amount: ₹ {Math.max(0, (Number(standardPrice) || 0) - (Number(discountAmount) || 0)).toLocaleString("en-IN")} INR
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Payment Status *</label>
                <div className="flex gap-3">
                  {["paid", "unpaid", "partial", "waived"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPaymentStatus(st)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "12px",
                        border: `2px solid ${paymentStatus === st ? "#4F46E5" : "#E2E8F0"}`,
                        background: paymentStatus === st ? "#EEF2FF" : "#FFFFFF",
                        color: paymentStatus === st ? "#4F46E5" : "#64748B",
                        fontWeight: 800,
                        fontSize: "13px",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "#E2E8F0" }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: "12px 24px", borderRadius: "12px", background: "#F1F5F9", color: "#475569", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: "12px", background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", color: "white", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)", fontSize: "14px" }}>
                  {submitting ? "Saving..." : "💾 Save Billing & Specimen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
