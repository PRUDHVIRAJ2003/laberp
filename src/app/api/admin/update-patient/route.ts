import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, first_name, last_name, gender, age, height, weight, place, email, phone_number, address } = body;

    if (!id || !first_name || !last_name) {
      return NextResponse.json({ error: "Patient ID, First Name, and Last Name are required." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key is not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    // Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        gender: gender || null,
        age: age ? parseInt(age, 10) : null,
        height: height || null,
        weight: weight || null,
        place: place || null,
        address: address || null,
        phone_number: phone_number || null,
        email: email || null,
        guardian_name: body.guardian_name || null,
        guardian_phone: body.guardian_phone || null,
      })
      .eq("id", id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // Also update Supabase Auth user email/phone if changed
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        email: email || undefined,
        phone: phone_number ? (phone_number.startsWith("+") ? phone_number : `+${phone_number.replace(/[^0-9]/g, "")}`) : undefined,
        user_metadata: {
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`.trim(),
          gender,
          age: age ? parseInt(age, 10) : null,
          height,
          weight,
          place,
          address,
          phone_number,
          email,
          role: "patient",
        },
      });
    } catch (authErr) {
      console.warn("Could not sync Auth user details:", authErr);
    }

    return NextResponse.json({ success: true, message: "Patient profile updated successfully." });
  } catch (error: any) {
    console.error("Update Patient Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
