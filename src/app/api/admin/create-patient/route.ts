import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendRegistrationNotifications } from "@/utils/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { first_name, last_name, gender, age, height, weight, place, email, phone_number, address } = body;

    if (!first_name || !last_name || !phone_number || !email) {
      return NextResponse.json({ error: "Name, Surname, Mobile, and Email are required." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key is not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    // Create user in Supabase Auth (auto-triggers profile creation via DB trigger)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      phone: phone_number.startsWith("+") ? phone_number : `+${phone_number.replace(/[^0-9]/g, "")}`,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`,
        gender,
        age: age ? parseInt(age, 10) : null,
        height: height || null,
        weight: weight || null,
        place: place || null,
        address: address || null,
        phone_number,
        email,
        role: "patient",
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = newUser.user.id;

    // Explicitly update profiles table to ensure all fields are saved completely
    await supabaseAdmin
      .from("profiles")
      .update({
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`,
        gender,
        age: age ? parseInt(age, 10) : null,
        height: height || null,
        weight: weight || null,
        place: place || null,
        address: address || null,
        phone_number,
        email,
        guardian_name: body.guardian_name || null,
        guardian_phone: body.guardian_phone || null,
        role: "patient",
      })
      .eq("id", userId);

    // Automatically send WhatsApp message and Email to user's contact!
    await sendRegistrationNotifications({
      name: `${first_name} ${last_name}`,
      phone: phone_number,
      email: email,
    });

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error("Create Patient Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
