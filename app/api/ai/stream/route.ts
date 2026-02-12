import { NextResponse } from "next/server";
import { generateWithHuggingFace } from "@/lib/ai/client";
import { hasUpstashConfig, tryUpstashLimit } from "@/lib/upstash/ratelimit";

export async function POST(request: Request) {
  // Simple streaming mock: returns Server-Sent Events style chunks.
  try {
    const forwarded = request.headers.get("x-forwarded-for") || null;
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || null;
    if (hasUpstashConfig()) {
      const r = await tryUpstashLimit(`ai_stream:${ip ?? 'unknown'}`);
      if (!r.success) return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt ?? "").toString();
    if (!prompt) return NextResponse.json({ message: "Missing prompt" }, { status: 400 });

    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfKey) {
      // stream mock
      const stream = new ReadableStream({
        start(controller) {
          const text = `Mock streaming reply for: ${prompt.slice(0, 120)}...`;
          let i = 0;
          const interval = setInterval(() => {
            if (i >= text.length) {
              controller.close();
              clearInterval(interval);
              return;
            }
            controller.enqueue(text.slice(i, i + 10));
            i += 10;
          }, 60);
        }
      });

      return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // For HF streaming proper integration you'd need to call a streaming endpoint
    // For now, fall back to synchronous generate
    try {
      const res = await generateWithHuggingFace(body.model ?? (process.env.DEFAULT_AI_MODEL ?? 'gpt2'), prompt, hfKey);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(res.text);
          controller.close();
        }
      });
      return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (err) {
      console.error("HF stream fallback failed", err);
      return NextResponse.json({ message: "AI streaming failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("AI stream handler failed", err);
    return NextResponse.json({ message: "AI streaming failed" }, { status: 500 });
  }
}
