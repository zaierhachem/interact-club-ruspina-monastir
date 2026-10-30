/* ICRM IMPACT · SECTION « MON PARCOURS ICRM » (dans Mon Profil)
   Chargement : trois lectures indépendantes. Une lecture en échec n'efface pas les autres et n'est jamais
   remplacée par une valeur inventée (ni XP à 0, ni historique vide). Les états sont explicites. */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, A = P.auth, G = P.progression, e = U.esc;
  var UI = P.progressionUI = {};

  var reduced = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var fmtDate = function (ts) { return ts ? U.date.short(String(ts).slice(0, 10)) : ''; };
  var signed = function (n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + ' XP'; };
  var SOURCE = { attendance: 'Présence', task: 'Tâche', proposal: 'Proposition', adjustment: 'Ajustement' };

  /* Chargement : renvoie un modèle où chaque partie peut porter sa propre erreur. */
  UI.load = function (api) {
    var fail = function (err) { return { error: A.friendly(err) }; };
    return Promise.all([
      api.getMyProgress().then(function (p) { return { data: p }; }, fail),
      api.getMyXpHistory(50).then(function (h) { return { data: h.entries }; }, fail),
      api.getMyProgressNotifications().then(function (n) { return { data: n.events }; }, fail)
    ]).then(function (r) {
      return { progress: r[0].data || null, progressError: r[0].error || null,
               history: r[1].data || null, historyError: r[1].error || null,
               events: r[2].data || [], eventsError: r[2].error || null };
    });
  };

  function levelCard(p) {
    var pct = Math.max(0, Math.min(100, p.progressPct));
    var span = p.nextMin == null ? '' : (p.xp - p.currentMin) + ' / ' + (p.nextMin - p.currentMin) + ' XP';
    return '<div class="pt-prog__head"><span class="pt-emblem" aria-hidden="true">' + e(p.level) + '</span>' +
      '<div><p class="pt-eyebrow">Niveau ' + e(p.level) + '</p><p class="pt-prog__title">' + e(p.title) + '</p>' +
      '<p class="pt-prog__xp"><b>' + e(p.xp) + '</b> XP au total</p></div></div>' +
      (p.isMax ? '<p class="pt-prog__meta">Niveau maximum atteint.</p>' :
        '<div class="pt-prog__bar" role="progressbar" aria-label="Progression vers le niveau suivant" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-valuetext="' + pct + ' % vers « ' + e(p.nextTitle || 'niveau suivant') + ' »"><i style="--v:' + pct + '"></i></div>' +
        '<p class="pt-prog__meta">' + e(span) + ' · encore ' + e(p.remaining) + ' XP pour « ' + e(p.nextTitle || 'le niveau suivant') + ' »</p>') +
      '<p class="pt-prog__msg">' + e(p.message) + '</p>';
  }

  function badgeItem(b) {
    if (b.earned) {
      return '<li class="pt-badge is-earned" tabindex="0" aria-label="Badge obtenu : ' + e(b.name) + '. ' + e(b.description) + ' Obtenu le ' + e(fmtDate(b.earnedAt)) + '.">' +
        '<span class="pt-badge__ico" aria-hidden="true">' + U.icon('check') + '</span><b>' + e(b.name) + '</b>' +
        '<small>' + e(b.description) + '</small><span class="pt-badge__date">Obtenu le ' + e(fmtDate(b.earnedAt)) + '</span></li>';
    }
    return '<li class="pt-badge is-locked" tabindex="0" aria-label="Badge verrouillé : ' + e(b.name) + '. Condition : ' + e(b.criteria) + '.">' +
      '<span class="pt-badge__ico" aria-hidden="true">' + U.icon('lock') + '</span><b>' + e(b.name) + '</b>' +
      '<small>Condition : ' + e(b.criteria) + '</small></li>';
  }

  function historyList(list) {
    if (!list || !list.length) return U.empty('Aucune activité XP pour le moment. Une présence vérifiée ou une tâche validée apparaîtra ici.');
    return '<ol class="pt-xplist">' + G.sortHistory(list).map(function (h) {
      var tone = h.xpDelta < 0 ? 'warn' : h.xpDelta > 0 ? 'ok' : 'neutral';
      return '<li class="pt-xp"><div><b>' + e(h.reason) + '</b><small>' + e(SOURCE[h.sourceType] || 'Activité') + ' · ' + e(fmtDate(h.createdAt)) + '</small></div>' +
        U.chip([signed(h.xpDelta), tone]) + '</li>';
    }).join('') + '</ol>';
  }

  function celebration(events) {
    if (!events.length) return '';
    return '<div class="pt-celebrate' + (reduced() ? '' : ' is-animated') + '" role="status" aria-live="polite">' +
      '<p class="pt-celebrate__title">Bravo !</p>' +
      events.map(function (ev) { return '<p>' + e(ev.label || G.eventLabel(ev)) + '</p>'; }).join('') + '</div>';
  }

  /* Rendu de la section (appelé par la vue Mon Profil). */
  UI.html = function (m) {
    var parts = [];
    parts.push(celebration(m.events || []));
    if (m.progressError) {
      parts.push('<section class="pt-card pt-prog" aria-labelledby="pg-title"><h2 class="pt-h3" id="pg-title">Mon parcours ICRM</h2>' +
        '<p class="pt-formerr" role="alert">' + e(m.progressError) + '</p><p class="pt-hint">Les XP et badges ne sont pas affichés tant que la lecture n’a pas réussi. Aucune valeur n’est estimée.</p></section>');
    } else if (m.progress) {
      var p = m.progress;
      parts.push('<section class="pt-card pt-prog" aria-labelledby="pg-title"><h2 class="pt-h3" id="pg-title">Mon parcours ICRM</h2>' + levelCard(p) +
        '<h3 class="pt-h4">Badges</h3><ul class="pt-badges" aria-label="Collection de badges">' + p.badges.map(badgeItem).join('') + '</ul></section>');
    }
    parts.push('<section class="pt-card pt-prog" aria-labelledby="xp-title"><h3 class="pt-h4" id="xp-title">Historique des XP</h3>' +
      (m.historyError ? '<p class="pt-formerr" role="alert">' + e(m.historyError) + '</p>' : historyList(m.history)) + '</section>');
    return parts.join('');
  };

  /* Après affichage : célébration unique (marquée vue immédiatement) ; échec d'enregistrement annoncé honnêtement. */
  UI.mount = function (root, m, api) {
    var ids = G.unseenIds(m.events || []);
    if (!ids.length) return;
    api.markProgressNotificationsSeen(ids).then(function (r) {
      if (r && r.mock) U.toast('Maquette : célébration affichée, rien n’est enregistré.');
    }, function (err) {
      U.toast((A.friendly(err) || 'Enregistrement impossible.') + ' La célébration pourra se répéter.');
    });
  };
})();
