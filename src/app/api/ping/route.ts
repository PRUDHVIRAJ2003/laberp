import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      return NextResponse.json({ status: "ok", message: "Pong! (Supabase env not set)" });
    }

    const supabase = createClient(url, key);
    // Lightweight keep-alive query to prevent Supabase 7-day pause
    const { data, error } = await supabase.from("lab_branches").select("id").limit(1);

    return NextResponse.json({
      status: "ok",
      database: error ? "error" : "awake",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ok", error: err.message });
  }
}
