import { NextResponse } from "next/server";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "AlmaApp/1.0 (contact@alma.care)";

type GeocodePayload = {
  query?: string;
  locale?: string;
};

type NominatimSearchResult = {
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

const buildShortLabel = (result: NominatimSearchResult) => {
  const address = result.address ?? {};
  const street = [address.road ?? address.pedestrian, address.house_number].filter(Boolean).join(" ").trim();
  const locality = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.suburb ?? address.neighbourhood;
  const region = address.state ?? address.county ?? address.country;
  const summary = [street || locality, locality && locality !== street ? locality : null, region].filter(Boolean) as string[];
  const uniqueParts = summary.filter((value, index, arr) => value && arr.indexOf(value) === index);
  return uniqueParts.join(", ") || result.display_name || null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeocodePayload;
    if (!body.query || body.query.trim().length < 4) {
      return NextResponse.json({ error: "Query too short" }, { status: 400 });
    }

    const params = new URLSearchParams({
      format: "jsonv2",
      q: body.query.trim(),
      limit: "1",
      addressdetails: "1",
      "accept-language": body.locale ?? "es",
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Geocode failed" }, { status: response.status });
    }

    const results = (await response.json()) as NominatimSearchResult[];
    const first = results[0];

    if (!first || !first.lat || !first.lon) {
      return NextResponse.json({ error: "No match" }, { status: 404 });
    }

    return NextResponse.json({
      lat: Number(first.lat),
      lon: Number(first.lon),
      displayName: first.display_name ?? null,
      shortLabel: buildShortLabel(first),
    });
  } catch (error) {
    console.error("/api/location/geocode", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
