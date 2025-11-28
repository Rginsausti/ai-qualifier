import { NextResponse } from "next/server";
import { z } from "zod";
import webpush, { type PushSubscription } from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONTACT_EMAIL = process.env.PUSH_NOTIFICATIONS_CONTACT || "mailto:alerts@eatapp.local";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const WEB_PUSH_READY = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (WEB_PUSH_READY) {
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

const requestSchema = z.object({
  type: z.enum(["water", "meal", "day_end", "nearby_search"]),
  mealLabel: z.string().optional(),
  mealTimeISO: z.string().optional(),
  searchSummary: z
    .object({
      query: z.string(),
      results: z.number().int().nonnegative(),
    })
    .optional(),
  searchId: z.string().optional(),
  targetUserIds: z.array(z.string().uuid()).optional(),
});

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tag?: string;
  icon?: string;
  badge?: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  subscription_json: PushSubscription;
  channels: Record<string, unknown>;
  locale?: string | null;
};

const MAX_BATCH = 200;

export async function POST(request: Request) {
  if (!WEB_PUSH_READY) {
    return NextResponse.json({ message: "Faltan llaves VAPID" }, { status: 503 });
  }

  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Payload inválido", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();

  switch (parsed.data.type) {
    case "water":
      return handleWaterCron(supabase);
    case "meal":
      return handleMealCron(supabase, parsed.data);
    case "day_end":
      return handleDayEndCron(supabase);
    case "nearby_search":
      return handleNearbyCron(supabase, parsed.data);
    default:
      return NextResponse.json({ message: "Tipo no soportado" }, { status: 400 });
  }
}

async function handleWaterCron(supabase: ReturnType<typeof getSupabaseServiceClient>) {
  const subscriptions = await fetchSubscriptions(supabase, "water");
  if (!subscriptions.length) {
    return NextResponse.json({ sent: 0, reason: "Sin suscripciones" });
  }

  const userIds = subscriptions.map((sub) => sub.user_id);
  const settings = await fetchUserSettings(supabase, userIds, [
    "hydration_enabled",
    "water_interval_minutes",
    "last_water_ping_at",
  ]);
  const now = Date.now();

  const due = subscriptions.filter((sub) => {
    const pref = settings.get(sub.user_id);
    if (pref && pref.hydration_enabled === false) return false;
    const interval = pref?.water_interval_minutes ?? 120;
    const lastPing = pref?.last_water_ping_at ? new Date(pref.last_water_ping_at).getTime() : 0;
    return now - lastPing >= interval * 60 * 1000;
  });

  const payload: NotificationPayload = {
    title: "Momento de agua",
    body: "Tomá un vaso para seguir en equilibrio.",
    data: { url: "/", type: "water" },
    tag: "water-reminder",
  };

  const { sent, removed } = await dispatchBatch(supabase, due, payload, "water");

  if (sent.length) {
    await supabase
      .from("user_settings")
      .update({ last_water_ping_at: new Date().toISOString() })
      .in("user_id", sent.map((row) => row.user_id));
  }

  return NextResponse.json({ type: "water", sent: sent.length, removed });
}

async function handleMealCron(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  params: z.infer<typeof requestSchema>
) {
  const subscriptions = await fetchSubscriptions(supabase, "meals");
  if (!subscriptions.length) {
    return NextResponse.json({ sent: 0, reason: "Sin suscripciones" });
  }

  const label = params.mealLabel || "comida";
  const mealTime = params.mealTimeISO ? new Date(params.mealTimeISO) : new Date();
  const dateKey = mealTime.toISOString().split("T")[0];

  const dedupeKeys = subscriptions.map((sub) => `meal:${sub.user_id}:${label}:${dateKey}`);
  const alreadySent = await fetchExistingDedupeKeys(supabase, "meal", dedupeKeys);

  const due = subscriptions.filter((sub, index) => !alreadySent.has(dedupeKeys[index]));

  const payload: NotificationPayload = {
    title: `Falta 1h para ${label}`,
    body: "Dejá tu preparación lista y registrá lo que vas a comer.",
    data: { url: "/", type: "meal", meal: label },
    tag: `meal-${label}`,
  };

  const { sent, removed } = await dispatchBatch(supabase, due, payload, "meal", (sub) =>
    `meal:${sub.user_id}:${label}:${dateKey}`
  );

  if (sent.length) {
    await supabase
      .from("user_settings")
      .update({ last_meal_ping_at: new Date().toISOString() })
      .in("user_id", sent.map((row) => row.user_id));
  }

  return NextResponse.json({ type: "meal", sent: sent.length, removed });
}

async function handleDayEndCron(supabase: ReturnType<typeof getSupabaseServiceClient>) {
  const subscriptions = await fetchSubscriptions(supabase, "dayEnd");
  if (!subscriptions.length) {
    return NextResponse.json({ sent: 0, reason: "Sin suscripciones" });
  }

  const userIds = subscriptions.map((sub) => sub.user_id);
  const settings = await fetchUserSettings(supabase, userIds, [
    "day_end_enabled",
    "last_day_end_ping_at",
  ]);
  const today = new Date().toISOString().split("T")[0];

  const due = subscriptions.filter((sub) => {
    const pref = settings.get(sub.user_id);
    if (pref && pref.day_end_enabled === false) return false;
    const last = pref?.last_day_end_ping_at;
    if (!last) return true;
    return last.slice(0, 10) !== today;
  });

  const payload: NotificationPayload = {
    title: "Cierre del día",
    body: "Registra tu último check-in antes de descansar.",
    data: { url: "/?panel=streaks", type: "day_end" },
    tag: "day-end",
  };

  const { sent, removed } = await dispatchBatch(supabase, due, payload, "day_end", (sub) =>
    `day_end:${sub.user_id}:${today}`
  );

  if (sent.length) {
    await supabase
      .from("user_settings")
      .update({ last_day_end_ping_at: new Date().toISOString() })
      .in("user_id", sent.map((row) => row.user_id));
  }

  return NextResponse.json({ type: "day_end", sent: sent.length, removed });
}

