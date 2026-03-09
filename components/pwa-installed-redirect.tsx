"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaInstalledRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isStandaloneMode()) {
      router.replace("/");
    }
  }, [router]);

  return null;
}
