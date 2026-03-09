import { NextRequest, NextResponse } from "next/server";
import { getApkMetadata, isApkDownloadReady } from "@/lib/apk/config";
import { tryUpstashLimit } from "@/lib/upstash/ratelimit";

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") || null;
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || null;

  const rateLimitResult = await tryUpstashLimit(`apk_download:${ip ?? "unknown"}`);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const metadata = getApkMetadata();
  if (!isApkDownloadReady(metadata)) {
    return NextResponse.json(
      { error: "APK download is not configured yet" },
      { status: 503 }
    );
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(metadata.downloadUrl);
  } catch {
    return NextResponse.json({ error: "Invalid APK download URL" }, { status: 500 });
  }

  const source = request.nextUrl.searchParams.get("source");
  if (source) {
    targetUrl.searchParams.set("source", source);
  }

  return NextResponse.redirect(targetUrl.toString(), { status: 302 });
}
