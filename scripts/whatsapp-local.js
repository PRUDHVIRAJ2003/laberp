const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');
const path = require('path');

// ─── CONFIGURATION ──────────────────────────────────────────────────
const PORT = 3005;

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large base64 PDFs

// ─── GLOBAL CLIENT ──────────────────────────────────────────────────
let clientInstance = null;

// =======================================================
// WHATSAPP WEB INITIALIZATION (WPPConnect)
// =======================================================
console.log("=======================================================");
console.log("    LAB ERP Local WhatsApp Server (WPPConnect)");
console.log("=======================================================");
console.log("Starting the headless Chrome browser and WhatsApp engine...");
console.log("Please leave this window open to keep the service running 24/7.\n");

wppconnect
  .create({
    session: 'lab-erp-session', // Name of the session
    puppeteerOptions: {
      userDataDir: path.join(__dirname, '..', '.wpp_auth'), // Save session data here
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
    },
    catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
      console.log('\n==================================================');
      console.log('                 ACTION REQUIRED                  ');
      console.log('==================================================');
      console.log('Scan this QR code in WhatsApp (Linked Devices -> Link a Device):');
      console.log(asciiQR);
      console.log('==================================================\n');
    },
    statusFind: (statusSession, session) => {
      console.log(`⏳ Synchronizing WhatsApp: ${statusSession}`);
    },
    headless: true, // Run in background
  })
  .then((client) => {
    clientInstance = client;
    startServer(client);
  })
  .catch((error) => {
    console.error("❌ Error starting WPPConnect:", error);
  });

function startServer(client) {
  console.log('✅ Authentication successful!\n');
  console.log('✅ LAB ERP WHATSAPP GATEWAY IS FULLY CONNECTED AND READY!');

  // Handle incoming messages for basic chatbot functionality
  client.onMessage((message) => {
    if (!message.isGroupMsg && message.body) {
      console.log(`\n💬 Message from ${message.from}: "${message.body}"`);
      
      const text = message.body.trim().toUpperCase();
      
      if (text === '1' || text === 'REPORT') {
        client.sendText(message.from, '🤖 Hello! I am the LAB ERP Bot.\nI am actively running and ready to deliver your lab reports and invoices.')
          .then(() => console.log('   ✅ Sent auto-reply.'))
          .catch(e => console.error('   ❌ Auto-reply failed:', e.message));
      } else {
        client.sendText(message.from, '🤖 This is an automated number for LAB ERP. Please reply with "1" or "REPORT" to check system status.')
          .catch(e => console.error('   ❌ Auto-reply failed:', e.message));
      }
    }
  });

  // Start the HTTP Server
  app.listen(PORT, () => {
    console.log(`\n🚀 LAB ERP Local WhatsApp Gateway API listening on port ${PORT}...`);
  });
}

// ─── API ROUTES FOR WEB APP COMMUNICATION ───────────────────────────
app.post(['/send-message', '/send', '/send-pdf'], async (req, res) => {
    const { phone, message, pdfBase64, filename, caption } = req.body;

    if (!phone) return res.status(400).json({ ok: false, error: 'Phone field is required.' });
    if (!clientInstance) return res.status(503).json({ ok: false, error: 'WhatsApp client is not ready yet.' });

    try {
        let digits = String(phone).replace(/[^0-9]/g, '').replace(/^0+/, '');
        if (digits.length === 10) digits = '91' + digits;
        if (digits.length === 12 && digits.startsWith('9191')) digits = digits.slice(2);

        console.log(`\n📤 [SEND] Starting send to +${digits}...`);
        
        // WPPConnect standard ID format
        const targetJid = `${digits}@c.us`;

        let sentMsg;
        if (pdfBase64) {
            console.log(`   [PDF] Preparing to send document...`);
            // Prepend the data URL prefix required by WPPConnect if not present
            const base64Data = pdfBase64.startsWith('data:') 
                ? pdfBase64 
                : `data:application/pdf;base64,${pdfBase64}`;
                
            sentMsg = await clientInstance.sendFileFromBase64(
                targetJid, 
                base64Data, 
                filename || 'Verified_Lab_Report.pdf', 
                caption || message || '📑 Here is your official laboratory document.'
            );
        } else {
            console.log(`   [TEXT] Preparing to send message...`);
            sentMsg = await clientInstance.sendText(targetJid, message);
        }

        console.log(`✅ [DELIVERED] Message sent to +${digits} | WPP MsgID: ${sentMsg.id}`);
        
        return res.json({ ok: true, sent: true, to: digits, targetJid, messageId: sentMsg.id });
    } catch (err) {
        console.error(`❌ [ERROR] Send failed to ${phone}:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});
