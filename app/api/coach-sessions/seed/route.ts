import { NextResponse } from "next/server";
import { getSupabaseServiceClient, hasSupabaseServiceEnv } from "@/lib/supabase/server-client";

export async function POST() {
  // Protect: allow only in non-production to avoid accidental runs in prod
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Seeding disabled in production" }, { status: 403 });
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json({ message: "Supabase service credentials missing" }, { status: 503 });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const now = new Date().toISOString();

    const seed = [
      {
        energy: "alta",
        pantry: "arroz, huevo",
        mood: "contento",
        email: "seed1@example.com",
        locale: "es",
        source: "seed",
        created_at: now,
      },
      {
        energy: "media",
        pantry: "pasta, tomate",
        mood: "tranquilo",
        email: "seed2@example.com",
        locale: "es",
        source: "seed",
        created_at: now,
      },
      {
        energy: "baja",
        pantry: "lentejas",
        mood: "cansado",
        email: "seed3@example.com",
        locale: "es",
        source: "seed",
        created_at: now,
      },
    ];

    const { data, error } = await supabase
      .from("coach_sessions")
      .insert(seed)
      .select("id, energy, pantry, mood, locale, email, created_at");

    if (error) {
      console.error("Seed insert error", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data }, { status: 201 });
  } catch (err) {
    console.error("Seeding failed", err);
    return NextResponse.json({ message: "Seeding failed" }, { status: 500 });
  }
}
