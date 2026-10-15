/* ICRM — ESPACE MEMBRES · VUES : Calendrier, Réunions, Tâches */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views, T = U.META;

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
  function meetingDetail(m, no) {
    no = no || {};                                               // no.agenda / no.notes / no.decisions / no.tasks : colonnes absentes de la base
    var parts = m.participants.length
      ? '<ul class="pt-people">' + m.participants.map(function (p) { return '<li>' + U.avatar(p[0], 'sm') + '<span>' + e(p[0]) + '</span>' + U.statusChip('attendance', p[1]) + '</li>'; }).join('') + '</ul>'
      : U.empty('Liste des participants à venir.');
    var sec = function (title, body) { return '<section class="pt-block"><h3 class="pt-h4">' + e(title) + '</h3>' + body + '</section>'; };
    return '<article class="pt-card pt-detail" aria-labelledby="pt-md-title">' +
      '<a class="pt-back" href="#/reunions">' + U.icon('back') + 'Toutes les réunions</a>' +
      '<p class="pt-eyebrow">' + e(m.commission) + '</p><h2 class="pt-h2 pt-h2--dark" id="pt-md-title" tabindex="-1">' + e(m.title) + '</h2>' +
      '<ul class="pt-meta"><li>' + U.icon('calendar') + '<span>' + e(U.date.full(m.date)) + '</span></li><li>' + U.icon('clock') + '<span>' + e(m.start) + ' – ' + e(m.end) + '</span></li><li>' + U.icon('pin') + '<span>' + e(m.location) + '</span></li></ul>' +
      sec('Participants & présence', parts) +
      sec('Ordre du jour', no.agenda ? U.unavailable('L’ordre du jour') : m.agenda.length ? '<ol class="pt-ol">' + m.agenda.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ol>' : U.empty('Aucun ordre du jour enregistré.')) +
      sec('Notes', no.notes ? U.unavailable('Les notes') : m.notes ? '<p>' + e(m.notes) + '</p>' : U.empty('Les notes seront ajoutées après la réunion.')) +
      sec('Décisions', no.decisions ? U.unavailable('Les décisions') : m.decisions.length ? '<ul class="pt-ul">' + m.decisions.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ul>' : U.empty('Aucune décision enregistrée.')) +
      sec('Tâches issues de la réunion', no.tasks ? U.unavailable('Le lien entre réunions et tâches') : m.tasks.length ? '<ul class="pt-ul">' + m.tasks.map(function (a) { return '<li>' + e(a) + '</li>'; }).join('') + '</ul>' : U.empty('Aucune tâche liée.')) +
      '</article>';
  }
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
          '<div class="pt-split__detail">' + (sel ? meetingDetail(sel, d.unsupported) : '<div class="pt-card pt-detail pt-detail--empty">' + U.icon('message') + '<p>Sélectionne une réunion pour voir son ordre du jour, ses participants et ses décisions.</p></div>') + '</div>' +
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
      list();
    }
  };

  /* ============================ TÂCHES ============================ */
  var COLS = [['pending', 'À faire'], ['in_progress', 'En cours'], ['completed', 'Terminées']];
  V.taches = {
    title: 'Mes Tâches',
    load: function (api) { return api.getTasks(); },
    render: function (d) {
      var action = P.can('tasks:create') ? '<button type="button" class="pt-btn pt-btn--primary" data-soon>' + U.icon('plus') + 'Nouvelle tâche</button>' : '';
      return U.pageHead('Organisation', 'Mes tâches', 'Suis l’avancement de tes tâches et de celles de ta commission.', action) +
        '<div class="pt-toolbar"><div class="pt-seg" role="group" aria-label="Périmètre">' +
          '<button type="button" class="pt-seg__btn" data-scope="mine" aria-pressed="true">Mes tâches</button>' +
          '<button type="button" class="pt-seg__btn" data-scope="all" aria-pressed="false">Toute la commission</button></div></div>' +
        '<div class="pt-seg pt-seg--cols" role="group" aria-label="Statut affiché">' +
          COLS.map(function (c, i) { return '<button type="button" class="pt-seg__btn" data-col="' + c[0] + '" aria-pressed="' + (i === 0) + '">' + c[1] + ' <span data-count="' + c[0] + '"></span></button>'; }).join('') + '</div>' +
        '<div class="pt-board" id="board" data-active="pending"></div>';
    },
    mount: function (root, d) {
      var scope = 'mine', board = root.querySelector('#board');
      function card(t) {
        var late = t.status !== 'completed' && t.deadline < d.today;
        return '<li class="pt-task pt-task--' + e(t.priority) + '"><div class="pt-task__top">' + U.statusChip('priority', t.priority) + (late ? U.chip(['En retard', 'warn']) : '') + '</div>' +
          '<h4 class="pt-task__title">' + e(t.title) + '</h4><p class="pt-task__desc">' + e(t.description) + '</p>' +
          '<div class="pt-task__foot"><span class="pt-task__who">' + U.avatar(t.assignee, 'sm') + e(t.assignee) + '</span><span class="pt-task__due">' + U.icon('flag') + '<span class="pt-sr">Échéance : </span>' + e(U.date.short(t.deadline)) + '</span></div>' +
          '<p class="pt-task__com">' + e(t.commission) + '</p>' +
          (t.status === 'completed' && P.can('tasks:validate') && t.assigneeId !== d.meId ?
            '<div class="pt-task__actions"><button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-validate-task="' + e(t.id) + '">' + U.icon('check') + 'Valider la tâche (+25 XP)</button></div>' : '') +
          '</li>';
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
      var soon = root.querySelector('[data-soon]'); if (soon) soon.addEventListener('click', U.soon);
      /* Validation : la base décide ; en cas d'échec, rien n'est affiché comme réussi. */
      board.addEventListener('click', function (ev) {
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
