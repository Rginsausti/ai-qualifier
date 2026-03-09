"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).catch((error) => {
      console.warn("PWA service worker registration failed", error);
    });
  }, []);

  return null;
}
