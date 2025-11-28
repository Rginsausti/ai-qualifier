export function buildCoachPrompt({ energy, pantry, mood, locale }: { energy: string; pantry: string; mood: string; locale?: string }) {
  // Basic templating — keep concise and localizable later
  return `Usuario con energía: ${energy}; despensa: ${pantry}; estado: ${mood}. Dame una recomendación breve, clara y amable en ${locale ?? 'es'}. Incluye un tip práctico y una opción rápida para preparar.`;
}

type CravingSwapPromptInput = {
  treats: string;
  cravingType: string;
  intensity: string;
  timeOfDay: string;
  profile?: unknown;
  locale?: string;
};

export function buildCravingSwapPrompt({
  treats,
  cravingType,
  intensity,
  timeOfDay,
  profile,
  locale,
}: CravingSwapPromptInput) {
  const language = locale?.toLowerCase() ?? "es";
  const profileSummary = profile ? JSON.stringify(profile, null, 2) : "Perfil no disponible";

  return `
Contexto del usuario:
- Idioma preferido: ${language}
- Perfil nutricional: ${profileSummary}

Escenario actual:
- Antojos declarados: ${treats}
- Tipo de craving dominante: ${cravingType}
- Intensidad: ${intensity}
- Momento del día: ${timeOfDay}

Instrucciones para Alma (nutricionista IA):
1. Respeta alergias, restricciones culturales y objetivos del perfil.
2. Propón 2 o 3 alternativas saludables que imiten textura/sabor del antojo pero con mejor densidad nutricional.
3. Indica por qué cada alternativa ayuda a calmar ese antojo y qué beneficio aporta (macros, saciedad, estabilidad de glucosa, etc.).
4. Incluye un mini plan de preparación o armado muy concreto (<=3 pasos) pensado para ${timeOfDay}.
5. Si el perfil tiene objetivos específicos (ej. reducir inflamación, bajar peso, ganar músculo) conéctalos con las sugerencias.
6. Cierra con un mensaje breve de contención o recordatorio mindful.

Formato de respuesta OBLIGATORIO (JSON válido, sin markdown):
{
  "alternatives": [
    {
      "name": string,
      "description": string,
      "swapReason": string,
      "prep": string
    }
  ],
  "reassurance": string
}

Escribe todo en ${language}.`;
}
