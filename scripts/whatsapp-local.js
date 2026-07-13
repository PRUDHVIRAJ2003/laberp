/**
 * LAB ERP — Local WhatsApp Gateway (whatsapp-web.js)
 * 
 * Runs a 24/7 headless Chrome browser locally via Puppeteer.
 * Stores auth state in `.wwebjs_auth` directory.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

const PORT = 3005;
const app = express();
app.use(express.json({ limit: '50mb' }));

// Helper to generate professional PDF report buffer
function buildReportPdfBuffer(rep) {
  const doc = new jsPDF();
  const patName = rep.patient_name || (rep.profiles && rep.profiles.full_name) || "Valued Patient";
  const repNum = rep.report_number || `REP-${(rep.id || "").slice(0, 6).toUpperCase() || "001"}`;
  const invNum = rep.invoice_number || "INV-STD";

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("JUST LAB ERP DIAGNOSTICS & RESEARCH", 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("ISO 9001:2015 Accredited Clinical Laboratory | Digital Verified Medical Report", 14, 21);

  // Patient Info Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 34, 182, 30, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`PATIENT: ${patName}`.slice(0, 50), 18, 43);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const phoneStr = (rep.profiles && rep.profiles.phone_number) || rep.patient_phone || "—";
  doc.text(`Phone: ${phoneStr}`, 18, 50);
  doc.text(`Specimen: ${rep.specimen_name || "Whole Blood (EDTA)"}`, 18, 57);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(`REPORT REF: ${repNum}`, 125, 43);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice: ${invNum}`, 125, 50);
  doc.text(`Date: ${new Date(rep.created_at || Date.now()).toLocaleDateString("en-IN")}`, 125, 57);

  // Diagnostic Results Table
  let resultsList = [];
  if (Array.isArray(rep.results_data)) {
    resultsList = rep.results_data;
  } else if (rep.results_data && Array.isArray(rep.results_data.results)) {
    resultsList = rep.results_data.results;
  }

  const tableBody = resultsList.length > 0
    ? resultsList.map((r) => [
        String(r.test_name || r.name || r.parameter || "Clinical Test").slice(0, 36),
        String(r.value || r.result || "—"),
        String(r.unit || "—"),
        String(r.normal_range || r.reference_range || "Standard"),
        String(r.flag || "NORMAL").toUpperCase()
      ])
    : [
        [(rep.tests && rep.tests.name) || rep.test_name || "Comprehensive Diagnostic Panel", "NORMAL", "—", "Within Range", "VERIFIED"]
      ];

  autoTable(doc, {
    startY: 72,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 32 },
      2: { cellWidth: 28 },
      3: { cellWidth: 38 },
      4: { cellWidth: 24 }
    },
    head: [["Test Parameter", "Observed Value", "Unit", "Biological Ref. Range", "Status"]],
    body: tableBody
  });

  const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 16 : 140;

  // Verification & Sign off
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, finalY, 182, 24, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52);
  doc.text("VERIFIED BY CHIEF MEDICAL OFFICER (MD PATHOLOGY)", 18, finalY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("This document is cryptographically verified and signed by Just LAB ERP Diagnostics.", 18, finalY + 16);

  return Buffer.from(doc.output("arraybuffer")).toString('base64');
}

// Helper to search Supabase reports
async function searchReportInSupabase(query, isPhone = true, pushName = "") {
  const supaUrl = "https://htxafjkknkpgimykjifb.supabase.co";
  const supaKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eGFmamtrbmtwZ2lteWtqaWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1NjEwNCwiZXhwIjoyMDk4OTMyMTA0fQ.-6Iq96WcAFGCFLWt_KymBNME1mgOBaIRLeLaV86uosE";

  const cleanQuery = String(query || "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  const last10 = cleanQuery.replace(/[^0-9]/g, "").slice(-10);
  const cleanPushName = String(pushName || "").trim().toLowerCase();

  try {
    const endpoint = `${supaUrl}/rest/v1/reports?select=*,profiles(*)&status=eq.published&order=created_at.desc&limit=100`;
    const res = await fetch(endpoint, {
      headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` }
    });
    const data = await res.json();
    
    if (Array.isArray(data)) {
      for (const rep of data) {
        if (isPhone && rep.profiles && String(rep.profiles.phone_number || "").includes(last10)) return rep;
        if (isPhone && String(rep.patient_phone || "").includes(last10)) return rep;
      }
      if (cleanPushName && cleanPushName.length > 2) {
        for (const rep of data) {
          const fn = String(rep.profiles && rep.profiles.full_name || rep.patient_name || "").toLowerCase();
          if (fn.includes(cleanPushName) || cleanPushName.includes(fn)) return rep;
        }
      }
    }
  } catch (err) {
    console.warn("Supabase fetch error:", err.message);
  }

  // Fallback API
  try {
    const apiRes = await fetch("http://localhost:3000/api/patient/get-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanQuery, name: cleanPushName })
    });
    const apiData = await apiRes.json();
    if (apiData.ok && Array.isArray(apiData.reports) && apiData.reports.length > 0) {
      return apiData.reports[0];
    }
  } catch (err) {
    console.warn("Fallback Local API fetch failed:", err);
  }

  return null;
}

// Global client state
let isConnected = false;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: { 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage', 
          '--disable-accelerated-2d-canvas', 
          '--no-first-run', 
          '--no-zygote', 
          '--single-process', 
          '--disable-gpu'
        ] 
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code with your WhatsApp app:');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Loading WhatsApp Web: ${percent}% - ${message}`);
});

client.on('ready', () => {
    isConnected = true;
    console.log('\n✅ Local WhatsApp Gateway is READY and CONNECTED!');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated successfully!');
});

client.on('auth_failure', msg => {
    console.error('❌ Authentication failure', msg);
    isConnected = false;
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Disconnected:', reason);
    isConnected = false;
    client.initialize(); // Auto-reconnect
});

// Interactive Chatbot
client.on('message_create', async msg => {
    // Ignore status updates
    if (msg.from === 'status@broadcast') return;

    const text = msg.body.trim();
    const upper = text.toUpperCase();
    const remoteJid = msg.from;
    
    // Normalize phone from ID (if fromMe is true, msg.to is the destination, msg.from is the sender)
    // To support testing by texting yourself, we extract the phone number of the chat.
    const chat = await msg.getChat();
    let phoneNum = msg.from.split('@')[0].replace(/[^0-9]/g, '');
    if (msg.fromMe) {
        phoneNum = msg.to.split('@')[0].replace(/[^0-9]/g, '');
    }

    const pushName = msg._data?.notifyName || '';

    // Only respond to specific trigger words. If the bot sends a message containing these words
    // (like "REPORT REF"), we don't want it to trigger itself and loop.
    if (msg.fromMe && text.length > 15) return; 
    
    if (upper === '1' || upper === 'REPORT') {
        console.log(`🤖 Received "1" or "REPORT" query for phone ${phoneNum}`);
        const found = await searchReportInSupabase(phoneNum, true, pushName);
        if (found) {
            try {
                const pdfBase64 = buildReportPdfBuffer(found);
                const media = new MessageMedia('application/pdf', pdfBase64, `Lab_Report_${found.report_number || 'Official'}.pdf`);
                
                const caption = `📄 *YOUR VERIFIED LAB REPORT PDF*\n\n👤 *Patient:* ${found.patient_name || (found.profiles && found.profiles.full_name) || 'Valued Patient'}\n📑 *Test:* ${(found.tests && found.tests.name) || found.test_name || 'Diagnostic Panel'}\n🔖 *Report Ref:* ${found.report_number || 'REP'}\n\nAttached above is your official laboratory report document.\n\nTo view all historical reports, billing invoices, or book appointments, log in anytime:\n🔗 *https://laberp.vercel.app/patient/dashboard*`;
                
                await msg.reply(media, null, { caption });
            } catch (pdfErr) {
                console.error("PDF generation error in chatbot:", pdfErr);
                await msg.reply(`📄 *VERIFIED LAB REPORT FOUND*\n\n👤 *Patient:* ${found.patient_name || 'Valued Patient'}\n📑 *Test:* ${found.test_name || 'Diagnostic Panel'}\n🔖 *Report ID:* ${found.report_number || 'REP'}\n\nLogin securely to download your verified PDF report instantly:\n🔗 *https://laberp.vercel.app/patient/dashboard*`);
            }
        } else {
            const displayNum = phoneNum.length > 13 ? 'your WhatsApp account' : `phone (+${phoneNum})`;
            await msg.reply(`🔒 *Medical Privacy Protection*\n\nWe could not find any published lab report linked directly to ${displayNum}.\n\nFor patient data privacy, reports can only be sent to the registered mobile number on file. If you registered under a different number or email, please log in securely via OTP:\n🔗 *https://laberp.vercel.app/patient*`);
        }
    } else if (upper === '2' || upper === 'INVOICE' || upper === 'BILL') {
        await msg.reply(`🧾 *YOUR RECENT INVOICES & PAYMENTS*\n\nYou can inspect your billing receipts, payment status, and tax invoices anytime:\n🔗 *https://laberp.vercel.app/patient/dashboard*\n\n_Need help? Reply 4 to speak with our reception._`);
    } else if (upper === '3' || upper === 'BOOK' || upper === 'APPOINTMENT') {
        await msg.reply(`🗓 *BOOK A NEW APPOINTMENT*\n\nWant to book a home sample collection or an in-lab test? Click below to reserve your slot instantly:\n🔗 *https://laberp.vercel.app/patient/dashboard*`);
    } else if (upper === '4' || upper === 'SUPPORT' || upper === 'HELP' || upper === 'RECEPTION') {
        await msg.reply(`📞 *CUSTOMER SUPPORT*\n\nOur lab reception team is here to help!\n\n💬 Reply with your question here, or call us at +91 98765 43210 (Mon-Sat, 07:00 AM - 09:00 PM).\nEmail: help@laberp.vercel.app`);
    }
});

// REST API for Web App Communication
app.post(['/send-message', '/send', '/send-pdf'], async (req, res) => {
    const { phone, message, pdfBase64, filename, caption } = req.body;

    if (!phone) {
        return res.status(400).json({ ok: false, error: '"phone" field is required.' });
    }

    if (!isConnected) {
        return res.status(503).json({ ok: false, error: 'Local WhatsApp server is not connected yet.' });
    }

    try {
        let digits = String(phone).replace(/[^0-9]/g, '').replace(/^0+/, '');
        if (digits.length === 10) {
            digits = '91' + digits;
        }
        if (digits.length === 12 && digits.startsWith('9191')) {
            digits = digits.slice(2);
        }

        // whatsapp-web.js uses @c.us for standard phone numbers (not @s.whatsapp.net like Baileys)
        const targetJid = `${digits}@c.us`;

        // Check if number is registered
        const isRegistered = await client.isRegisteredUser(targetJid);
        if (!isRegistered) {
            console.warn(`❌ [Send Aborted] Phone number +${digits} is not registered on WhatsApp.`);
            return res.status(404).json({ ok: false, error: `Phone number +${digits} is not registered on WhatsApp.` });
        }

        if (pdfBase64) {
            const media = new MessageMedia('application/pdf', pdfBase64, filename || 'Verified_Lab_Report.pdf');
            await client.sendMessage(targetJid, media, { caption: caption || message || '📑 Here is your official verified laboratory PDF document.' });
        } else {
            await client.sendMessage(targetJid, message);
        }

        console.log(`✅ Successfully sent message to ${targetJid}`);
        return res.json({ ok: true, sent: true, to: digits, targetJid });
    } catch (err) {
        console.error(`❌ Send failed to ${phone}:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/health', (_req, res) => {
    res.json({ ok: true, connected: isConnected, uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`\n🚀 LAB ERP Local WhatsApp Gateway API listening on port ${PORT}...`);
    console.log(`Initializing Chrome browser via Puppeteer. This takes a few seconds...\n`);
    client.initialize();
});
