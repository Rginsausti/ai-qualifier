"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone } from "lucide-react";

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<"idle" | "installed" | "dismissed" | "manual">("idle");

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
      setStatus("manual");
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setStatus(choice.outcome === "accepted" ? "installed" : "dismissed");
    setDeferredPrompt(null);
  };

  if (platform.isStandalone) {
    return (
      <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
        Ya tenes Agente Alma instalada como app web.
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
          Instalar app en este dispositivo
        </button>
        {status === "dismissed" && (
          <p className="text-sm text-slate-600">No hay problema. Puedes instalarla mas tarde desde el menu del navegador.</p>
        )}
        {status === "manual" && (
          <p className="text-sm text-slate-600">
            No pudimos abrir el instalador automatico. Abre el menu del navegador y elige Instalar app o Agregar a pantalla de inicio.
          </p>
        )}
      </div>
    );
  }

  if (platform.isIos) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">En iPhone (Safari):</p>
        <ol className="mt-2 space-y-2">
          <li className="flex items-start gap-2">
            <Share2 className="mt-0.5 h-4 w-4" />
            1) Toca Compartir en Safari.
          </li>
          <li className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4" />
            2) Elige Agregar a pantalla de inicio.
          </li>
          <li className="flex items-start gap-2">
            <Download className="mt-0.5 h-4 w-4" />
            3) Abre la app desde tu home.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <p className="text-sm text-slate-600">
      Si no aparece el boton de instalacion, abre el menu del navegador y selecciona Instalar app o Agregar a pantalla de inicio.
    </p>
  );
}
