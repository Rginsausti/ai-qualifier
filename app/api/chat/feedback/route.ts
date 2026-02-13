import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type FeedbackValue = "up" | "down";

const normalizeIntent = (intent?: string | null) => {
  if (!intent) return "nutrition";
  const cleaned = intent.trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : "nutrition";
};

const sanitizeFeedback = (value: unknown): FeedbackValue | null => {
  if (value === "up" || value === "down") return value;
  return null;
};

const sanitizeText = (value: unknown, maxLen: number) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ feedback: {} }, { status: 200 });
  }

  const intent = normalizeIntent(request.nextUrl.searchParams.get("intent"));
  const idsParam = request.nextUrl.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((id) => sanitizeText(id, 128))
    .filter(Boolean)
    .slice(0, 200);

  if (ids.length === 0) {
    return NextResponse.json({ feedback: {} }, { status: 200 });
  }

  const { data, error } = await supabase
    .from("chat_feedback_events")
    .select("client_message_id,feedback")
    .eq("user_id", user.id)
    .eq("intent", intent)
    .in("client_message_id", ids);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const feedbackMap = Object.fromEntries(
    (data || []).map((row) => [row.client_message_id, row.feedback])
  );

  return NextResponse.json({ feedback: feedbackMap });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const intent = normalizeIntent(typeof payload.intent === "string" ? payload.intent : undefined);
  const clientMessageId = sanitizeText(payload.clientMessageId, 128);
  const assistantExcerpt = sanitizeText(payload.assistantExcerpt, 1200);
  const reason = sanitizeText(payload.reason, 280);
  const feedback = sanitizeFeedback(payload.feedback);

  if (!feedback || !clientMessageId || !assistantExcerpt) {
    return NextResponse.json({ success: false, error: "Invalid feedback payload" }, { status: 400 });
  }

  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  const { error } = await supabase
    .from("chat_feedback_events")
    .upsert(
      {
        user_id: user.id,
        intent,
        client_message_id: clientMessageId,
        assistant_excerpt: assistantExcerpt,
        feedback,
        reason: reason || null,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,intent,client_message_id" }
    );

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
