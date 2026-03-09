export type ApkMetadata = {
  version: string;
  sizeMb: string;
  minAndroid: string;
  sha256: string;
  updatedAt: string;
  downloadUrl: string;
};

const DEFAULTS: ApkMetadata = {
  version: "0.1.0",
  sizeMb: "38",
  minAndroid: "8.0",
  sha256: "pending",
  updatedAt: "pending",
  downloadUrl: "",
};

export function getApkMetadata(): ApkMetadata {
  return {
    version: process.env.APK_VERSION || DEFAULTS.version,
    sizeMb: process.env.APK_SIZE_MB || DEFAULTS.sizeMb,
    minAndroid: process.env.APK_MIN_ANDROID || DEFAULTS.minAndroid,
    sha256: process.env.APK_SHA256 || DEFAULTS.sha256,
    updatedAt: process.env.APK_UPDATED_AT || DEFAULTS.updatedAt,
    downloadUrl: process.env.APK_DOWNLOAD_URL || DEFAULTS.downloadUrl,
  };
}

export function isApkDownloadReady(metadata: ApkMetadata): boolean {
  return Boolean(metadata.downloadUrl && metadata.downloadUrl.trim().length > 0);
}
