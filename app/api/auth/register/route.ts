import { NextResponse } from "next/server";
import { getSupabaseServiceClient, hasSupabaseServiceEnv } from "@/lib/supabase/server-client";

const MIN_PASSWORD_LENGTH = 6;

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = sanitizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password.trim() : "";

    if (!email || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Missing email or password" },
        { status: 400 }
      );
    }

    if (!hasSupabaseServiceEnv()) {
      console.warn("Auth register blocked: missing service credentials");
      return NextResponse.json(
        { message: "Auth service unavailable" },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: body?.metadata ?? {},
    });

    if (error) {
      console.error("Supabase register error", error);
      return NextResponse.json(
        { message: error.message },
        { status: error.status ?? 500 }
      );
    }

    return NextResponse.json({ user: data.user }, { status: 201 });
  } catch (error) {
    console.error("Register endpoint failure", error);
    return NextResponse.json(
      { message: "Unable to create user" },
      { status: 500 }
    );
  }
}
