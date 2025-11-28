"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, RefreshCw, Sparkles } from "lucide-react";

export type HealthySpot = {
  id: number;
  name: string;
  brand?: string;
  type?: string;
  score: number;
  reason: string;
  tags?: string[];
  distance_m: number | null;
  lat: number;
  lon: number;
};

export default function HealthyNeighborhoodPanel() {
  const { t } = useTranslation();
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [spots, setSpots] = useState<HealthySpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const requestLocation = useCallback(() => {
    setError(null);
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setError(t("dashboard.neighborhood.locationDenied", "Tu navegador no permite ubicación"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        setLocationDenied(true);
        setError(t("dashboard.neighborhood.locationDenied", "No pudimos usar tu ubicación."));
      }
    );
  }, [t]);

  const fetchSpots = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/neighborhood/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: location.lat, lon: location.lon }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch spots");
      }

      const data = await response.json();
      setSpots(data?.spots ?? []);
    } catch (err) {
      console.error("HealthyNeighborhoodPanel", err);
      setError(t("dashboard.neighborhood.error", "No pude analizar la zona"));
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, [location, t]);

  useEffect(() => {
    if (location) {
      fetchSpots();
    }
  }, [location, fetchSpots]);

  const distanceFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }), []);

  const renderDistance = (distance?: number | null) => {
    if (!distance || distance <= 0) return "-";
    if (distance >= 1000) {
      return `${distanceFormatter.format(distance / 1000)} km`;
    }
    return `${Math.round(distance)} m`;
  };

  if (!location) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-sm text-slate-600">
        <p className="text-base font-semibold text-slate-900">
          {t("dashboard.neighborhood.requestTitle", "Compartí tu ubicación")}
        </p>
        <p className="mt-2 text-slate-500">
          {t(
            "dashboard.neighborhood.requestDescription",
            "Analizamos locales cercanos con IA para ordenar los más saludables."
          )}
        </p>
        <button
          type="button"
          onClick={requestLocation}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <MapPin className="h-4 w-4" />
          {t("dashboard.neighborhood.locationCta", "Usar ubicación actual")}
        </button>
        {locationDenied && (
          <p className="mt-2 text-xs text-rose-500">
            {t(
              "dashboard.neighborhood.locationDenied",
              "Necesitamos permisos de ubicación para recomendar locales vecinos."
            )}
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-white/60 bg-white/80 p-6 text-center text-sm text-slate-500">
        <Sparkles className="h-10 w-10 animate-pulse text-emerald-500" />
        <p className="mt-3 font-semibold">
          {t("dashboard.neighborhood.loading", "Analizando lugares saludables cerca tuyo…")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 text-sm text-rose-700">
        <p className="font-semibold">{error}</p>
        <button
          type="button"
          onClick={fetchSpots}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("dashboard.neighborhood.refresh", "Reintentar")}
        </button>
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
        {t("dashboard.neighborhood.empty", "No encontramos lugares saludables en este radio todavía.")}
        <div className="mt-4">
          <button
            type="button"
            onClick={fetchSpots}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("dashboard.neighborhood.refresh", "Actualizar")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {spots.map((spot) => (
        <article
          key={spot.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">{spot.name}</p>
            {spot.brand && (
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{spot.brand}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">{spot.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                {t("dashboard.neighborhood.score", { score: spot.score, defaultValue: `${spot.score}% mindful` })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-500">
                {renderDistance(spot.distance_m)}
              </span>
              {spot.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-50 px-2 py-1 text-slate-500">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-emerald-600 hover:text-emerald-700"
          >
            <Navigation className="h-5 w-5" />
          </a>
        </article>
      ))}
      <button
        type="button"
        onClick={fetchSpots}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t("dashboard.neighborhood.refresh", "Actualizar")}
      </button>
    </div>
  );
}
