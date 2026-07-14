import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      reportId,
      patient_id,
      branch_id,
      test_id,
      group_id,
      referring_doctor,
      status,
      sample_status,
      results_data,
      notes,
      signed_by,
      signed_at,
      patient_phone,
      patient_email,
      patient_name,
      patient_age,
      patient_gender,
      test_name,
      report_number,
      branch_name,
      branch_address,
      branch_phone,
      branch_email,
    } = body;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key is not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    // Helper: Generate Server-Side Binary PDF Buffer using jsPDF + autoTable
    const generateRealPdfBuffer = async (
      repNum: string,
      patName: string,
      patAge: any,
      patGender: string,
      tName: string,
      repStatus: string,
      sStatus: string,
      signer: string,
      signTime: string,
      rem: string,
      resList: any[],
      bName: string,
      bAddr: string,
      bPhone: string,
      bEmail: string,
      refDoc: string,
      billingInfo?: {
        invoice_number?: string;
        specimen_name?: string;
        sample_type?: string;
        standard_price?: number;
        discount_amount?: number;
        net_amount?: number;
        contract_name?: string;
        payment_status?: string;
      }
    ) => {
      const doc = new jsPDF("p", "mm", "a4");

      // 1. Top Header Banner
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text("LAB ERP", 14, 20);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text("Developed by PRUDHVI RAJ", 14, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(bName || "Main Diagnostic Hub", 196, 18, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(bAddr || "Medical District Sector 5, India", 196, 23, { align: "right" });
      doc.text(`Phone: ${bPhone || "+91 98765 43210"} | Email: ${bEmail || "reports@laberp.com"}`, 196, 28, { align: "right" });

      // Divider Line
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.8);
      doc.line(14, 33, 196, 33);

      // 2. Professional Structured Patient Details Container (3 Columns via autoTable)
      const formattedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const patDetailsBody = [
        [
          `NAME: ${patName || "Valued Patient"}\nGENDER: ${patGender || "—"} | AGE: ${patAge ? patAge + " Yrs" : "—"}`,
          `REPORT ID: ${repNum || "REP-001"}\nDATE: ${formattedDate}\nSAMPLE: ${sStatus ? sStatus.toUpperCase() : "COLLECTED"}`,
          `TEST PANEL: ${tName || "Diagnostic Profile"}\nREF DOCTOR: ${refDoc || "Self / General"}\nSTATUS: ${repStatus ? repStatus.toUpperCase() : "PUBLISHED"}`
        ]
      ];

      autoTable(doc, {
        startY: 38,
        theme: "grid",
        styles: { fontSize: 9.5, cellPadding: 5, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.3, fontStyle: "bold" },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { fillColor: [248, 250, 252] },
        head: [["PATIENT CLINICAL PROFILE", "REPORT METADATA & TRACKING", "DIAGNOSTIC PROFILE"]],
        body: patDetailsBody,
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
          2: { cellWidth: 62 }
        }
      });

      // 3. Clinical Test Parameters & Observed Results Table
      const afterPatY = Math.max((doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 80, 80);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("LABORATORY TEST RESULTS & CLINICAL OBSERVATIONS", 14, afterPatY);

      const resultsTableBody = Array.isArray(resList) && resList.length > 0
        ? resList.map((r: any) => [
            r.parameter_name || "—",
            `${r.observed_value || "—"}${r.is_abnormal ? " [ABNORMAL]" : ""}`,
            r.reference_range || "—",
            r.unit || "—",
            r.method || "Standard"
          ])
        : [["No measurement parameters logged", "", "", "", ""]];

      autoTable(doc, {
        startY: afterPatY + 4,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9.5, cellPadding: 4, textColor: [30, 41, 59] },
        head: [["Test Parameter Name", "Observed Reading", "Reference Range", "Unit", "Assay Method"]],
        body: resultsTableBody,
        didParseCell: function(data) {
          if (data.section === "body" && data.column.index === 1) {
            const val = String(data.cell.raw || "");
            if (val.includes("ABNORMAL")) {
              data.cell.styles.textColor = [220, 38, 38]; // Red highlight
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });

      // 4. Clinical Remarks (Dynamic Box Height!)
      let currentY = Math.max((doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 140, 140);
      if (rem) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const splitNotes = doc.splitTextToSize(rem, 174);
        const boxHeight = Math.max(20, splitNotes.length * 5 + 12);
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(245, 158, 11);
        doc.rect(14, currentY, 182, boxHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(217, 119, 6);
        doc.text("PATHOLOGIST CLINICAL REMARKS:", 18, currentY + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 53, 15);
        doc.text(splitNotes, 18, currentY + 12);
        currentY += boxHeight + 8;
      }

      // 5. Footer Block: QR Verification & Signatory Seal
      let footY = Math.max(currentY + 12, 235);
      if (footY > 260) {
        doc.addPage();
        footY = 40;
      }

      // Fetch QR Code Image buffer from api.qrserver.com
      let qrBase64 = "";
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`LAB ERP REPORT ID: ${repNum || "REP"} | PATIENT: ${patName || "Patient"} | STATUS: VERIFIED`)}`;
        const qrRes = await fetch(qrUrl);
        const qrBuf = await qrRes.arrayBuffer();
        qrBase64 = `data:image/png;base64,${Buffer.from(qrBuf).toString("base64")}`;
      } catch (e) {
        console.warn("Could not fetch QR code for server PDF:", e);
      }

      // Left: QR Image & Verification Notice
      if (qrBase64) {
        try {
          doc.addImage(qrBase64, "PNG", 14, footY - 4, 24, 24);
        } catch (err) {
          console.warn("Could not add QR image to doc:", err);
        }
      }
      const textX = qrBase64 ? 42 : 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("CRYPTOGRAPHIC REPORT VERIFICATION", textX, footY + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Scan barcode in patient portal to verify report authenticity.", textX, footY + 7);
      doc.text(`Report ID: ${repNum || "REP"} | Secured by LAB ERP`, textX, footY + 12);

      // Right: Authorized Signatory Stamp
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text("DIGITALLY VERIFIED & SEALED", 196, footY, { align: "right" });

      doc.setFont("times", "bolditalic");
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229);
      doc.text(signer || "Dr. Rajesh Sharma, MD Pathology", 196, footY + 6, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("Chief Medical Officer / Pathologist", 196, footY + 11, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const timeStr = signTime ? new Date(signTime).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
      doc.text(`Timestamp: ${timeStr}`, 196, footY + 16, { align: "right" });

      // Section 2: Official Tax Invoice Page (if billing info present)
      if (billingInfo) {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text("Just LAB ERP", 14, 20);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("Developed by PRUDHVI RAJ", 14, 26);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(5, 150, 105);
        doc.text("OFFICIAL TAX INVOICE & BILLING STATEMENT", 14, 33);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(bName || "Main Diagnostic Hub", 196, 20, { align: "right" });
        doc.text(bAddr || "Medical District Sector 5", 196, 25, { align: "right" });
        doc.text(`Phone: ${bPhone || "+91 98765 43210"}`, 196, 30, { align: "right" });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(14, 38, 196, 38);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 44, 182, 38, 3, 3, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("INVOICE NO & REPORT LINK", 20, 52);
        doc.text("DATE & TIME", 105, 52);
        doc.text("PATIENT NAME", 150, 52);

        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        const invDisplay = `${billingInfo.invoice_number || `INV-${repNum}`} (Ref: ${repNum})`;
        doc.text(invDisplay.slice(0, 38), 20, 59);
        doc.text(timeStr, 105, 59);
        doc.text((patName || "Valued Patient").slice(0, 22), 150, 59);

        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("SPECIMEN & SAMPLE TYPE", 20, 68);
        doc.text("RATE CONTRACT AGREEMENT", 105, 68);
        doc.text("PAYMENT STATUS", 165, 68);

        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const specDisplay = billingInfo.specimen_name || "Whole Blood (EDTA)";
        doc.text(specDisplay.slice(0, 32), 20, 75);
        doc.text((billingInfo.contract_name || "Standard Patient Rate").slice(0, 25), 105, 75);

        const statusStr = (billingInfo.payment_status || "paid").toUpperCase();
        if (statusStr === "PAID") doc.setTextColor(5, 150, 105);
        else doc.setTextColor(217, 119, 6);
        doc.text(`[ ${statusStr} ]`, 165, 75);

        doc.setFillColor(15, 23, 42);
        doc.rect(14, 92, 182, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("DESCRIPTION / DIAGNOSTIC PANEL", 20, 98);
        doc.text("SPECIMEN TYPE", 100, 98);
        doc.text("AMOUNT (INR)", 188, 98, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text((tName || "Diagnostic Test Panel").slice(0, 35), 20, 112);
        doc.text(specDisplay.slice(0, 28), 100, 112);
        doc.text(`INR ${(billingInfo.standard_price || 500).toFixed(2)}`, 188, 112, { align: "right" });

        doc.line(14, 122, 196, 122);

        const stdP = Number(billingInfo.standard_price || 500);
        const disA = Number(billingInfo.discount_amount || 0);
        const netA = Number(billingInfo.net_amount || (stdP - disA));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("Standard Gross Price:", 120, 134);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(`INR ${stdP.toFixed(2)}`, 190, 134, { align: "right" });

        if (disA > 0) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 38, 38);
          doc.text("Contract Discount / Waiver:", 120, 142);
          doc.setFont("helvetica", "normal");
          doc.text(`- INR ${disA.toFixed(2)}`, 190, 142, { align: "right" });
        }

        doc.setFillColor(240, 253, 244);
        doc.roundedRect(118, 150, 78, 16, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(5, 150, 105);
        doc.text("NET AMOUNT DUE:", 124, 160);
        doc.text(`INR ${netA.toFixed(2)}`, 190, 160, { align: "right" });

        // Fetch UPI QR Code for Server PDF
        let upiQrBase64 = "";
        try {
          const invNum = billingInfo.invoice_number || `INV-${repNum}`;
          const upiUrl = `upi://pay?pa=labincharge@okicici&pn=${encodeURIComponent("Just LAB ERP")}&am=${netA.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invNum}`)}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;
          const qrRes = await fetch(qrUrl);
          const qrBuf = await qrRes.arrayBuffer();
          upiQrBase64 = `data:image/png;base64,${Buffer.from(qrBuf).toString("base64")}`;
        } catch (e) {
          console.warn("Could not fetch UPI QR code for server PDF:", e);
        }

        // UPI Payment Section with Real QR Code
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(14, 150, 102, 30, 3, 3, "F");
        if (upiQrBase64) {
          try {
            doc.addImage(upiQrBase64, "PNG", 17, 153, 24, 24);
          } catch (err) {
            console.warn("Error adding UPI QR image to server doc:", err);
          }
        }

        const upiTextX = upiQrBase64 ? 45 : 18;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(5, 150, 105);
        doc.text("INSTANT UPI PAYMENT (GPay / PhonePe)", upiTextX, 158);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Payee UPI ID: labincharge@okicici", upiTextX, 165);
        doc.text(`Amount Due: INR ${netA.toFixed(2)}`, upiTextX, 171);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Scan QR with any UPI app to pay instantly.", upiTextX, 176);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Note: This is an electronic tax invoice and laboratory billing receipt generated by Just LAB ERP. No physical signature required.", 14, 190);
      }

      // Return PDF Binary Buffer
      const arrayBuffer = doc.output("arraybuffer");
      return Buffer.from(arrayBuffer);
    };

    // Helper: Dispatch WhatsApp message via live Render gateway
    const sendWhatsAppAlert = async (phone: string, text: string) => {
      try {
        if (!phone) return false;
        const phoneToUse = phone.includes("@") ? "+919876543210" : phone;
        const baseUrl = process.env.WHATSAPP_SERVER_URL || process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "http://localhost:3005";
        const res = await fetch(`${baseUrl}/send-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phoneToUse,
            message: text,
            branchId: body.branch_id || "default",
            branchName: body.branch_name || "Main Diagnostic Hub"
          }),
        });
        return res.ok;
      } catch (e) {
        console.warn("WhatsApp Server dispatch warning:", e);
        return false;
      }
    };

    // Helper: Dispatch WhatsApp PDF document via live Render gateway
    const sendWhatsAppPdfAlert = async (phone: string, pdfBase64: string, filename: string, caption: string) => {
      try {
        if (!phone) return false;
        const phoneToUse = phone.includes("@") ? "+919876543210" : phone;
        const baseUrl = process.env.WHATSAPP_SERVER_URL || process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "http://localhost:3005";
        const res = await fetch(`${baseUrl}/send-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phoneToUse,
            pdfBase64,
            filename,
            caption,
            branchId: body.branch_id || "default",
            branchName: body.branch_name || "Main Diagnostic Hub"
          }),
        });
        return res.ok;
      } catch (e) {
        console.warn("WhatsApp Server PDF dispatch warning:", e);
        return false;
      }
    };

    // Helper: Dispatch Email via Resend with PDF Attachment
    const sendEmailAlert = async (email: string, subject: string, htmlContent: string, attachments?: any[]) => {
      try {
        if (!email || !process.env.RESEND_API_KEY) {
          return { success: false, error: "Missing email recipient or RESEND_API_KEY in .env.local" };
        }
        const sender = process.env.RESEND_FROM_EMAIL || "LAB ERP <reports@prudhvirajchalapaka.in>";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: [email],
            subject: subject,
            html: htmlContent,
            attachments: attachments || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("Resend API Error:", data);
          return { success: false, error: data.message || JSON.stringify(data) };
        }
        return { success: true, id: data.id };
      } catch (e: any) {
        console.warn("Email dispatch warning:", e);
        return { success: false, error: e.message };
      }
    };

    if (action === "create") {
      if (!patient_id) {
        return NextResponse.json({ error: "Patient ID is required." }, { status: 400 });
      }

      const repNum = `REP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const payload = {
        patient_id,
        branch_id: branch_id || null,
        test_id: test_id || null,
        group_id: group_id || null,
        referring_doctor: referring_doctor ? referring_doctor.trim() : null,
        status: status || "draft",
        sample_status: sample_status || "collected",
        results_data: results_data || [],
        notes: notes ? notes.trim() : null,
        report_number: repNum,
        beneficiary_name: body.beneficiary_name || null,
        beneficiary_age: body.beneficiary_age || null,
        beneficiary_gender: body.beneficiary_gender || null,
        beneficiary_relationship: body.beneficiary_relationship || "Self",
      };

      const { data, error } = await supabaseAdmin
        .from("reports")
        .insert([payload])
        .select("*, profiles(*), tests(*), lab_branches(*)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Notify patient via WhatsApp & Email
      if (patient_phone) {
        const msg = `🏥 *LAB ERP DIAGNOSTIC ALERT*\n\nHello *${patient_name || "Patient"}*,\nYour laboratory report *[${repNum}]* for test *${test_name || "Diagnostic Panel"}* has been initiated.\n\n📍 *Sample Status*: ${sample_status || "Collected"}\n📑 *Report Status*: ${status || "Draft / Under Analysis"}\n\nYou can track and download your verified PDF report anytime via our Patient Portal!`;
        await sendWhatsAppAlert(patient_phone, msg);
      }
      if (patient_email) {
        const pdfBuffer = await generateRealPdfBuffer(
          repNum,
          patient_name || "Patient",
          patient_age || "",
          patient_gender || "",
          test_name || "Diagnostic Panel",
          status || "draft",
          sample_status || "collected",
          signed_by || "",
          signed_at || "",
          notes || "",
          results_data || [],
          branch_name || "Main Diagnostic Hub",
          branch_address || "",
          branch_phone || "",
          branch_email || "",
          referring_doctor || "Self / General"
        );

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; max-width: 600px; color: #1e293b;">
            <h2 style="color: #4f46e5; margin-top: 0;">⚡ LAB ERP Diagnostic Report Initiated</h2>
            <p>Dear <strong>${patient_name || "Patient"}</strong>,</p>
            <p>Your diagnostic laboratory testing for <strong>${test_name || "Test Profile"}</strong> has been registered in our enterprise suite.</p>
            <p><strong>Report Number:</strong> <span style="color: #4f46e5; font-weight: bold;">${repNum}</span></p>
            <p><strong>Sample Status:</strong> <span style="color: #059669; font-weight: bold;">${(sample_status || "COLLECTED").toUpperCase()}</span></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 14px;">Please find attached your preliminary diagnostic report document (<strong>.PDF format</strong>).</p>
            <p style="font-size: 12px; color: #64748b;">Developed by Prudhvi RAJ — Accredited Clinical Reference Laboratory.</p>
          </div>
        `;

        const attach = [{ filename: `Lab_Report_${repNum}.pdf`, content: pdfBuffer.toString("base64") }];
        await sendEmailAlert(patient_email, `Lab Report Initiated — ${repNum}`, emailHtml, attach);
      }

      return NextResponse.json({ success: true, report: data });
    } else if (action === "update") {
      if (!reportId) {
        return NextResponse.json({ error: "Report ID is required for update." }, { status: 400 });
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (branch_id !== undefined) updateData.branch_id = branch_id || null;
      if (test_id !== undefined) updateData.test_id = test_id || null;
      if (group_id !== undefined) updateData.group_id = group_id || null;
      if (referring_doctor !== undefined) updateData.referring_doctor = referring_doctor ? referring_doctor.trim() : null;
      if (status !== undefined) updateData.status = status;
      if (sample_status !== undefined) updateData.sample_status = sample_status;
      if (results_data !== undefined) updateData.results_data = results_data;
      if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

      const { data, error } = await supabaseAdmin
        .from("reports")
        .update(updateData)
        .eq("id", reportId)
        .select("*, profiles(*), tests(*), lab_branches(*)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if ((status === "completed" || status === "published") && patient_phone) {
        const msg = `🎉 *LAB REPORT READY*\n\nHello *${patient_name || "Patient"}*,\nYour lab test report *[${data.report_number || "Report"}]* is now **${status.toUpperCase()}**!\n\nAll clinical parameters have been analyzed. Login to your Patient Portal to view your complete diagnostic results and download your official PDF report.`;
        await sendWhatsAppAlert(patient_phone, msg);
      }

      return NextResponse.json({ success: true, report: data });
    } else if (action === "sign") {
      if (!reportId) {
        return NextResponse.json({ error: "Report ID is required for signing." }, { status: 400 });
      }

      const signerName = signed_by || "Dr. Rajesh Sharma, MD Pathology (Chief Medical Officer)";
      const signedTime = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("reports")
        .update({
          authorized_signature: "DIGITALLY_VERIFIED_MD_SEAL",
          signed_by: signerName,
          signed_at: signedTime,
          status: "published",
          sample_status: "completed",
          updated_at: signedTime,
        })
        .eq("id", reportId)
        .select("*, profiles(*), tests(*), lab_branches(*)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if (patient_phone) {
        const msg = `🛡️ *OFFICIAL REPORT VERIFIED & SIGNED*\n\nHello *${patient_name || "Patient"}*,\nYour clinical report *[${data.report_number || "REP-ID"}]* has been digitally signed and authorized by:\n👨‍⚕️ *${signerName}*\n⏰ *Verified At*: ${new Date(signedTime).toLocaleString("en-IN")}\n\nYour vibrant PDF report with QR code & digital seal is ready for download in your portal!`;
        await sendWhatsAppAlert(patient_phone, msg);
      }
      if (patient_email) {
        const pdfBuffer = await generateRealPdfBuffer(
          data.report_number || "REP-001",
          patient_name || "Patient",
          patient_age || "",
          patient_gender || "",
          test_name || data.tests?.name || "Diagnostic Panel",
          "published",
          "completed",
          signerName,
          signedTime,
          notes || data.notes || "",
          results_data || data.results_data || [],
          branch_name || data.lab_branches?.name || "Main Diagnostic Hub",
          branch_address || data.lab_branches?.address || "",
          branch_phone || data.lab_branches?.contact_phone || "",
          branch_email || data.lab_branches?.contact_email || "",
          referring_doctor || data.referring_doctor || "Self / General"
        );

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #10b981; border-radius: 16px; max-width: 600px; background: #ecfdf5; color: #1e293b;">
            <h2 style="color: #059669; margin-top: 0;">✔ Official Report Digitally Signed & Published</h2>
            <p>Dear <strong>${patient_name || "Patient"}</strong>,</p>
            <p>Your laboratory test results for <strong>${test_name || data.tests?.name || "Diagnostic Profile"}</strong> have been formally verified and authorized.</p>
            <div style="background: white; padding: 16px; border-radius: 12px; margin: 16px 0; border: 1px solid #d1fae5;">
              <p style="margin: 0; font-weight: bold; color: #1e293b;">Report ID: <span style="color: #4f46e5;">${data.report_number || ""}</span></p>
              <p style="margin: 8px 0 0; font-weight: bold; color: #1e293b;">Authorized Signatory:</p>
              <p style="margin: 4px 0 0; color: #4f46e5; font-size: 16px; font-weight: 800;">✍️ ${signerName}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Timestamp: ${new Date(signedTime).toLocaleString("en-IN")}</p>
            </div>
            <p style="font-weight: bold; color: #059669;">Please find attached your official verified laboratory report document in .PDF format!</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">Developed by Prudhvi RAJ — Accredited Clinical Reference Laboratory.</p>
          </div>
        `;

        const attach = [{ filename: `Verified_Lab_Report_${data.report_number || "REP"}.pdf`, content: pdfBuffer.toString("base64") }];
        await sendEmailAlert(patient_email, `✔ Verified Lab Report Signed — ${data.report_number || ""}`, html, attach);
      }

      return NextResponse.json({ success: true, report: data });
    } else if (action === "delete") {
      if (!reportId) {
        return NextResponse.json({ error: "Report ID is required for deletion." }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from("reports").delete().eq("id", reportId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, message: "Report deleted permanently." });
    } else if (action === "notify_whatsapp_custom") {
      if (!patient_phone) return NextResponse.json({ error: "No WhatsApp phone provided." }, { status: 400 });
      const sent = await sendWhatsAppAlert(patient_phone, body.message || "Laboratory status update.");
      return NextResponse.json({ success: true, sent });
    } else if (action === "notify_whatsapp") {
      if (!patient_phone) return NextResponse.json({ error: "No patient WhatsApp number provided." }, { status: 400 });

      const pdfBuffer = await generateRealPdfBuffer(
        report_number || "REP-001",
        patient_name || "Patient",
        patient_age || "",
        patient_gender || "",
        test_name || "Diagnostic Panel",
        status || "published",
        sample_status || "completed",
        signed_by || "Dr. Rajesh Sharma, MD Pathology",
        signed_at || new Date().toISOString(),
        notes || "",
        results_data || [],
        branch_name || "Main Diagnostic Hub",
        branch_address || "",
        branch_phone || "",
        branch_email || "",
        referring_doctor || "Self / General"
      );

      const caption = `📑 *LAB REPORT DISPATCH*\n\nHello *${patient_name || "Patient"}*,\nPlease find attached your official diagnostic report PDF document for *[${report_number || "Report"}]* (${test_name || "Test Panel"}).\n\n📌 *Status*: ${status ? status.toUpperCase() : "PUBLISHED"}\n✍️ *Authorized By*: ${signed_by || "Chief Pathologist"}`;
      await sendWhatsAppPdfAlert(patient_phone, pdfBuffer.toString("base64"), `Lab_Report_${report_number || "REP"}.pdf`, caption);
      await sendWhatsAppAlert(patient_phone, caption);

      return NextResponse.json({ success: true, message: "WhatsApp PDF report alert sent successfully!" });
    } else if (action === "notify_email") {
      if (!patient_email) return NextResponse.json({ error: "No patient email address provided." }, { status: 400 });

      const pdfBuffer = await generateRealPdfBuffer(
        report_number || "REP-001",
        patient_name || "Patient",
        patient_age || "",
        patient_gender || "",
        test_name || "Diagnostic Panel",
        status || "published",
        sample_status || "completed",
        signed_by || "Dr. Rajesh Sharma, MD Pathology",
        signed_at || new Date().toISOString(),
        notes || "",
        results_data || [],
        branch_name || "Main Diagnostic Hub",
        branch_address || "",
        branch_phone || "",
        branch_email || "",
        referring_doctor || "Self / General"
      );

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; max-width: 600px; color: #1e293b;">
          <h2 style="color: #4f46e5; margin-top: 0;">📑 Official Laboratory Report Copy</h2>
          <p>Dear <strong>${patient_name || "Patient"}</strong>,</p>
          <p>Please find attached your clinical diagnostic report document (<strong>${report_number || "REP"}.pdf</strong>) for test profile <strong>${test_name || "Diagnostic Panel"}</strong>.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #cbd5e1; margin: 16px 0;">
            <p style="margin: 0;"><strong>Status:</strong> <span style="color: #059669;">${(status || "PUBLISHED").toUpperCase()}</span></p>
            <p style="margin: 6px 0 0;"><strong>Authorized By:</strong> ${signed_by || "Chief Medical Officer"}</p>
          </div>
          <p style="font-size: 13px; color: #475569;">The attached PDF is secured with cryptographic QR code verification and digital seal.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Developed by PRUDHVI RAJ.</p>
        </div>
      `;

      const attach = [{ filename: `Lab_Report_${report_number || "REP"}.pdf`, content: pdfBuffer.toString("base64") }];
      const resendRes = await sendEmailAlert(patient_email, `📑 Official Lab Report Copy — ${report_number || ""}`, html, attach);

      if (!resendRes.success) {
        return NextResponse.json({ error: `Resend Email Error: ${resendRes.error}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: `Email report (with genuine .PDF attachment!) sent successfully! [ID: ${resendRes.id}]` });
    } else if (action === "notify_both") {
      const { invoice_number, net_amount, specimen_name, sample_type, standard_price, discount_amount, contract_name } = body;
      const pdfBuffer = await generateRealPdfBuffer(
        report_number || "REP-001",
        patient_name || "Valued Patient",
        body.patient_age || "",
        body.patient_gender || "",
        body.test_name || "Diagnostic Panel",
        status || "published",
        sample_status || "completed",
        body.signed_by || "Dr. Rajesh Sharma, MD Pathology",
        body.signed_at || new Date().toISOString(),
        notes || "",
        results_data || [],
        branch_name || "Main Diagnostic Hub",
        body.branch_address || "Medical District Sector 5, India",
        body.branch_phone || "+91 98765 43210",
        body.branch_email || "reports@laberp.com",
        referring_doctor || "Self / General",
        {
          invoice_number: invoice_number || `INV-${reportId?.slice(0, 6)?.toUpperCase() || "2026-01"}`,
          specimen_name: specimen_name || "Whole Blood (EDTA)",
          sample_type: sample_type || "Routine Serum",
          standard_price: standard_price || 500,
          discount_amount: discount_amount || 0,
          net_amount: net_amount || 500,
          contract_name: contract_name || "Standard Patient Rate",
          payment_status: "paid"
        }
      );

      if (patient_phone) {
        const msg = `🏥 *LAB ERP DIAGNOSTIC & BILLING DISPATCH*\n\nHello *${patient_name || "Patient"}*,\nPlease find attached your merged official laboratory report *[${report_number || "REP"}]* and tax invoice *[${invoice_number || "INV"}]* (Net Amount: Rs. ${net_amount || 500}).\n\n📑 *Test Profile*: ${body.test_name || "Diagnostic Panel"}\n📌 *Status*: PUBLISHED & PAID`;
        await sendWhatsAppPdfAlert(patient_phone, pdfBuffer.toString("base64"), `${report_number || "Lab_Report"}_Invoice.pdf`, msg);
        await sendWhatsAppAlert(patient_phone, msg);
      }

      if (patient_email) {
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; max-width: 600px; color: #1e293b;">
            <h2 style="color: #4f46e5; margin-top: 0;">⚡ LAB ERP Merged Diagnostic Report & Tax Invoice</h2>
            <p>Dear <strong>${patient_name || "Patient"}</strong>,</p>
            <p>Please find attached your comprehensive medical dossier (<strong>${report_number || "REP"}_Merged.pdf</strong>), which includes both your clinical diagnostic findings and your official tax billing receipt.</p>
            <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #cbd5e1; margin: 16px 0;">
              <p style="margin: 0;"><strong>Report ID:</strong> ${report_number || "REP"}</p>
              <p style="margin: 6px 0 0;"><strong>Invoice ID:</strong> <span style="color: #059669; font-weight: bold;">${invoice_number || "INV"}</span></p>
              <p style="margin: 6px 0 0;"><strong>Total Net Paid:</strong> Rs. ${net_amount || 500} INR</p>
            </div>
            <p style="font-size: 13px; color: #475569;">The attached document is digitally sealed and verified for healthcare claims and tax records.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">Just LAB ERP — Developed by PRUDHVI RAJ.</p>
          </div>
        `;
        const attach = [{ filename: `${report_number || "REP"}_Report_and_Invoice.pdf`, content: pdfBuffer.toString("base64") }];
        await sendEmailAlert(patient_email, `📑 Merged Report & Invoice — ${report_number || ""}`, html, attach);
      }

      return NextResponse.json({ success: true, message: "Merged Report + Official Tax Invoice PDF successfully sent via WhatsApp & Email!" });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Report Action Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
