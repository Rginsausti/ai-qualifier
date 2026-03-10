import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateLatestRecommendationOutcome } from "@/lib/kb/personalization";

type Outcome = "accepted" | "skipped" | "replaced";

const sanitizeOutcome = (value: unknown): Outcome | null => {
  if (value === "accepted" || value === "skipped" || value === "replaced") return value;
  return null;
};

const sanitizeText = (value: unknown, maxLen: number) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
};

const normalizeIntent = (intent?: string | null) => {
  if (!intent) return "nutrition";
  const cleaned = intent.trim().toLowerCase();
  return cleaned || "nutrition";
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const outcome = sanitizeOutcome(payload.outcome);
  const reason = sanitizeText(payload.reason, 280);
  const intent = normalizeIntent(typeof payload.intent === "string" ? payload.intent : undefined);

  if (!outcome) {
    return NextResponse.json({ success: false, error: "Invalid outcome" }, { status: 400 });
  }

  try {
    await updateLatestRecommendationOutcome({
      userId: user.id,
      intent,
      outcome,
      reason: reason || null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("recommendation-outcome update failed", error);
    return NextResponse.json({ success: false, error: "Failed to save recommendation outcome" }, { status: 500 });
  }
}
