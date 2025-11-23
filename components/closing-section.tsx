"use client";

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, HeartHandshake, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function ClosingSection() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("beta_signups")
        .insert({ email, notes });

      if (error) {
        throw error;
      }

      setStatus("success");
      setEmail("");
      setNotes("");
    } catch (error) {
      console.error("Beta signup error", error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : t("closingSection.form.genericError")
      );
    }
  }

  return (
    <section className="rounded-3xl border border-white/60 bg-slate-900 p-8 text-white shadow-2xl shadow-slate-900/30">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em]">
        {t("closingSection.badge")}
      </div>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,_7fr)_minmax(0,_5fr)]">
        <div className="space-y-4">
          <h2 className="text-4xl font-semibold">
            {t("closingSection.title")}
          </h2>
          <p className="text-base text-white/80">
            {t("closingSection.description")}
          </p>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:-translate-y-0.5">
            {t("closingSection.secondaryCta")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <form
          className="space-y-4 rounded-3xl bg-white/10 p-6 backdrop-blur"
          onSubmit={handleSubmit}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              {t("closingSection.form.emailLabel")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("closingSection.form.emailPlaceholder")}
                className="mt-2 w-full rounded-2xl border border-white/30 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              {t("closingSection.form.notesLabel")}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("closingSection.form.notesPlaceholder")}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/30 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HeartHandshake className="h-4 w-4" />
            )}
            {isSubmitting
              ? t("closingSection.form.sending")
              : t("closingSection.primaryCta")}
          </button>
          <p className="text-xs text-white/60">
            {t("closingSection.form.privacy")}
          </p>
          <div
            className="text-sm"
            role="status"
            aria-live="polite"
          >
            {status === "success" && (
              <p className="rounded-2xl bg-emerald-100/90 px-4 py-2 text-emerald-900">
                {t("closingSection.form.success")}
              </p>
            )}
            {status === "error" && (
              <p className="rounded-2xl bg-rose-100/90 px-4 py-2 text-rose-900">
                {errorMessage ?? t("closingSection.form.genericError")}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
