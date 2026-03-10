import { aggregatePersonalizationSnapshots } from "@/lib/kb/personalization";

export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response("CRON_SECRET is not configured", { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const nutrition = await aggregatePersonalizationSnapshots(14, "nutrition");
    const movement = await aggregatePersonalizationSnapshots(14, "movement");
    return Response.json({ success: true, nutrition, movement });
  } catch (error) {
    console.error("personalization aggregation failed", error);
    return new Response("Aggregation failed", { status: 500 });
  }
}
