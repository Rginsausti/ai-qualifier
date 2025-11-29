import { NextRequest, NextResponse } from "next/server";
import { findNearbyStores } from "@/lib/scraping/osm-discovery";

const DEFAULT_RADIUS = 1800; // meters
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const radius = Number(body?.radius ?? DEFAULT_RADIUS);
    const limit = clamp(Number(body?.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
    }

    if (!Number.isFinite(radius) || radius < 200 || radius > 5000) {
      return NextResponse.json({ error: "Radius must be between 200 and 5000 meters" }, { status: 400 });
    }

    const stores = await findNearbyStores(lat, lon, radius);
    if (!stores.length) {
      return NextResponse.json({ success: true, spots: [], totalCandidates: 0 });
    }

    const candidates = stores
      .filter((store) => Boolean(store.name))
      .slice(0, 40)
      .map((store) => ({
        id: store.osm_id,
        name: store.name,
        brand: store.brand ?? null,
        type: store.store_type,
        distance_m: store.distance ?? null,
        lat: store.latitude,
        lon: store.longitude,
      }))
      .filter((candidate) => !isClearlyIndulgentBakery(candidate));

    let ranked = await scoreStoresWithGroq(candidates, limit);
    if (!ranked.length) {
      ranked = fallbackScore(candidates, limit);
    }

    return NextResponse.json({
      success: true,
      spots: ranked,
      totalCandidates: stores.length,
    });
  } catch (error) {
    console.error("[API /neighborhood/spots]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function scoreStoresWithGroq(
  candidates: CandidateSpot[],
  limit: number
): Promise<HealthySpot[]> {
  if (!process.env.GROQ_API_KEY) {
    return [];
  }

  try {
    const systemPrompt = `Eres un scout de alimentación saludable. Recibes un JSON con locales cercanos. Debes priorizar los que probablemente ofrezcan opciones nutritivas según su nombre, tipo y marca. DESCARTÁ panaderías tradicionales (solo harinas/azúcares) a menos que su nombre incluya pistas de masa madre, integral, vegano, sin azúcar o harinas alternativas. Asigna un score de 0 a 100 (100 = súper saludable). Devuelve SOLO JSON válido con este formato:
{
  "spots": [
    {
      "id": number,
      "score": number,
      "reason": string,
      "tags": string[] | null
    }
  ]
}
Incluye como máximo ${limit} entradas con score mayor o igual a 55. Ordena por score descendente. Usa tags breves como "orgánico", "vegano", "panadería".`;

    const userPayload = JSON.stringify({ candidates });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    if (!parsed?.spots || !Array.isArray(parsed.spots)) {
      return [];
    }

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const scoredSpots = parsed.spots as unknown[];

    return scoredSpots
      .filter((spot: unknown): spot is GroqScoredSpot =>
        Boolean(
          spot &&
          typeof spot === "object" &&
          typeof (spot as { id?: unknown }).id === "number"
        )
      )
      .map((spot) => {
        const candidate = candidateMap.get(spot.id);
        if (!candidate) return null;
        return {
          id: candidate.id,
          name: candidate.name,
          brand: candidate.brand ?? undefined,
          type: candidate.type,
          score: clamp(Number(spot.score ?? 0), 0, 100),
          reason: typeof spot.reason === "string" ? spot.reason : "",
          tags: Array.isArray(spot.tags)
            ? spot.tags
                .map((tag: unknown) => (typeof tag === "string" ? tag : null))
                .filter(Boolean)
            : [],
          distance_m: candidate.distance_m ?? null,
          lat: candidate.lat,
          lon: candidate.lon,
        } as HealthySpot;
      })
      .filter((spot): spot is HealthySpot => Boolean(spot))
      .slice(0, limit);
  } catch (error) {
    console.error("scoreStoresWithGroq", error);
    return [];
  }
}

function fallbackScore(candidates: CandidateSpot[], limit: number): HealthySpot[] {
  const keywordBoosts: Array<{ regex: RegExp; boost: number; tag: string }> = [
    { regex: /(verde|green|natural|organic|orgánico|organico)/i, boost: 18, tag: "Orgánico" },
    { regex: /(veg|plant|huerta|garden)/i, boost: 15, tag: "Plant-based" },
    { regex: /(integral|whole|grain)/i, boost: 10, tag: "Integral" },
  ];

  const typeBase: Record<string, number> = {
    health_food: 92,
    greengrocer: 86,
    produce: 82,
    cafe: 65,
    deli: 64,
    supermarket: 58,
    convenience: 40,
    restaurant: 55,
    butcher: 45,
    fishmonger: 60,
  };

  return candidates
    .map((candidate) => {
      const bakeryHealthy = hasBakeryHealthHint(candidate);
      let score = candidate.type === "bakery"
        ? bakeryHealthy ? 72 : 38
        : typeBase[candidate.type] ?? 55;
      const tags: string[] = [];
      const name = candidate.name || "";

      if (candidate.type === "bakery" && bakeryHealthy) {
        tags.push("Pan integral");
      }

      keywordBoosts.forEach(({ regex, boost, tag }) => {
        if (regex.test(name)) {
          score += boost;
          tags.push(tag);
        }
      });

      const distancePenalty = candidate.distance_m ? Math.min(candidate.distance_m / 100, 20) : 0;
      score = clamp(score - distancePenalty, 30, 99);

      const reasonParts = [candidate.type.replace(/_/g, " ")];
      if (candidate.type === "bakery" && !bakeryHealthy) {
        reasonParts.push("solo harinas refinadas");
      }
      if (tags.length) {
        reasonParts.push(tags.join(", "));
      }

      return {
        id: candidate.id,
        name: candidate.name,
        brand: candidate.brand ?? undefined,
        type: candidate.type,
        score: Math.round(score),
        reason: reasonParts.join(" · "),
        tags,
        distance_m: candidate.distance_m ?? null,
        lat: candidate.lat,
        lon: candidate.lon,
      } as HealthySpot;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

type CandidateSpot = {
  id: number;
  name: string;
  brand: string | null;
  type: string;
  distance_m: number | null;
  lat: number;
  lon: number;
};

type HealthySpot = {
  id: number;
  name: string;
  brand?: string;
  type: string;
  score: number;
  reason: string;
  tags?: string[];
  distance_m: number | null;
  lat: number;
  lon: number;
};

type GroqScoredSpot = {
  id: number;
  score?: unknown;
  reason?: unknown;
  tags?: unknown;
};

const BAKERY_HEALTH_HINTS = [
  /(masa madre|sourdough)/i,
  /(integral|whole grain|grano entero|multicereal)/i,
  /(sin azucar|sugar free|sin azúcar)/i,
  /(vegano|plant based|vegana)/i,
  /(sin gluten|gluten free|sin tacc)/i,
  /(harina de almendra|harina de coco|harinas alternativas)/i,
];

function hasBakeryHealthHint(candidate: CandidateSpot): boolean {
  const haystack = [candidate.name, candidate.brand]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return false;
  return BAKERY_HEALTH_HINTS.some((regex) => regex.test(haystack));
}

function isClearlyIndulgentBakery(candidate: CandidateSpot): boolean {
  if (candidate.type !== "bakery") return false;
  return !hasBakeryHealthHint(candidate);
}
