import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimitClient: Ratelimit | null = null;

export function hasUpstashConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getUpstashRatelimit() {
  if (!hasUpstashConfig()) return null;
  if (ratelimitClient) return ratelimitClient;

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL as string,
    token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
  });

  // sliding window: X requests per 1 minute
  const perMinute = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || "60");

  ratelimitClient = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(perMinute, "1 m"),
  });

  return ratelimitClient;
}

export async function tryUpstashLimit(key: string) {
  const rl = getUpstashRatelimit();
  if (!rl) return { success: true };
  const res = await rl.limit(key);
  return res; // { success, limit, remaining, reset }
}
