// Curfew's service worker. It exists for exactly one reason: on Android, a push
// cannot be displayed without one.
//
// It deliberately does NOT cache anything. Every screen in this app is server
// rendered against data that changes when you press a button, so an offline
// cache would show a day that has already moved on, with a Check in button that
// posts into the void. A stale Curfew is worse than no Curfew. If offline ever
// becomes a goal it is a design decision, not something to slide in here.
//
// The payload is Declarative Web Push: `{ web_push: 8030, notification: {...},
// app_badge: n }`. Safari understands that format natively and never runs this
// file, because an immutable payload is rendered by the platform itself. So
// everything below is the Chrome and Android path, parsing by hand what Safari
// parses for us.

self.addEventListener("install", () => {
  // Take over immediately. The alternative is a worker that activates on the
  // next launch, which means the first notification after subscribing silently
  // does nothing and looks like a broken subscription.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = read(event);
  const note = payload.notification ?? {};

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(note.title ?? "Curfew", {
        body: note.body ?? "",
        // The icon is the maskable one at 192, which is what Android draws in
        // the shade. The badge, confusingly, is the small monochrome mark in
        // the status bar and not the number on the app icon.
        icon: "/icons/icon-192.png",
        badge: "/icons/maskable-192.png",
        // Where a tap goes, read back in notificationclick. `navigate` is the
        // declarative format's own field name, kept rather than renamed so the
        // payload is one shape for both platforms.
        data: { navigate: note.navigate ?? "/" },
        // One notification at a time. Curfew sends a digest of everything
        // outstanding, so a second one always supersedes the first, and two
        // stacked in the shade would say overlapping things about the same day.
        tag: "curfew-digest",
        renotify: true,
      }),
      badge(payload.app_badge),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.navigate ?? "/";

  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus a window that is already open rather than opening a second one.
      // Curfew is used as an installed app, so there is almost always one, and
      // launching a duplicate loses whatever was on screen.
      for (const client of open) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/**
 * The payload, or something harmless.
 *
 * A push that arrives without a body, or with a body this does not understand,
 * must still show something: Chrome requires a visible notification for every
 * push and revokes the permission from origins that swallow them.
 */
function read(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

/** The number on the home-screen icon. Absent means leave it alone. */
async function badge(count) {
  if (typeof count !== "number") return;
  try {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // Not supported everywhere, and never worth failing a notification over.
    // The notification is the message; the badge is a decoration on it.
  }
}
