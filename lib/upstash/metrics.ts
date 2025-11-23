const UPSTASH_BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function sendRedisCommand(command: string[]) {
  if (!UPSTASH_BASE_URL || !UPSTASH_TOKEN) {
    console.warn("Upstash env vars missing: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
    return;
  }

  const response = await fetch(UPSTASH_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash command failed: ${text}`);
  }
}

export async function emitCoachSessionMetric(locale?: string | null) {
  try {
    await Promise.all([
      sendRedisCommand(["INCR", "metrics:coach_sessions:total"]),
      sendRedisCommand(["INCR", `metrics:coach_sessions:locale:${locale ?? "unknown"}`]),
    ]);
  } catch (error) {
    console.warn("Redis metrics emit error", error);
  }
}
