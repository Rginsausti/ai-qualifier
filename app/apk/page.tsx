import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { getApkMetadata, isApkDownloadReady } from "@/lib/apk/config";

export const metadata: Metadata = {
  title: "Descargar APK | Agente Alma",
  description: "Descargá la APK oficial de Agente Alma para Android.",
};

export default function ApkLandingPage() {
  const apk = getApkMetadata();
  const ready = isApkDownloadReady(apk);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-white/90 p-6 shadow-xl shadow-amber-100/40 sm:p-8">
          <p className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            APK Android oficial
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            Descarga Agente Alma en tu celular
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Instalá la app de forma segura y empezá a usar Alma en minutos.
          </p>

          <div className="mt-5 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
            <p>
              <span className="font-semibold">Version:</span> {apk.version}
            </p>
            <p>
              <span className="font-semibold">Tamano:</span> {apk.sizeMb} MB
            </p>
            <p>
              <span className="font-semibold">Android minimo:</span> {apk.minAndroid}+
            </p>
            <p>
              <span className="font-semibold">Actualizada:</span> {apk.updatedAt}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={ready ? "/api/apk/download?source=apk_landing" : "#"}
              aria-disabled={!ready}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                ready
                  ? "bg-slate-900 text-white hover:-translate-y-0.5"
                  : "cursor-not-allowed bg-slate-300 text-slate-700"
              }`}
            >
              <Download className="h-4 w-4" />
              Descargar APK para Android
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Volver al inicio
            </Link>
          </div>

          {!ready && (
            <p className="mt-3 text-sm text-rose-700">
              La descarga aun no esta habilitada en este entorno. Configura `APK_DOWNLOAD_URL` en Vercel.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-lg shadow-emerald-100/40 sm:p-8">
          <h2 className="text-xl font-semibold">Instalacion en 3 pasos</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4" />
              <span>1) Descarga el archivo APK desde el boton de arriba.</span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4" />
              <span>2) Android te pedira permitir la instalacion para esta fuente.</span>
            </li>
            <li className="flex items-start gap-3">
              <Download className="mt-0.5 h-4 w-4" />
              <span>3) Abri Agente Alma e inicia sesion para empezar.</span>
            </li>
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-100 sm:p-8">
          <h2 className="text-xl font-semibold">Seguridad y verificacion</h2>
          <p className="mt-3 text-sm text-slate-700">
            Esta APK debe distribuirse firmada. Verifica la huella SHA-256 antes de instalar.
          </p>
          <p className="mt-3 rounded-2xl bg-slate-900 p-3 font-mono text-xs text-emerald-200 break-all">
            SHA-256: {apk.sha256}
          </p>
        </section>
      </div>
    </main>
  );
}
