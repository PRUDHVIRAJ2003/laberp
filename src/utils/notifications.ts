import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendRegistrationNotifications({
  name,
  phone,
  email,
  portalUrl = "http://localhost:3000/patient",
}: {
  name: string;
  phone?: string;
  email?: string;
  portalUrl?: string;
}) {
  const results = { whatsapp: false, email: false };

  // 1. Send WhatsApp Notification via Local Baileys Gateway (Port 3005)
  if (phone) {
    try {
      const baseUrl = process.env.BAILEYS_SERVICE_URL || process.env.WHATSAPP_SERVER_URL || "https://laberp.onrender.com";
      const message = `🎉 *Welcome to LAB ERP, ${name}!*\n\nYour clinical patient registration is complete. You can now access your diagnostic test reports, lab results, and medical history anytime via our secure Patient Portal:\n🌐 ${portalUrl}\n\nIf you have any questions, please contact your nearest lab branch. Stay healthy!`;

      const res = await fetch(`${baseUrl}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        results.whatsapp = true;
      } else {
        console.warn("WhatsApp notification error:", data.error);
      }
    } catch (err: any) {
      console.warn("Failed to send WhatsApp registration message:", err.message);
    }
  }

  // 2. Send Welcome Email via Resend (or Console Log Fallback)
  if (email) {
    try {
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "LAB ERP <reports@prudhvirajchalapaka.in>",
          to: email,
          subject: "Welcome to LAB ERP — Your Patient Portal Access",
          html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #FAFAFE;">
              <div style="background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); padding: 24px; border-radius: 12px; color: white; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Welcome to LAB ERP</h1>
                <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Diagnostic Reports & Healthcare Management</p>
              </div>
              <div style="padding: 24px 8px; color: #0F172A; line-height: 1.6;">
                <h2 style="font-size: 18px; margin-top: 0;">Hello ${name},</h2>
                <p>Your patient registration has been successfully created in our database. Every clinical detail is stored securely.</p>
                <p>You can view all your lab test reports, download PDF certificates, and track your health history online anytime:</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${portalUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Access Patient Portal</a>
                </div>
                <p style="font-size: 14px; color: #64748B;">If the button above does not work, copy and paste this link into your browser: <br/>${portalUrl}</p>
              </div>
              <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 12px; color: #94A3B8; text-align: center;">
                &copy; ${new Date().getFullYear()} LAB ERP Enterprise Diagnostics Suite. All rights reserved.
              </div>
            </div>
          `,
        });
        results.email = true;
      } else {
        console.log(`[SIMULATED EMAIL TO ${email}]: Welcome to LAB ERP, ${name}! Portal: ${portalUrl}`);
        results.email = true;
      }
    } catch (err: any) {
      console.warn("Failed to send Welcome Email:", err.message);
    }
  }

  return results;
}
