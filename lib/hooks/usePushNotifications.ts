"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationChannels = {
  water: boolean;
  meals: boolean;
  dayEnd: boolean;
  nearbySearch: boolean;
};

const DEFAULT_CHANNELS: NotificationChannels = {
  water: true,
  meals: true,
  dayEnd: true,
  nearbySearch: true,
};

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type ExtendedNavigator = Navigator & { standalone?: boolean };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window === "undefined" ? "" : window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isBrowserPushSupported() {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function isIOSDevice() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia?.("(display-mode: standalone)");
  const navigatorAny = window.navigator as ExtendedNavigator;
  return Boolean(media?.matches || navigatorAny.standalone);
}

async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";

  try {
    const permissionResult = Notification.requestPermission();
    if (permissionResult instanceof Promise) {
      return permissionResult;
    }
    return permissionResult;
  } catch (error) {
    return new Promise<NotificationPermission>((resolve, reject) => {
      try {
        Notification.requestPermission((result) => resolve(result));
      } catch (nestedError) {
        reject(nestedError ?? error);
      }
    });
  }
}

async function getOrRegisterServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export function usePushNotifications(initialChannels?: Partial<NotificationChannels>) {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window === "undefined" ? "default" : Notification.permission
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresPwaInstall, setRequiresPwaInstall] = useState(false);
  const [channels, setChannels] = useState<NotificationChannels>(() => ({
    ...DEFAULT_CHANNELS,
    ...initialChannels,
  }));
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setIsSupported(isBrowserPushSupported());
  }, []);

  useEffect(() => {
    if (isSupported === false || isSupported === null) return;

    let mounted = true;

    const syncSubscriptionStatus = async () => {
      try {
        const registration = await getOrRegisterServiceWorker();
        const readyRegistration = await navigator.serviceWorker.ready.catch(() => registration);
        const subscription = await readyRegistration.pushManager.getSubscription();
        if (mounted) {
          setIsEnabled(Boolean(subscription));
        }
      } catch (err) {
        console.warn("usePushNotifications:init", err);
      }
    };

    const updateIosState = () => {
      setRequiresPwaInstall(isIOSDevice() && !isStandaloneDisplayMode());
    };

    updateIosState();

    const media = typeof window !== "undefined" ? window.matchMedia?.("(display-mode: standalone)") : null;
    if (media) {
      if (media.addEventListener) {
        media.addEventListener("change", updateIosState);
      } else if (media.addListener) {
        media.addListener(updateIosState);
      }
    }

    syncSubscriptionStatus();

    return () => {
      mounted = false;
      if (media) {
        if (media.removeEventListener) {
          media.removeEventListener("change", updateIosState);
        } else if (media.removeListener) {
          media.removeListener(updateIosState);
        }
      }
    };
  }, [isSupported]);

  const registerSubscription = useCallback(
    async (channelOverrides?: Partial<NotificationChannels>) => {
      if (isSupported === null) {
        setError("Verificando compatibilidad del navegador…");
        return { success: false };
      }

      if (isSupported === false) {
        setError("Tu navegador no soporta notificaciones push");
        return { success: false };
      }

      if (!PUBLIC_VAPID_KEY) {
        setError("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        return { success: false };
      }

      if (requiresPwaInstall) {
        setError("En iOS agregá la app a tu pantalla de inicio para activar los avisos");
        return { success: false };
      }

      setIsLoading(true);
      setError(null);

      try {
        const permissionResult = await requestNotificationPermission();
        setPermission(permissionResult);

        if (permissionResult !== "granted") {
          throw new Error("Necesitamos permisos para enviarte recordatorios");
        }

        const registration = await getOrRegisterServiceWorker();
        const readyRegistration = await navigator.serviceWorker.ready.catch(() => registration);
        const subscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        });

        const payloadChannels: NotificationChannels = {
          ...DEFAULT_CHANNELS,
          ...channels,
          ...channelOverrides,
        };

        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription,
            channels: payloadChannels,
            locale: navigator.language,
          }),
        });

        if (!response.ok) {
          throw new Error("No pudimos guardar tus preferencias");
        }

        setChannels(payloadChannels);
        setIsEnabled(true);
        return { success: true };
      } catch (err) {
        console.error("usePushNotifications:register", err);
        setError(err instanceof Error ? err.message : "Error activando notificaciones");
        setIsEnabled(false);
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [channels, isSupported, requiresPwaInstall]
  );

  const unregisterSubscription = useCallback(async () => {
    if (isSupported === false || isSupported === null) return { success: true };

    setIsLoading(true);
    setError(null);

    try {
      const registration = await getOrRegisterServiceWorker();
      const readyRegistration = await navigator.serviceWorker.ready.catch(() => registration);
      const subscription = await readyRegistration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setIsEnabled(false);
      return { success: true };
    } catch (err) {
      console.error("usePushNotifications:unregister", err);
      setError(err instanceof Error ? err.message : "No pudimos desactivar los avisos");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const toggleChannel = useCallback((key: keyof NotificationChannels, value: boolean) => {
    setChannels((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    isSupported: Boolean(isSupported),
    supportKnown: isSupported !== null,
    permission,
    isEnabled,
    isLoading,
    error,
    channels,
    requiresPwaInstall,
    enablePush: registerSubscription,
    disablePush: unregisterSubscription,
    toggleChannel,
  };
}
