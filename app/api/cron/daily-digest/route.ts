import { createClient } from "@supabase/supabase-js";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

// This route is meant to be called by a Cron Job (e.g. Vercel Cron)
// It iterates over users and generates a daily plan for them.

export const maxDuration = 60; // Allow longer timeout for batch processing

export async function GET(req: Request) {
  // 1. Security Check (Basic Bearer token or Vercel Cron header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return new Response("Unauthorized", { status: 401 });
    // For development/demo, we might skip this or use a simple secret
  }

  // 2. Initialize Supabase Admin Client (to fetch all users)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. Fetch Users with Profiles
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("*");

  if (error || !profiles) {
    return new Response("Error fetching profiles", { status: 500 });
  }

  const results = [];

  // 4. Generate Plan for each user
  for (const profile of profiles) {
    try {
      // Skip if plan already exists for today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("date", today)
        .single();

      if (existing) {
        results.push({ userId: profile.user_id, status: "skipped_already_exists" });
        continue;
      }

      // "Knowledge Base" Prompt
      const systemPrompt = `
        You are Alma, an AI Nutrition Coach.
        Generate a practical DAILY PLAN for the user based on their profile.
        
        USER PROFILE:
        ${JSON.stringify(profile, null, 2)}
        
        OUTPUT FORMAT:
        Return ONLY a valid JSON object with this structure:
        {
          "morning": { "title": "...", "detail": "..." },
          "lunch": { "title": "...", "detail": "..." },
          "dinner": { "title": "...", "detail": "..." },
          "tip": "A short, practical daily tip."
        }
        
        Keep it short, actionable, and culturally relevant to their locale (${profile.locale}).
      `;

      const { text } = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        system: systemPrompt,
        prompt: "Generate today's plan.",
      });

      // Parse JSON (simple attempt)
      const jsonContent = JSON.parse(text.replace(/```json|```/g, "").trim());

      // Save to DB
      await supabase.from("daily_plans").insert({
        user_id: profile.user_id,
        date: today,
        content: jsonContent,
      });

      results.push({ userId: profile.user_id, status: "generated" });

    } catch (err) {
      console.error(`Error generating for user ${profile.user_id}:`, err);
      results.push({ userId: profile.user_id, status: "error", error: String(err) });
    }
  }

  return Response.json({ success: true, results });
}
