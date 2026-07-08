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

async function connectBranch(branchId = 'default', branchName = 'Main Laboratory') {
  let session = sessions.get(branchId);
  if (!session) {
    session = { sock: null, status: 'DISCONNECTED', qr: null, retryCount: 0, phone: null, branchName };
    sessions.set(branchId, session);
  } else if (branchName) {
    session.branchName = branchName;
  }

  const authDir = path.resolve(`auth_info_baileys_${branchId}`);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
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
        if (fs.existsSync(authDir)) {
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
        }
        // Auto restart once after clearing stale creds to generate fresh QR
        setTimeout(() => connectBranch(branchId, session.branchName), 1500);
        return;
      }

      if (session.retryCount < MAX_RETRIES) {
        session.retryCount++;
        const delay = Math.min(session.retryCount * 2000, 10000);
        console.log(`⟳ [Branch: ${session.branchName}] Reconnecting in ${delay/1000}s...`);
        setTimeout(() => connectBranch(branchId, session.branchName), delay);
      } else {
        console.log(`\n❌ [Branch: ${session.branchName}] Max reconnections reached.`);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

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

      const phoneNum = remoteJid.split('@')[0];
      console.log(`🤖 [Bot - ${session.branchName}] Received "${text}" from ${phoneNum}`);

      if (upper === '1' || upper.includes('REPORT')) {
        await sock.sendMessage(remoteJid, {
          text: `📄 *YOUR LATEST DIAGNOSTIC REPORT*\n\nTo view and download your verified NABL/ISO vector PDF report instantly, click below to open your secure portal:\n🔗 *https://laberp.vercel.app/patient/dashboard*\n\n_Login is automatic with your WhatsApp mobile number._`
        });
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

// POST send message
app.post(['/send-message', '/send'], async (req, res) => {
  const { phone, message, branchId = 'default', branchName = 'Main Lab' } = req.body || {};

  if (!phone || !message) {
    return res.status(400).json({ ok: false, error: 'Both "phone" and "message" fields are required.' });
  }

  let sess = sessions.get(branchId);
  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    // Fallback to default session if specified branch is offline
    sess = sessions.get('default');
  }

  if (!sess || sess.status !== 'CONNECTED' || !sess.sock) {
    const err = 'No active WhatsApp session connected for this branch or default lab.';
    addLog(branchId, branchName, phone, 'FAILED', message, err);
    return res.status(503).json({ ok: false, error: err });
  }

  try {
    let digits = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }

    const jid = `${digits}@s.whatsapp.net`;
    const [waCheck] = await sess.sock.onWhatsApp(jid);
    const targetJid = waCheck?.exists ? waCheck.jid : jid;

    await sess.sock.sendMessage(targetJid, { text: message });

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
});
