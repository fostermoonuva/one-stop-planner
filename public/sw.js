/* One Stop Planner Service Worker */
const CACHE_NAME = "one-stop-planner-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "One Stop Planner",
    body: "You have a new notification",
    icon: "/vite.svg",
    badge: "/vite.svg",
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // Invalid JSON payload — fall back to defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "One Stop Planner", {
      body: data.body || "",
      icon: data.icon || "/vite.svg",
      badge: data.badge || "/vite.svg",
      tag: data.tag || "planner-notification",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || "/";
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});