/* دفاتري - service worker. Bump CACHE on every release. */
const CACHE = "cahiers-v10";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];
/* Only these third-party files are cached (fonts, scanner engine, language data, Firebase SDK files). */
function cacheableExternal(u){
  return u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com" ||
         u.host === "cdn.jsdelivr.net" || u.host === "tessdata.projectnaptha.com" ||
         (u.host === "www.gstatic.com" && u.pathname.indexOf("/firebasejs/") === 0);
}
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  /* Firebase login/database traffic is never touched by the service worker. */
  if (/firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations|firebaseapp\.com/.test(u.host)) return;

  if (u.origin === location.origin) {
    /* Own files: network first so updates show immediately; cache is the offline fallback. */
    e.respondWith(
      fetch(r).then(function (res) {
        if (res && res.status === 200) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
        return res;
      }).catch(function () {
        return caches.match(r).then(function (m) { return m || caches.match("./index.html"); });
      })
    );
    return;
  }
  if (cacheableExternal(u)) {
    /* Fonts, scanner and Firebase SDK files: cache first (they never change for a given version). */
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(r).then(function (m) {
        return m || fetch(r).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone());
          return res;
        });
      });
    }));
  }
});
