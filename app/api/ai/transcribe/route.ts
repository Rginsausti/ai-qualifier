import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    // Prepare form data for Groq
    const groqFormData = new FormData();
    groqFormData.append("file", file, "recording.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("language", "es"); // Force Spanish for better accuracy
    groqFormData.append("response_format", "verbose_json"); // Get more details
    groqFormData.append("temperature", "0"); // More deterministic transcription

    console.log("Transcribing audio with Groq Whisper...");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq API Error:", error);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const data = await response.json();
    console.log("Transcription successful:", data.text);

    return NextResponse.json({ text: data.text });

  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
