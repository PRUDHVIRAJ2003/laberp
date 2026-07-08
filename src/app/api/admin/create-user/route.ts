import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, full_name, role, branch_id } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: "Email, Password, and Full Name are required." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key is not configured in environment." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    const cleanBranchId = role === "super_admin" || !branch_id || branch_id === "" ? null : branch_id;

    // 1. Create user in Supabase Auth with email_confirm = true so login works immediately
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: role || "admin",
        branch_id: cleanBranchId,
      },
    });

    if (createError) {
      let msg =
        createError.message ||
        (createError as any).msg ||
        (createError as any).error_description ||
        JSON.stringify(createError);
      if (
        msg === "{}" ||
        msg.includes("{}") ||
        msg.toLowerCase().includes("database error creating new user") ||
        createError.status === 500
      ) {
        msg =
          "Supabase Database trigger error when creating user. Please execute migration_v6_fix_user_creation.sql in your Supabase SQL Editor to update the user trigger and roles constraint.";
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = newUser.user.id;

    // 2. Explicitly upsert profile record so user immediately appears in Users list
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name,
        role: role || "admin",
        branch_id: cleanBranchId,
      });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error("Create User Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
