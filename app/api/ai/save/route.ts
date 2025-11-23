import { NextResponse } from "next/server";
import { hasSupabaseServiceEnv, getSupabaseServiceClient } from "@/lib/supabase/server-client";

export async function POST(request: Request) {
  try {
    if (!hasSupabaseServiceEnv()) {
      return NextResponse.json({ message: "Supabase service credentials missing" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const sessionId = body?.sessionId ?? null;

    if (!text) {
      return NextResponse.json({ message: "Missing text" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("ai_responses")
      .insert({ session_id: sessionId, text })
      .select("id, session_id, text, created_at")
      .single();

    if (error) {
      console.error("AI save error", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: data }, { status: 201 });
  } catch (err) {
    console.error("AI save handler failed", err);
    return NextResponse.json({ message: "Failed to save AI response" }, { status: 500 });
  }
}
