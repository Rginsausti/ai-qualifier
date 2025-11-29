import { NextResponse } from "next/server";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "AlmaApp/1.0 (contact@alma.care)";

type ReversePayload = {
  lat?: number;
  lon?: number;
  locale?: string;
};

type NominatimReverseResponse = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    county?: string;
    country?: string;
  };
};

const buildShortLabel = (data: NominatimReverseResponse) => {
  const address = data.address ?? {};
  const line = [address.road ?? address.pedestrian, address.house_number].filter(Boolean).join(" ").trim();
  const locality = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.suburb ?? address.neighbourhood;
  const region = address.state ?? address.county ?? address.country;
  const parts = [line || locality, locality && locality !== line ? locality : null, region].filter(Boolean) as string[];
  const uniqueParts = parts.filter((value, index, arr) => value && arr.indexOf(value) === index);
  return uniqueParts.join(", ") || data.display_name || null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReversePayload;
    if (typeof body.lat !== "number" || typeof body.lon !== "number") {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: body.lat.toString(),
      lon: body.lon.toString(),
      zoom: "18",
      "accept-language": body.locale ?? "es",
      addressdetails: "1",
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Reverse geocode failed" }, { status: response.status });
    }

    const payload = (await response.json()) as NominatimReverseResponse;
    const shortLabel = buildShortLabel(payload);

    return NextResponse.json({
      displayName: payload.display_name ?? null,
      shortLabel,
      lat: payload.lat ? Number(payload.lat) : body.lat,
      lon: payload.lon ? Number(payload.lon) : body.lon,
    });
  } catch (error) {
    console.error("/api/location/reverse", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
