import { NextResponse } from "next/server";
import { getSupabaseServiceClient, hasSupabaseServiceEnv } from "@/lib/supabase/server-client";
import { emitCoachSessionMetric } from "@/lib/upstash/metrics";

const SUPPORTED_FIELDS = ["energy", "pantry", "mood"] as const;
const MAX_FIELD_LENGTH = 80;

function sanitizeInput(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, MAX_FIELD_LENGTH);
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseServiceEnv()) {
      console.warn("Coach session POST skipped: missing service credentials");
      return NextResponse.json(
        { message: "Coach session storage unavailable" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const payload = Object.fromEntries(
      SUPPORTED_FIELDS.map((field) => [field, sanitizeInput(body?.[field])])
    ) as Record<(typeof SUPPORTED_FIELDS)[number], string>;

    const email = sanitizeEmail(body?.email);
    const locale = sanitizeInput(body?.locale) || null;

    if (SUPPORTED_FIELDS.some((field) => !payload[field])) {
      return NextResponse.json(
        { message: "Missing required answers" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("coach_sessions")
      .insert({ ...payload, email, locale, source: "demo" })
      .select("id, energy, pantry, mood, locale, email, created_at")
      .single();

    if (error) {
      console.error("Supabase coach session error", error);
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }

    await emitCoachSessionMetric(locale);

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (error) {
    console.error("Coach session POST handler failed", error);
    return NextResponse.json(
      { message: "Unable to capture coach session" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    if (!hasSupabaseServiceEnv()) {
      console.warn("Coach session GET skipped: missing service credentials");
      return NextResponse.json({ sessions: [], message: "Coach sessions disabled" });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 5, 1), 12);

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("coach_sessions")
      .select("id, energy, pantry, mood, locale, email, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase coach sessions fetch error", error);
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch (error) {
    console.error("Coach session GET handler failed", error);
    return NextResponse.json(
      { message: "Unable to load coach sessions" },
      { status: 500 }
    );
  }
}
