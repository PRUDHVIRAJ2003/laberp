"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import SearchableSelect from "@/components/SearchableSelect";

export interface ReportResultItem {
  parameter_name: string;
  unit?: string;
  reference_range?: string;
  observed_value: string;
  is_abnormal?: boolean;
  method?: string;
  result_type?: "text" | "select";
  options?: string;
}

export default function EnterpriseReportsManager() {
  const [reports, setReports] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMappings, setGroupMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Quick Generate Invoice from Report States
  const [showGenerateInvoiceModal, setShowGenerateInvoiceModal] = useState(false);
  const [reportForInvoice, setReportForInvoice] = useState<any | null>(null);
  const [invPriceOverride, setInvPriceOverride] = useState("500");
  const [invDiscountOverride, setInvDiscountOverride] = useState("0");
  const [invStatusOverride, setInvStatusOverride] = useState("paid");

  // Form Fields
  const [reportMode, setReportMode] = useState<"single" | "group">("single");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [referringDoctor, setReferringDoctor] = useState("Self / General");
  const [reportStatus, setReportStatus] = useState("draft");
  const [sampleStatus, setSampleStatus] = useState("collected");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [resultsData, setResultsData] = useState<ReportResultItem[]>([]);
  const [specimenName, setSpecimenName] = useState("Whole Blood (EDTA)");
  const [sampleType, setSampleType] = useState("Routine Blood / Serum");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [standardPrice, setStandardPrice] = useState("500");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [contractName, setContractName] = useState("Standard Patient Rate");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [idFormat, setIdFormat] = useState("std_year");
  const [reportNumber, setReportNumber] = useState("");
  const [patientIdCode, setPatientIdCode] = useState("");

  const generateFormattedId = (prefix: string, format = idFormat) => {
    const yr = new Date().getFullYear();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (format === "short_code") return `${prefix}-${hex}${rnd.toString().slice(-2)}`;
    if (format === "branch_date") return `${prefix}-LAB-${new Date().toLocaleDateString("en-GB").replace(/\//g, "").slice(0, 4)}-${rnd}`;
    return `${prefix}-${yr}-${rnd}`;
  };

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [reportToSign, setReportToSign] = useState<any>(null);
  const [signerName, setSignerName] = useState("Dr. Rajesh Sharma, MD Pathology (Chief Medical Officer)");

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reportToPreview, setReportToPreview] = useState<any>(null);

  // Fixed Portal Actions Dropdown State
  const [activeDropdownReport, setActiveDropdownReport] = useState<any | null>(null);

  // Branch-Wise Report Setup State
  const [activeReportTab, setActiveReportTab] = useState<"list" | "setup">("list");
  const [setupBranchId, setSetupBranchId] = useState<string>("default");
  const [allReportConfigs, setAllReportConfigs] = useState<Record<string, any>>({});
  const [repLogoUrl, setRepLogoUrl] = useState("");
  const [repLabName, setRepLabName] = useState("Just LAB Diagnostic & Research Center");
  const [repPathologistName, setRepPathologistName] = useState("Dr. Prudhvi Raj, MD (Pathology)");
  const [repPathologistQual, setRepPathologistQual] = useState("Consultant Pathologist & Lab Director");
  const [repSignatureUrl, setRepSignatureUrl] = useState("");
  const [repDisclaimer, setRepDisclaimer] = useState(
    "Official electronically verified clinical diagnostic report. Values should be correlated clinically."
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lab_erp_report_setup_branches");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAllReportConfigs(parsed);
        applyReportConfig("default", parsed);
      }
    } catch (e) {}
  }, []);

  const applyReportConfig = (bId: string, store: Record<string, any> = allReportConfigs) => {
    const conf = store[bId] || store["default"] || {};
    setRepLogoUrl(conf.logoUrl || "");
    setRepLabName(conf.labName || "Just LAB Diagnostic & Research Center");
    setRepPathologistName(conf.pathologistName || "Dr. Prudhvi Raj, MD (Pathology)");
    setRepPathologistQual(conf.pathologistQual || "Consultant Pathologist & Lab Director");
    setRepSignatureUrl(conf.signatureUrl || "");
    setRepDisclaimer(conf.disclaimer || "Official electronically verified clinical diagnostic report. Values should be correlated clinically.");
  };

  const handleSetupBranchChange = (bId: string) => {
    setSetupBranchId(bId);
    applyReportConfig(bId);
  };

  const saveReportBranchSetup = () => {
    const updated = {
      ...allReportConfigs,
      [setupBranchId]: {
        logoUrl: repLogoUrl,
        labName: repLabName,
        pathologistName: repPathologistName,
        pathologistQual: repPathologistQual,
        signatureUrl: repSignatureUrl,
        disclaimer: repDisclaimer,
      },
    };
    setAllReportConfigs(updated);
    localStorage.setItem("lab_erp_report_setup_branches", JSON.stringify(updated));
    setMessage(`✔ Report PDF setup saved for ${setupBranchId === "default" ? "All Branches (Default)" : "selected branch"}!`);
    setTimeout(() => setMessage(""), 4000);
  };
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeDropdownReport) {
        setActiveDropdownReport(null);
        setDropdownCoords(null);
      }
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeDropdownReport]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [repRes, patRes, brRes, testRes, groupRes, mapRes] = await Promise.all([
        supabase.from("reports").select("*, profiles(*), tests(*), test_groups(*), lab_branches(*)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("role", "patient").order("created_at", { ascending: false }),
        supabase.from("lab_branches").select("*").order("name"),
        supabase.from("tests").select("*").order("name"),
        supabase.from("test_groups").select("*").order("name"),
        supabase.from("test_group_mapping").select("*"),
      ]);

      if (repRes.data) setReports(repRes.data);
      if (patRes.data) setPatients(patRes.data);
      if (brRes.data) setBranches(brRes.data);
      if (testRes.data) setTests(testRes.data);
      if (groupRes.data) setGroups(groupRes.data);
      if (mapRes.data) setGroupMappings(mapRes.data);
    } catch (err) {
      console.error("Error fetching reports data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Single Test Profile selection
  const handleTestChange = (testId: string) => {
    setSelectedTestId(testId);
    const foundTest = tests.find((t) => t.id === testId);
    if (foundTest) {
      if (foundTest.price) setStandardPrice(String(foundTest.price));
      if (Array.isArray(foundTest.components)) {
        const mappedResults: ReportResultItem[] = foundTest.components
          .filter((c: any) => c.type !== "title" && c.name?.trim())
          .map((c: any) => ({
            parameter_name: c.name || "",
            unit: c.unit || "",
            reference_range: c.reference_range || (c.normal_range_min && c.normal_range_max ? `${c.normal_range_min} - ${c.normal_range_max}` : ""),
            observed_value: "",
            is_abnormal: false,
            method: c.method || "",
            result_type: c.result_type || "text",
            options: c.options || "",
          }));
        setResultsData(mappedResults);
      } else {
        setResultsData([]);
      }
    } else {
      setResultsData([]);
    }
  };

  // Handle Group Test Panel selection (Combines components from multiple tests!)
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const foundGrp = groups.find((g) => g.id === groupId);
    if (foundGrp && foundGrp.price) setStandardPrice(String(foundGrp.price));
    const mappings = groupMappings.filter((m) => m.group_id === groupId);
    const linkedTestIds = mappings.map((m) => m.test_id);
    const linkedTests = tests.filter((t) => linkedTestIds.includes(t.id));

    let combined: ReportResultItem[] = [];
    linkedTests.forEach((foundTest) => {
      if (Array.isArray(foundTest.components)) {
        const mapped = foundTest.components
          .filter((c: any) => c.type !== "title" && c.name?.trim())
          .map((c: any) => ({
            parameter_name: `${foundTest.name}: ${c.name || ""}`,
            unit: c.unit || "",
            reference_range: c.reference_range || (c.normal_range_min && c.normal_range_max ? `${c.normal_range_min} - ${c.normal_range_max}` : ""),
            observed_value: "",
            is_abnormal: false,
            method: c.method || "",
            result_type: c.result_type || "text",
            options: c.options || "",
          }));
        combined = [...combined, ...mapped];
      }
    });
    setResultsData(combined);
  };

  const updateResultRow = (index: number, field: keyof ReportResultItem, val: any) => {
    setResultsData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentReportId(null);
    setReportMode("single");
    setSelectedPatientId(patients[0]?.id || "");
    setSelectedBranchId(branches[0]?.id || "");
    setSelectedTestId(tests[0]?.id || "");
    setSelectedGroupId(groups[0]?.id || "");
    setReferringDoctor("Self / General");
    setReportStatus("draft");
    setSampleStatus("collected");
    setClinicalNotes("");
    setSpecimenName("Whole Blood (EDTA)");
    setSampleType("Routine Blood / Serum");
    setReportNumber(generateFormattedId("REP"));
    setInvoiceNumber(generateFormattedId("INV"));
    setPatientIdCode(generateFormattedId("PAT"));
    setDiscountAmount("0");
    setContractName("Standard Patient Rate");
    setPaymentStatus("paid");
    if (tests[0]?.id) handleTestChange(tests[0].id);
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (rep: any) => {
    setIsEditing(true);
    setCurrentReportId(rep.id);
    const isGrp = !!rep.group_id;
    setReportMode(isGrp ? "group" : "single");
    setSelectedPatientId(rep.patient_id || "");
    setSelectedBranchId(rep.branch_id || "");
    setSelectedTestId(rep.test_id || "");
    setSelectedGroupId(rep.group_id || "");
    setReferringDoctor(rep.referring_doctor || "Self / General");
    setReportStatus(rep.status || "draft");
    setSampleStatus(rep.sample_status || "collected");
    setClinicalNotes(rep.notes || "");
    setSpecimenName(rep.specimen_name || "Whole Blood (EDTA)");
    setSampleType(rep.sample_type || "Routine Blood / Serum");
    setReportNumber(rep.report_number || generateFormattedId("REP"));
    setInvoiceNumber(rep.invoice_number || generateFormattedId("INV"));
    setPatientIdCode(`PAT-${rep.patient_id?.slice(0, 6)?.toUpperCase() || "2026-001"}`);
    setStandardPrice(String(rep.standard_price || rep.tests?.price || rep.test_groups?.price || 500));
    setDiscountAmount(String(rep.discount_amount || 0));
    setContractName(rep.contract_name || "Standard Patient Rate");
    setPaymentStatus(rep.payment_status || "paid");
    setResultsData(Array.isArray(rep.results_data) ? rep.results_data : []);
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMsg("Please select a registered patient.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const pat = patients.find((p) => p.id === selectedPatientId);
    const testObj = reportMode === "single" ? tests.find((t) => t.id === selectedTestId) : groups.find((g) => g.id === selectedGroupId);
    const br = branches.find((b) => b.id === selectedBranchId) || {};

    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isEditing ? "update" : "create",
          reportId: currentReportId,
          patient_id: selectedPatientId,
          branch_id: selectedBranchId,
          test_id: reportMode === "single" ? selectedTestId : null,
          group_id: reportMode === "group" ? selectedGroupId : null,
          referring_doctor: referringDoctor,
          status: reportStatus,
          sample_status: sampleStatus,
          results_data: resultsData,
          notes: clinicalNotes,
          branch_name: br.name || "Main Diagnostic Hub",
          branch_address: br.address || "Medical District Sector 5, India",
          branch_phone: br.contact_phone || "+91 98765 43210",
          branch_email: br.contact_email || "reports@laberp.com",
          patient_phone: pat?.phone_number || pat?.phone || "",
          patient_email: pat?.email || "",
          patient_name: pat?.full_name || `${pat?.first_name || ""} ${pat?.last_name || ""}`.trim(),
          patient_age: pat?.age,
          patient_gender: pat?.gender,
          test_name: testObj?.name || "Diagnostic Panel",
          report_number: reportNumber || generateFormattedId("REP"),
          specimen_name: specimenName,
          sample_type: sampleType,
          invoice_number: invoiceNumber || generateFormattedId("INV"),
          standard_price: Number(standardPrice) || 0,
          discount_amount: Number(discountAmount) || 0,
          net_amount: Math.max(0, (Number(standardPrice) || 0) - (Number(discountAmount) || 0)),
          contract_name: contractName,
          payment_status: paymentStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save diagnostic report");

      setMessage(`Report successfully ${isEditing ? "updated" : "created"}! Genuine .PDF dispatched.`);
      setShowModal(false);
      fetchInitialData();
      setTimeout(() => setMessage(""), 5000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
    }
  };

  const handleGenerateInvoiceFromReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForInvoice) return;
    setSubmitting(true);
    const invNo = reportForInvoice.invoice_number || generateFormattedId("INV");
    const std = Number(invPriceOverride) || 0;
    const disc = Number(invDiscountOverride) || 0;
    const net = Math.max(0, std - disc);

    const fullNotes = [
      reportForInvoice.notes,
      `[INVOICE GENERATED] INV: ${invNo} | Std: ₹${std} | Disc: ₹${disc} | Net: ₹${net} | Status: ${invStatusOverride}`
    ].filter(Boolean).join("\n");

    let { error } = await supabase.from("reports").update({
      invoice_number: invNo,
      standard_price: std,
      discount_amount: disc,
      net_amount: net,
      payment_status: invStatusOverride,
      notes: fullNotes
    }).eq("id", reportForInvoice.id);

    if (error && (error.message?.includes("column") || error.message?.includes("schema cache"))) {
      const res2 = await supabase.from("reports").update({
        invoice_number: invNo,
        notes: fullNotes
      }).eq("id", reportForInvoice.id);
      error = res2.error;
    }

    setSubmitting(false);
    if (error) {
      alert("Error generating invoice: " + error.message);
    } else {
      setMessage(`✅ Invoice ${invNo} generated successfully with ₹ ${net} INR Net Payable! Check Invoices tab.`);
      setShowGenerateInvoiceModal(false);
      fetchInitialData();
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleDeleteReport = async (rep: any) => {
    if (!confirm(`Are you sure you want to permanently delete report ${rep.report_number || rep.id}?`)) return;
    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", reportId: rep.id }),
      });
      if (res.ok) {
        setMessage(`Report ${rep.report_number || ""} deleted.`);
        fetchInitialData();
        setTimeout(() => setMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportToSign) return;

    setSubmitting(true);
    const pat = reportToSign.profiles || {};
    const br = reportToSign.lab_branches || {};
    const testTitle = reportToSign.tests?.name || reportToSign.test_groups?.name || "Diagnostic Panel";

    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign",
          reportId: reportToSign.id,
          signed_by: signerName,
          branch_name: br.name || "Main Diagnostic Hub",
          branch_address: br.address || "Medical District Sector 5, India",
          branch_phone: br.contact_phone || "+91 98765 43210",
          branch_email: br.contact_email || "reports@laberp.com",
          patient_phone: pat.phone_number || pat.phone || "",
          patient_email: pat.email || "",
          patient_name: pat.full_name || `${pat.first_name || ""} ${pat.last_name || ""}`.trim(),
          patient_age: pat.age,
          patient_gender: pat.gender,
          test_name: testTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signing failed");

      setMessage(`Report ${reportToSign.report_number || ""} verified & signed! Real .PDF sent.`);
      setShowSignModal(false);
      fetchInitialData();
      setTimeout(() => setMessage(""), 5000);
    } catch (err: any) {
      alert("Error authorizing report: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotify = async (rep: any, channel: "whatsapp" | "email" | "both") => {
    const pat = rep.profiles || {};
    const testTitle = rep.tests?.name || rep.test_groups?.name || "Diagnostic Test Panel";
    const br = rep.lab_branches || {};
    try {
      const res = await fetch("/api/admin/report-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: channel === "whatsapp" ? "notify_whatsapp" : channel === "email" ? "notify_email" : "notify_both",
          report_number: rep.report_number || rep.id,
          status: rep.status,
          sample_status: rep.sample_status,
          signed_by: rep.signed_by,
          signed_at: rep.signed_at,
          notes: rep.notes,
          results_data: rep.results_data,
          referring_doctor: rep.referring_doctor,
          branch_name: br.name || "Main Diagnostic Hub",
          branch_address: br.address || "Medical District Sector 5, India",
          branch_phone: br.contact_phone || "+91 98765 43210",
          branch_email: br.contact_email || "reports@laberp.com",
          patient_phone: pat.phone_number || pat.phone || "",
          patient_email: pat.email || "",
          patient_name: pat.full_name || `${pat.first_name || ""} ${pat.last_name || ""}`.trim(),
          patient_age: pat.age,
          patient_gender: pat.gender,
          test_name: testTitle,
          invoice_number: rep.invoice_number || `INV-${rep.id?.slice(0, 6)?.toUpperCase() || "2026"}`,
          standard_price: rep.standard_price || 500,
          discount_amount: rep.discount_amount || 0,
          net_amount: rep.net_amount || 500,
          contract_name: rep.contract_name || "Standard Patient Rate",
          specimen_name: rep.specimen_name || "Whole Blood (EDTA)",
          sample_type: rep.sample_type || "Routine Serum",
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Notification dispatch failed.");
      else {
        setMessage(`📲 ${channel === "both" ? "MERGED REPORT + INVOICE PDF" : channel.toUpperCase()} alert dispatched to ${pat.full_name || "Patient"}!`);
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (err: any) {
      alert("Dispatch error: " + err.message);
    }
  };

  // Convert exact HTML Report Card into a high-res vector-sharp PDF!
  const generateAndDownloadVectorPdf = async (rep: any) => {
    const element = document.getElementById("printable-report-card");
    if (!element) {
      alert("Please open the preview modal first to generate the exact layout PDF!");
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

  const filteredReports = reports.filter((r) => {
    const patName = (r.profiles?.full_name || `${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}`).toLowerCase();
    const repNum = (r.report_number || "").toLowerCase();
    const testTitle = (r.tests?.name || r.test_groups?.name || "").toLowerCase();
    const matchesSearch = patName.includes(searchTerm.toLowerCase()) || repNum.includes(searchTerm.toLowerCase()) || testTitle.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter || (statusFilter === "signed" && !!r.authorized_signature);
    return matchesSearch && matchesStatus;
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.2 }}>
            📑 Lab Report Manager
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
            Full CRUD control, Group Panels support, WhatsApp/Email alerts, and genuine .PDF generation
          </p>
        </div>
        <button
          onClick={showModal ? () => setShowModal(false) : openCreateModal}
          style={{
            height: "44px",
            padding: "0 24px",
            fontSize: "13px",
            fontWeight: 800,
            borderRadius: "12px",
            background: showModal ? "#FFFFFF" : "var(--primary-gradient)",
            color: showModal ? "var(--text-main)" : "white",
            border: showModal ? "1px solid var(--border-color)" : "none",
            boxShadow: showModal ? "none" : "var(--shadow-glow)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "16px" }}>{showModal ? "✕" : "＋"}</span>
          <span>{showModal ? "Close Form" : "Create New Lab Report"}</span>
        </button>
      </div>

      {/* Notification Banner */}
      {message && (
        <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "fadeIn 0.3s ease" }}>
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <span>{message}</span>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveReportTab("list")}
          style={{
            padding: "12px 24px",
            borderRadius: "14px",
            border: "none",
            background: activeReportTab === "list" ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" : "white",
            color: activeReportTab === "list" ? "white" : "#475569",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeReportTab === "list" ? "0 10px 20px -5px rgba(15, 23, 42, 0.3)" : "0 2px 5px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>📋</span><span>Clinical Diagnostic Reports</span>
        </button>
        <button
          onClick={() => setActiveReportTab("setup")}
          style={{
            padding: "12px 24px",
            borderRadius: "14px",
            border: "none",
            background: activeReportTab === "setup" ? "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)" : "white",
            color: activeReportTab === "setup" ? "white" : "#475569",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: activeReportTab === "setup" ? "0 10px 20px -5px rgba(79, 70, 229, 0.3)" : "0 2px 5px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>⚙️</span><span>Report PDF Setup (Branch-wise)</span>
        </button>
      </div>

      {activeReportTab === "setup" && (
        <div style={{ background: "white", borderRadius: "24px", border: "1px solid #E2E8F0", padding: "32px", boxShadow: "0 4px 25px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: "24px", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 900, color: "#0F172A", margin: 0 }}>
                ⚙️ Report PDF Setup & Signatory Configuration (Branch-wise)
              </h2>
              <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>
                Configure lab logo, pathologist name, qualification, signature stamp image, and disclaimer per branch.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#334155" }}>Select Branch:</span>
              <select
                value={setupBranchId}
                onChange={(e) => handleSetupBranchChange(e.target.value)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  fontWeight: 800,
                  background: "#F8FAFC",
                  color: "#0F172A",
                  cursor: "pointer"
                }}
              >
                <option value="default">⚡ All Branches (Default Config)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code || "Branch"})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* Section 1: Lab Branding */}
            <div style={{ background: "#F8FAFC", padding: "24px", borderRadius: "18px", border: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 900, color: "#1E293B", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🏥</span> Lab Header Branding
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>Lab Brand Display Name</label>
                  <input
                    type="text"
                    value={repLabName}
                    onChange={(e) => setRepLabName(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>Header Logo Image URL</label>
                  <input
                    type="text"
                    value={repLogoUrl}
                    onChange={(e) => setRepLogoUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Consulting Pathologist & Signature */}
            <div style={{ background: "#F8FAFC", padding: "24px", borderRadius: "18px", border: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 900, color: "#1E293B", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>👨‍⚕️</span> Consulting Pathologist & Digital Stamp
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>Pathologist Name</label>
                  <input
                    type="text"
                    value={repPathologistName}
                    onChange={(e) => setRepPathologistName(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>Qualification & Medical Reg #</label>
                  <input
                    type="text"
                    value={repPathologistQual}
                    onChange={(e) => setRepPathologistQual(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "18px" }}>
                <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px" }}>Digital Signature Image URL (PNG transparent stamp)</label>
                <input
                  type="text"
                  value={repSignatureUrl}
                  onChange={(e) => setRepSignatureUrl(e.target.value)}
                  placeholder="Paste transparent PNG stamp image URL..."
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            {/* Section 3: Disclaimer */}
            <div style={{ background: "#F8FAFC", padding: "24px", borderRadius: "18px", border: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 900, color: "#1E293B", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🛡️</span> Footer Note & Disclaimer Container
              </h3>
              <textarea
                value={repDisclaimer}
                onChange={(e) => setRepDisclaimer(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #CBD5E1", fontSize: "13px", lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "12px" }}>
              <button
                type="button"
                onClick={() => saveReportBranchSetup()}
                style={{
                  padding: "14px 32px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)",
                  color: "white",
                  fontWeight: 900,
                  fontSize: "15px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 10px 20px -5px rgba(79, 70, 229, 0.4)"
                }}
              >
                💾 Save Branch Report PDF Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReportTab === "list" && (
        <>
          {/* Filter & Search Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "All Reports", value: "all" },
            { label: "Drafts / Pending", value: "draft" },
            { label: "Published", value: "published" },
            { label: "✔ Digitally Signed", value: "signed" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              style={{
                padding: "8px 18px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 700,
                border: "none",
                background: statusFilter === tab.value ? "var(--primary)" : "#FFFFFF",
                color: statusFilter === tab.value ? "white" : "var(--text-muted)",
                cursor: "pointer",
                boxShadow: statusFilter === tab.value ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: "white", borderRadius: "14px", padding: "8px 16px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "10px", width: "340px" }}>
          <span>🔍</span>
          <input
            type="text"
            style={{ width: "100%", border: "none", outline: "none", fontSize: "14px" }}
            placeholder="Search by report ID, patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Create / Edit Report Modal Form */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", borderRadius: "28px", border: "1px solid var(--border-color)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", width: "100%", maxWidth: "880px", maxHeight: "90vh", overflowY: "auto", padding: "32px" }}>
            <div className="flex justify-between items-center pb-4 mb-6 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontSize: "24px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)" }}>📑</div>
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-main)", margin: 0 }}>
                    {isEditing ? `Edit Clinical Report — ${reports.find((r: any) => r.id === currentReportId)?.report_number || (currentReportId || "").slice(0, 8).toUpperCase()}` : "Create Diagnostic Laboratory Report"}
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Configure clinical measurement parameters, mark abnormal values, and dispatch alerts</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 38, height: 38, fontWeight: 800, cursor: "pointer", fontSize: "16px", color: "#64748B" }}>✕</button>
            </div>

            {errorMsg && <div style={{ padding: "14px 18px", borderRadius: "14px", background: "#FEF2F2", color: "#DC2626", fontWeight: 700, marginBottom: "20px", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: "10px" }}><span>⚠️</span> {errorMsg}</div>}

            <form onSubmit={handleSaveReport} className="flex-col gap-6">
              {/* Clean Reference Bar */}
              <div style={{ background: "#F8FAFC", padding: "16px 20px", borderRadius: "16px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "20px" }}>📑</span>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Report Reference Number</span>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", marginTop: "2px" }}>{reportNumber || "REP-XXXX"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>ID Style:</span>
                    <select
                      value={idFormat}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIdFormat(val);
                        setReportNumber(generateFormattedId("REP", val));
                        setInvoiceNumber(generateFormattedId("INV", val));
                        setPatientIdCode(generateFormattedId("PAT", val));
                      }}
                      style={{ padding: "6px 12px", borderRadius: "8px", background: "white", color: "#0F172A", border: "1px solid #CBD5E1", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                    >
                      <option value="std_year">📅 Standard Year (REP-2026-XXXX)</option>
                      <option value="short_code">⚡ Short Code (REP-A1B234)</option>
                      <option value="branch_date">🏥 Branch Date (REP-LAB-2026-XXXX)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReportNumber(generateFormattedId("REP"))}
                    style={{ padding: "6px 12px", borderRadius: "8px", background: "#FFFFFF", color: "#4F46E5", border: "1px solid #CBD5E1", fontWeight: 800, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    title="Regenerate unique Report No"
                  >
                    <span>🔄</span> <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Step 1: Demographics */}
              <div style={{ background: "#FFFFFF", padding: "24px", borderRadius: "20px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ background: "#EEF2FF", color: "#4F46E5", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>1</span>
                  <span>Patient & Branch Demographics</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>Select Registered Patient *</label>
                    <SearchableSelect
                      options={patients.map((p) => ({
                        id: p.id,
                        label: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Valued Patient",
                        sublabel: `📞 ${p.phone_number || "No phone"} | ✉️ ${p.email || "No email"}`
                      }))}
                      value={selectedPatientId}
                      onChange={(val) => setSelectedPatientId(val)}
                      placeholder="Type patient name, phone or email..."
                      required={true}
                      icon="👤"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Select Lab Branch *</label>
                    <SearchableSelect
                      options={branches.map((b) => ({
                        id: b.id,
                        label: b.name,
                        sublabel: `Code: ${b.code || "MAIN"}`
                      }))}
                      value={selectedBranchId}
                      onChange={(val) => setSelectedBranchId(val)}
                      placeholder="Type branch name or code..."
                      icon="🏥"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Referring Doctor</label>
                    <input style={{ ...inputStyle, background: "white" }} placeholder="Dr. Name or Self" value={referringDoctor} onChange={(e) => setReferringDoctor(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Step 2: Test Profile Mode Toggle (Single vs Group) */}
              <div style={{ background: "#FFFFFF", padding: "24px", borderRadius: "20px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ background: "#EEF2FF", color: "#4F46E5", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>2</span>
                    <span>Diagnostic Profile & Workflow Status</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", background: "#F8FAFC", padding: "6px", borderRadius: "14px", border: "1px solid #CBD5E1" }}>
                    <button
                      type="button"
                      onClick={() => { setReportMode("single"); if (tests[0]?.id) handleTestChange(tests[0].id); }}
                      style={{ padding: "8px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 800, border: "none", background: reportMode === "single" ? "linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)" : "transparent", color: reportMode === "single" ? "white" : "#64748B", cursor: "pointer", transition: "all 0.2s", boxShadow: reportMode === "single" ? "0 2px 8px rgba(79, 70, 229, 0.3)" : "none" }}
                    >
                      🧪 Single Test Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReportMode("group"); if (groups[0]?.id) handleGroupChange(groups[0].id); }}
                      style={{ padding: "8px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 800, border: "none", background: reportMode === "group" ? "linear-gradient(135deg, #059669 0%, #10B981 100%)" : "transparent", color: reportMode === "group" ? "white" : "#64748B", cursor: "pointer", transition: "all 0.2s", boxShadow: reportMode === "group" ? "0 2px 8px rgba(5, 150, 105, 0.3)" : "none" }}
                    >
                      📦 Group Test Panel (Package)
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px" }}>
                  <div>
                    {reportMode === "single" ? (
                      <>
                        <label style={labelStyle}>Select Individual Test Profile *</label>
                        <SearchableSelect
                          options={tests.map((t) => ({
                            id: t.id,
                            label: t.name,
                            sublabel: t.price ? `₹ ${Number(t.price).toLocaleString("en-IN")} INR` : "Standard Panel"
                          }))}
                          value={selectedTestId}
                          onChange={(val) => handleTestChange(val)}
                          placeholder="Type test name or profile..."
                          required={reportMode === "single"}
                          icon="🧪"
                        />
                      </>
                    ) : (
                      <>
                        <label style={labelStyle}>Select Group Panel Package *</label>
                        <SearchableSelect
                          options={groups.map((g) => ({
                            id: g.id,
                            label: g.name,
                            sublabel: g.price ? `₹ ${Number(g.price).toLocaleString("en-IN")} INR` : "Package Deal"
                          }))}
                          value={selectedGroupId}
                          onChange={(val) => handleGroupChange(val)}
                          placeholder="Type group package name..."
                          required={reportMode === "group"}
                          icon="📦"
                        />
                      </>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Sample Status</label>
                    <select style={{ ...inputStyle, fontWeight: 700, background: "white" }} value={sampleStatus} onChange={(e) => setSampleStatus(e.target.value)}>
                      <option value="pending">Pending Collection</option>
                      <option value="collected">Sample Collected</option>
                      <option value="processing">In Lab Processing</option>
                      <option value="completed">Completed / Verified</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Report Status</label>
                    <select style={{ ...inputStyle, fontWeight: 800, background: "white", color: reportStatus === "published" ? "#059669" : reportStatus === "completed" ? "#3B82F6" : "#D97706" }} value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                      <option value="draft">Draft / Pending</option>
                      <option value="completed">Completed</option>
                      <option value="published">Published / Ready</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3: Measurement Parameters Table */}
              <div style={{ background: "#FFFFFF", padding: "24px", borderRadius: "20px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                <div className="flex justify-between items-center mb-4 pb-3 border-b" style={{ borderColor: "#E2E8F0" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ background: "#EEF2FF", color: "#4F46E5", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>3</span>
                      <span>Clinical Measurement Results</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500, display: "block", marginTop: "2px" }}>Enter observed diagnostic values below. Toggle "Abnormal" to flag in bold red on PDF report cards.</span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 800, padding: "4px 12px", borderRadius: "20px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1" }}>{resultsData.length} Parameters Active</span>
                </div>

                <div style={{ overflowX: "auto", border: "1px solid #CBD5E1", borderRadius: "14px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "680px" }}>
                    <thead>
                      <tr style={{ background: "#0F172A", color: "white" }}>
                        <th style={{ padding: "14px 18px", fontSize: "12px", fontWeight: 800, textAlign: "left" }}>Parameter Name</th>
                        <th style={{ padding: "14px 18px", fontSize: "12px", fontWeight: 800, textAlign: "left" }}>Unit</th>
                        <th style={{ padding: "14px 18px", fontSize: "12px", fontWeight: 800, textAlign: "left" }}>Normal Reference Range</th>
                        <th style={{ padding: "14px 18px", fontSize: "12px", fontWeight: 800, textAlign: "left", width: "200px" }}>Observed Reading *</th>
                        <th style={{ padding: "14px 18px", fontSize: "12px", fontWeight: 800, textAlign: "center", width: "150px" }}>Clinical Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsData.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: "36px", textAlign: "center", color: "#64748B", fontWeight: 600, background: "#F8FAFC" }}>⚠️ No parameters loaded. Please select an Individual Test Profile or Group Package above to populate diagnostic rows.</td></tr>
                      ) : (
                        resultsData.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0", background: row.is_abnormal ? "#FEF2F2" : idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC", transition: "all 0.15s" }}>
                            <td style={{ padding: "12px 18px", fontWeight: 800, color: "#0F172A", fontSize: "14px" }}>{row.parameter_name}</td>
                            <td style={{ padding: "12px 18px", color: "#64748B", fontWeight: 600, fontSize: "13px" }}>{row.unit || "—"}</td>
                            <td style={{ padding: "12px 18px", color: "#475569", fontWeight: 700, fontSize: "13px", background: row.is_abnormal ? "#FEE2E2" : "#F1F5F9", borderRadius: "6px" }}>{row.reference_range || "—"}</td>
                            <td style={{ padding: "12px 18px" }}>
                              {row.result_type === "select" && row.options ? (
                                <select
                                  style={{ ...inputStyle, padding: "10px 14px", fontWeight: 800, fontSize: "14px", color: row.is_abnormal ? "#DC2626" : "#0F172A", background: "white", border: row.is_abnormal ? "2px solid #EF4444" : "1px solid #CBD5E1" }}
                                  value={row.observed_value}
                                  onChange={(e) => updateResultRow(idx, "observed_value", e.target.value)}
                                >
                                  <option value="">Select Reading...</option>
                                  {row.options.split(",").map((opt: string, i: number) => (
                                    <option key={i} value={opt.trim()}>{opt.trim()}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  style={{ ...inputStyle, padding: "10px 14px", fontWeight: 800, fontSize: "14px", color: row.is_abnormal ? "#DC2626" : "#0F172A", background: "white", border: row.is_abnormal ? "2px solid #EF4444" : "1px solid #CBD5E1", boxShadow: row.is_abnormal ? "0 0 0 3px rgba(239, 68, 68, 0.15)" : "none" }}
                                  placeholder="Enter observed reading..."
                                  value={row.observed_value}
                                  onChange={(e) => updateResultRow(idx, "observed_value", e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: "12px 18px", textAlign: "center" }}>
                              <label className="flex items-center justify-center gap-2 cursor-pointer" style={{ padding: "6px 12px", borderRadius: "10px", background: row.is_abnormal ? "#EF4444" : "#F1F5F9", color: row.is_abnormal ? "white" : "#64748B", fontWeight: 800, fontSize: "12px", transition: "all 0.2s", border: row.is_abnormal ? "none" : "1px solid #CBD5E1" }}>
                                <input
                                  type="checkbox"
                                  checked={row.is_abnormal || false}
                                  onChange={(e) => updateResultRow(idx, "is_abnormal", e.target.checked)}
                                  style={{ width: 16, height: 16, accentColor: "#EF4444", cursor: "pointer" }}
                                />
                                <span>{row.is_abnormal ? "🚨 FLAGGED" : "Normal"}</span>
                              </label>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 4: Clinical Notes */}
              <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "20px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.5px" }}>✍️ STEP 4: PATHOLOGIST CLINICAL REMARKS & ADVICE</div>
                <textarea
                  style={{ ...inputStyle, minHeight: "85px", resize: "vertical", background: "white", fontSize: "14px", fontWeight: 500 }}
                  placeholder="e.g. Mild leucocytosis observed. Advised clinical correlation and repeat evaluation after 1 week if symptoms persist."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "12px 24px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "white", fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 32px", borderRadius: "12px", background: "var(--primary-gradient)", color: "white", fontWeight: 800, border: "none", cursor: "pointer" }}>
                  {submitting ? "Saving..." : "✔ Save Diagnostic Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports Catalog Table */}
      <div style={{ background: "white", borderRadius: "24px", border: "1px solid var(--border-color)", boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.03)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "950px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Report ID</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Patient Details</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Test / Panel</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Branch</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Sample / Status</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Signatory Seal</th>
                <th style={{ padding: "16px 20px", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", width: "140px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "64px", textAlign: "center", fontWeight: 700 }}>Loading Diagnostic Reports Catalog...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>No diagnostic lab reports found. Click "+ Create New Lab Report" above!</td></tr>
              ) : (
                filteredReports.map((rep, i) => {
                  const pat = rep.profiles || {};
                  const testTitle = rep.tests?.name || rep.test_groups?.name || "Diagnostic Panel";
                  const br = rep.lab_branches || {};
                  const isSigned = !!rep.authorized_signature;

                  return (
                    <tr key={rep.id} style={{ borderBottom: "1px solid var(--border-color)", background: i % 2 === 0 ? "white" : "#FAFAFE" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: "14px", background: "rgba(79,70,229,0.08)", padding: "4px 10px", borderRadius: "8px" }}>
                          {rep.report_number || rep.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "14px" }}>{pat.full_name || `${pat.first_name || ""} ${pat.last_name || ""}`}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{pat.gender || "—"}, {pat.age ? `${pat.age} yrs` : "—"} | 📞 {pat.phone_number || pat.phone || "No phone"}</div>
                      </td>
                      <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--text-main)" }}>
                        {testTitle}
                        <div style={{ fontSize: "11px", color: "#059669", fontWeight: 800 }}>{rep.group_id ? "📦 Group Package" : "🧪 Single Test"}</div>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
                        {br.name || "Main Lab Hub"}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div className="flex-col gap-1">
                          <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 800, background: rep.status === "published" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: rep.status === "published" ? "#059669" : "#D97706", width: "fit-content" }}>
                            ● {rep.status ? rep.status.toUpperCase() : "DRAFT"}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-light)" }}>Sample: {rep.sample_status || "Collected"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {isSigned ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "12px", background: "#ECFDF5", border: "1px solid #10B981", color: "#059669", fontSize: "11px", fontWeight: 800 }}>
                            <span>🛡️</span><span>Verified & Signed</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReportToSign(rep); setShowSignModal(true); }}
                            style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", color: "#D97706", border: "1px solid rgba(245, 158, 11, 0.3)", fontWeight: 800, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <span>✍️</span><span>Sign In / Verify</span>
                          </button>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeDropdownReport?.id === rep.id) {
                              setActiveDropdownReport(null);
                              setDropdownCoords(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownCoords({
                              top: rect.bottom + 6,
                              right: window.innerWidth - rect.right,
                            });
                            setActiveDropdownReport(rep);
                          }}
                          style={{
                            padding: "8px 18px",
                            borderRadius: "10px",
                            background: activeDropdownReport?.id === rep.id ? "#1E293B" : "var(--primary-gradient)",
                            color: "white",
                            fontWeight: 800,
                            fontSize: "13px",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⚙️ Actions ▾
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Root-Level Fixed Portal Actions Dropdown */}
      {activeDropdownReport && dropdownCoords && (
        <>
          <div
            onClick={() => { setActiveDropdownReport(null); setDropdownCoords(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
          />
          <div
            style={{
              position: "fixed",
              top: dropdownCoords.top,
              right: dropdownCoords.right,
              background: "white",
              borderRadius: "16px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 40px -8px rgba(15, 23, 42, 0.18), 0 0 1px 1px rgba(15, 23, 42, 0.05)",
              zIndex: 9999,
              minWidth: "220px",
              padding: "8px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                setReportToPreview(rep);
                setShowPreviewModal(true);
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#F1F5F9")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              👁️ Preview & PDF
            </button>
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                setReportForInvoice(rep);
                setInvPriceOverride(String(rep.standard_price || rep.tests?.price || rep.test_groups?.price || 500));
                setInvDiscountOverride(String(rep.discount_amount || 0));
                setInvStatusOverride(rep.payment_status || "paid");
                setShowGenerateInvoiceModal(true);
              }}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                background: activeDropdownReport?.invoice_number ? "#ECFDF5" : "transparent",
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "13px",
                color: activeDropdownReport?.invoice_number ? "#059669" : "#4F46E5",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textAlign: "left"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = activeDropdownReport?.invoice_number ? "#D1FAE5" : "#EEF2FF")}
              onMouseOut={(e) => (e.currentTarget.style.background = activeDropdownReport?.invoice_number ? "#ECFDF5" : "transparent")}
            >
              {activeDropdownReport?.invoice_number ? `✅ Invoice Active (${activeDropdownReport.invoice_number})` : "🧾 Generate Invoice"}
            </button>
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                handleNotify(rep, "whatsapp");
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "#059669", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#ECFDF5")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              💬 Send WhatsApp
            </button>
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                handleNotify(rep, "email");
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#EEF2FF")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              📧 Send Email PDF
            </button>
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                handleNotify(rep, "both");
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "#0284C7", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#F0F9FF")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              🚀 Resend All
            </button>
            <div style={{ height: "1px", background: "#E2E8F0", margin: "6px 8px" }} />
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                openEditModal(rep);
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "#D97706", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#FFFBEB")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              ✏️ Edit Report
            </button>
            <button
              onClick={() => {
                const rep = activeDropdownReport;
                setActiveDropdownReport(null);
                handleDeleteReport(rep);
              }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "#DC2626", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#FEF2F2")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              🗑️ Delete
            </button>
          </div>
        </>
      )}

      {/* Digitally Sign / Authorize Modal */}
      {showSignModal && reportToSign && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", zIndex: 150, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "24px", padding: "32px", maxWidth: "500px", width: "100%", border: "1px solid var(--border-color)", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ECFDF5", color: "#059669", fontSize: "32px", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 16px" }}>✍️</div>
            <h3 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-main)", margin: "0 0 8px" }}>Authoritative Digital Signature</h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 24px" }}>
              Sign & verify Report <strong>{reportToSign.report_number || reportToSign.id}</strong> for Patient <strong>{reportToSign.profiles?.full_name || "Patient"}</strong>. This will publish the report and trigger email with a genuine .PDF attachment!
            </p>

            <form onSubmit={handleSignReport} className="flex-col gap-4 text-left">
              <div>
                <label style={labelStyle}>Authorized Signatory Title *</label>
                <input style={{ ...inputStyle, fontWeight: 700 }} value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
              </div>

              <div style={{ padding: "14px", borderRadius: "12px", background: "#F8FAFC", border: "1px dashed var(--border-color)", fontSize: "13px", color: "var(--text-muted)" }}>
                🛡️ <em>By clicking Authorize below, you apply an encrypted digital seal and QR verification barcode to this official laboratory report.</em>
              </div>

              <div className="flex justify-between gap-3 mt-4">
                <button type="button" onClick={() => setShowSignModal(false)} style={{ padding: "12px 20px", borderRadius: "12px", border: "none", background: "#F1F5F9", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: "12px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}>
                  {submitting ? "Applying Seal..." : "✔ Apply Digital Signature & Seal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structured Report Preview & 100% Vector PDF Download Modal */}
      {showPreviewModal && reportToPreview && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "28px", width: "100%", maxWidth: "920px", maxHeight: "95vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            {/* Control Bar */}
            <div style={{ padding: "16px 24px", background: "#0F172A", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "20px" }}>📑</span>
                <span style={{ fontWeight: 800, fontSize: "16px" }}>Structured Diagnostic Report Preview ({reportToPreview.report_number || "REP"})</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => generateAndDownloadVectorPdf(reportToPreview)}
                  style={{ padding: "8px 20px", borderRadius: "10px", background: "var(--primary-gradient)", color: "white", fontWeight: 800, fontSize: "14px", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span>📥</span>
                  <span>Download 100% Vector PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 700, fontSize: "13px", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}
                >
                  🖨️ Print
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontWeight: 800, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Rendered Layout */}
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
                const collectionAddress = addrMatch ? addrMatch[1].trim() : (reportToPreview.profiles?.address || reportToPreview.profiles?.place || "Address Pending");
                const gpsCoords = gpsMatch ? `${gpsMatch[1]}, ${gpsMatch[2]}` : null;
                const contactPhone = contactMatch ? contactMatch[1].trim() : (reportToPreview.profiles?.phone_number || reportToPreview.profiles?.phone || "—");

                // Completely strip out any [APPOINTMENT BOOKING...] block from clinical remarks
                const cleanRemarks = rawNotes.replace(/\[APPOINTMENT BOOKING[\s\S]*/i, "").trim();

                const patName = reportToPreview.beneficiary_name || reportToPreview.profiles?.full_name || `${reportToPreview.profiles?.first_name || ""} ${reportToPreview.profiles?.last_name || ""}`.trim() || "Valued Patient";
                const patGender = reportToPreview.beneficiary_gender || reportToPreview.profiles?.gender || "—";
                const patAge = reportToPreview.beneficiary_age || (reportToPreview.profiles?.age ? `${reportToPreview.profiles.age} Yrs` : "—");
                const guardianText = reportToPreview.beneficiary_name ? `Booked by Relative/Guardian (${reportToPreview.beneficiary_relationship || "Family"}): ${reportToPreview.profiles?.full_name || contactPhone}` : null;
                const repNumber = reportToPreview.report_number || "REP-001";
                const repDate = reportToPreview.created_at ? new Date(reportToPreview.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

                return (
                  <div
                    id="printable-report-card"
                    style={{
                      width: "820px",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                      padding: "48px",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      color: "#1E293B",
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                  >
                    {/* Header Banner: LAB ERP (Developed by PRUDHVI RAJ) on Left, Branch Details on Right */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #4F46E5", paddingBottom: "24px", marginBottom: "28px" }}>
                      <div>
                        <h1 style={{ fontSize: "32px", fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: "-1px" }}>
                          LAB <span style={{ color: "#4F46E5" }}>ERP</span>
                        </h1>
                        <p style={{ fontSize: "14px", fontStyle: "italic", fontWeight: 700, color: "#4F46E5", margin: "4px 0 0" }}>Developed by PRUDHVI RAJ</p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0F172A" }}>{reportToPreview.lab_branches?.name || "Main Diagnostic Hub"}</div>
                        <div>📍 {reportToPreview.lab_branches?.address || "Medical District Sector 5, India"}</div>
                        <div>📞 {reportToPreview.lab_branches?.contact_phone || "+91 98765 43210"}</div>
                        <div>✉️ {reportToPreview.lab_branches?.contact_email || "reports@laberp.com"}</div>
                      </div>
                    </div>

                    {/* Professional Structured Patient Details Container (3 Columns) */}
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
                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px", lineHeight: 1.4 }}>
                            📍 {collectionAddress}
                          </div>
                          {gpsCoords ? (
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(gpsCoords)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", borderRadius: "8px", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}
                            >
                              🗺️ Live Maps Navigation ({gpsCoords})
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(collectionAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #10B981, #059669)", color: "white", borderRadius: "8px", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}
                            >
                              🗺️ Live Maps Navigation 🧭
                            </a>
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
                              <td style={{ padding: "14px", fontWeight: 900, fontSize: "14px", color: res.is_abnormal ? "#DC2626" : "#0F172A" }}>
                                {res.reading || res.observed_value || "—"} {res.is_abnormal && "⚠️"}
                              </td>
                              <td style={{ padding: "14px", color: "#475569", fontSize: "13px" }}>{res.ref_range || res.reference_range || "—"}</td>
                              <td style={{ padding: "14px", color: "#64748B", fontSize: "13px" }}>{res.unit || "—"}</td>
                              <td style={{ padding: "14px", color: "#64748B", fontSize: "13px" }}>{res.method || "Standard"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ padding: "28px", textAlign: "center", color: "#94A3B8" }}>
                              No parameter results logged in this report.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Structured Appointment & Home Collection Card (Only displayed if appointment booking data exists) */}
                    {isBooking && (
                      <div style={{ background: "#EEF2FF", borderRadius: "16px", border: "1px solid #C7D2FE", overflow: "hidden", marginBottom: "28px" }}>
                        <div style={{ background: "#E0E7FF", padding: "10px 18px", fontSize: "11px", fontWeight: 900, color: "#3730A3", textTransform: "uppercase", letterSpacing: "0.6px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🏠</span>
                          <span>HOME COLLECTION & CLINICAL APPOINTMENT DETAILS</span>
                        </div>
                        <div style={{ padding: "18px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr 1fr", gap: "16px", marginBottom: "14px" }}>
                            <div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>SCHEDULED SLOT</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{preferredDate}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>FASTING PREP</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{fastingInfo}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>BLOOD GROUP</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{bloodGroup}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>HELPLINE CONTACT</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E1B4B", marginTop: "2px" }}>{contactPhone}</div>
                            </div>
                          </div>

                          <div style={{ borderTop: "1px solid #E0E7FF", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                            <div>
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#6366F1", textTransform: "uppercase", display: "block" }}>COLLECTION ADDRESS</span>
                              <div style={{ fontSize: "12px", fontWeight: 700, color: "#312E81", marginTop: "2px" }}>{collectionAddress}</div>
                            </div>
                            {gpsCoords && (
                              <a
                                href={`https://www.google.com/maps?q=${encodeURIComponent(gpsCoords)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: "6px 12px", borderRadius: "8px", background: "#4F46E5", color: "white", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}
                              >
                                📍 GPS: {gpsCoords}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pathologist Clinical Remarks (Only shown if clean remarks remain) */}
                    {cleanRemarks && (
                      <div style={{ background: "#FFFBEB", borderLeft: "4px solid #F59E0B", padding: "16px 20px", borderRadius: "8px", marginBottom: "28px", border: "1px solid #FDE68A" }}>
                        <span style={{ fontSize: "11px", fontWeight: 900, color: "#D97706", textTransform: "uppercase" }}>Pathologist Clinical Remarks & Advice:</span>
                        <p style={{ fontSize: "13px", color: "#78350F", margin: "6px 0 0", lineHeight: 1.5, fontWeight: 600 }}>{cleanRemarks}</p>
                      </div>
                    )}

                    {/* Footer Bar: QR Barcode & Signatory Block */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "32px", borderTop: "2px solid #E2E8F0", paddingTop: "24px", alignItems: "flex-end", marginTop: "auto" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#F8FAFC", padding: "14px 18px", borderRadius: "16px", border: "1px solid #CBD5E1" }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`LAB ERP REPORT ID: ${reportToPreview.report_number || reportToPreview.id} | PATIENT: ${patName} | STATUS: VERIFIED`)}`}
                          alt="Verification QR Barcode"
                          style={{ width: 80, height: 80, borderRadius: 8, border: "1px solid #CBD5E1" }}
                          crossOrigin="anonymous"
                        />
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 900, color: "#0F172A", textTransform: "uppercase" }}>📱 Cryptographic Report Verification</div>
                          <p style={{ fontSize: "11px", color: "#64748B", margin: "4px 0 0", lineHeight: 1.4 }}>
                            Scan this QR barcode in your patient portal to authenticate report validity and download official laboratory records.
                          </p>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", paddingRight: "12px" }}>
                        {reportToPreview.authorized_signature ? (
                          <div>
                            <div style={{ display: "inline-block", border: "2px solid #10B981", borderRadius: "12px", padding: "4px 12px", color: "#059669", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", marginBottom: "8px", background: "#ECFDF5" }}>
                              ✔ Digitally Verified & Sealed
                            </div>
                            <div style={{ fontSize: "18px", fontFamily: "serif", fontStyle: "italic", fontWeight: 800, color: "#4F46E5", margin: "4px 0" }}>
                              {reportToPreview.signed_by || "Dr. Rajesh Sharma, MD Pathology"}
                            </div>
                            <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>Chief Medical Pathologist / Laboratory Director</div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                              Verified on: {reportToPreview.signed_at ? new Date(reportToPreview.signed_at).toLocaleString("en-IN") : "Digital Stamp"}
                            </div>
                          </div>
                        ) : (
                          <div style={{ borderTop: "2px dashed #94A3B8", paddingTop: "8px", color: "#94A3B8", fontSize: "13px", fontWeight: 700 }}>
                            [Report Pending Medical Officer Signature]
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Quick Generate Invoice Modal */}
      {showGenerateInvoiceModal && reportForInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "24px", width: "100%", maxWidth: "480px", padding: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b" style={{ borderColor: "#E2E8F0" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: 0 }}>🧾 Generate Tax Invoice & Receipt</h3>
                <p style={{ fontSize: "12px", color: "#64748B", margin: "2px 0 0" }}>For Patient: {reportForInvoice.profiles?.full_name || "Patient"}</p>
              </div>
              <button onClick={() => setShowGenerateInvoiceModal(false)} style={{ background: "#F1F5F9", border: "none", width: 30, height: 30, borderRadius: "8px", cursor: "pointer", fontWeight: 800 }}>✕</button>
            </div>

            <form onSubmit={handleGenerateInvoiceFromReport} className="space-y-4">
              <div>
                <label style={labelStyle}>Standard Test Price (INR) *</label>
                <input type="number" required value={invPriceOverride} onChange={(e) => setInvPriceOverride(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Discount or Waiver Amount (INR)</label>
                <input type="number" value={invDiscountOverride} onChange={(e) => setInvDiscountOverride(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ padding: "12px 14px", background: "#ECFDF5", borderRadius: "12px", border: "1px solid #A7F3D0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#065F46" }}>Net Payable Amount:</span>
                <span style={{ fontSize: "18px", fontWeight: 900, color: "#047857" }}>₹ {Math.max(0, (Number(invPriceOverride) || 0) - (Number(invDiscountOverride) || 0)).toLocaleString("en-IN")} INR</span>
              </div>

              <div>
                <label style={labelStyle}>Payment Status *</label>
                <div className="flex gap-2">
                  {["paid", "unpaid", "waived"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setInvStatusOverride(st)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "10px",
                        border: `2px solid ${invStatusOverride === st ? "#059669" : "#E2E8F0"}`,
                        background: invStatusOverride === st ? "#ECFDF5" : "#FFFFFF",
                        color: invStatusOverride === st ? "#059669" : "#64748B",
                        fontWeight: 800,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        cursor: "pointer"
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: "#E2E8F0" }}>
                <button type="button" onClick={() => setShowGenerateInvoiceModal(false)} style={{ padding: "10px 20px", borderRadius: "10px", background: "#F1F5F9", color: "#475569", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", color: "white", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)", fontSize: "13px" }}>
                  {submitting ? "Saving..." : "🧾 Save & Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
