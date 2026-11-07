/* =========================================================================
   ICRM — ESPACE MEMBRES · CLIENT SUPABASE (initialisation unique)
   Le client officiel (@supabase/supabase-js@2, chargé par CDN dans chaque page)
   gère lui-même la session : persistance, rafraîchissement du jeton, synchro
   entre onglets. Aucune session n'est stockée à la main par ce code.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  var client = null;

  function fail(code, msg) { var e = new Error(msg); e.code = code; e.coded = true; return e; }

  /* Lit le champ « role » d'une clé au format JWT (sans vérifier la signature : simple garde-fou). */
  function jwtRole(key) {
    try {
      var p = String(key).split('.')[1]; if (!p) return null;
      return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).role || null;
    } catch (e) { return null; }
  }

  /* Refuse toute clé privée : une clé « secret » / service_role ne doit jamais atteindre le navigateur. */
  P.assertPublicKey = function (key) {
    if (!key) throw fail('CONFIG', 'Clé publishable manquante.');
    if (/^sb_secret_/i.test(key) || jwtRole(key) === 'service_role') throw fail('CONFIG', 'Clé privée refusée dans le navigateur.');
  };

  /* opts.detectSessionInUrl : true uniquement sur reset-password.html (lien de récupération reçu par e-mail). */
  P.getClient = function (opts) {
    if (client) return client;
    var cfg = (P.config && P.config.BACKEND && P.config.BACKEND.supabase) || {};
    if (!cfg.url || !cfg.publishableKey || /\/dashboard\b/.test(cfg.url) || !/^https:\/\//i.test(cfg.url)) throw fail('CONFIG', 'Configuration Supabase incomplète ou invalide.');
    P.assertPublicKey(cfg.publishableKey);
    if (!window.supabase || typeof window.supabase.createClient !== 'function') throw fail('LIB_UNAVAILABLE', 'Bibliothèque Supabase indisponible.');
    client = window.supabase.createClient(cfg.url.replace(/\/+$/, ''), cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !!(opts && opts.detectSessionInUrl) }
    });
    return client;
  };
})();
