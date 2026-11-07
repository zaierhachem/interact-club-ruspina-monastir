/* =========================================================================
   ICRM — ESPACE MEMBRES · COQUE, PORTAIL D'AUTHENTIFICATION & ROUTEUR
   Déroulé : /members/ → session ? (sinon login.html) → profil → rôle → routeur → vue.
   Rien de privé n'est rendu avant que la session et le profil soient validés.
   - routeur par hash (#/page/param), compatible hébergement statique ;
   - tiroir mobile, focus, titre de page, annonces vocales ;
   - événements d'authentification (SIGNED_OUT, SIGNED_IN, PASSWORD_RECOVERY ; TOKEN_REFRESHED est géré par le client).
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, cfg = P.config, A = P.auth, e = U.esc;
  var $ = function (s, c) { return (c || document).querySelector(s); };

  var main = $('#main'), sidebar = $('#sidebar'), scrim = $('#scrim'), burger = $('#burger'), live = $('#pt-live'), boot = $('#boot');
  var desktop = window.matchMedia('(min-width: 1024px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticket = 0, firstRender = true, drawerOpen = false, isMock = P.api.isMock();

  burger.innerHTML = U.icon('menu');

  /* ---------------------------- Chargement / erreurs plein écran ---------------------------- */
  function reveal() { document.body.classList.remove('pt-booting'); }
  function toLogin() { location.replace('login.html'); }
  function clearUi() {                                           // état d'interface uniquement (les jetons restent gérés par Supabase)
    P.session = { user: null, role: 'member', permissions: [] };
    ['navPrimary', 'navSecondary', 'userChip', 'tabbar'].forEach(function (id) { var n = document.getElementById(id); if (n) n.innerHTML = ''; });
    main.innerHTML = ''; document.body.classList.add('pt-booting');
  }
  /* États : profil absent, profil inactif, réseau, requête, inattendu… Texte français, jamais de détail technique. */
  function fatal(code) {
    var m = A.messageFor(code), retry = /^(NETWORK|QUERY|UNEXPECTED|LIB_UNAVAILABLE|RATE_LIMIT)$/.test(code);
    document.title = m.title + ' — Espace Membres · ICRM';
    boot.innerHTML = '<div class="pt-boot__card" role="alert"><img src="../assets/logos/NEW_ICRM_LOGO.png" alt="" width="1000" height="392">' +
      '<h1 class="pt-h3" id="pt-fatal" tabindex="-1">' + e(m.title) + '</h1><p>' + e(m.text) + '</p><div class="pt-boot__actions">' +
      (retry ? '<button type="button" class="pt-btn pt-btn--primary" data-act="retry">Réessayer</button>' : '<button type="button" class="pt-btn pt-btn--primary" data-act="out">Se déconnecter</button>') +
      '<a class="pt-btn pt-btn--ghost" href="../index.html">Retour au site public</a></div></div>';
    document.body.classList.add('pt-booting');
    var h = $('#pt-fatal'); if (h) h.focus();
    var r = boot.querySelector('[data-act="retry"]'), o = boot.querySelector('[data-act="out"]');
    if (r) r.addEventListener('click', function () { location.reload(); });
    if (o) o.addEventListener('click', function () { P.api.signOut().then(toLogin, toLogin); });
  }

  /* ---------------------------- Navigation ---------------------------- */
  function link(item) {
    var label = item.id === 'commission' && (P.session.role === 'bureau' || P.session.role === 'super_admin') ? 'Mon équipe' : item.label;
    return '<a class="pt-nav__link" href="#/' + item.id + '" data-route="' + item.id + '">' + U.icon(item.icon) + '<span>' + e(label) + '</span></a>';
  }
  function buildNav() {
    var role = cfg.ROLES[P.session.role], allowed = role.nav;
    var primary = cfg.NAV_PRIMARY.filter(function (i) { return allowed.indexOf(i.id) > -1; });
    $('#navPrimary').innerHTML = primary.map(link).join('');
    $('#navSecondary').innerHTML = cfg.NAV_SECONDARY.map(link).join('') +
      '<button type="button" class="pt-nav__link" id="signOut">' + U.icon('logout') + '<span>Se déconnecter</span></button>' +
      '<a class="pt-nav__link pt-nav__link--muted" href="../index.html">' + U.icon('globe') + '<span>Retour au site public</span></a>';

    var quick = ['dashboard', 'calendrier', 'taches', 'annonces'].map(function (id) { return primary.filter(function (i) { return i.id === id; })[0]; }).filter(Boolean);
    $('#tabbar').innerHTML = quick.map(function (i) {
      return '<a class="pt-tab" href="#/' + i.id + '" data-route="' + i.id + '">' + U.icon(i.icon) + '<span>' + e(i.label.replace('Mes ', '')) + '</span></a>';
    }).join('') + '<button type="button" class="pt-tab" id="tabMenu" aria-expanded="false" aria-controls="sidebar">' + U.icon('menu') + '<span>Menu</span></button>';

    var u = P.session.user, name = (u.firstName + ' ' + u.lastName).trim();
    $('#userChip').innerHTML = U.avatar(name, 'md') + '<span><b>' + e(name) + '</b><small>' + e(P.session.roleLabel) + '</small></span>';

    $('#signOut').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      P.api.signOut().then(function () { clearUi(); toLogin(); }).catch(function (err) {
        btn.disabled = false;
        U.toast(err && err.code === 'NOT_IMPLEMENTED' ? err.message : A.messageFor('SIGNOUT_FAILED').text);
      });
    });
    $('#tabMenu').addEventListener('click', function () { setDrawer(true); });
  }
  function markCurrent(id) {
    document.querySelectorAll('[data-route]').forEach(function (a) {
      if (a.dataset.route === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------------------------- Tiroir (< 1024 px) ---------------------------- */
  function setDrawer(open, opts) {
    opts = opts || {};
    if (desktop.matches) open = false;
    drawerOpen = open;
    sidebar.classList.toggle('is-open', open);
    scrim.hidden = !open;
    document.body.classList.toggle('pt-lock', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    var tm = $('#tabMenu'); if (tm) tm.setAttribute('aria-expanded', open);
    /* `inert` : pendant que le tiroir est ouvert, le reste de la page n'est ni focalisable ni lisible (piège à focus natif). */
    ['shell', 'tabbar'].forEach(function (id) { var n = document.getElementById(id); if (n) n.inert = open; });
    if (open) { var first = sidebar.querySelector('a, button'); if (first) first.focus({ preventScroll: true }); }
    else if (opts.restoreFocus) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', function () { setDrawer(!drawerOpen, { restoreFocus: true }); });
  scrim.addEventListener('click', function () { setDrawer(false, { restoreFocus: true }); });
  sidebar.addEventListener('click', function (ev) { if (ev.target.closest('a') && !desktop.matches) setDrawer(false); });
  document.addEventListener('keydown', function (ev) {
    if (!drawerOpen) return;
    if (ev.key === 'Escape') { setDrawer(false, { restoreFocus: true }); return; }
    if (ev.key === 'Tab') {
      var f = Array.prototype.slice.call(sidebar.querySelectorAll('a[href], button')), a = f[0], z = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
    }
  });
  desktop.addEventListener('change', function () { setDrawer(false); });

  /* ---------------------------- Routeur ---------------------------- */
  function parse() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { id: parts[0] || '', params: parts.slice(1) };
  }
  function render() {
    var role = cfg.ROLES[P.session.role], r = parse(), allowed = role.nav.concat(['parametres']);
    if (!r.id || allowed.indexOf(r.id) < 0 || !P.views[r.id]) { location.replace('#/' + role.home); return; }

    var view = P.views[r.id], my = ++ticket, ctx = { id: r.id, params: r.params };
    main.setAttribute('aria-busy', 'true');
    view.load(P.api, ctx).then(function (data) {
      if (my !== ticket) return;                                 // une navigation plus récente a pris le relais
      main.innerHTML = '<div class="pt-page' + (reduce ? '' : ' is-entering') + '">' + view.render(data, ctx) + '</div>';
      main.removeAttribute('aria-busy');
      if (view.mount) view.mount(main, data, ctx);
      markCurrent(r.id);
      document.title = view.title + ' — Espace Membres · ICRM';
      $('#crumb').textContent = view.title;
      reveal();
      if (!firstRender) {                                         // focus + annonce vocale (jamais au premier chargement)
        window.scrollTo(0, 0);
        var target = (r.params.length && $('#pt-md-title')) || $('#pt-h1') || main;
        target.focus({ preventScroll: true });
        live.textContent = view.title;
      }
      firstRender = false;
    }).catch(function (err) {
      if (my !== ticket) return;
      var code = A.classify(err);
      if (code === 'NO_SESSION' && !isMock) { toLogin(); return; }
      var m = A.messageFor(code);
      main.innerHTML = '<div class="pt-page"><section class="pt-card" role="alert"><h1 class="pt-h1" id="pt-h1" tabindex="-1">' + e(m.title) + '</h1><p class="pt-lede">' + e(m.text) + '</p>' +
        '<p style="margin-top:1.2rem"><button type="button" class="pt-btn pt-btn--ghost" data-retry>Réessayer</button></p></section></div>';
      main.removeAttribute('aria-busy'); reveal();
      var b = main.querySelector('[data-retry]'); if (b) b.addEventListener('click', render);
    });
  }

  /* ---------------------------- Événements d'authentification ---------------------------- */
  function watchAuth() {
    P.api.onAuthChange(function (event, info) {
      if (event === 'SIGNED_OUT') { clearUi(); toLogin(); }                                  // déconnexion (ici, autre onglet ou session expirée)
      else if (event === 'SIGNED_IN' && P.session.user && info.userId && info.userId !== P.session.user.id) location.reload(); // autre compte connecté dans un autre onglet
      else if (event === 'PASSWORD_RECOVERY') location.replace('reset-password.html');
      /* TOKEN_REFRESHED : le client Supabase met lui-même la session à jour ; rien à faire (et pas de rechargement). */
    });
  }

  /* Rafraîchit la route courante dans l'application (relit les données ; la session n'est pas touchée). */
  P.app = {
    refresh: function () { render(); },
    profileUpdated: function (user) {
      if (user) P.session.user = user;
      buildNav();
      render();
    }
  };

  /* ---------------------------- Démarrage ---------------------------- */
  function init(s) {
    P.session = { user: s.user, role: s.role, roleLabel: s.roleLabel, permissions: s.permissions, commission: s.commission };
    if (!isMock) { var badge = $('.pt-mock'); if (badge) badge.remove(); }                  // la mention « maquette » ne concerne que le mode mock
    buildNav();
    if (!isMock) watchAuth();
    window.addEventListener('hashchange', render);
    render();
  }
  P.api.getSession().then(init).catch(function (err) {
    var code = A.classify(err);
    if (code === 'NO_SESSION' && !isMock) { toLogin(); return; }                            // pas de session → page de connexion
    fatal(code);
  });
})();
