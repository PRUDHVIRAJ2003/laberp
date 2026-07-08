import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendRegistrationNotifications } from "@/utils/notifications";

// ─── In-Memory OTP Store ─────────────────────────────────────────
const otpStore = new Map<string, { code: string; expiresAt: number; metadata?: any }>();

// ─── Supabase Admin Client ───────────────────────────────────────
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, serviceKey);
};

// ─── Normalize Phone Number ──────────────────────────────────────
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

// ─── Send WhatsApp via Baileys Gateway ───────────────────────────
async function sendWhatsApp(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  // Base URL only — NO trailing path (the endpoint is /send-message)
  const baseUrl = process.env.BAILEYS_SERVICE_URL || process.env.WHATSAPP_SERVER_URL || "https://laberp.onrender.com";

  try {
    const res = await fetch(`${baseUrl}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      return { sent: false, error: data.error || `HTTP ${res.status}` };
    }

    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message || "Failed to reach WhatsApp gateway" };
  }
}

// ─── POST Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phone, otp, metadata } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // ═════════════════════════════════════════════════════════════
    // ACTION: REQUEST OTP
    // ═════════════════════════════════════════════════════════════
    if (action === "request") {

      // For LOGIN (no metadata): verify account exists before sending OTP
      if (!metadata) {
        const supabaseAdmin = getSupabaseAdmin();
        const last10 = normalized.slice(-10);
        const { data: found } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("phone_number", `%${last10}%`);

        if (!found || found.length === 0) {
          return NextResponse.json(
            { error: "No account found with this mobile number. Please switch to the Sign Up tab to create an account first!" },
            { status: 404 }
          );
        }
      }

      // Generate 6-digit OTP
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min
      otpStore.set(normalized, { code: generatedCode, expiresAt, metadata });

      // Attempt WhatsApp delivery
      const whatsappResult = await sendWhatsApp(
        normalized,
        `Your LAB ERP verification code is: *${generatedCode}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`
      );

      // Log delivery status without revealing sensitive OTP code
      console.log("──────────────────────────────────");
      console.log(`📱 OTP generated & dispatched for ${normalized} (******)`);
      console.log(`   WhatsApp: ${whatsappResult.sent ? "✅ Sent" : `❌ ${whatsappResult.error}`}`);
      console.log("──────────────────────────────────");

      return NextResponse.json({
        success: true,
        message: whatsappResult.sent
          ? "OTP sent via WhatsApp!"
          : "OTP generated — check your WhatsApp or server terminal for the code.",
        whatsappSent: whatsappResult.sent,
      });
    }

    // ═════════════════════════════════════════════════════════════
    // ACTION: VERIFY OTP
    // ═════════════════════════════════════════════════════════════
    if (action === "verify") {
      if (!otp) {
        return NextResponse.json({ error: "OTP code is required" }, { status: 400 });
      }

      const stored = otpStore.get(normalized);
      if (!stored || stored.code !== otp) {
        return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 400 });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalized);
        return NextResponse.json({ error: "Verification code expired. Please request a new one." }, { status: 400 });
      }

      // OTP valid — clear it
      otpStore.delete(normalized);

      const supabaseAdmin = getSupabaseAdmin();
      const last10 = normalized.slice(-10);

      // Look up existing user
      const { data: existingUsers } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .ilike("phone_number", `%${last10}%`);

      let userId: string | undefined;

      if (existingUsers && existingUsers.length > 0) {
        // Existing user — return their ID
        userId = existingUsers[0].id;
      } else if (stored.metadata) {
        // New signup — create user in Supabase Auth
        const email = stored.metadata.email || `${normalized}@whatsapp.local`;
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          phone: `+${normalized}`,
          phone_confirm: true,
          email_confirm: true,
          user_metadata: {
            ...stored.metadata,
            role: "patient",
          },
        });

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }
        userId = newUser.user.id;

        // Ensure profiles table is updated with metadata
        await supabaseAdmin
          .from("profiles")
          .update({
            ...stored.metadata,
            role: "patient",
          })
          .eq("id", userId);

        // Send automated welcome notifications
        await sendRegistrationNotifications({
          name: stored.metadata.full_name || `${stored.metadata.first_name || ""} ${stored.metadata.last_name || ""}`.trim() || "Patient",
          phone: `+${normalized}`,
          email: stored.metadata.email,
        });
      } else {
        return NextResponse.json(
          { error: "No account found with this WhatsApp number. Please Sign Up first." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Verification successful!",
        userId,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'request' or 'verify'." }, { status: 400 });
  } catch (error: any) {
    console.error("WhatsApp OTP Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
