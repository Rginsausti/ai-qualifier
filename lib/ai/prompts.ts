export function buildCoachPrompt({ energy, pantry, mood, locale }: { energy: string; pantry: string; mood: string; locale?: string }) {
  // Basic templating — keep concise and localizable later
  return `Usuario con energía: ${energy}; despensa: ${pantry}; estado: ${mood}. Dame una recomendación breve, clara y amable en ${locale ?? 'es'}. Incluye un tip práctico y una opción rápida para preparar.`;
}
