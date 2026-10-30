/* ICRM MEMBERS · service worker conservateur.
   Seuls les fichiers statiques du shell sont mis en cache. Les réponses Supabase,
   les jetons et toute donnée de membre ne sont jamais mis en cache ici. */
'use strict';

var CACHE_NAME = 'icrm-members-static-v6-meeting-minutes-audience-v1';
var BASE = self.registration.scope;
var SHELL = [
  'index.html', 'login.html', 'reset-password.html', 'members.css', 'auth.css',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'
].map(function (path) { return new URL(path, BASE).toString(); });

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(SHELL);
  }).catch(function () {
    /* Un cache préliminaire raté ne doit pas empêcher l'installation de l'application. */
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf('icrm-members-static-') === 0 && key !== CACHE_NAME;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

function isSafeStaticRequest(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf(new URL('.', BASE).pathname) !== 0) return false;
  if (/\/js\/(mock-data\.js|providers\/mock\.js)$/.test(url.pathname)) return false;
  if (/\/(rest\/v1|auth\/v1)\//.test(url.pathname)) return false;
  return request.mode === 'navigate' || /\.(html|css|js|webmanifest|png|svg|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (!isSafeStaticRequest(request, url)) return;

  /* Réseau d'abord : les mises à jour du portail restent visibles dès qu'il est en ligne. */
  event.respondWith(fetch(request).then(function (response) {
    if (response && response.ok && response.type === 'basic') {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }).catch(function () {});
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match(new URL('index.html', BASE).toString());
      return Response.error();
    });
  }));
});

/* Web Push : Safari impose l'affichage immédiat du push reçu. */
self.addEventListener('push', function (event) {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = {}; }
  var title = String(payload.title || 'Interact Club Ruspina Monastir');
  var body = String(payload.body || 'Une nouvelle information est disponible dans ton espace membres.');
  var dataUrl = String(payload.url || '/members/index.html#/dashboard');
  var options = {
    body: body,
    icon: new URL('icons/icon-192.png', BASE).toString(),
    badge: new URL('icons/icon-192.png', BASE).toString(),
    tag: String(payload.tag || ('icrm-push-' + Date.now())),
    data: { url: dataUrl },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var basePath = new URL('.', BASE).pathname;
  var target;
  try { target = new URL(String((event.notification.data || {}).url || '/members/index.html#/dashboard'), self.location.origin); }
  catch (_) { target = new URL('index.html#/dashboard', BASE); }
  if (target.origin !== self.location.origin || target.pathname.indexOf(basePath) !== 0) {
    target = new URL('index.html#/dashboard', BASE);
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      if (client.url && new URL(client.url).origin === self.location.origin) {
        if (typeof client.navigate === 'function') {
          return client.navigate(target.href).then(function (navigated) { return (navigated || client).focus(); }).catch(function () { return client.focus(); });
        }
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});

