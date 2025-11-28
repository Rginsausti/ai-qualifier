import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server-client";

const channelsSchema = z.object({
  water: z.boolean().optional(),
  meals: z.boolean().optional(),
  dayEnd: z.boolean().optional(),
  nearbySearch: z.boolean().optional(),
});

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  channels: channelsSchema.optional(),
  locale: z.string().min(2).max(8).optional(),
});

const deleteSchema = z.object({
  endpoint: z.string().url().or(z.string().min(10)),
});

const DEFAULT_CHANNELS = {
  water: true,
  meals: true,
  dayEnd: true,
  nearbySearch: true,
};

export async function POST(request: Request) {
  const parsed = subscribeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload inválido", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAuth = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Necesitas iniciar sesión" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const channels = { ...DEFAULT_CHANNELS, ...parsed.data.channels };

  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.subscription.endpoint,
        subscription_json: parsed.data.subscription,
        p256dh: parsed.data.subscription.keys.p256dh,
        auth: parsed.data.subscription.keys.auth,
        locale: parsed.data.locale ?? null,
        channels,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (upsertError) {
    console.error("push-subscribe: upsert error", upsertError);
    return NextResponse.json({ message: "No pudimos guardar la suscripción" }, { status: 500 });
  }

  await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, locale: parsed.data.locale ?? null }, { onConflict: "user_id" });

  return NextResponse.json({ status: "subscribed" }, { status: 201 });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 });
  }

  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesión" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("push-subscribe: delete error", error);
    return NextResponse.json({ message: "No pudimos eliminar la suscripción" }, { status: 500 });
  }

  return NextResponse.json({ status: "unsubscribed" });
}
