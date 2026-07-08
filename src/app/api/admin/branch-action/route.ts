import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, branchId, name, code, address, contact_phone, contact_email, is_active } = body;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key is not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    if (action === "create") {
      if (!name || !code) {
        return NextResponse.json({ error: "Branch Name and Unique Code are required." }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("lab_branches")
        .insert([
          {
            name: name.trim(),
            code: code.toUpperCase().trim(),
            address: address ? address.trim() : null,
            contact_phone: contact_phone ? contact_phone.trim() : null,
            contact_email: contact_email ? contact_email.trim() : null,
            is_active: is_active !== undefined ? is_active : true,
          },
        ])
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, branch: data });
    } else if (action === "update") {
      if (!branchId) {
        return NextResponse.json({ error: "Branch ID is required for update." }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("lab_branches")
        .update({
          name: name ? name.trim() : undefined,
          code: code ? code.toUpperCase().trim() : undefined,
          address: address !== undefined ? address : undefined,
          contact_phone: contact_phone !== undefined ? contact_phone : undefined,
          contact_email: contact_email !== undefined ? contact_email : undefined,
          is_active: is_active !== undefined ? is_active : undefined,
        })
        .eq("id", branchId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, branch: data });
    } else if (action === "delete") {
      if (!branchId) {
        return NextResponse.json({ error: "Branch ID is required for deletion." }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from("lab_branches").delete().eq("id", branchId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, message: "Branch deleted successfully." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Branch Action Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
