/* ICRM MEMBERS · service worker conservateur.
   Seuls les fichiers statiques du shell sont mis en cache. Les réponses Supabase,
   les jetons et toute donnée de membre ne sont jamais mis en cache ici. */
'use strict';

var CACHE_NAME = 'icrm-members-static-v1';
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
