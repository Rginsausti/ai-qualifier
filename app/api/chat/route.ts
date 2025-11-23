import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { getUserProfile } from "@/lib/actions";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, locale, userId } = await req.json();

  // 1. Memory System: Fetch User Profile
  // Instead of generic RAG, we inject the specific user context ("Memory")
  const userProfile = await getUserProfile(userId);

  // 2. Construct System Prompt with Memory
  const userLocale = userProfile?.locale || locale || 'es';

  const systemPrompt = `
    You are Alma, an expert AI Nutrition Coach.
    
    YOUR PERSONALITY:
    - Empathetic, motivating, and knowledgeable.
    - You speak in a warm, conversational tone.
    - You are "AI-First" but human-centric.
    
    USER MEMORY (CONTEXT):
    ${userProfile ? JSON.stringify(userProfile, null, 2) : "No specific profile found. Ask the user about their goals."}
    
    INSTRUCTIONS:
    - Reply in the user's language (${userLocale}).
    - Use the User Memory above to personalize every answer.
    - Be specific and actionable. Avoid generic advice like "eat healthy". Instead, suggest specific foods based on their preferences/pantry.
    - If the user wants to lose weight and is vegan, NEVER suggest meat or high-calorie generic advice.
    - Ask ONE relevant follow-up question to deepen the conversation.
    - Do NOT provide medical diagnoses. Always suggest consulting a doctor for medical issues.
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
