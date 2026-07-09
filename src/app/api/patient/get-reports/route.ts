import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { phone, email, userId, name } = await req.json();

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://htxafjkknkpgimykjifb.supabase.co";
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eGFmamtrbmtwZ2lteWtqaWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1NjEwNCwiZXhwIjoyMDk4OTMyMTA0fQ.-6Iq96WcAFGCFLWt_KymBNME1mgOBaIRLeLaV86uosE";

    const supabase = createClient(supaUrl, supaKey);

    // Fetch all published reports
    const { data: allPublished, error } = await supabase
      .from("reports")
      .select("*, tests(*), test_groups(*), lab_branches(*)")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error || !allPublished) {
      return NextResponse.json({ ok: false, error: error?.message || "Failed to fetch reports", reports: [] });
    }

    const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, "").slice(-10) : "";
    const cleanEmail = email ? String(email).trim().toLowerCase() : "";
    const cleanName = name ? String(name).trim().toLowerCase() : "";

    const matchedReports = allPublished.filter((r) => {
      // 1. Match by patient_id
      if (userId && r.patient_id === userId) return true;

      // 2. Match by phone (last 10 digits)
      const rPhone = r.patient_phone ? String(r.patient_phone).replace(/[^0-9]/g, "").slice(-10) : "";
      if (cleanPhone && cleanPhone.length >= 10 && rPhone === cleanPhone) return true;

      // 3. Match by email
      const rEmail = r.patient_email ? String(r.patient_email).trim().toLowerCase() : "";
      if (cleanEmail && rEmail === cleanEmail) return true;

      // 4. Match by patient name
      const rName = r.patient_name ? String(r.patient_name).trim().toLowerCase() : "";
      if (cleanName && rName === cleanName) return true;

      return false;
    });

    return NextResponse.json({ ok: true, reports: matchedReports });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, reports: [] }, { status: 500 });
  }
}
