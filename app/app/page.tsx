import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Smartphone } from "lucide-react";
import { PwaInstallAssistant } from "@/components/pwa-install-assistant";
import { PwaInstalledRedirect } from "@/components/pwa-installed-redirect";

export const metadata: Metadata = {
  title: "Instalar app | Agente Alma",
  description: "Instala Agente Alma como app web en iPhone o Android.",
};

export default function InstallAppPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-4 py-8 text-slate-900 sm:px-6">
      <PwaInstalledRedirect />
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-white/90 p-6 shadow-xl shadow-amber-100/40 sm:p-8">
          <p className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            App web oficial
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            Instala Agente Alma en tu celular
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Funciona en iPhone y Android sin pasar por tienda. Queda en tu pantalla de inicio como app.
          </p>

          <div className="mt-6">
            <PwaInstallAssistant />
          </div>

          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Volver al inicio
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-lg shadow-emerald-100/40 sm:p-8">
          <h2 className="text-xl font-semibold">Instalacion en 3 pasos</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>1) Abre esta pagina desde tu celular.</span>
            </li>
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>2) Toca Instalar app o Agregar a pantalla de inicio.</span>
            </li>
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>3) Inicia sesion y usa Alma como app.</span>
            </li>
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-100 sm:p-8">
          <h2 className="text-xl font-semibold">Seguridad y privacidad</h2>
          <p className="mt-3 text-sm text-slate-700">
            Agente Alma se abre bajo HTTPS y usa el mismo entorno seguro que ya usas en web.
            No hay instaladores externos ni APK para iOS.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Instalacion segura desde el navegador
          </div>
        </section>
      </div>
    </main>
  );
}
