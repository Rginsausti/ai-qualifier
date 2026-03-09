import { NextResponse } from "next/server";
import { getApkMetadata, isApkDownloadReady } from "@/lib/apk/config";

export async function GET() {
  const metadata = getApkMetadata();
  const available = isApkDownloadReady(metadata);

  return NextResponse.json(
    {
      available,
      version: metadata.version,
      size_mb: metadata.sizeMb,
      min_android: metadata.minAndroid,
      sha256: metadata.sha256,
      updated_at: metadata.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
