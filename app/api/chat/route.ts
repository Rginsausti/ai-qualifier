import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { getUserProfile, getRecentQuickLogs, getTodayNutritionLogs } from "@/lib/actions";
import { getMarketContext } from "@/lib/market-prices";

type QuickLog = {
  created_at: string;
  energy: string | null;
  hunger: number;
  craving: string | null;
  notes: string | null;
};

type MealLog = {
  created_at: string;
  name: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
};

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, locale, userId } = await req.json();

  // 1. Memory System: Fetch User Profile & Recent Logs
  // Instead of generic RAG, we inject the specific user context ("Memory")
  const [userProfile, recentLogs, todaysMeals] = await Promise.all([
    getUserProfile(userId),
    getRecentQuickLogs(userId),
    getTodayNutritionLogs(userId, locale)
  ]);

  // 2. Construct System Prompt with Memory
  const userLocale = userProfile?.locale || locale || 'es';
  const marketMemory = getMarketContext(userLocale);

  // Format logs for better LLM readability
  const formattedLogs = recentLogs.map((log: QuickLog) => 
    `- [${new Date(log.created_at).toLocaleDateString(userLocale)}] Energy: ${log.energy}, Hunger: ${log.hunger}/5, Craving: ${log.craving}, Note: "${log.notes}"`
  ).join("\n");

  const totals = todaysMeals.reduce((acc: Record<string, number>, meal: MealLog) => ({
    calories: acc.calories + (meal.calories || 0),
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fats: acc.fats + (meal.fats || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const formattedMeals = todaysMeals.map((meal: MealLog) => {
    const time = new Date(meal.created_at).toLocaleTimeString(userLocale, { hour: "2-digit", minute: "2-digit" });
    return `- ${time} · ${meal.name || "Registro"} (${meal.calories || 0} kcal | P${meal.protein || 0}g, C${meal.carbs || 0}g, G${meal.fats || 0}g)`;
  }).join("\n");

  const mealsSection = todaysMeals.length
    ? `${formattedMeals}\nTotal last 24h: ${totals.calories} kcal · P${totals.protein}g · C${totals.carbs}g · F${totals.fats}g`
    : "No meals logged in the last 24 hours.";

  const systemPrompt = `
    You are Alma, a practical and direct AI Nutrition Coach.
    
    YOUR GOAL:
    - Provide immediate, actionable advice for healthy eating.
    - Minimize fluff and small talk. Get straight to the point.
    - Your responses must be short and easy to read on a mobile screen.
    
    USER MEMORY (CONTEXT):
    Profile: ${userProfile ? JSON.stringify(userProfile, null, 2) : "No specific profile found."}
    
    RECENT CHECK-INS (Last 3):
    ${formattedLogs || "No recent logs."}

    TODAY'S INTAKE (last 24h):
    ${mealsSection}
    
    ${marketMemory}
    
    INSTRUCTIONS:
    - Reply in the user's language (${userLocale}).
    - Use the User Memory to personalize answers (e.g., respect lactose intolerance).
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
