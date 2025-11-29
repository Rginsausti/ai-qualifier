"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, RefreshCw, Sparkles } from "lucide-react";
import { clearStoredLocation, loadStoredLocation, saveStoredLocation, type StoredLocation } from "@/lib/location-storage";

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

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export default function HealthyNeighborhoodPanel() {
  const { t } = useTranslation();
  const dashboardLocale = t("dashboard.locale", "es-AR");
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [spots, setSpots] = useState<HealthySpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualLabel, setManualLabel] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    const stored = loadStoredLocation();
    if (stored) {
      setLocation(stored);
    }
  }, []);

  useEffect(() => {
    if (!location) {
      setAddressLabel(null);
      setAddressLoading(false);
      return;
    }

    if (location.formattedAddress) {
      setAddressLabel(location.formattedAddress);
      setAddressLoading(false);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);

    const resolveAddress = async () => {
      try {
        const response = await fetch("/api/location/reverse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: location.lat, lon: location.lon, locale: dashboardLocale }),
        });

        if (!response.ok) {
          setAddressLabel(null);
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        const formatted = data.shortLabel ?? data.displayName ?? null;
        setAddressLabel(formatted);

        if (formatted) {
          setLocation((prev) => {
            if (!prev || prev.formattedAddress === formatted) return prev;
            const next: StoredLocation = { ...prev, formattedAddress: formatted };
            saveStoredLocation(next);
            return next;
          });
        }
      } catch (err) {
        console.error("resolveAddress", err);
        if (!cancelled) {
          setAddressLabel(null);
        }
      } finally {
        if (!cancelled) {
          setAddressLoading(false);
        }
      }
    };

    void resolveAddress();

    return () => {
      cancelled = true;
    };
  }, [location, dashboardLocale]);

  const applyLocation = useCallback(
    (coords: { lat: number; lon: number }, meta?: Partial<StoredLocation>) => {
      const next: StoredLocation = {
        lat: coords.lat,
        lon: coords.lon,
        label: meta?.label ?? location?.label,
        source: meta?.source ?? location?.source ?? "gps",
        savedAt: meta?.savedAt ?? new Date().toISOString(),
        formattedAddress: meta?.formattedAddress ?? location?.formattedAddress,
      };
      setLocation(next);
      saveStoredLocation(next);
    },
    [location?.label, location?.source, location?.formattedAddress]
  );

  const openManualDialog = () => {
    const defaultLabel = t("dashboard.neighborhood.manualDialog.defaultLabel", "Casa");
    setManualLabel(location?.label ?? defaultLabel);
    setManualAddress(location?.formattedAddress ?? addressLabel ?? "");
    setManualError(null);
    setIsManualOpen(true);
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualError(null);
    const trimmedAddress = manualAddress.trim();

    if (!trimmedAddress) {
      setManualError(t("dashboard.neighborhood.manualDialog.errorAddress", "Ingresá una dirección."));
      return;
    }

    setManualSubmitting(true);

    try {
      const response = await fetch("/api/location/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedAddress, locale: dashboardLocale }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setManualError(t("dashboard.neighborhood.manualDialog.errorGeocode", "No encontramos esa dirección."));
        } else {
          setManualError(t("dashboard.neighborhood.manualDialog.errorGeneric", "No pudimos guardar la ubicación."));
        }
        return;
      }

      const data = await response.json();
      if (typeof data.lat !== "number" || typeof data.lon !== "number") {
        setManualError(t("dashboard.neighborhood.manualDialog.errorGeneric", "No pudimos guardar la ubicación."));
        return;
      }

      const fallbackLabel = t("dashboard.neighborhood.customLabel", "Mi punto de partida");
      const resolvedLabel = (manualLabel || data.shortLabel || fallbackLabel).trim();

      applyLocation(
        { lat: data.lat, lon: data.lon },
        {
          label: resolvedLabel,
          source: "manual",
          formattedAddress: data.shortLabel ?? data.displayName ?? trimmedAddress,
        }
      );
      setIsManualOpen(false);
    } catch (err) {
      console.error("handleManualSubmit", err);
      setManualError(t("dashboard.neighborhood.manualDialog.errorGeneric", "No pudimos guardar la ubicación."));
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleClearLocation = () => {
    setLocation(null);
    setSpots([]);
    setAddressLabel(null);
    clearStoredLocation();
  };

  const requestLocation = useCallback(() => {
    setError(null);
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setError(t("dashboard.neighborhood.locationDenied", "Tu navegador no permite ubicación"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocation(
          {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          { source: "gps" }
        );
      },
      () => {
        setLocationDenied(true);
        setError(t("dashboard.neighborhood.locationDenied", "No pudimos usar tu ubicación."));
      },
      GEOLOCATION_OPTIONS
    );
  }, [applyLocation, t]);

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

  const currentLat = location?.lat;
  const currentLon = location?.lon;

  useEffect(() => {
    if (typeof currentLat === "number" && typeof currentLon === "number") {
      fetchSpots();
    }
  }, [currentLat, currentLon, fetchSpots]);

  const distanceFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }), []);
  const timestampFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(dashboardLocale || undefined, {
        dateStyle: "short",
        timeStyle: "medium",
      });
    } catch {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" });
    }
  }, [dashboardLocale]);

  const renderDistance = (distance?: number | null) => {
    if (!distance || distance <= 0) return "-";
    if (distance >= 1000) {
      return `${distanceFormatter.format(distance / 1000)} km`;
    }
    return `${Math.round(distance)} m`;
  };

  const resolvedAddress = location?.formattedAddress ?? addressLabel;
  const addressText = addressLoading && !resolvedAddress
    ? t("dashboard.neighborhood.addressLoading", "Buscando dirección...")
    : resolvedAddress ?? t("dashboard.neighborhood.addressFallback", "Dirección pendiente");
  const sourceLabel = location?.source === "manual"
    ? t("dashboard.neighborhood.manualSource", "Manual")
    : t("dashboard.neighborhood.gpsSource", "GPS");
  const savedAtText = location?.savedAt ? timestampFormatter.format(new Date(location.savedAt)) : null;

  const locationSummary = location ? (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-xs text-slate-600">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {location.label || t("dashboard.neighborhood.customLabel", "Mi punto de partida")}
        </p>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          {sourceLabel}
          {savedAtText ? ` · ${savedAtText}` : ""}
        </p>
        <p className="text-[11px] text-slate-500">{addressText}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openManualDialog}
          className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600"
        >
          {t("dashboard.neighborhood.manualEdit", "Editar")}
        </button>
        <button
          type="button"
          onClick={handleClearLocation}
          className="rounded-full border border-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-600"
        >
          {t("dashboard.neighborhood.clearLocation", "Limpiar")}
        </button>
      </div>
    </div>
  ) : null;

  const manualDialog = !isManualOpen ? null : (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={() => setIsManualOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {t("dashboard.neighborhood.manualDialog.title", "Ajustar ubicación manual")}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t(
                "dashboard.neighborhood.manualDialog.description",
                "Ingresá una dirección segura y la usaremos como punto de partida."
              )}
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            {t("dashboard.neighborhood.manualDialog.labelLabel", "Etiqueta")}
            <input
              type="text"
              value={manualLabel}
              onChange={(event) => setManualLabel(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              placeholder={t("dashboard.neighborhood.customLabel", "Mi punto de partida")}
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {t("dashboard.neighborhood.manualDialog.addressLabel", "Dirección")}
            <textarea
              value={manualAddress}
              onChange={(event) => setManualAddress(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              rows={3}
              placeholder={t("dashboard.neighborhood.manualDialog.addressPlaceholder", "Calle, número, ciudad")}
              autoComplete="street-address"
            />
          </label>
          <p className="text-xs text-slate-400">
            {t("dashboard.neighborhood.manualDialog.helper", "Solo guardamos esto en tu dispositivo para personalizar mapas.")}
          </p>
          {manualError && <p className="text-sm text-rose-600">{manualError}</p>}
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsManualOpen(false)}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"
            >
              {t("dashboard.neighborhood.manualDialog.cancel", "Cancelar")}
            </button>
            <button
              type="submit"
              disabled={manualSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
            >
              {manualSubmitting
                ? t("dashboard.neighborhood.manualDialog.saving", "Guardando...")
                : t("dashboard.neighborhood.manualDialog.save", "Guardar dirección")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!location) {
    return (
      <>
        {manualDialog}
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
          <button
            type="button"
            onClick={openManualDialog}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"
          >
            {t("dashboard.neighborhood.manualCta", "Ajustar manualmente")}
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
      </>
    );
  }

  if (loading) {
    return (
      <>
        {manualDialog}
        <div className="mt-6 space-y-4">
          {locationSummary}
          <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/80 p-6 text-center text-sm text-slate-500">
            <Sparkles className="h-10 w-10 animate-pulse text-emerald-500" />
            <p className="mt-3 font-semibold">
              {t("dashboard.neighborhood.loading", "Analizando lugares saludables cerca tuyo…")}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {manualDialog}
        <div className="mt-6 space-y-4">
          {locationSummary}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5 text-sm text-rose-700">
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
        </div>
      </>
    );
  }

  if (spots.length === 0) {
    return (
      <>
        {manualDialog}
        <div className="mt-6 space-y-4">
          {locationSummary}
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
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
        </div>
      </>
    );
  }

  const buildDirectionsUrl = (spot: HealthySpot) => {
    const params = new URLSearchParams({
      api: "1",
      destination: `${spot.lat},${spot.lon}`,
      travelmode: "walking",
    });

    if (location) {
      params.set("origin", `${location.lat},${location.lon}`);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };

  return (
    <>
      {manualDialog}
      <div className="mt-6 space-y-4">
        {locationSummary}
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
              href={buildDirectionsUrl(spot)}
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
    </>
  );
}
