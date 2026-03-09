"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __almaDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).catch((error) => {
      console.warn("PWA service worker registration failed", error);
    });

    const beforeInstallPromptHandler = (event: Event) => {
      event.preventDefault();
      window.__almaDeferredInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event("alma-install-prompt-ready"));
    };

    const appInstalledHandler = () => {
      window.__almaDeferredInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", beforeInstallPromptHandler);
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallPromptHandler);
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
  }, []);

  return null;
}