async function handleNearbyCron(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  params: z.infer<typeof requestSchema>
) {
  const targetIds = params.targetUserIds || [];
  if (!targetIds.length) {
    return NextResponse.json({ message: "targetUserIds requerido" }, { status: 400 });
  }

  const subscriptions = await fetchSubscriptions(supabase, "nearbySearch", targetIds);
  if (!subscriptions.length) {
    return NextResponse.json({ sent: 0, reason: "Sin suscripciones activas" });
  }

  const summary = params.searchSummary ?? { query: "tu búsqueda", results: 0 };
  const payload: NotificationPayload = {
    title: "Tenemos resultados cerca",
    body: `Encontramos ${summary.results} opciones para ${summary.query}.`,
    data: { url: "/", type: "nearby_search", query: summary.query },
    tag: params.searchId ? `nearby-${params.searchId}` : "nearby-search",
  };

  const dedupeBase = params.searchId || `${summary.query}:${new Date().toISOString()}`;

  const { sent, removed } = await dispatchBatch(supabase, subscriptions, payload, "nearby_search", (sub) =>
    `nearby:${sub.user_id}:${dedupeBase}`
  );

  if (sent.length) {
    await supabase
      .from("user_settings")
      .update({ last_nearby_alert_at: new Date().toISOString() })
      .in("user_id", sent.map((row) => row.user_id));
  }

  return NextResponse.json({ type: "nearby_search", sent: sent.length, removed });
}

async function fetchSubscriptions(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  channel: "water" | "meals" | "dayEnd" | "nearbySearch",
  userIds?: string[]
) {
  let query = supabase
    .from("push_subscriptions")
    .select("id, user_id, subscription_json, channels, locale")
    .filter(`channels->>${channel}`, "eq", "true")
    .limit(MAX_BATCH);

  if (userIds && userIds.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`fetchSubscriptions:${channel}`, error);
    return [] as SubscriptionRow[];
  }

  return (data || []) as SubscriptionRow[];
}

type UserSettingsRow = Record<string, unknown> & { user_id: string };

async function fetchUserSettings(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  userIds: string[],
  columns: string[]
) {
  if (!userIds.length) return new Map<string, UserSettingsRow>();
  const uniqueIds = Array.from(new Set(userIds));
  const { data, error } = await supabase
    .from("user_settings")
    .select(["user_id", ...columns].join(","))
    .in("user_id", uniqueIds);

  if (error) {
    console.error("fetchUserSettings", error);
    return new Map();
  }

  if (!Array.isArray(data)) {
    return new Map();
  }

  const rows = data.map((row) => row as unknown as UserSettingsRow);
  return new Map(rows.map((row) => [row.user_id, row]));
}

async function fetchExistingDedupeKeys(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  type: string,
  keys: string[]
) {
  if (!keys.length) return new Set<string>();

  const { data, error } = await supabase
    .from("notification_events")
    .select("dedupe_key")
    .eq("type", type)
    .in("dedupe_key", Array.from(new Set(keys)));

  if (error) {
    console.error("fetchExistingDedupeKeys", error);
    return new Set();
  }

  return new Set((data || []).map((row) => row.dedupe_key));
}

async function dispatchBatch(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  subscriptions: SubscriptionRow[],
  payload: NotificationPayload,
  type: string,
  dedupeKeyFactory?: (row: SubscriptionRow) => string
) {
  const sent: SubscriptionRow[] = [];
  const removed: string[] = [];

  for (const subscription of subscriptions) {
    const dedupeKey = dedupeKeyFactory ? dedupeKeyFactory(subscription) : `${type}:${subscription.user_id}`;
    try {
      await webpush.sendNotification(subscription.subscription_json, JSON.stringify(payload));
      sent.push(subscription);
      await logEvent(supabase, {
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        type,
        status: "sent",
        payload,
        dedupe_key: dedupeKey,
      });
    } catch (error) {
      console.error("dispatchBatch:push", error);
      await logEvent(supabase, {
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        type,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        payload,
        dedupe_key: dedupeKey,
      });

      if (isSubscriptionGone(error)) {
        removed.push(subscription.id);
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }

  return { sent, removed };
}

async function logEvent(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  event: {
    user_id: string;
    subscription_id: string;
    type: string;
    status: string;
    payload: NotificationPayload;
    dedupe_key?: string;
    error?: string;
  }
) {
  const { error } = await supabase.from("notification_events").insert({ ...event });
  if (error) {
    console.error("logEvent", error);
  }
}

function isSubscriptionGone(error: unknown) {
  if (typeof error !== "object" || !error) return false;
  return "statusCode" in error && (error as { statusCode: number }).statusCode === 410;
}
