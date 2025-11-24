import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { getUserProfile, getRecentQuickLogs, getDailyStats } from "@/lib/actions";
import { getMarketContext } from "@/lib/market-prices";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, locale, userId } = await req.json();

  // 1. Memory System: Fetch User Profile, Recent Logs & Daily Stats
  // Instead of generic RAG, we inject the specific user context ("Memory")
  const [userProfile, recentLogs, dailyStats] = await Promise.all([
    getUserProfile(userId),
    getRecentQuickLogs(userId),
    getDailyStats(userId)
  ]);

  // 2. Construct System Prompt with Memory
  const userLocale = userProfile?.locale || locale || 'es';
  const marketMemory = getMarketContext(userLocale);

  // Format logs for better LLM readability
  const formattedLogs = recentLogs.map((log: any) =>
    `- [${new Date(log.created_at).toLocaleDateString()}] Energy: ${log.energy}, Hunger: ${log.hunger}/5, Craving: ${log.craving}, Note: "${log.notes}"`
  ).join("\n");

  // Format nutrition stats
  const nutritionSummary = dailyStats ? `
TODAY'S NUTRITION (${new Date().toLocaleDateString()}):
- Calories: ${dailyStats.nutrition.calories} / ${dailyStats.goals.calories} kcal (${Math.round((dailyStats.nutrition.calories / dailyStats.goals.calories) * 100)}%)
- Protein: ${dailyStats.nutrition.protein}g / ${dailyStats.goals.protein}g
- Carbs: ${dailyStats.nutrition.carbs}g / ${dailyStats.goals.carbs}g
- Fats: ${dailyStats.nutrition.fats}g / ${dailyStats.goals.fats}g
- Water: ${dailyStats.water}ml / ${dailyStats.goals.water}ml
  ` : "No nutrition data logged today.";

  const systemPrompt = `
    You are Alma, a practical and direct AI Nutrition Coach.
    
    YOUR GOAL:
    - Provide immediate, actionable advice for healthy eating.
    - Minimize fluff and small talk. Get straight to the point.
    - Your responses must be short and easy to read on a mobile screen.
    
    USER MEMORY (CONTEXT):
    Profile: ${userProfile ? JSON.stringify(userProfile, null, 2) : "No specific profile found."}
    
    ${nutritionSummary}
    
    RECENT CHECK-INS (Last 3):
    ${formattedLogs || "No recent logs."}
    
    ${marketMemory}
    
    INSTRUCTIONS:
    - Reply in the user's language (${userLocale}).
    - Use the User Memory to personalize answers (e.g., respect lactose intolerance).
    - CRITICAL: Check the "TODAY'S NUTRITION" section to see what the user has eaten today. Use this to give accurate advice about remaining calories and macros.
    - CRITICAL: Check the "RECENT CHECK-INS" for any health notes (e.g., "sick", "flu", "stomach pain") or cravings. If the user mentions being sick, prioritize comfort foods suitable for their condition.
    - Use the MARKET MEMORY to give realistic budget advice. NEVER hallucinate prices.
    - Be extremely concise. Use bullet points for options.
    - Avoid long explanations unless explicitly asked.
    - Ask MAX ONE follow-up question, and ONLY if critical to give a recommendation. Otherwise, do not ask anything.
    - If the user asks "what to eat", give 2-3 concrete options immediately based on their profile.
    - Do NOT provide medical diagnoses.
  `;

  // 3. Call Groq (Llama 3)
  if (!process.env.GROQ_API_KEY) {
    return new Response("Missing GROQ_API_KEY", { status: 500 });
  }

  try {
    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error calling Groq:", error);
    return new Response("Error processing request", { status: 500 });
  }
}
