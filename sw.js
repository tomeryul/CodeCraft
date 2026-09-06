const CACHE = "codecraft-v149";
const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./css/styles.css",
  "./css/codecraft-v4.css",
  "./css/codecraft-v5.css",
  "./css/codecraft-v6.css",
  "./css/codecraft-v7.css",
  "./fonts/fredoka-latin.woff2",
  "./fonts/fredoka-latin-ext.woff2",
  "./fonts/fredoka-hebrew.woff2",
  "./js/sprites.js",
  "./js/extras.js",
  "./js/ui-icons.js",
  "./js/game/blocks.js",
  "./js/game/boot.js",
  "./js/game/v5-ui.js",
  "./js/game/build.js",
  "./js/game/decor-tiles.js",
  "./js/game/economy.js",
  "./js/game/funclib.js",
  "./js/game/puzzle-tiles.js",
  "./js/game/challenges.js",
  "./js/game/tower3d.js",
  "./js/game/tower-editor.js",
  "./js/game/creator-guide.js",
  "./js/game/academy.js",
  "./js/game/chapters.js",
  "./js/game/constants.js",
  "./js/game/dragdrop.js",
  "./js/game/editor.js",
  "./js/game/engagement.js",
  "./js/game/moderation.js",
  "./js/game/orders.js",
  "./js/game/music.js",
  "./js/game/journey.js",
  "./js/game/hub.js",
  "./js/game/settings.js",
  "./js/game/nav.js",
  "./js/game/i18n.js",
  "./js/game/fx.js",
  "./js/game/hud.js",
  "./js/game/input.js",
  "./js/game/interpreter.js",
  "./js/game/loop.js",
  "./js/game/mentor.js",
  "./js/game/python.js",
  "./js/game/cosmetics.js",
  "./js/game/wear-code.js",
  "./js/game/wear-maker.js",
  "./js/game/wear-tutor.js",
  "./js/game/render.js",
  "./js/game/robot.js",
  "./js/game/agegate.js",
  "./js/game/account.js",
  "./js/game/save.js",
  "./js/game/shop.js",
  "./js/game/state.js",
  "./js/game/tutorial.js",
  "./js/game/util.js",
  "./js/game/world.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// network-first so game updates propagate; cache fallback keeps it playable offline.
// IMPORTANT: fetch with cache:"no-store" so we bypass the browser HTTP cache — on
// iOS the standalone PWA otherwise kept serving stale JS/CSS for GitHub Pages'
// cache lifetime, so code updates (like publishing sort challenges) never landed.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // never touch cross-origin requests (Supabase API, fonts CDN)
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" }).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp));
      return r;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match("./index.html"))
    )
  );
});
