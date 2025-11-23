export type AiResponse = { text: string };

const HF_API = "https://api-inference.huggingface.co/models";

export async function generateWithHuggingFace(model: string, prompt: string, apiKey: string): Promise<AiResponse> {
  const url = `${HF_API}/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HuggingFace error: ${res.status} ${body}`);
  }

  const json = await res.json();
  // HF inference returns different shapes depending on model; try to handle common cases
  if (typeof json === "string") {
    return { text: json };
  }

  if (Array.isArray(json)) {
    // many text-generation models return [{generated_text: "..."}]
    const first = json[0] as { generated_text?: string } | undefined;
    if (first && typeof first.generated_text === "string") {
      return { text: first.generated_text };
    }
    // sometimes it's tokens array or other formats; fallback to JSON stringify
    return { text: JSON.stringify(json) };
  }

  if (json.generated_text) {
    return { text: String(json.generated_text) };
  }

  return { text: JSON.stringify(json) };
}

export async function generateMock(prompt: string): Promise<AiResponse> {
  // Very small deterministic mock to keep UI working without keys
  const summary = `Mock reply: recibí tu prompt de ${Math.min(120, prompt.length)} chars.`;
  return { text: summary };
}
