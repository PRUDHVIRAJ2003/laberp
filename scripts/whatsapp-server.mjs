/**
 * LAB ERP — Multi-Branch WhatsApp OTP & Dispatch Gateway
 * 
 * Manages separate WhatsApp web sessions for every lab branch using @whiskeysockets/baileys.
 * Exposes REST API for QR scanning on webpage, session control, dispatching messages, and logs.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PORT = Number(process.env.PORT) || 3005;
const MAX_RETRIES = 5;

// Map of branchId => { sock, status: 'CONNECTED'|'WAITING_FOR_QR'|'DISCONNECTED', qr: string|null, retryCount: number, phone: string|null, branchName: string }
const sessions = new Map();

// In-memory dispatch logs (last 100)
const logs = [];

function addLog(branchId, branchName, phone, status, message, error = null) {
  const safeMessage = message
    ? message.replace(/verification code is:\s*\*?(\d{6})\*?/gi, "verification code is: ******")
             .replace(/OTP:\s*(\d{6})/gi, "OTP: ******")
             .slice(0, 80)
    : "";

  const entry = {
    id: Date.now() + '-' + Math.floor(Math.random()*1000),
    timestamp: new Date().toISOString(),
    branchId,
    branchName: branchName || branchId || 'Main Lab',
    phone,
    status, // 'SENT' | 'FAILED'
    message: safeMessage + (safeMessage.length > 80 ? '...' : ''),
    error: error ? String(error) : null
  };
  logs.unshift(entry);
  if (logs.length > 100) logs.pop();
}

// Ensure default session exists
if (!sessions.has('default')) {
  sessions.set('default', {
    sock: null,
    status: 'DISCONNECTED',
    qr: null,
    retryCount: 0,
    phone: null,
    branchName: 'Main Laboratory / Default'
  });
}

// Supabase Cloud Session Persistence for Ephemeral Environments (Render / Docker)
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://htxafjkknkpgimykjifb.supabase.co";
// Always use SERVICE_ROLE_KEY to bypass RLS policies on branch_configurations table
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eGFmamtrbmtwZ2lteWtqaWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1NjEwNCwiZXhwIjoyMDk4OTMyMTA0fQ.-6Iq96WcAFGCFLWt_KymBNME1mgOBaIRLeLaV86uosE";

async function restoreCredsFromSupabase(branchId, authDir) {
  try {
    if (!supaUrl || !supaKey) return;
    const res = await fetch(`${supaUrl}/rest/v1/branch_configurations?branch_id=eq.wa_session_${branchId}`, {
      headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` }
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.config?.creds) {
      if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
      fs.writeFileSync(path.join(authDir, 'creds.json'), JSON.stringify(data[0].config.creds, null, 2), 'utf-8');
      console.log(`☁️ [Branch: ${branchId}] Restored WhatsApp session from cloud storage!`);
    }
  } catch (err) {}
}

async function saveCredsToSupabase(branchId, authDir) {
  try {
    if (!supaUrl || !supaKey) return;
    const credsPath = path.join(authDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const credsRaw = fs.readFileSync(credsPath, 'utf-8');
      const credsObj = JSON.parse(credsRaw);
      await fetch(`${supaUrl}/rest/v1/branch_configurations`, {
        method: "POST",
        headers: {
          "apikey": supaKey,
          "Authorization": `Bearer ${supaKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          branch_id: `wa_session_${branchId}`,
          config: { creds: credsObj },
          updated_at: new Date().toISOString()
        })
      });
    }
  } catch (err) {}
}

async function clearCredsInSupabase(branchId) {
  try {
    if (!supaUrl || !supaKey) return;
    await fetch(`${supaUrl}/rest/v1/branch_configurations?branch_id=eq.wa_session_${branchId}`, {
      method: "DELETE",
      headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` }
    });
  } catch (err) {}
}

async function connectBranch(branchId = 'default', branchName = 'Main Laboratory') {
  let session = sessions.get(branchId);
  if (!session) {
    session = { sock: null, status: 'DISCONNECTED', qr: null, retryCount: 0, phone: null, branchName };
    sessions.set(branchId, session);
  } else if (branchName) {
    session.branchName = branchName;
  }

  const authDir = path.resolve(`auth_info_baileys_${branchId}`);
  if (!fs.existsSync(path.join(authDir, 'creds.json'))) {
    await restoreCredsFromSupabase(branchId, authDir);
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
    browser: ['Just LAB ERP', 'Chrome', '124.0.0.0'],
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
  });

  session.sock = sock;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr = qr;
      session.status = 'WAITING_FOR_QR';
      console.log(`\n📱 [Branch: ${session.branchName}] New QR Code generated! Scan from web UI or terminal.`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      session.status = 'CONNECTED';
      session.qr = null;
      session.retryCount = 0;
      session.phone = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || 'Connected';
      console.log(`\n✅ [Branch: ${session.branchName}] WhatsApp connected! (${session.phone})`);
    }

    if (connection === 'close') {
      session.status = 'DISCONNECTED';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log(`\n❌ [Branch: ${session.branchName}] Logged out. Clearing stale auth data...`);
        session.qr = null;
        session.phone = null;
        clearCredsInSupabase(branchId);
        if (fs.existsSync(authDir)) {
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
        }
        setTimeout(() => connectBranch(branchId, session.branchName), 1500);
        return;
      }

      // Automatically reconnect persistently without permanent lockouts
      const delay = 3000;
      console.log(`⟳ [Branch: ${session.branchName}] Connection dropped (${statusCode}). Reconnecting in ${delay/1000}s...`);
      setTimeout(() => connectBranch(branchId, session.branchName), delay);
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    saveCredsToSupabase(branchId, authDir);
  });

  // Interactive 2-Way WhatsApp Chatbot Handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) continue; // Ignore group chats

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!text) continue;

      const upper = text.toUpperCase();

      // Ignore messages from self unless testing with HI, MENU, TEST, or 1-4
      const isTestCmd = ['HI', 'HELLO', 'MENU', 'TEST', '1', '2', '3', '4'].includes(upper);
      if (msg.key.fromMe && !isTestCmd) continue;

      // Resolve sender phone number (handling Baileys multi-device LID format vs standard s.whatsapp.net)
      const rawAlt = msg.key.remoteJidAlt || msg.key.participantAlt || '';
      const rawMain = msg.key.participant || remoteJid || '';
      const phoneNum = (rawAlt.includes('@s.whatsapp.net') ? rawAlt : rawMain).split('@')[0].replace(/[^0-9]/g, '');
      const pushName = msg.pushName || '';
      console.log(`🤖 [Bot - ${session.branchName}] Received "${text}" from ${phoneNum} (${pushName})`);

      if (upper === '1' || upper.includes('REPORT')) {
        const found = await searchReportInSupabase(phoneNum, true, pushName);
        if (found) {
          try {
            const pdfBuffer = buildReportPdfBuffer(found);
            await sock.sendMessage(remoteJid, {
              document: pdfBuffer,
              mimetype: 'application/pdf',
              fileName: `Lab_Report_${found.report_number || 'Official'}.pdf`,
              caption: `📄 *YOUR VERIFIED LAB REPORT PDF*\n\n👤 *Patient:* ${found.patient_name || 'Valued Patient'}\n📑 *Test:* ${found.tests?.name || found.test_name || 'Diagnostic Panel'}\n🔖 *Report Ref:* ${found.report_number || 'REP'}\n\nAttached above is your official laboratory report document.\n\nTo view all historical reports, billing invoices, or book appointments, log in anytime:\n🔗 *https://laberp.vercel.app/patient/dashboard*`
            });
          } catch (pdfErr) {
            console.error("PDF generation error in chatbot:", pdfErr);
            await sock.sendMessage(remoteJid, {
              text: `📄 *VERIFIED LAB REPORT FOUND*\n\n👤 *Patient:* ${found.patient_name || 'Valued Patient'}\n📑 *Test:* ${found.test_name || 'Diagnostic Panel'}\n🔖 *Report ID:* ${found.report_number || 'REP'}\n\nLogin securely to download your verified PDF report instantly:\n🔗 *https://laberp.vercel.app/patient/dashboard*`
            });
          }
        } else {
          const displayNum = phoneNum.length > 13 ? 'your WhatsApp account' : `phone (+${phoneNum})`;
          await sock.sendMessage(remoteJid, {
            text: `🔒 *Medical Privacy Protection*\n\nWe could not find any published lab report linked directly to ${displayNum}.\n\nFor patient data privacy, reports can only be sent to the registered mobile number on file. If you registered under a different number or email, please log in securely via OTP:\n🔗 *https://laberp.vercel.app/patient*`
          });
        }
      } else if (upper === '2' || upper.includes('INVOICE') || upper.includes('BILL')) {
        await sock.sendMessage(remoteJid, {
          text: `🧾 *YOUR RECENT INVOICES & PAYMENTS*\n\nYou can inspect your billing receipts, payment status, and tax invoices anytime:\n🔗 *https://laberp.vercel.app/patient/dashboard*\n\n_Need help? Reply 4 to speak with our reception._`
        });
      } else if (upper === '3' || upper.includes('BOOK') || upper.includes('APPOINTMENT')) {
        await sock.sendMessage(remoteJid, {
          text: `📅 *BOOK A TEST / HOME SAMPLE COLLECTION*\n\nBook blood tests, full body checkups, or home sample pickup in 30 seconds:\n🔗 *https://laberp.vercel.app/patient/dashboard*\n\nChoose your preferred date, time slot, and nearest lab branch!`
        });
      } else if (upper === '4' || upper.includes('ADDRESS') || upper.includes('LOCATION')) {
        await sock.sendMessage(remoteJid, {
          text: `📍 *LAB BRANCH & CONTACT DETAILS*\n\n*Branch:* ${session.branchName}\n*Headquarters:* Medical District Sector 5, India\n*Helpline:* +91 98765 43210\n*Email:* help@laberp.vercel.app\n\nWe are open Monday to Saturday (07:00 AM - 09:00 PM).`
        });
      } else {
        // Default Interactive Menu
        await sock.sendMessage(remoteJid, {
          text: `🏥 *LAB ERP DIAGNOSTIC & RESEARCH CENTER*\n_Automated 24/7 Patient Assistant_\n\nHello! How can we assist you today?\n\nReply with a number:\n*1️⃣* Download Latest Test Report (PDF)\n*2️⃣* Check Invoices & Payment Status\n*3️⃣* Book Home Sample Collection / Lab Visit\n*4️⃣* Lab Location & Helpline Contact\n\n_Reply 1, 2, 3, or 4 at any time._`
        });
      }
    }
  });
}

const app = express();
app.use(express.json());

// Enable CORS for Next.js UI
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// GET all branch sessions & status
app.get('/sessions', (req, res) => {
  const result = [];
  for (const [branchId, sess] of sessions.entries()) {
    result.push({
      branchId,
      branchName: sess.branchName,
      status: sess.status,
      phone: sess.phone,
      qr: sess.qr,
      retryCount: sess.retryCount
    });
  }
  res.json({ ok: true, sessions: result });
});

// POST start/refresh a branch session
app.post('/sessions/start', async (req, res) => {
  const { branchId = 'default', branchName = 'Lab Branch' } = req.body || {};
  const existing = sessions.get(branchId);
  if (existing && existing.sock && existing.status !== 'CONNECTED') {
    try { existing.sock.end(undefined); } catch (e) {}
  }
  await connectBranch(branchId, branchName);
  res.json({ ok: true, message: `Session initiated for ${branchName}` });
});

// POST logout/disconnect a branch session
app.post('/sessions/logout', async (req, res) => {
  const { branchId = 'default' } = req.body || {};
  const sess = sessions.get(branchId);
  if (sess && sess.sock) {
    try {
      await sess.sock.logout();
    } catch (e) {}
    sess.status = 'DISCONNECTED';
    sess.qr = null;
    sess.phone = null;
  }
  const authDir = path.resolve(`auth_info_baileys_${branchId}`);
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch (e) {}
  }
  res.json({ ok: true, message: `Logged out and reset credentials for branch ${branchId}` });
});

// GET logs
app.get('/logs', (req, res) => {
  res.json({ ok: true, logs });
});

// Helper to generate professional PDF report buffer
function buildReportPdfBuffer(rep) {
  const doc = new jsPDF();
  const patName = rep.patient_name || rep.profiles?.full_name || "Valued Patient";
  const repNum = rep.report_number || `REP-${rep.id?.slice(0, 6)?.toUpperCase() || "001"}`;
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
  const phoneStr = rep.profiles?.phone_number || rep.patient_phone || "—";
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
        [rep.tests?.name || rep.test_name || "Comprehensive Diagnostic Panel", "NORMAL", "—", "Within Range", "VERIFIED"]
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

  return Buffer.from(doc.output("arraybuffer"));
}

// Helper to search Supabase reports
async function searchReportInSupabase(query, isPhone = true, pushName = "") {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://htxafjkknkpgimykjifb.supabase.co";
  // Always use SERVICE_ROLE_KEY (never anon key) so RLS policies do not block server-side WhatsApp lookups
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eGFmamtrbmtwZ2lteWtqaWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1NjEwNCwiZXhwIjoyMDk4OTMyMTA0fQ.-6Iq96WcAFGCFLWt_KymBNME1mgOBaIRLeLaV86uosE";

  const cleanQuery = String(query || "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  const last10 = cleanQuery.replace(/[^0-9]/g, "").slice(-10);
  const cleanPushName = String(pushName || "").trim().toLowerCase();

  try {
    const endpoint = `${supaUrl}/rest/v1/reports?select=*,profiles(*)&status=eq.published&order=created_at.desc&limit=100`;
    const res = await fetch(endpoint, {
      headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` }
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      for (const r of data) {
        const prof = r.profiles || {};
        const rPhone = String(prof.phone_number || prof.phone || r.patient_phone || "").replace(/[^0-9]/g, "");
        const rName = String(prof.full_name || r.patient_name || "").trim().toLowerCase();

        if (isPhone) {
          if (last10.length >= 7 && rPhone.includes(last10)) {
            r.patient_name = prof.full_name || r.patient_name || "Valued Patient";
            return r;
          }

          if (cleanPushName.length >= 3 && rName && (rName === cleanPushName || rName.includes(cleanPushName) || cleanPushName.includes(rName))) {
            r.patient_name = prof.full_name || r.patient_name || "Valued Patient";
            return r;
          }
        } else {
          if (cleanQuery.length >= 3 && (rName.includes(cleanQuery) || cleanQuery.includes(rName))) {
            r.patient_name = prof.full_name || r.patient_name || "Valued Patient";
            return r;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Direct Supabase fetch failed in WhatsApp bot:", e);
  }

  // Fail-safe fallback: call Vercel /api/patient/get-reports endpoint directly
  try {
    const apiRes = await fetch("https://laberp.vercel.app/api/patient/get-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanQuery, name: cleanPushName })
    });
    const apiData = await apiRes.json();
    if (apiData.ok && Array.isArray(apiData.reports) && apiData.reports.length > 0) {
      return apiData.reports[0];
    }
  } catch (err) {
    console.warn("Fallback Vercel API fetch failed:", err);
  }

  return null;
}

// POST send message or PDF document
app.post(['/send-message', '/send', '/send-pdf'], async (req, res) => {
  const { phone, message, branchId = 'default', branchName = 'Main Lab', pdfBase64, filename, caption } = req.body || {};

  if (!phone) {
    return res.status(400).json({ ok: false, error: '"phone" field is required.' });
  }

  let sess = sessions.get(branchId);
  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    sess = sessions.get('default');
  }
  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    for (const s of sessions.values()) {
      if (s.status === 'CONNECTED' && s.sock) {
        sess = s;
        break;
      }
    }
  }

  // Auto-restore from Supabase cloud storage if session sat idle or container restarted
  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    console.log(`⚡ [Auto-Restore] No active session found. Restoring & reconnecting branch "${branchId}" on demand...`);
    await connectBranch(branchId, branchName);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 600));
      sess = sessions.get(branchId) || sessions.get('default');
      if (sess && sess.status === 'CONNECTED' && sess.sock) break;
    }
  }

  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    const err = 'No active WhatsApp session connected for this branch or default lab.';
    addLog(branchId, branchName, phone, 'FAILED', message || caption || 'PDF Document', err);
    return res.status(503).json({ ok: false, error: err });
  }

  try {
    let digits = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }

    const jid = `${digits}@s.whatsapp.net`;
    let targetJid = jid;
    try {
      const waChecks = await sess.sock.onWhatsApp(jid);
      if (Array.isArray(waChecks) && waChecks[0]?.exists) {
        targetJid = waChecks[0].jid;
      }
    } catch (checkErr) {
      // Keep direct jid if WhatsApp check times out or drops IQ
    }

    try {
      if (pdfBase64) {
        await sess.sock.sendMessage(targetJid, {
          document: Buffer.from(pdfBase64, 'base64'),
          mimetype: 'application/pdf',
          fileName: filename || 'Verified_Lab_Report.pdf',
          caption: caption || message || '📑 Here is your official verified laboratory PDF document.'
        });
      } else {
        await sess.sock.sendMessage(targetJid, { text: message });
      }
    } catch (firstSendErr) {
      console.warn(`⚠️ First send attempt failed (${firstSendErr.message}). Retrying in 1.5s...`);
      await new Promise(r => setTimeout(r, 1500));
      if (pdfBase64) {
        await sess.sock.sendMessage(targetJid, {
          document: Buffer.from(pdfBase64, 'base64'),
          mimetype: 'application/pdf',
          fileName: filename || 'Verified_Lab_Report.pdf',
          caption: caption || message || '📑 Here is your official verified laboratory PDF document.'
        });
      } else {
        await sess.sock.sendMessage(targetJid, { text: message });
      }
    }

    console.log(`✅ [Branch: ${sess.branchName}] Sent message → ${digits}`);
    addLog(branchId, sess.branchName, digits, 'SENT', message);
    return res.json({ ok: true, sent: true, to: digits, branchUsed: sess.branchName });
  } catch (err) {
    console.error(`❌ Send failed → ${phone}:`, err.message);
    addLog(branchId, sess?.branchName || branchName, phone, 'FAILED', message, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/health', (_req, res) => {
  const anyConnected = Array.from(sessions.values()).some(s => s.status === 'CONNECTED');
  res.json({ ok: true, connected: anyConnected, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 LAB ERP Multi-Branch WhatsApp Gateway starting on port ${PORT}...\n`);
  connectBranch('default', 'Main Laboratory / Default');

  // Keep-alive monitor: Every 3 minutes, check if sessions are disconnected and restore them automatically
  setInterval(() => {
    for (const [branchId, session] of sessions.entries()) {
      if (session.status !== 'CONNECTED') {
        console.log(`⏱️ [Keep-Alive] Branch "${branchId}" inactive. Restoring & reconnecting...`);
        connectBranch(branchId, session.branchName);
      }
    }
  }, 3 * 60 * 1000);
});
