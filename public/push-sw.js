/* global self, clients */

const DEFAULT_TITLE = "Agente saludable";
const DEFAULT_OPTIONS = {
  body: "Tienes un recordatorio pendiente.",
  icon: "/images/girl-avatar.png",
  badge: "/images/girl-avatar.png",
  data: {},
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.warn("push-sw: payload parse error", error);
  }

  const title = payload.title || DEFAULT_TITLE;
  const options = {
    ...DEFAULT_OPTIONS,
    ...payload,
    data: {
      url: payload?.data?.url || "/",
      ...payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  const normalizedTarget = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const matchingClient = clientList.find((client) => client.url === normalizedTarget);
      if (matchingClient) {
        return matchingClient.focus();
      }
      return clients.openWindow(normalizedTarget);
    })
  );
});
