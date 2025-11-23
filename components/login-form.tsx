"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LogIn, LogOut, Loader2, ShieldCheck } from "lucide-react";
import type { SupabaseClient, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { login, signOut } from "@/lib/auth-actions";

const TOKEN_PREVIEW_LENGTH = 32;

type AuthStatus = "idle" | "loading" | "success" | "error";

type SeedRequest = {
  email: string;
  password: string;
};

export function LoginForm() {
  const { t } = useTranslation();
  const supabase = useMemo(() => getSupabaseClient() as unknown as SupabaseClient, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<AuthStatus>("idle");
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const isLoading = status === "loading";
  const isSeeding = seedStatus === "loading";

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAccessToken(data.session?.access_token ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      setAccessToken(nextSession?.access_token ?? null);
      if (!nextSession) {
        setStatus("idle");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage(t("auth.login.errors.missingFields"));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("email", email.trim());
      formData.append("password", password);

      const result = await login(formData);
      
      if (result?.error) {
        throw new Error(result.error);
      }

      // Success is handled by redirect in server action
    } catch (error) {
      console.error("Supabase login error", error);
      setStatus("error");
      
      let msg = t("auth.login.errors.generic");
      if (error instanceof Error) {
        const err = error.message.toLowerCase();
        if (err.includes("user already registered") || err.includes("already registered") || err.includes("already been registered")) {
          msg = t("auth.login.errors.userAlreadyRegistered");
        } else if (err.includes("password should be at least")) {
          msg = t("auth.login.errors.passwordTooShort");
        } else if (err.includes("invalid email") || err.includes("unable to validate email")) {
          msg = t("auth.login.errors.invalidEmail");
        } else if (err.includes("invalid login credentials")) {
          msg = t("auth.login.errors.invalidCredentials");
        } else if (err.includes("email not confirmed")) {
          msg = t("auth.login.errors.emailNotConfirmed");
        } else {
          msg = error.message;
        }
      }
      setErrorMessage(msg);
    }
  }

  async function handleSignOut() {
    setStatus("loading");
    try {
      await signOut();
      // Redirect handled by server action
    } catch (error) {
      console.error("Supabase logout error", error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : t("auth.login.errors.generic")
      );
    }
  }

  async function handleSeedUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload: SeedRequest = {
      email: (formData.get("seedEmail") as string) ?? "",
      password: (formData.get("seedPassword") as string) ?? "",
    };

    if (!payload.email.trim() || payload.password.length < 6) {
      setSeedStatus("error");
      setSeedMessage(t("auth.login.errors.seedInvalid"));
      return;
    }

    setSeedStatus("loading");
    setSeedMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Registration failed");
      }

      const body = await response.json();
      setSeedStatus("success");
      setSeedMessage(
        t("auth.login.seedSuccess", { userId: body.user?.id ?? "" })
      );
    } catch (error) {
      console.error("Seed user error", error);
      setSeedStatus("error");
      
      let msg = t("auth.login.errors.generic");
      if (error instanceof Error) {
        const err = error.message.toLowerCase();
        if (err.includes("user already registered") || err.includes("already registered") || err.includes("already been registered")) {
           msg = t("auth.login.errors.userAlreadyRegistered", "El usuario ya está registrado.");
        } else if (err.includes("password should be at least")) {
           msg = t("auth.login.errors.passwordTooShort", "La contraseña es muy corta.");
        } else if (err.includes("invalid email") || err.includes("unable to validate email")) {
           msg = t("auth.login.errors.invalidEmail", "Email inválido.");
        } else if (err.includes("invalid login credentials")) {
           msg = t("auth.login.errors.invalidCredentials", "Credenciales inválidas.");
        } else if (err.includes("email not confirmed")) {
           msg = t("auth.login.errors.emailNotConfirmed", "Email no confirmado.");
        } else {
           msg = error.message;
        }
      }
      setSeedMessage(msg);
    }
  }

  return (
    <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl shadow-emerald-100">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-900">
        <ShieldCheck className="h-4 w-4" />
        {t("auth.login.badge")}
      </div>
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">
        {t("auth.login.title")}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("auth.login.description")}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          {t("auth.login.emailLabel")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.login.emailPlaceholder")}
            className="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 outline-none transition focus:border-emerald-500"
            required
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          {t("auth.login.passwordLabel")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.login.passwordPlaceholder")}
            className="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 outline-none transition focus:border-emerald-500"
            required
            minLength={6}
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {t("auth.login.primaryCta")}
        </button>
      </form>

      <div className="mt-4 text-sm" role="status" aria-live="polite">
        {status === "success" && session && (
          <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-emerald-900">
            {t("auth.login.success", { email: session.user.email ?? "" })}
          </p>
        )}
        {status === "error" && (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-rose-900">
            {errorMessage ?? t("auth.login.errors.generic")}
          </p>
        )}
      </div>

      {session ? (
        <div className="mt-6 space-y-3 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            {t("auth.login.loggedInAs", { email: session.user.email ?? "" })}
          </p>
          {accessToken && (
            <p className="text-xs text-emerald-700">
              {t("auth.login.tokenLabel")} {accessToken.slice(0, TOKEN_PREVIEW_LENGTH)}...
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-900 transition hover:bg-white"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.login.logout")}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          {t("auth.login.seedInfo")}
        </p>
      )}

      <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          {t("auth.login.seedTitle")}
        </p>
        <p className="text-sm text-slate-600">
          {t("auth.login.seedDescription")}
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSeedUser}>
          <input
            name="seedEmail"
            type="email"
            placeholder={t("auth.login.seedEmailPlaceholder")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
            required
          />
          <input
            name="seedPassword"
            type="password"
            placeholder={t("auth.login.seedPasswordPlaceholder")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={isSeeding}
            className="md:col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {t("auth.login.seedCta")}
          </button>
        </form>
        <div className="mt-3 text-sm" role="status" aria-live="polite">
          {seedStatus === "success" && seedMessage && (
            <p className="rounded-2xl bg-emerald-100 px-4 py-2 text-emerald-900">{seedMessage}</p>
          )}
          {seedStatus === "error" && seedMessage && (
            <p className="rounded-2xl bg-rose-100 px-4 py-2 text-rose-900">{seedMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
