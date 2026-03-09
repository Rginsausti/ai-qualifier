"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __almaDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaInstallAssistant() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<"idle" | "installed" | "dismissed" | "manual">("idle");
  const [manualReason, setManualReason] = useState<string | null>(null);

  const platform = useMemo(() => {
    if (typeof window === "undefined") {
      return { isIos: false, isStandalone: false };
    }

    return {
      isIos: isIosUserAgent(window.navigator.userAgent),
      isStandalone: isInStandaloneMode(),
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      window.__almaDeferredInstallPrompt = event as BeforeInstallPromptEvent;
    };

    const readyHandler = () => {
      setDeferredPrompt(window.__almaDeferredInstallPrompt ?? null);
    };

    const installedHandler = () => {
      setStatus("installed");
      setDeferredPrompt(null);
      window.__almaDeferredInstallPrompt = null;
    };

    setDeferredPrompt(window.__almaDeferredInstallPrompt ?? null);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("alma-install-prompt-ready", readyHandler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("alma-install-prompt-ready", readyHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;
      const hasServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isAndroid = /Android/i.test(ua);

      if (!isSecure) {
        setManualReason(
          t(
            "installApp.assistant.reasonInsecure",
            "This page is not running in a secure context (HTTPS), so installation is blocked."
          )
        );
      } else if (!hasServiceWorker) {
        setManualReason(
          t(
            "installApp.assistant.reasonNoSw",
            "Your browser does not support Service Worker, so installation is not available."
          )
        );
      } else if (isAndroid) {
        setManualReason(
          t(
            "installApp.assistant.reasonNoPromptAndroid",
            "Chrome still has no install prompt available for this session. Open menu (⋮) and tap Install app."
          )
        );
      } else {
        setManualReason(
          t(
            "installApp.assistant.reasonNoPromptGeneric",
            "Automatic install prompt is not available on this browser right now."
          )
        );
      }

      setStatus("manual");
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setStatus(choice.outcome === "accepted" ? "installed" : "dismissed");
    setManualReason(null);
    setDeferredPrompt(null);
  };

  if (platform.isStandalone) {
    return (
      <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
        {t("installApp.assistant.installed", "You already have Agente Alma installed as a web app.")}
      </p>
    );
  }

  if (!platform.isIos) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleInstall}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          <Download className="h-4 w-4" />
          {t("installApp.assistant.installButton", "Install app on this device")}
        </button>
        {status === "dismissed" && (
          <p className="text-sm text-slate-600">
            {t(
              "installApp.assistant.dismissed",
              "No problem. You can install it later from your browser menu."
            )}
          </p>
        )}
        {status === "manual" && (
          <p className="text-sm text-slate-600">
            {t(
              "installApp.assistant.manual",
              "We could not open the automatic installer. Open your browser menu and choose Install app or Add to home screen."
            )}
          </p>
        )}
        {status === "manual" && manualReason && <p className="text-xs text-slate-500">{manualReason}</p>}
      </div>
    );
  }

  if (platform.isIos) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">
          {t("installApp.assistant.iosTitle", "On iPhone (Safari):")}
        </p>
        <ol className="mt-2 space-y-2">
          <li className="flex items-start gap-2">
            <Share2 className="mt-0.5 h-4 w-4" />
            {t("installApp.assistant.iosStepShare", "1) Tap Share in Safari.")}
          </li>
          <li className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4" />
            {t("installApp.assistant.iosStepAdd", "2) Choose Add to Home Screen.")}
          </li>
          <li className="flex items-start gap-2">
            <Download className="mt-0.5 h-4 w-4" />
            {t("installApp.assistant.iosStepOpen", "3) Open the app from your home screen.")}
          </li>
        </ol>
      </div>
    );
  }

  return (
    <p className="text-sm text-slate-600">
      {t(
        "installApp.assistant.fallbackHint",
        "If the install button does not appear, open your browser menu and select Install app or Add to home screen."
      )}
    </p>
  );
}
