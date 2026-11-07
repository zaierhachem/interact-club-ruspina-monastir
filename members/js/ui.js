/* =========================================================================
   ICRM — ESPACE MEMBRES · HELPERS D'INTERFACE
   Échappement, icônes, formats FR, puces d'état, avatars, toasts.
   Toute donnée injectée dans du HTML passe par esc().
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var esc = U.esc;

  /* ---------- Icônes (traits 24×24, héritent de currentColor) ---------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c2 .7 3 2.6 3 5.6"/>',
    message: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    megaphone: '<path d="M3 10v4l11 4V6z"/><path d="M14 8.5c2.5.5 4 1.7 4 3.5s-1.500 3-4 3.500M6 15l1.500 5h3"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12.500 5 5 9-10"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    clip: '<path d="m20 11-8.500 8.500a5 5 0 0 1-7-7L13 4a3.500 3.500 0 0 1 5 5l-8.500 8.500a2 2 0 0 1-3-3L14 7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 16v4h14v-4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
  };
  U.icon = function (name, cls) {
    return '<svg class="pt-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  };

  /* ---------- Dates (locale fr-FR, midi local pour éviter les décalages de fuseau) ---------- */
  var d = function (iso) { return new Date(iso + 'T12:00:00'); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var f = function (opts) { return new Intl.DateTimeFormat('fr-FR', opts); };
  var F = {
    long: f({ weekday: 'long', day: 'numeric', month: 'long' }),
    full: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: f({ day: 'numeric', month: 'short' }),
    month: f({ month: 'long', year: 'numeric' }),
    monthOnly: f({ month: 'long' }),
    weekday: f({ weekday: 'long' }),
    my: f({ month: 'long', year: 'numeric' })
  };
  U.date = {
    parse: d,
    long:  function (iso) { if (!iso) return '—'; return cap(F.long.format(d(iso))); },
    full:  function (iso) { if (!iso) return '—'; return cap(F.full.format(d(iso))); },
    short: function (iso) { if (!iso) return '—'; return F.short.format(d(iso)); },
    month: function (y, m) { return cap(F.month.format(new Date(y, m, 1, 12))); },
    monthName: function (iso) { if (!iso) return '—'; return cap(F.monthOnly.format(d(iso))); },
    weekday: function (iso) { if (!iso) return '—'; return cap(F.weekday.format(d(iso))); },
    day: function (iso) { if (!iso) return '—'; return ('0' + d(iso).getDate()).slice(-2); },
    my: function (iso) { if (!iso) return '—'; return cap(F.my.format(d(iso))); },
    daysBetween: function (a, b) { return Math.round((d(b) - d(a)) / 864e5); },
    relative: function (from, to) {
      var n = U.date.daysBetween(from, to);
      return n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : n > 1 ? 'Dans ' + n + ' jours' : n === -1 ? 'Hier' : 'Il y a ' + (-n) + ' jours';
    },
    key: function (y, m, day) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + day).slice(-2); }
  };

  /* ---------- Métadonnées d'état (libellé + ton). Un ton = une classe .pt-chip--<ton>. ---------- */
  U.META = {
    memberStatus: { active: ['Actif', 'ok'], watch: ['À suivre', 'warn'], inactive: ['Inactif', 'neutral'] },
    taskStatus:   { pending: ['À faire', 'neutral'], in_progress: ['En cours', 'info'], completed: ['Terminée', 'ok'] },
    priority:     { high: ['Priorité haute', 'warn'], medium: ['Priorité moyenne', 'info'], low: ['Priorité basse', 'neutral'] },
    access:       { all: ['Tous les membres', 'neutral'], commission: ['Ma commission', 'info'], bureau: ['Bureau exécutif', 'warn'], admin: ['Administrateurs', 'dark'], unknown: ['Accès non reconnu', 'warn'] },
    attendance:   { present: ['Présent', 'ok'], late: ['En retard', 'info'], excused: ['Excusé', 'neutral'], absent: ['Absent', 'warn'], expected: ['Attendu', 'neutral'], unknown: ['Statut inconnu', 'neutral'] },
    announce:     { important: ['Important', 'warn'], normal: ['Annonce', 'info'], info: ['Info', 'neutral'] },
    eventType: {
      'club-meeting':       ['Réunion du club', 'club'],
      'commission-meeting': ['Réunion de commission', 'commission'],
      'event':              ['Événement', 'event'],
      'training':           ['Formation', 'training'],
      'deadline':           ['Échéance', 'deadline'],
      'other':              ['Autre', 'other']
    },
    folders: [['all', 'Tous'], ['bureau', 'Bureau'], ['communication', 'Communication'], ['events', 'Events'], ['finance', 'Finance'], ['forms', 'Forms'], ['archives', 'Archives']]
  };
  U.chip = function (pair, extra) {
    return '<span class="pt-chip pt-chip--' + esc(pair[1]) + (extra ? ' ' + extra : '') + '">' + esc(pair[0]) + '</span>';
  };
  U.statusChip = function (map, key) { return U.chip(U.META[map][key] || [key, 'neutral']); };

  /* ---------- Avatars & jauges ---------- */
  U.initials = function (name) {
    var p = String(name).replace(/\./g, '').trim().split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  };
  U.avatar = function (name, size) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 3;
    return '<span class="pt-avatar pt-avatar--' + (size || 'md') + ' pt-avatar--v' + h + '" aria-hidden="true">' + esc(U.initials(name)) + '</span>';
  };
  /* Barre de progression : la valeur passe par une variable CSS (pas de style en dur dans les feuilles). */
  U.bar = function (pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return '<span class="pt-bar" role="img" aria-label="' + esc(label || pct + ' %') + '" style="--v:' + pct + '"><i></i></span>';
  };

  /* ---------- Toasts (zone aria-live créée dans index.html) ---------- */
  U.toast = function (msg) {
    var zone = document.getElementById('pt-toasts'); if (!zone) return;
    var t = document.createElement('p'); t.className = 'pt-toast'; t.textContent = msg; zone.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 400); }, 4200);
  };
  U.soon = function () { U.toast('Fonctionnalité disponible dans une prochaine phase (maquette).'); };

  /* ---------- Fragments communs ---------- */
  U.pageHead = function (eyebrow, title, lede, actions) {
    return '<header class="pt-pagehead"><div><p class="pt-eyebrow">' + esc(eyebrow) + '</p><h1 class="pt-h1" id="pt-h1" tabindex="-1">' + title + '</h1>' +
      (lede ? '<p class="pt-lede">' + esc(lede) + '</p>' : '') + '</div>' + (actions ? '<div class="pt-pagehead__actions">' + actions + '</div>' : '') + '</header>';
  };
  /* Fonctionnalité dont la donnée n'existe pas (encore) dans la base : on le dit, on ne simule pas un « vide ». */
  U.unavailable = function (what) {
    return '<p class="pt-empty">' + esc(what) + ' : pas encore disponible, cette information n’est pas encore enregistrée dans la base de données.</p>';
  };
  U.empty = function (text) { return '<p class="pt-empty">' + esc(text) + '</p>'; };
  U.fileTypeLabel = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', img: 'Image', file: 'Fichier' };
})();
