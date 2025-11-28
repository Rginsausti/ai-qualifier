import { buildCravingSwapPrompt } from "@/lib/ai/prompts";
import { getUserProfile } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return new Response("Missing GROQ_API_KEY", { status: 500 });
  }

  const { treats, cravingType, intensity, timeOfDay, locale } = await req.json();

  if (!treats || typeof treats !== "string") {
    return new Response("Missing treats", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await getUserProfile(user.id);
  const prompt = buildCravingSwapPrompt({
    treats,
    cravingType: cravingType || "sweet",
    intensity: intensity || "medium",
    timeOfDay: timeOfDay || "afternoon",
    profile,
    locale: locale || profile?.locale,
  });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres Alma, una nutricionista funcional que convierte antojos en swaps saludables manteniendo el tono humano y directo.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("craving-swap error", response.status, errorBody);
    return new Response("AI request failed", { status: 502 });
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;

  if (!content) {
    return new Response("Empty AI response", { status: 502 });
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("Invalid JSON from AI", error, content);
    parsed = {
      alternatives: [
        {
          name: "Idea rápida",
          description: content,
          swapReason: "Respuesta libre",
          prep: "Divide la sugerencia en tres pasos aplicables.",
        },
      ],
      reassurance: "Respirá profundo, el antojo pasa en minutos si comes algo estabilizante.",
    };
  }

  if (!Array.isArray(parsed.alternatives)) {
    parsed.alternatives = [];
  }

  return Response.json({
    alternatives: parsed.alternatives.slice(0, 3),
    reassurance: parsed.reassurance || "Tenés permiso para disfrutar mientras cuidás tu energía.",
  });
}
