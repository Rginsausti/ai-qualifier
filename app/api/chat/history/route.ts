import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

const localeTimezoneMap: Record<string, string> = {
  "es-ar": "America/Argentina/Buenos_Aires",
  es: "Europe/Madrid",
  "pt-br": "America/Sao_Paulo",
  pt: "America/Sao_Paulo",
  "en-us": "America/New_York",
  en: "America/Los_Angeles",
  "fr-fr": "Europe/Paris",
  fr: "Europe/Paris",
  "it-it": "Europe/Rome",
  it: "Europe/Rome",
  "de-de": "Europe/Berlin",
  de: "Europe/Berlin",
  "ja-jp": "Asia/Tokyo",
  ja: "Asia/Tokyo",
};

type ChatRole = "user" | "assistant";

const resolveTimezone = (locale?: string | null) => {
  if (!locale) return "UTC";
  const normalized = locale.toLowerCase();
  const base = normalized.split("-")[0];
  return localeTimezoneMap[normalized] || localeTimezoneMap[base] || "UTC";
};

const getTodayRangeIso = (timezone: string) => {
  try {
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);
    const zonedStart = startOfDay(zonedNow);
    const zonedEnd = addDays(zonedStart, 1);
    return {
      startIso: fromZonedTime(zonedStart, timezone).toISOString(),
      endIso: fromZonedTime(zonedEnd, timezone).toISOString(),
    };
  } catch {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }
};

const normalizeIntent = (intent?: string | null) => {
  if (!intent) return "nutrition";
  const cleaned = intent.trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : "nutrition";
};

const sanitizeRole = (value: unknown): ChatRole | null => {
  if (value === "user" || value === "assistant") return value;
  return null;
};

const sanitizeContent = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 5000);
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ messages: [] }, { status: 200 });
  }

  const intent = normalizeIntent(request.nextUrl.searchParams.get("intent"));
  const locale = request.nextUrl.searchParams.get("locale");
  const timezone = resolveTimezone(locale);
  const { startIso, endIso } = getTodayRangeIso(timezone);

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,role,content,hidden,created_at")
    .eq("user_id", user.id)
    .eq("intent", intent)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const intent = normalizeIntent(typeof payload.intent === "string" ? payload.intent : undefined);
  const rawMessages: unknown[] = Array.isArray(payload.messages) ? payload.messages : [];

  const rows = rawMessages
    .map((item: unknown) => {
      const record = (item && typeof item === "object") ? (item as Record<string, unknown>) : null;
      const role = sanitizeRole(record?.role);
      const content = sanitizeContent(record?.content);
      if (!role || !content) return null;
      return {
        user_id: user.id,
        intent,
        role,
        content,
        hidden: Boolean(record?.hidden),
      };
    })
    .filter((row: { user_id: string; intent: string; role: ChatRole; content: string; hidden: boolean } | null): row is { user_id: string; intent: string; role: ChatRole; content: string; hidden: boolean } => Boolean(row));

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "No valid messages to persist" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(rows)
    .select("id")
    .limit(rows.length);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: data?.length || 0 });
}
