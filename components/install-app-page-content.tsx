"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Smartphone } from "lucide-react";
import { PwaInstallAssistant } from "@/components/pwa-install-assistant";
import { PwaInstalledRedirect } from "@/components/pwa-installed-redirect";

export function InstallAppPageContent() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-4 py-8 text-slate-900 sm:px-6">
      <PwaInstalledRedirect />
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-white/90 p-6 shadow-xl shadow-amber-100/40 sm:p-8">
          <p className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            {t("installApp.badge", "Official web app")}
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            {t("installApp.title", "Install Agente Alma on your phone")}
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            {t(
              "installApp.description",
              "Works on iPhone and Android without app stores. It stays on your home screen like an app."
            )}
          </p>

          <div className="mt-6">
            <PwaInstallAssistant />
          </div>

          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              {t("installApp.backHome", "Back to home")}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-lg shadow-emerald-100/40 sm:p-8">
          <h2 className="text-xl font-semibold">{t("installApp.stepsTitle", "Install in 3 steps")}</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>{t("installApp.stepOpen", "1) Open this page from your phone.")}</span>
            </li>
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>{t("installApp.stepInstall", "2) Tap Install app or Add to home screen.")}</span>
            </li>
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>{t("installApp.stepLogin", "3) Sign in and use Alma like an app.")}</span>
            </li>
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-100 sm:p-8">
          <h2 className="text-xl font-semibold">{t("installApp.securityTitle", "Security and privacy")}</h2>
          <p className="mt-3 text-sm text-slate-700">
            {t(
              "installApp.securityDescription",
              "Agente Alma runs over HTTPS and uses the same secure environment as the web version. There are no external installers and no APK for iOS."
            )}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            {t("installApp.securityBadge", "Secure browser-based installation")}
          </div>
        </section>
      </div>
    </main>
  );
}
