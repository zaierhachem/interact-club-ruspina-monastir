/* =========================================================================
   ICRM IMPACT · LOGIQUE DE PROGRESSION (fonctions pures, aucun appel réseau)
   Miroir d'affichage de la SOURCE DE VÉRITÉ, qui est la base :
     supabase/migrations/20261012100000_member_progression.sql
   Les seuils, les règles XP et les critères de badges ci-dessous doivent rester identiques à ceux de la base ;
   tests/members-progression.test.js vérifie cette correspondance en lisant la migration.
   Le navigateur n'envoie JAMAIS de niveau ni de total d'XP : il n'affiche que ce que la base renvoie.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  var G = P.progression = {};

  /* Niveaux : cumul à vie, n'est jamais remis à zéro. */
  G.LEVELS = [
    { level: 1, title: 'Nouveau', min: 0 }, { level: 2, title: 'Participant', min: 100 }, { level: 3, title: 'Engagé', min: 250 },
    { level: 4, title: 'Actif', min: 450 }, { level: 5, title: 'Bâtisseur', min: 700 }, { level: 6, title: 'Ambassadeur', min: 1000 },
    { level: 7, title: 'Leader', min: 1400 }, { level: 8, title: 'Pilier', min: 1900 }, { level: 9, title: 'Excellence', min: 2500 },
    { level: 10, title: 'Légende Ruspina', min: 3200 }
  ];

  /* Types de réunion qui comptent pour les badges d'assiduité et le double impact (miroir de private.qualifying_meeting_kinds). */
  G.BADGE_MEETING_KINDS = ['meeting', 'event', 'training'];

  /* Règles XP v1 (affichage et documentation ; le calcul réel est dans la base). */
  G.XP_RULES = {
    attendance_present: 20, attendance_late: 10, attendance_absent: 0, attendance_excused: 0,
    task_validated: 25, proposal_accepted: 30
  };

  /* Palier courant à partir d'un total. Total négatif (corrections) → niveau 1. */
  G.levelInfo = function (xp) {
    var total = Math.max(0, Math.floor(Number(xp) || 0)), cur = G.LEVELS[0], next = null, i;
    for (i = 0; i < G.LEVELS.length; i++) { if (G.LEVELS[i].min <= total) cur = G.LEVELS[i]; }
    for (i = 0; i < G.LEVELS.length; i++) { if (G.LEVELS[i].min > cur.min) { next = G.LEVELS[i]; break; } }
    var pct = next ? Math.round(((total - cur.min) * 100) / (next.min - cur.min)) : 100;
    return { xp: total, level: cur.level, title: cur.title, currentMin: cur.min, nextMin: next ? next.min : null,
             remaining: next ? next.min - total : 0, progressPct: Math.min(100, Math.max(0, pct)), isMax: !next };
  };

  /* Types de réunion qualifiants (miroir de private.qualifying_meeting_kinds). */
  G.QUALIFYING_KINDS = ['meeting', 'event', 'training'];

  /* Critères de badges (miroir de private.evaluate_progression). stats = compteurs VÉRIFIÉS fournis par la base. */
  G.BADGE_RULES = {
    /* verifiedContributions : présences qualifiantes, tâches validées, propositions acceptées. Les AJUSTEMENTS n'y comptent pas. */
    premier_engagement: function (s) { return s.verifiedContributions > 0; },
    assidu: function (s) { return s.attendedMeetings >= 5; },
    fidele: function (s) { return s.attendedMeetings >= 10; },
    finisseur: function (s) { return s.validatedTasks >= 3; },
    force_proposition: function (s) { return s.acceptedProposals >= 1; },
    innovateur: function (s) { return s.acceptedProposals >= 3; },
    double_impact: function (s) { return s.membershipCount >= 2 && s.contributedCommissions >= 2; },
    batisseur: function (s) { return s.xp >= 700; },
    pilier_club: function (s) { return s.xp >= 1000; }
  };
  G.evaluateBadges = function (stats) {
    return Object.keys(G.BADGE_RULES).filter(function (code) { return G.BADGE_RULES[code](stats || {}); });
  };

  /* Enregistrement IDEMPOTENT d'un événement (même clé = une seule entrée). Utilisé par le fournisseur de démonstration. */
  G.recordOnce = function (entries, key, entry) {
    if (entries.some(function (e) { return e.key === key; })) return entries;
    return entries.concat([Object.assign({ key: key }, entry)]);
  };

  /* Historique : plus récent d'abord ; à date égale, par identifiant décroissant (ordre total et stable). */
  G.sortHistory = function (list) {
    return (list || []).slice().sort(function (a, b) {
      var ta = String(a.created_at || a.createdAt || ''), tb = String(b.created_at || b.createdAt || '');
      if (ta !== tb) return ta < tb ? 1 : -1;
      var ia = String(a.id || ''), ib = String(b.id || '');
      return ia < ib ? 1 : ia > ib ? -1 : 0;
    });
  };

  /* Notifications non vues : identifiants à marquer, sans doublon. */
  G.unseenIds = function (events) {
    var seen = {}, out = [];
    (events || []).forEach(function (e) { if (e && e.id && !seen[e.id]) { seen[e.id] = true; out.push(e.id); } });
    return out;
  };

  /* Libellés français des événements (niveau atteint, badge obtenu). */
  G.eventLabel = function (ev) {
    if (ev.kind === 'level') {
      var lv = G.LEVELS.filter(function (l) { return 'L' + l.level === ev.code; })[0];
      return lv ? 'Niveau ' + lv.level + ' atteint : ' + lv.title : 'Nouveau niveau atteint';
    }
    return 'Nouveau badge obtenu';
  };

  /* Message d'encouragement selon la progression (court, factuel, sans pression). */
  G.message = function (info) {
    if (info.isMax) return 'Tu as atteint le plus haut niveau. Merci pour ton engagement durable.';
    if (info.progressPct >= 80) return 'Tu es tout près du niveau suivant : encore ' + info.remaining + ' XP.';
    if (info.xp === 0) return 'Chaque présence et chaque tâche validée comptent. Ton parcours commence ici.';
    return 'Continue : il te reste ' + info.remaining + ' XP pour atteindre « ' + (G.LEVELS[info.level] || {}).title + ' ».';
  };
})();
