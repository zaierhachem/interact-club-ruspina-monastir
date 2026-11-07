/* ICRM — ESPACE MEMBRES · VUES : Calendrier, Réunions, Tâches */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views, T = U.META;

  /* Affichage robuste pour les rôles connus ; la vraie autorisation reste imposée par les RPC SQL. */
  function canManageAttendance() {
    var role = String(P.session && P.session.role || '').toLowerCase();
    return P.can('attendance:manage') || role === 'bureau' || role === 'super_admin';
  }

  var eventCard = function (ev) {
    var t = T.eventType[ev.type] || T.eventType.other;
    return '<li class="pt-event pt-event--' + e(t[1]) + '"><span class="pt-event__date" aria-hidden="true"><b>' + e(U.date.day(ev.date)) + '</b>' + e(U.date.short(ev.date).replace(/^\d+\s/, '')) + '</span>' +
      '<span class="pt-event__body"><span class="pt-event__type"><i></i>' + e(t[0]) + '</span><b>' + e(ev.title) + '</b>' +
      '<small>' + e(U.date.weekday(ev.date)) + ' · ' + e(ev.time) + (ev.location ? ' · ' + e(ev.location) : '') + '</small></span></li>';
  };

  /* ============================ CALENDRIER ============================ */
  V.calendrier = {
    title: 'Calendrier',
    load: function (api) { return api.getCalendar(); },
    render: function (d) {
      var legend = Object.keys(T.eventType).map(function (k) {
        return '<li class="pt-legend__item pt-event--' + T.eventType[k][1] + '"><i></i>' + e(T.eventType[k][0]) + '</li>';
      }).join('');
      return U.pageHead('Planning du club', 'Calendrier', 'Réunions, événements, formations et échéances au même endroit.') +
        '<div class="pt-calwrap">' +
          '<section class="pt-card pt-cal" aria-labelledby="pt-cal-title">' +
            '<header class="pt-cal__head"><h2 class="pt-h3" id="pt-cal-title" aria-live="polite"></h2>' +
              '<div class="pt-cal__nav"><button type="button" class="pt-iconbtn" data-cal="-1" aria-label="Mois précédent">' + U.icon('left') + '</button>' +
              '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-cal="0">Aujourd’hui</button>' +
              '<button type="button" class="pt-iconbtn" data-cal="1" aria-label="Mois suivant">' + U.icon('right') + '</button></div></header>' +
            '<div class="pt-cal__grid" id="calGrid"></div>' +
            '<ul class="pt-legend" aria-label="Légende des types d’événements">' + legend + '</ul>' +
          '</section>' +
          '<div class="pt-calside">' +
            '<section class="pt-card" aria-labelledby="pt-day-title"><header class="pt-card__head"><h2 class="pt-h3" id="pt-day-title">Jour sélectionné</h2></header><div id="calDay"></div></section>' +
            '<section class="pt-card" aria-labelledby="pt-up-title"><header class="pt-card__head"><h2 class="pt-h3" id="pt-up-title">À venir</h2></header><ul class="pt-events" id="calUpcoming"></ul></section>' +
          '</div>' +
        '</div>';
    },
    mount: function (root, d) {
      var t0 = U.date.parse(d.today), st = { y: t0.getFullYear(), m: t0.getMonth(), sel: d.today };
      var byDate = {}; d.events.forEach(function (ev) { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });
      var DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

      function draw() {
        root.querySelector('#pt-cal-title').textContent = U.date.month(st.y, st.m);
        var first = (new Date(st.y, st.m, 1).getDay() + 6) % 7, days = new Date(st.y, st.m + 1, 0).getDate(), cells = '', n = 0;
        for (var i = 0; i < first; i++) cells += '<td class="pt-day-empty"></td>';
        for (var day = 1; day <= days; day++) {
          var key = U.date.key(st.y, st.m, day), evs = byDate[key] || [], pressed = key === st.sel;
          var dots = evs.slice(0, 3).map(function (ev) { return '<i class="pt-event--' + (T.eventType[ev.type] || T.eventType.other)[1] + '"></i>'; }).join('');
          cells += '<td><button type="button" class="pt-day' + (key === d.today ? ' is-today' : '') + '" data-date="' + key + '" aria-pressed="' + pressed + '" aria-label="' +
            e(U.date.full(key)) + ', ' + (evs.length ? evs.length + (evs.length > 1 ? ' événements' : ' événement') : 'aucun événement') + (key === d.today ? ', aujourd’hui' : '') + '"><span>' + day + '</span><span class="pt-dots">' + dots + '</span></button></td>';
          n = first + day; if (n % 7 === 0 && day < days) cells += '</tr><tr>';
        }
        while (n % 7 !== 0) { cells += '<td class="pt-day-empty"></td>'; n++; }
        root.querySelector('#calGrid').innerHTML = '<table class="pt-cal__table"><caption class="pt-sr">' + e(U.date.month(st.y, st.m)) + '</caption><thead><tr>' +
          DOW.map(function (w) { return '<th scope="col">' + w + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + cells + '</tr></tbody></table>';
        drawDay();
      }
      function drawDay() {
        var evs = byDate[st.sel] || [];
        root.querySelector('#calDay').innerHTML = '<p class="pt-daylabel">' + e(U.date.full(st.sel)) + '</p>' +
          (evs.length ? '<ul class="pt-events">' + evs.map(eventCard).join('') + '</ul>' : U.empty('Aucun événement ce jour.'));
      }
      root.querySelector('#calUpcoming').innerHTML = d.events.filter(function (ev) { return ev.date >= d.today; })
        .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).slice(0, 5).map(eventCard).join('');

      root.addEventListener('click', function (ev) {
        var nav = ev.target.closest('[data-cal]'), day = ev.target.closest('[data-date]');
        if (nav) {
          var v = +nav.dataset.cal;
          if (v === 0) { st.y = t0.getFullYear(); st.m = t0.getMonth(); st.sel = d.today; }
          else { var nd = new Date(st.y, st.m + v, 1); st.y = nd.getFullYear(); st.m = nd.getMonth(); }
          draw();
        } else if (day) {
          st.sel = day.dataset.date; draw();
          var again = root.querySelector('[data-date="' + st.sel + '"]'); if (again) again.focus();  /* garde le focus clavier après le rendu */
        }
      });
      draw();
    }
  };

  /* ============================ RÉUNIONS ============================ */
   /* ============================ SONDAGES ============================ */
  function pollSection(m, polls, available) {
    var role = String(P.session && (P.session.role || (P.session.user && P.session.user.role)) || '').toLowerCase();
    /* UI affordance only: every create/read/vote is still authorized by Supabase RPC/RLS. */
    var canCreate = P.can('meetings:create') || role === 'bureau' || role === 'super_admin' || role === 'commission_head';
    var isAvailable = available !== false;
    var createButton = canCreate
      ? '<div class="pt-polls__create"><button type="button" class="pt-btn pt-btn--primary pt-btn--sm" data-create-poll="' + e(m.id) + '" data-meeting-title="' + e(m.title) + '"' + (isAvailable ? '' : ' disabled aria-disabled="true" title="Le service de sondage doit être activé côté Supabase."') + '>' + U.icon('plus') + 'Créer un sondage</button></div>'
      : '';
    var availabilityNotice = !isAvailable
      ? '<div class="pt-poll__availability" role="alert"><b>Sondages non disponibles pour le moment</b><p>L’interface est chargée, mais Supabase ne répond pas à la fonction get_meeting_polls. Vérifie que la migration 20261029190000_meeting_polls_voting est appliquée au bon projet et que le déploiement utilise cette version des fichiers.</p></div>'
      : '';
    var body = !isAvailable ? '' : (polls.length ? polls.map(function (p) {
      var open = p.status === 'open', voted = !!p.my_option_id, reveal = !!p.results_visible;
      var total = Number(p.total_votes) || 0, options = p.options || [];
      var voteChoices = options.map(function (o) {
        return '<label class="pt-poll__choice"><input type="radio" name="poll-option-' + e(p.id) + '" value="' + e(o.id) + '"' + (!open ? ' disabled' : '') + (String(p.my_option_id || '') === String(o.id) ? ' checked' : '') + '><span>' + e(o.label) + '</span></label>';
      }).join('');
      var resultChoices = options.map(function (o) {
        var count = o.vote_count == null ? 0 : Number(o.vote_count) || 0;
        var pct = reveal && total > 0 ? Math.round(count * 100 / total) : 0;
        return '<div class="pt-poll__choice pt-poll__choice--result"><div class="pt-poll__resultline"><span>' + e(o.label) + '</span><b>' + count + ' · ' + pct + '%</b></div><div class="pt-poll__bar" aria-label="' + pct + ' %"><span style="width:' + pct + '%"></span></div></div>';
      }).join('');
      var status = open ? '<span class="pt-poll__status">Vote ouvert</span>' : '<span class="pt-poll__status pt-poll__status--closed">Clôturé</span>';
      var results = reveal
        ? '<p class="pt-poll__muted">' + total + ' vote' + (total > 1 ? 's' : '') + ' enregistré' + (total > 1 ? 's' : '') + ' · ' + (open ? 'résultats actualisés' : 'résultats définitifs') + '</p><div class="pt-poll__results" aria-label="Résultats agrégés">' + resultChoices + '</div>'
        : '<p class="pt-poll__muted">Les résultats s’affichent après ton vote ou à la clôture du sondage.</p>';
      var voting = open
        ? '<fieldset class="pt-poll__choices"><legend>' + (voted ? 'Ton choix actuel — tu peux encore le modifier' : 'Choisis une réponse') + '</legend>' + voteChoices + '</fieldset>' +
          '<div class="pt-poll__actions"><button type="button" class="pt-btn pt-btn--primary pt-btn--sm" data-vote-poll="' + e(p.id) + '">' + U.icon('check') + (voted ? 'Mettre à jour mon vote' : 'Voter') + '</button>' +
          (p.can_manage ? '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-close-poll="' + e(p.id) + '">Clôturer le sondage</button>' : '') + '</div>'
        : '';
      return '<article class="pt-poll" data-poll-card="' + e(p.id) + '"><header class="pt-poll__head"><h4 class="pt-poll__question">' + e(p.question) + '</h4>' + status + '</header>' +
        (p.description ? '<p class="pt-poll__description">' + e(p.description) + '</p>' : '') + results + voting + '</article>';
    }).join('') : U.empty('Aucun sondage pour cette activité.'));
    return '<div data-poll-feature-version="20261029202000">' + createButton + availabilityNotice +
      (isAvailable ? '<p class="pt-polls__intro">Vote en un clic. Un seul choix courant par membre ; tu peux le modifier tant que le sondage reste ouvert. Les résultats sont visibles après ton vote ou à la clôture.</p>' : '') + body + '</div>';
  }
  function meetingDetail(m, no, polls, pollsAvailable) {
    no = no || {};                                               // no.agenda / no.notes / no.decisions / no.tasks : colonnes absentes de la base
    var parts = m.participants.length
      ? '<ul class="pt-people">' + m.participants.map(function (p) { return '<li>' + U.avatar(p[0], 'sm') + '<span>' + e(p[0]) + '</span>' + U.statusChip('attendance', p[1]) + '</li>'; }).join('') + '</ul>'
      : U.empty('Liste des participants à venir.');
    var sec = function (title, body) { return '<section class="pt-block"><h3 class="pt-h4">' + e(title) + '</h3>' + body + '</section>'; };
    var pollsBody = pollSection(m, polls || [], pollsAvailable !== false);
    var rollCall = canManageAttendance() ? sec('Feuille de présence', '<div id="rollCallRoot" class="pt-rollcall" data-meeting-id="' + e(m.id) + '"><p class="pt-hint" role="status">Chargement de la liste des membres…</p></div>') : '';
    var minutesActions = m.canEditMinutes ? '<div class="pt-meeting-minutes-actions"><button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-edit-meeting-minutes="' + e(m.id) + '">Modifier le compte rendu</button>' + (P.can('tasks:create') ? '<button type="button" class="pt-btn pt-btn--primary pt-btn--sm" data-new-task-for-meeting="' + e(m.id) + '">Créer une tâche issue de cette réunion</button>' : '') + '</div>' : '';
    return '<article class="pt-card pt-detail" aria-labelledby="pt-md-title">' +
      '<a class="pt-back" href="#/reunions">' + U.icon('back') + 'Toutes les réunions</a>' +
      '<p class="pt-eyebrow">' + e(m.commission) + '</p><h2 class="pt-h2 pt-h2--dark" id="pt-md-title" tabindex="-1">' + e(m.title) + '</h2>' +
      '<ul class="pt-meta"><li>' + U.icon('calendar') + '<span>' + e(U.date.full(m.date)) + '</span></li><li>' + U.icon('clock') + '<span>' + e(m.start) + ' – ' + e(m.end) + '</span></li><li>' + U.icon('pin') + '<span>' + e(m.location) + '</span></li></ul>' +
      minutesActions +
      sec('Description', m.description ? '<p class="pt-poll-meeting-description">' + e(m.description) + '</p>' : U.empty('Aucune description enregistrée.')) +
      sec('Sondages & votes', pollsBody) +
      sec('Participants & présence', parts) +
      rollCall +
      sec('Ordre du jour', no.agenda ? U.unavailable('L’ordre du jour') : m.agenda.length ? '<ol class="pt-ol">' + m.agenda.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ol>' : U.empty('Aucun point de l’ordre du jour enregistré pour le moment.')) +
      sec('Notes', no.notes ? U.unavailable('Les notes') : m.notes ? '<p>' + e(m.notes) + '</p>' : U.empty('Aucune note enregistrée pour le moment.')) +
      sec('Décisions', no.decisions ? U.unavailable('Les décisions') : m.decisions.length ? '<ul class="pt-ul">' + m.decisions.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ul>' : U.empty('Aucune décision enregistrée pour le moment.')) +
      sec('Tâches issues de la réunion', no.tasks ? U.unavailable('Le lien entre réunions et tâches') : m.tasks.length ? '<ul class="pt-ul">' + m.tasks.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ul>' : U.empty('Aucune tâche issue de cette réunion pour le moment.')) +
      '</article>';
  }
  function mountRollCall(root, meetingId) {
    var host = root.querySelector('#rollCallRoot');
    if (!host) return;
    var data = null, loading = false;
    function timeLabel(ts) {
      if (!ts) return '';
      try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
      catch (_) { return String(ts); }
    }
    function chip(status) {
      if (!status) return U.chip(['À pointer', 'neutral']);
      var labels = { present: ['Présent · +20 XP', 'ok'], late: ['En retard · +10 XP', 'info'], absent: ['Absent · 0 XP', 'warn'], excused: ['Excusé · 0 XP', 'neutral'] };
      return U.chip(labels[status] || ['Statut inconnu', 'neutral']);
    }
    function render() {
      if (!data) return;
      var members = data.members || [];
      var counts = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 };
      members.forEach(function (m) { var s = m.attendanceStatus; if (s && counts[s] !== undefined) counts[s]++; else counts.pending++; });
      var timing = data.openedAt
        ? '<p class="pt-rollcall__timing">Appel démarré à <b>' + e(timeLabel(data.openedAt)) + '</b>. Les pointages à partir de <b>' + e(timeLabel(data.lateAfterAt)) + '</b> sont classés « En retard » automatiquement.</p>'
        : '<p class="pt-rollcall__timing">Le délai de 30 minutes démarre au premier membre marqué présent. L’heure est enregistrée par Supabase.</p>';
      var closed = data.closedAt ? '<p class="pt-rollcall__closed" role="status">Feuille clôturée le ' + e(timeLabel(data.closedAt)) + '. Les corrections restent possibles par le Bureau exécutif ou le Super Admin.</p>' : '';
      var rows = members.map(function (m) {
        var status = m.attendanceStatus, checked = status === 'present' || status === 'late';
        var profile = m.status === 'follow_up' ? '<small class="pt-rollcall__meta">Profil à suivre</small>' : '';
        var excuseAction = status === 'excused'
          ? '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-roll-absent="' + e(m.id) + '">Remettre absent</button>'
          : '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-roll-excused="' + e(m.id) + '">Excuser</button>';
        return '<li class="pt-rollcall__row" data-roll-member="' + e(m.id) + '"><span class="pt-rollcall__avatar">' + U.avatar(m.fullName, 'sm') + '</span>' +
          '<span class="pt-rollcall__person"><b>' + e(m.fullName) + '</b>' + profile + '</span>' +
          '<span class="pt-rollcall__status">' + chip(status) + '</span>' +
          '<label class="pt-rollcall__check"><input type="checkbox" data-roll-present="' + e(m.id) + '"' + (checked ? ' checked' : '') + '><span>Présent</span></label>' +
          '<span class="pt-rollcall__row-action">' + excuseAction + '</span></li>';
      }).join('');
      host.innerHTML = '<div class="pt-rollcall__head"><div><p class="pt-eyebrow">POINTAGE OFFICIEL</p><h3 class="pt-h4">' + e(data.title || 'Réunion / événement') + '</h3></div>' +
        '<span class="pt-chip">' + members.length + ' membres</span></div>' + timing + closed +
        '<div class="pt-rollcall__counts"><span>Présents <b>' + counts.present + '</b></span><span>En retard <b>' + counts.late + '</b></span><span>Absents <b>' + counts.absent + '</b></span><span>Excusés <b>' + counts.excused + '</b></span><span>À pointer <b>' + counts.pending + '</b></span></div>' +
        '<p class="pt-hint">Les cases non cochées sont converties en « Absent » à la clôture. Utilise « Excuser » pour préserver explicitement une absence excusée.</p>' +
        (rows ? '<ul class="pt-rollcall__list">' + rows + '</ul>' : U.empty('Aucun membre reçu de Supabase. Réunion club : vérifie que les profils ont status active/follow_up. Réunion de commission : vérifie aussi la commission affectée et les appartenances dans commission_members.')) +
        '<div class="pt-rollcall__footer"><button type="button" class="pt-btn pt-btn--primary" data-roll-finalize' + (members.length && !data.closedAt ? '' : ' disabled') + '>' + U.icon('check') + (data.closedAt ? 'Feuille déjà clôturée' : 'Clôturer l’appel et marquer les non pointés absents') + '</button>' +
        '<button type="button" class="pt-btn pt-btn--ghost" data-roll-reload>Actualiser la liste</button></div>';
    }
    function refresh() {
      loading = true; host.setAttribute('aria-busy', 'true');
      P.api.getMeetingRollCall(meetingId).then(function (result) {
        data = result; loading = false; host.removeAttribute('aria-busy'); render();
      }).catch(function (err) {
        loading = false; host.removeAttribute('aria-busy');
        host.innerHTML = '<p class="pt-formerr" role="alert">' + e(P.auth.friendly(err) || 'Impossible de charger la feuille de présence.') + '</p><button type="button" class="pt-btn pt-btn--ghost" data-roll-reload>Réessayer</button>';
      });
    }
    function writeStatus(memberId, status, row) {
      if (loading) return;
      loading = true;
      if (row) { row.setAttribute('aria-busy', 'true'); row.querySelectorAll('button,input').forEach(function (el) { el.disabled = true; }); }
      P.api.setMeetingAttendance(meetingId, memberId, status).then(function (result) {
        U.toast(result.status === 'present' ? 'Présence enregistrée : +20 XP.' : result.status === 'late' ? 'Retard enregistré : +10 XP.' : 'Statut enregistré ; le journal XP est réconcilié par Supabase.');
        refresh();
      }).catch(function (err) {
        loading = false;
        U.toast(P.auth.friendly(err) || 'Le statut de présence n’a pas été enregistré.');
        refresh();
      });
    }
    host.addEventListener('change', function (ev) {
      var box = ev.target.closest('[data-roll-present]');
      if (!box) return;
      var id = box.dataset.rollPresent, row = box.closest('[data-roll-member]');
      var old = data && data.members.filter(function (m) { return String(m.id) === String(id); })[0];
      if (!box.checked && old && (old.attendanceStatus === 'present' || old.attendanceStatus === 'late') &&
          !window.confirm('Retirer la présence ? Le système enregistrera la correction XP correspondante dans l’historique.')) {
        box.checked = true; return;
      }
      writeStatus(id, box.checked ? 'present' : 'absent', row);
    });
    host.addEventListener('click', function (ev) {
      var retry = ev.target.closest('[data-roll-reload]');
      if (retry) { refresh(); return; }
      var excused = ev.target.closest('[data-roll-excused]');
      if (excused) {
        var exId = excused.dataset.rollExcused, exRow = excused.closest('[data-roll-member]');
        var item = data && data.members.filter(function (m) { return String(m.id) === String(exId); })[0];
        if (item && (item.attendanceStatus === 'present' || item.attendanceStatus === 'late') &&
            !window.confirm('Marquer ce membre excusé ? Les XP gagnés par la présence seront corrigés dans l’historique.')) return;
        writeStatus(exId, 'excused', exRow); return;
      }
      var absent = ev.target.closest('[data-roll-absent]');
      if (absent) { writeStatus(absent.dataset.rollAbsent, 'absent', absent.closest('[data-roll-member]')); return; }
      var finalize = ev.target.closest('[data-roll-finalize]');
      if (finalize) {
        if (loading || !window.confirm('Clôturer la feuille ? Tous les membres sans statut seront enregistrés absents. Les présences, retards et excuses déjà pointés seront conservés.')) return;
        loading = true; finalize.disabled = true;
        P.api.finalizeMeetingRollCall(meetingId).then(function (result) {
          data = result; U.toast('Feuille clôturée : les membres non pointés sont absents.'); refresh();
        }).catch(function (err) {
          loading = false; U.toast(P.auth.friendly(err) || 'Impossible de clôturer la feuille.'); refresh();
        });
      }
    });
    refresh();
  }

  /* ICRM meeting minutes + announcement audience — 20261029230000 */
  V.reunions = {
    title: 'Réunions',
    load: function (api) { return api.getMeetings(); },
    render: function (d, ctx) {
      var sel = ctx.params[0] ? d.meetings.filter(function (m) { return m.id === ctx.params[0]; })[0] : null;
      var action = P.can('meetings:create') ? '<button type="button" class="pt-btn pt-btn--primary" data-new-meeting>' + U.icon('plus') + 'Nouvelle réunion</button>' : '';
      if (sel && P.can('meetings:delete')) action += '<button type="button" class="pt-btn pt-btn--danger" data-delete-meeting="' + e(sel.id) + '" data-title="' + e(sel.title) + '">' + U.icon('close') + 'Supprimer</button>';
      var tab = sel && sel.status === 'past' ? 'past' : 'upcoming';
      return U.pageHead('Vie du club', 'Réunions', 'Ordre du jour, présence, décisions et tâches : tout est rattaché à la réunion.', action) +
        '<div class="pt-split' + (sel ? ' is-detail' : '') + '">' +
          '<section class="pt-split__list" aria-label="Liste des réunions">' +
            '<div class="pt-seg" role="group" aria-label="Filtrer les réunions">' +
              '<button type="button" class="pt-seg__btn" data-tab="upcoming" aria-pressed="' + (tab === 'upcoming') + '">À venir</button>' +
              '<button type="button" class="pt-seg__btn" data-tab="past" aria-pressed="' + (tab === 'past') + '">Passées</button></div>' +
            '<ul class="pt-mlist" id="mList"></ul></section>' +
          '<div class="pt-split__detail">' + (sel ? meetingDetail(sel, d.unsupported, (d.polls || []).filter(function (p) { return String(p.meeting_id) === String(sel.id); }), d.pollsAvailable) : '<div class="pt-card pt-detail pt-detail--empty">' + U.icon('message') + '<p>Sélectionne une réunion pour voir son ordre du jour, ses participants et ses décisions.</p></div>') + '</div>' +
        '</div>';
    },
    mount: function (root, d, ctx) {
      var current = root.querySelector('[data-tab][aria-pressed="true"]').dataset.tab;
      function list() {
        var items = d.meetings.filter(function (m) { return m.status === current; })
          .sort(function (a, b) { return current === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date); });
        root.querySelector('#mList').innerHTML = items.map(function (m) {
          var on = ctx.params[0] === m.id;
          return '<li><a class="pt-mitem' + (on ? ' is-on' : '') + '" href="#/reunions/' + e(m.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<span class="pt-mitem__date" aria-hidden="true"><b>' + e(U.date.day(m.date)) + '</b>' + e(U.date.monthName(m.date).slice(0, 4)) + '.</span>' +
            '<span class="pt-mitem__body"><b>' + e(m.title) + '</b><small>' + e(m.start) + ' · ' + e(m.location) + '</small></span></a></li>';
        }).join('') || '<li>' + U.empty('Aucune réunion.') + '</li>';
      }
      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          current = b.dataset.tab;
          root.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
          list();
        });
      });
      var dm = root.querySelector('[data-delete-meeting]');
      if (dm) dm.addEventListener('click', function () {
        P.forms.openDeleteConfirm(dm, { eyebrow: 'Vie du club', heading: 'Supprimer cette réunion ?', name: dm.dataset.title,
          note: 'La suppression est tracée dans le journal du club. Une réunion qui a encore des présences enregistrées ne peut pas être supprimée. Les tâches liées à cette réunion sont conservées et ne sont plus rattachées à une réunion.',
          run: function () { return P.api.deleteMeeting(dm.dataset.deleteMeeting); },
          doneText: 'Réunion supprimée.', onDone: function () { if (location.hash === '#/reunions') P.app.refresh(); else location.hash = '#/reunions'; } });
      });
      var nm = root.querySelector('[data-new-meeting]');
      if (nm) nm.addEventListener('click', function () { P.forms.openMeetingForm(nm); });
      /* ICRM meeting polls click actions — 20261029165000 */
      function handleMeetingPollClick(ev) {
        var target = ev.target;
        if (!target || typeof target.closest !== 'function') return;

        var createBtn = target.closest('[data-create-poll]');
        if (createBtn && root.contains(createBtn)) {
          ev.preventDefault();
          if (createBtn.disabled) return;
          if (!P.forms || typeof P.forms.openMeetingPollForm !== 'function') {
            U.toast('Le formulaire de sondage n’est pas chargé. Recharge la page ; si le problème persiste, vérifie le déploiement.');
            return;
          }
          try {
            P.forms.openMeetingPollForm(createBtn, {
              id: createBtn.getAttribute('data-create-poll'),
              title: createBtn.getAttribute('data-meeting-title') || ''
            });
          } catch (err) {
            if (window.console && console.error) console.error('[ICRM polls] ouverture du formulaire impossible', err);
            U.toast('Impossible d’ouvrir le formulaire du sondage. Recharge la page et réessaie.');
          }
          return;
        }

        var voteBtn = target.closest('[data-vote-poll]');
        if (voteBtn && root.contains(voteBtn)) {
          ev.preventDefault();
          if (voteBtn.disabled) return;
          var card = voteBtn.closest('[data-poll-card]');
          var selected = card && card.querySelector('input[type="radio"]:checked');
          if (!selected) { U.toast('Choisis une réponse avant de voter.'); return; }
          if (!P.api || typeof P.api.voteMeetingPoll !== 'function') {
            U.toast('Le service de vote n’est pas chargé. Recharge la page.');
            return;
          }
          voteBtn.disabled = true;
          Promise.resolve().then(function () { return P.api.voteMeetingPoll(voteBtn.getAttribute('data-vote-poll'), selected.value); }).then(function (res) {
            U.toast(res && res.mock ? 'Maquette : vote conservé en mémoire uniquement.' : 'Ton vote a été enregistré.');
            if (P.app) P.app.refresh();
          }).catch(function (err) {
            voteBtn.disabled = false;
            U.toast(P.auth && P.auth.friendly ? P.auth.friendly(err) : (err && err.message) || 'Le vote n’a pas été enregistré.');
          });
          return;
        }

        var closeBtn = target.closest('[data-close-poll]');
        if (closeBtn && root.contains(closeBtn)) {
          ev.preventDefault();
          if (closeBtn.disabled || !window.confirm('Clôturer ce sondage ? Les membres ne pourront plus voter.')) return;
          if (!P.api || typeof P.api.closeMeetingPoll !== 'function') {
            U.toast('Le service de sondage n’est pas chargé. Recharge la page.');
            return;
          }
          closeBtn.disabled = true;
          Promise.resolve().then(function () { return P.api.closeMeetingPoll(closeBtn.getAttribute('data-close-poll'), true); }).then(function () {
            U.toast('Sondage clôturé.');
            if (P.app) P.app.refresh();
          }).catch(function (err) {
            closeBtn.disabled = false;
            U.toast(P.auth && P.auth.friendly ? P.auth.friendly(err) : (err && err.message) || 'Le sondage n’a pas pu être clôturé.');
          });
        }
      }
      root.addEventListener('click', handleMeetingPollClick);
      var minutesBtn = root.querySelector('[data-edit-meeting-minutes]');
      if (minutesBtn) minutesBtn.addEventListener('click', function () {
        var targetMeeting = d.meetings.filter(function (m) { return String(m.id) === String(minutesBtn.getAttribute('data-edit-meeting-minutes')); })[0];
        if (!targetMeeting || !targetMeeting.canEditMinutes) { U.toast('Tu n’as pas les droits pour modifier ce compte rendu.'); return; }
        if (!P.forms || typeof P.forms.openMeetingMinutesForm !== 'function') { U.toast('Le formulaire du compte rendu n’est pas chargé. Recharge la page.'); return; }
        P.forms.openMeetingMinutesForm(minutesBtn, targetMeeting);
      });
      var taskFromMeetingBtn = root.querySelector('[data-new-task-for-meeting]');
      if (taskFromMeetingBtn) taskFromMeetingBtn.addEventListener('click', function () {
        var sourceMeeting = d.meetings.filter(function (m) { return String(m.id) === String(taskFromMeetingBtn.getAttribute('data-new-task-for-meeting')); })[0];
        if (!sourceMeeting || !sourceMeeting.canEditMinutes || !P.can('tasks:create')) { U.toast('Tu n’as pas les droits pour créer une tâche depuis cette réunion.'); return; }
        P.forms.openTaskForm(taskFromMeetingBtn, sourceMeeting);
      });
      list();
      var selectedMeeting = ctx.params[0] ? d.meetings.filter(function (m) { return String(m.id) === String(ctx.params[0]); })[0] : null;
      if (selectedMeeting && canManageAttendance()) mountRollCall(root, selectedMeeting.id);
    }
  };

  /* ============================ TÂCHES ============================ */
  var COLS = [['pending', 'À faire'], ['in_progress', 'En cours'], ['completed', 'Terminées']];
  V.taches = {
    title: 'Mes Tâches',
    load: function (api) { return api.getTasks(); },
    render: function (d) {
      var action = P.can('tasks:create') ? '<button type="button" class="pt-btn pt-btn--primary" data-new-task>' + U.icon('plus') + 'Nouvelle tâche</button>' : '';
      var allScopeLabel = P.session && (P.session.role === 'bureau' || P.session.role === 'super_admin') ? 'Toutes les tâches' : 'Toute la commission';
      var pendingPolls = d.pendingPolls || [];
      var pollTasksHTML = pendingPolls.length ? '<section class="pt-card pt-poll-tasks" aria-labelledby="pt-pending-polls"><header class="pt-card__head"><h2 class="pt-h3" id="pt-pending-polls">Sondages à compléter</h2><span class="pt-poll__status">' + pendingPolls.length + ' à voter</span></header><ul class="pt-poll-tasks__list">' + pendingPolls.map(function (p) { return '<li class="pt-poll-tasks__item"><span class="pt-eyebrow">Vote requis</span><b>' + e(p.title) + '</b><small>' + e(p.meetingTitle || 'Activité') + (p.deadline ? ' · ' + e(U.date.short(p.deadline)) : '') + '</small><a class="pt-btn pt-btn--primary pt-btn--sm" href="#/reunions/' + e(p.meetingId) + '">Ouvrir et voter ' + U.icon('right') + '</a></li>'; }).join('') + '</ul></section>' : (d.pollsAvailable === false ? '<p class="pt-hint">Sondages indisponibles : la migration Supabase est à appliquer.</p>' : '');
      return U.pageHead('Organisation', 'Mes tâches', 'Suis l’avancement de tes tâches et de celles de ta commission.', action) + pollTasksHTML +
        '<div class="pt-toolbar"><div class="pt-seg" role="group" aria-label="Périmètre">' +
          '<button type="button" class="pt-seg__btn" data-scope="mine" aria-pressed="' + (!P.can('tasks:create')) + '">Mes tâches</button>' +
          '<button type="button" class="pt-seg__btn" data-scope="all" aria-pressed="' + P.can('tasks:create') + '">' + e(allScopeLabel) + '</button></div></div>' +
        '<div class="pt-seg pt-seg--cols" role="group" aria-label="Statut affiché">' +
          COLS.map(function (c, i) { return '<button type="button" class="pt-seg__btn" data-col="' + c[0] + '" aria-pressed="' + (i === 0) + '">' + c[1] + ' <span data-count="' + c[0] + '"></span></button>'; }).join('') + '</div>' +
        '<div class="pt-board" id="board" data-active="pending"></div>';
    },
    mount: function (root, d) {
      var scope = P.can('tasks:create') ? 'all' : 'mine', board = root.querySelector('#board');
      function card(t) {
        var late = t.status !== 'completed' && !!t.deadline && t.deadline < d.today;
        var workflow = '';
        if (String(t.assigneeId || '') === String(d.meId || '') && t.status !== 'completed') {
          var sid = 'task-status-' + String(t.id).replace(/[^a-zA-Z0-9_-]/g, '');
          workflow = '<details class="pt-task__workflow"><summary>Mettre à jour mon avancement</summary>' +
            '<label for="' + e(sid) + '">Statut</label><select id="' + e(sid) + '" data-task-status-select="' + e(t.id) + '">' +
            COLS.map(function (c) { return '<option value="' + c[0] + '"' + (t.status === c[0] ? ' selected' : '') + '>' + e(c[1]) + '</option>'; }).join('') + '</select>' +
            '<label for="task-note-' + e(String(t.id).replace(/[^a-zA-Z0-9_-]/g, '')) + '">Note d’avancement (facultative)</label>' +
            '<textarea id="task-note-' + e(String(t.id).replace(/[^a-zA-Z0-9_-]/g, '')) + '" rows="2" maxlength="1000" data-task-progress-note="' + e(t.id) + '" placeholder="Ex. : contact pris, en attente de réponse…">' + e(t.progressNote || '') + '</textarea>' +
            '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-save-task-status="' + e(t.id) + '">Enregistrer l’avancement</button></details>';
        }
        var waiting = t.status === 'completed' && !t.validated && String(t.assigneeId || '') === String(d.meId || '')
          ? '<p class="pt-task__waiting" role="status">Terminée : en attente de validation pour attribuer +25 XP.</p>' : '';
        var deleteAction = P.can('tasks:delete')
          ? '<div class="pt-task__admin"><button type="button" class="pt-btn pt-btn--danger pt-btn--sm" data-delete-task="' + e(t.id) + '" data-title="' + e(t.title) + '">' + U.icon('close') + 'Supprimer</button></div>' : '';
        return '<li class="pt-task pt-task--' + e(t.priority) + '"><div class="pt-task__top">' + U.statusChip('priority', t.priority) + (late ? U.chip(['En retard', 'warn']) : '') +
          (t.status === 'completed' ? U.chip([t.validated ? 'Validée · +25 XP' : 'En attente de validation', t.validated ? 'ok' : 'warn']) : '') + '</div>' +
          '<h4 class="pt-task__title">' + e(t.title) + '</h4><p class="pt-task__desc">' + e(t.description) + '</p>' +
          (t.progressNote ? '<p class="pt-task__progress-note"><b>Avancement :</b> ' + e(t.progressNote) + '</p>' : '') +
          '<div class="pt-task__foot"><span class="pt-task__who">' + U.avatar(t.assignee, 'sm') + e(t.assignee) + '</span><span class="pt-task__due">' + U.icon('flag') + '<span class="pt-sr">Échéance : </span>' + e(t.deadline ? U.date.short(t.deadline) : 'Sans échéance') + '</span></div>' +
          '<p class="pt-task__com">' + e(t.commission) + '</p>' + workflow + waiting +
          (t.status === 'completed' && !t.validated && P.can('tasks:validate') && t.assigneeId !== d.meId ?
            '<div class="pt-task__actions"><button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-validate-task="' + e(t.id) + '">' + U.icon('check') + 'Valider la tâche (+25 XP)</button></div>' : '') +
          deleteAction + '</li>';
      }
      function draw() {
        var tasks = d.tasks.filter(function (t) { return scope === 'all' || t.assignee === d.me; });
        board.innerHTML = COLS.map(function (c) {
          var items = tasks.filter(function (t) { return t.status === c[0]; });
          root.querySelector('[data-count="' + c[0] + '"]').textContent = '(' + items.length + ')';
          return '<section class="pt-col pt-col--' + c[0] + '" data-status="' + c[0] + '" aria-labelledby="col-' + c[0] + '"><h3 class="pt-col__title" id="col-' + c[0] + '"><i></i>' + c[1] + '<span>' + items.length + '</span></h3>' +
            (items.length ? '<ul class="pt-col__list">' + items.map(card).join('') + '</ul>' : U.empty('Aucune tâche.')) + '</section>';
        }).join('');
      }
      root.querySelectorAll('[data-scope]').forEach(function (b) {
        b.addEventListener('click', function () { scope = b.dataset.scope; root.querySelectorAll('[data-scope]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(); });
      });
      root.querySelectorAll('[data-col]').forEach(function (b) {
        b.addEventListener('click', function () { board.dataset.active = b.dataset.col; root.querySelectorAll('[data-col]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); });
      });
      var newTask = root.querySelector('[data-new-task]'); if (newTask) newTask.addEventListener('click', function () { P.forms.openTaskForm(newTask); });
      /* ICRM task lifecycle + Super Admin delete — 20261029220000 */
      board.addEventListener('click', function (ev) {
        var del = ev.target.closest('[data-delete-task]');
        if (del) {
          P.forms.openDeleteConfirm(del, {
            eyebrow: 'Administration des tâches', heading: 'Supprimer cette tâche ?', name: del.dataset.title,
            note: 'La tâche disparaîtra des vues du portail. Le journal de suppression et les XP déjà attribués sont conservés.',
            run: function () { return P.api.adminDeleteTask(del.dataset.deleteTask); },
            doneText: 'Tâche supprimée des vues du portail.', onDone: function () { if (P.app) P.app.refresh(); }
          });
          return;
        }
        var save = ev.target.closest('[data-save-task-status]');
        if (save) {
          if (save.disabled) return;
          var id = save.getAttribute('data-save-task-status');
          var statusSelect = Array.prototype.slice.call(board.querySelectorAll('[data-task-status-select]')).filter(function (x) { return x.getAttribute('data-task-status-select') === id; })[0];
          var noteField = Array.prototype.slice.call(board.querySelectorAll('[data-task-progress-note]')).filter(function (x) { return x.getAttribute('data-task-progress-note') === id; })[0];
          if (!statusSelect || !noteField) { U.toast('Le formulaire d’avancement est incomplet. Recharge la page puis réessaie.'); return; }
          save.disabled = true; statusSelect.disabled = true; noteField.disabled = true;
          P.api.updateMyTaskStatus(id, statusSelect.value, noteField.value).then(function (res) {
            if (res.mock) U.toast('Maquette : avancement modifié en mémoire seulement.');
            else if (res.status === 'completed') U.toast('Tâche marquée terminée. Un responsable doit valider la fin pour attribuer +25 XP.');
            else U.toast('Avancement enregistré.');
            if (P.app) P.app.refresh();
          }, function (err) {
            save.disabled = false; statusSelect.disabled = false; noteField.disabled = false;
            U.toast(err && err.coded ? err.message : P.auth.messageFor('WRITE_FAILED').text);
          });
          return;
        }
        var btn = ev.target.closest('[data-validate-task]'); if (!btn || btn.disabled) return;
        btn.disabled = true;
        P.api.validateTask(btn.dataset.validateTask).then(function (r) {
          U.toast(r.mock ? 'Maquette : validation non enregistrée.' : 'Tâche validée : +' + r.xp + ' XP pour son assigné.');
          if (P.app) P.app.refresh();
        }, function (err) {
          btn.disabled = false;
          U.toast(err && err.coded ? err.message : P.auth.messageFor('WRITE_FAILED').text);
        });
      });
      draw();
    }
  };
})();
