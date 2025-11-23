import { NextResponse } from "next/server";
import { generateWithHuggingFace, generateMock } from "@/lib/ai/client";

import { tryUpstashLimit, hasUpstashConfig } from "@/lib/upstash/ratelimit";
// Simple in-memory rate limiter per IP. This is per-process and intended
// as a lightweight protection for demo/staging. For production use a
// centralized store (Redis) and stronger controls.
const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_RATE_PER_MIN = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || "60");

function checkRateLimit(ip: string | null) {
  if (!ip) return true; // unknown IP, allow
  const now = Date.now();
  const windowMs = 60_000;
  const state = RATE_LIMIT_MAP.get(ip);
  if (!state || state.resetAt <= now) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (state.count >= DEFAULT_RATE_PER_MIN) {
    return false;
  }
  state.count += 1;
  return true;
}

type Body = {
  prompt?: string;
  model?: string;
};

export async function POST(request: Request) {
  try {
    // Rate limit by IP: prefer Upstash when configured
    const forwarded = request.headers.get("x-forwarded-for") || null;
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || null;
    if (hasUpstashConfig()) {
      try {
        const res = await tryUpstashLimit(`ai:${ip ?? 'unknown'}`);
        if (!res.success) {
          return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
        }
      } catch (err) {
        console.warn("Upstash rate limit error", err);
        // fallback to allowing request
      }
    } else {
      if (!checkRateLimit(ip)) {
        return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
      }
    }

    const body = await request.json().catch(() => ({})) as Body;
    const prompt = (body.prompt ?? "").toString().trim();
    if (!prompt) {
      return NextResponse.json({ message: "Missing prompt" }, { status: 400 });
    }

    const model = (body.model ?? process.env.DEFAULT_AI_MODEL ?? "gpt2").toString();

    // Prefer Hugging Face if API key present
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (hfKey) {
      try {
        const r = await generateWithHuggingFace(model, prompt, hfKey);
        return NextResponse.json({ text: r.text });
      } catch (err) {
        console.error("HF generation failed", err);
        // fall through to mock if HF errors
      }
    }

    const mock = await generateMock(prompt);
    return NextResponse.json({ text: mock.text, note: "mock" });
  } catch (error) {
    console.error("AI generate handler failed", error);
    return NextResponse.json({ message: "AI generation failed" }, { status: 500 });
  }
}
