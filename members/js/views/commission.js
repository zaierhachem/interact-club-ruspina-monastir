/* ICRM — ESPACE MEMBRES · VUE « MA COMMISSION »
   Parcours par rôle (le rôle vient de la session issue de la base ; l'accès réel est décidé par la RLS) :
     membre        : sélection initiale de deux commissions, puis ses deux cartes + « Proposer une action »,
                     et « Mes propositions ».
     chef          : ses commissions (cartes avec les deux responsables et l'effectif), « Boîte de réception ».
     bureau/admin  : vue d'ensemble des six commissions, détail d'une commission, boîte de réception globale.
   Aucune donnée n'est affichée avant la réponse de l'API ; toute erreur est affichée sans texte technique. */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, A = P.auth, X = P.payloads, e = U.esc, V = P.views;

  var STATUS_TONE = { submitted: 'info', under_review: 'info', needs_revision: 'warn', accepted: 'ok', rejected: 'neutral' };
  var statusChip = function (p) { return U.chip([p.statusLabel || X.proposalStatusLabel(p.status), STATUS_TONE[p.status] || 'neutral']); };
  var leadLabel = function (commissionName, count) { return (count > 1 ? 'Co-chef de ' : 'Chef de ') + commissionName; };
  var when = function (ts) { return ts ? U.date.short(String(ts).slice(0, 10)) : '—'; };
  var isReviewer = function () { return P.session.role === 'bureau' || P.session.role === 'super_admin'; };
  var isSuperAdmin = function () { return P.session.role === 'super_admin'; };
  var isHeadOnly = function () { return P.session.role === 'commission_head'; };
  var tabs = function (active) {
    var list = isSuperAdmin() ? [['', 'Commissions'], ['bureau', 'Bureau exécutif'], ['chefs', 'Bureau élargi'], ['boite', 'Boîte de réception']]
      : isReviewer() ? [['', 'Commissions'], ['boite', 'Boîte de réception']]
      : isHeadOnly() ? [['', 'Ma commission'], ['boite', 'Boîte de réception']]
      : [['', 'Ma commission'], ['propositions', 'Mes propositions']];
    return '<nav class="pt-seg pt-seg--tabs" aria-label="Sections de Mon équipe et des commissions">' + list.map(function (t) {
      return '<a class="pt-seg__btn" href="#/commission' + (t[0] ? '/' + t[0] : '') + '"' + (t[0] === active ? ' aria-current="page"' : '') + '>' + e(t[1]) + '</a>';
    }).join('') + '</nav>';
  };

  /* ---------------------------- cartes de commission ---------------------------- */
  function headsList(heads, commissionName) {
    return heads.length ? '<ul class="pt-heads">' + heads.map(function (h) {
      var label = leadLabel(commissionName || 'la commission', heads.length);
      return '<li>' + U.avatar(h.name, 'sm') + '<span>' + e(h.name) + '</span>' + U.chip([label, 'info']) + '</li>';
    }).join('') + '</ul>' : '<p class="pt-hint">Aucun chef renseigné.</p>';
  }
  function commissionAnnouncements(c) {
    if (c.announcementsError) return '<p class="pt-hint" role="status">Les annonces de cette commission n’ont pas pu être chargées. Réessaie plus tard.</p>';
    var list = c.announcements || [];
    if (!list.length) return '<p class="pt-hint">Aucune annonce de commission pour le moment. Les prochaines actions partagées apparaîtront ici.</p>';
    return '<ul class="pt-commission-news__list">' + list.map(function (a) {
      var excerpt = (a.body || []).join(' ').trim();
      if (excerpt.length > 180) excerpt = excerpt.slice(0, 177) + '…';
      return '<li><a class="pt-commission-news__item" href="#/annonces/' + e(a.id) + '"><span class="pt-commission-news__meta">' + e(U.date.short(a.date)) + ' · ' + e(a.priority === 'important' ? 'Important' : 'Annonce') + '</span><b>' + e(a.title) + '</b>' + (excerpt ? '<span>' + e(excerpt) + '</span>' : '') + '</a></li>';
    }).join('') + '</ul>';
  }
  function warningFor(headCount) {
    if (headCount >= 1 && headCount <= 2) return '';
    return '<p class="pt-cwarn" role="status">' + U.icon('flag') + '<span>Configuration à vérifier : ' + headCount + ' responsable' + (headCount > 1 ? 's' : '') + '. Un responsable principal est obligatoire ; un adjoint reste facultatif.</span></p>';
  }
  function myCard(c) {
    var canPropose = P.can('proposals:create');
    var leaderCount = (c.heads || []).length;
    var membersHtml = '<ul class="pt-people pt-people--compact">' + (c.members || []).map(function (m) {
      var isLead = m.position === 'responsable';
      return '<li>' + U.avatar(m.name, 'sm') + '<span>' + e(m.name) + '</span>' + (isLead ? U.chip([leadLabel(c.name, leaderCount), 'info']) : '') + '</li>';
    }).join('') + '</ul>';
    return '<article class="pt-ccard" aria-labelledby="cc-' + e(c.id) + '">' +
      '<header class="pt-ccard__head"><div><p class="pt-eyebrow">Commission</p><h2 class="pt-h3" id="cc-' + e(c.id) + '">' + e(c.name) + '</h2></div>' +
      (c.myPosition === 'responsable' ? U.chip([leaderCount > 1 ? 'Tu es co-chef' : 'Tu es chef', 'info']) : '') + '</header>' +
      (c.description ? '<p class="pt-ccard__desc">' + e(c.description) + '</p>' : '') +
      (isReviewer() || c.warning ? warningFor(c.headCount) : '') +
      '<h3 class="pt-h4">Membres (' + (c.members || []).length + ')</h3>' + (c.rosterError ? '<p class="pt-hint">La liste des membres n’a pas pu être chargée. Réessaie plus tard.</p>' : membersHtml) +
      '<section class="pt-commission-news" aria-label="Annonces de la commission"><h3 class="pt-h4">Actions et annonces en cours</h3><p class="pt-hint">Les dernières annonces partagées avec cette commission.</p>' + commissionAnnouncements(c) + '</section>' +
      '<h3 class="pt-h4">Équipe de pilotage</h3>' + headsList(c.heads || [], c.name) +
      (canPropose ? '<div class="pt-ccard__foot"><button type="button" class="pt-btn pt-btn--primary" data-propose="' + e(c.id) + '" data-name="' + e(c.name) + '">' + U.icon('plus') + 'Proposer une action</button></div>' : '') +
      '</article>';
  }
  function selectionScreen(catalog) {
    if (!catalog.length) return '<section class="pt-card">' + U.empty('Aucune commission n’est disponible pour le moment. Contacte le bureau exécutif.') + '</section>';
    return '<section class="pt-card pt-select" aria-labelledby="sel-title">' +
      '<header class="pt-card__head"><div><p class="pt-eyebrow">Première connexion</p><h2 class="pt-h3" id="sel-title">Choisis tes deux commissions</h2></div></header>' +
      '<p class="pt-lede">Tu fais partie de deux commissions. Choisis exactement deux commissions différentes. Ce choix est définitif : toute modification passe ensuite par le bureau exécutif.</p>' +
      '<form id="selForm" novalidate>' +
        '<fieldset class="pt-choices"><legend class="pt-sr">Commissions disponibles</legend>' +
        catalog.map(function (c) {
          return '<label class="pt-choice"><input type="checkbox" name="commission" value="' + e(c.id) + '"><span class="pt-choice__box" aria-hidden="true">' + U.icon('check') + '</span>' +
            '<span class="pt-choice__text"><b>' + e(c.name) + '</b><small>' + e(c.description || 'Description à venir') + '</small></span></label>';
        }).join('') + '</fieldset>' +
        '<p class="pt-choice-count" id="selCount" aria-live="polite">0 sur 2 choisie</p>' +
        '<p class="pt-formerr" id="selErr" role="alert" tabindex="-1" hidden></p>' +
        '<div class="pt-form__actions"><button type="submit" class="pt-btn pt-btn--primary" id="selSubmit" disabled>Confirmer mes deux commissions</button></div>' +
      '</form></section>';
  }

  /* ---------------------------- vue d'ensemble / détail (bureau, admin) ---------------------------- */
  function overviewGrid(list) {
    if (!list.length) return U.empty('Aucune commission active.');
    return '<div class="pt-ccards">' + list.map(function (c) {
      return '<article class="pt-ccard" aria-labelledby="ov-' + e(c.id) + '"><header class="pt-ccard__head"><div><p class="pt-eyebrow">' + c.memberCount + ' membre' + (c.memberCount > 1 ? 's' : '') + '</p>' +
        '<h2 class="pt-h3" id="ov-' + e(c.id) + '">' + e(c.name) + '</h2></div></header>' +
        (c.description ? '<p class="pt-ccard__desc">' + e(c.description) + '</p>' : '') + warningFor(c.headCount) +
        '<h3 class="pt-h4">Responsables</h3>' + (c.heads.length ? '<ul class="pt-heads">' + c.heads.map(function (h) {
          var name = typeof h === 'string' ? h : (h.name || h.full_name || 'Responsable');
          var rank = typeof h === 'string' ? null : (Number(h.rank || h.leadership_rank) || null);
          var roleChip = rank ? U.chip([leadLabel(c.name, c.heads.length || c.headCount || 1), 'info']) : '';
          return '<li>' + U.avatar(name, 'sm') + '<span>' + e(name) + '</span>' + roleChip + '</li>';
        }).join('') + '</ul>' : '<p class="pt-hint">Aucun responsable renseigné.</p>') +
        '<div class="pt-ccard__foot"><a class="pt-link" href="#/commission/c/' + e(c.id) + '">Voir le détail ' + U.icon('right') + '</a></div></article>';
    }).join('') + '</div>';
  }
  function rosterTable(members, commissionName) {
    var leadCount = (members || []).filter(function (m) { return m.position === 'responsable'; }).length;
    if (!members.length) return U.empty('Aucun membre enregistré dans cette commission.');
    return '<div class="pt-tablecard"><table class="pt-table"><thead><tr><th scope="col">Membre</th><th scope="col">Fonction</th><th scope="col">Statut</th></tr></thead><tbody>' +
      members.map(function (m) {
        return '<tr><th scope="row" data-label="Membre"><span class="pt-person">' + U.avatar(m.name, 'sm') + e(m.name) + '</span></th>' +
          '<td data-label="Fonction">' + (m.position === 'responsable' ? U.chip([leadLabel(commissionName || 'la commission', leadCount), 'info']) : U.chip(['Membre', 'neutral'])) + '</td>' +
          '<td data-label="Statut">' + (m.status ? U.statusChip('memberStatus', m.status) : '<span class="pt-hint">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------------------------- boîte de réception ---------------------------- */
  function inboxList(list, scope) {
    if (!list.length) return U.empty(scope ? 'Aucune proposition pour cette commission pour le moment.' : 'Aucune proposition pour le moment.');
    return '<ul class="pt-inbox">' + list.map(function (p) {
      var last = p.history.length ? p.history[p.history.length - 1] : null;
      return '<li class="pt-prop"><article aria-labelledby="pr-' + e(p.id) + '">' +
        '<header class="pt-prop__head"><div><p class="pt-eyebrow">' + e(p.reference) + ' · ' + e(p.commissionName) + '</p>' +
        '<h3 class="pt-h3" id="pr-' + e(p.id) + '">' + e(p.title) + '</h3>' +
        '<p class="pt-hint">Par ' + e(p.proposerName) + ' · soumise le ' + e(when(p.createdAt)) + '</p></div>' + statusChip(p) + '</header>' +
        '<details class="pt-prop__more"><summary>Voir la proposition et l’historique</summary>' +
          '<h4 class="pt-h4">Description</h4><p class="pt-prop__text">' + e(p.description) + '</p>' +
          (p.objective ? '<h4 class="pt-h4">Objectif attendu</h4><p class="pt-prop__text">' + e(p.objective) + '</p>' : '') +
          '<h4 class="pt-h4">Historique</h4>' + (p.history.length ? '<ol class="pt-hist">' + p.history.map(function (h) {
            return '<li><b>' + e(X.proposalStatusLabel(h.to)) + '</b> — ' + e(h.reviewer) + ', le ' + e(when(h.at)) + (h.note ? '<span class="pt-hist__note">« ' + e(h.note) + ' »</span>' : '') + '</li>';
          }).join('') + '</ol>' : '<p class="pt-hint">Aucune revue pour l’instant.</p>') +
        '</details>' +
        (last && last.note ? '<p class="pt-prop__last">Dernière note : « ' + e(last.note) + ' »</p>' : '') +
        (p.canReview && p.status !== 'accepted' && p.status !== 'rejected' ?
          '<div class="pt-prop__actions"><button type="button" class="pt-btn pt-btn--ghost" data-review="' + e(p.id) + '">Décider</button></div>' : '') +
        (p.canDelete && P.can('proposals:delete') ?
          '<div class="pt-prop__actions"><button type="button" class="pt-btn pt-btn--danger pt-btn--sm" data-delete-proposal="' + e(p.id) + '" data-title="' + e(p.title) + '">' + U.icon('close') + 'Supprimer</button></div>' : '') +
        '</article></li>';
    }).join('') + '</ul>';
  }
  function proposalSummary(list) {
    var counts = { submitted: 0, under_review: 0, needs_revision: 0, accepted: 0, rejected: 0 };
    (list || []).forEach(function (p) { if (Object.prototype.hasOwnProperty.call(counts, p.status)) counts[p.status]++; });
    return '<section class="pt-card pt-proposal-summary"><p class="pt-eyebrow">VUE DE SUIVI</p><h2 class="pt-h3">État des propositions</h2><p class="pt-hint">Consultation uniquement : le Super Admin suit les statuts sans prendre la décision à la place du Bureau ou des chefs de commission.</p><div class="pt-proposal-summary__grid">' +
      [['submitted','Soumises'],['under_review','En discussion'],['needs_revision','À revoir'],['accepted','Acceptées'],['rejected','Refusées']].map(function (row) {
        return '<div class="pt-proposal-summary__item"><span>' + e(row[1]) + '</span><b>' + counts[row[0]] + '</b></div>';
      }).join('') + '</div></section>';
  }
  function myProposals(list) {
    if (!list.length) return U.empty('Tu n’as pas encore proposé d’action. Ouvre « Ma commission » et utilise « Proposer une action ».');
    return '<ul class="pt-inbox">' + list.map(function (p) {
      return '<li class="pt-prop"><article aria-labelledby="mp-' + e(p.id) + '"><header class="pt-prop__head"><div><p class="pt-eyebrow">' + e(p.reference) + ' · ' + e(p.commissionName) + '</p>' +
        '<h3 class="pt-h3" id="mp-' + e(p.id) + '">' + e(p.title) + '</h3><p class="pt-hint">Soumise le ' + e(when(p.createdAt)) + (p.reviewedAt ? ' · dernière revue le ' + e(when(p.reviewedAt)) : '') + '</p></div>' +
        U.chip([p.statusLabel, STATUS_TONE[p.status] || 'neutral']) + '</header>' +
        (p.status === 'needs_revision' && p.reviewerNotes ? '<p class="pt-prop__last">Note du responsable : « ' + e(p.reviewerNotes) + ' »</p>' : '') +
        '</article></li>';
    }).join('') + '</ul>';
  }

  /* ============================ VUE ============================ */
  V.commission = {
    title: 'Ma Commission',
    load: function (api, ctx) {
      var tab = ctx.params[0] || '', role = P.session.role;
      V.commission.title = tab === 'bureau' ? 'Bureau exécutif' : tab === 'chefs' ? 'Bureau élargi' : (isReviewer() ? 'Mon équipe' : 'Ma Commission');
      if (tab === 'propositions') return api.getMyActionProposals().then(function (r) { return { kind: 'proposals', list: r.proposals }; });
      if (tab === 'boite') {
        var only = ctx.params[1] || null;
        return api.getInboxProposals(only).then(function (r) { return { kind: 'inbox', list: r.proposals, scope: only }; });
      }
      if (tab === 'bureau' || tab === 'chefs') {
        if (!isSuperAdmin()) return Promise.resolve({ kind: 'forbidden' });
        return api.getAdminTeamWorkspace().then(function (workspace) {
          return { kind: tab === 'bureau' ? 'admin-bureau' : 'admin-heads', workspace: workspace };
        });
      }
      if (isReviewer()) {
        if (ctx.params[0] === 'c' && ctx.params[1]) {
          return Promise.all([api.getCommissionOverview(), api.getCommissionDirectory(ctx.params[1])]).then(function (rs) {
            var com = rs[0].commissions.filter(function (c) { return c.id === ctx.params[1]; })[0];
            return { kind: 'detail', commission: com || null, members: rs[1].members };
          });
        }
        return api.getCommissionOverview().then(function (r) { return { kind: 'overview', list: r.commissions }; });
      }
      return api.getMyCommissions().then(function (my) {
        /* La sélection initiale ne concerne QUE les membres ; un chef sans affectation reçoit un message, pas le formulaire. */
        if (my.state === 'none' && role === 'member') return api.getCommissionCatalog().then(function (c) { return { kind: 'select', catalog: c.commissions, my: my }; });
        return { kind: 'mine', my: my };
      });
    },
    render: function (d, ctx) {
      var tab = ctx.params[0] || '';
      var isAdminScreen = d.kind === 'admin-bureau' || d.kind === 'admin-heads';
      var title = isReviewer() ? 'Mon équipe' : 'Ma Commission';
      var head = isAdminScreen
        ? U.pageHead('ADMINISTRATION DU CLUB', d.kind === 'admin-bureau' ? 'Bureau exécutif' : 'Bureau élargi',
            d.kind === 'admin-bureau' ? 'Gère les fonctions du Bureau. Chaque sauvegarde ou suppression est synchronisée automatiquement avec le site public.' : 'Désigne le responsable principal obligatoire et, si besoin, son adjoint pour chaque commission.',
            null)
        : d.kind === 'forbidden'
          ? U.pageHead('ACCÈS RESTREINT', 'Fonction réservée', 'La gestion de la composition du Bureau exécutif et du Bureau élargi est accessible uniquement au Super Admin.')
          : U.pageHead(isReviewer() ? 'Pilotage du club' : 'Ma commission', title,
            d.kind === 'select' ? 'Première connexion : choisis tes commissions.' : null);
      var body = '';
      if (d.kind === 'admin-bureau') body = P.teamAdmin.renderBureau(d.workspace);
      else if (d.kind === 'admin-heads') body = P.teamAdmin.renderHeads(d.workspace);
      else if (d.kind === 'forbidden') body = '<section class="pt-card"><p>Cette page est réservée au Super Admin.</p><p><a class="pt-btn pt-btn--ghost" href="#/commission">Retour aux commissions</a></p></section>';
      else if (d.kind === 'select') body = selectionScreen(d.catalog);
      else if (d.kind === 'mine') {
        if (!d.my.cards.length) body = '<section class="pt-card">' + U.empty('Aucune commission ne t’est affectée pour le moment. Contacte le bureau exécutif.') + '</section>';
        else body = (d.my.state === 'incomplete' ? '<p class="pt-cwarn" role="status">' + U.icon('flag') + '<span>Ton affectation est incomplète (' + d.my.cards.length + ' commission' + (d.my.cards.length > 1 ? 's' : '') + ' au lieu de 2). Contacte le bureau exécutif pour la compléter.</span></p>' : '') +
          '<div class="pt-ccards">' + d.my.cards.map(function (c) { return myCard(c); }).join('') + '</div>';
      }
      else if (d.kind === 'overview') body = overviewGrid(d.list);
      else if (d.kind === 'detail') {
        if (!d.commission) body = '<section class="pt-card">' + U.empty('Cette commission n’existe pas ou n’est plus active.') + '</section>';
        else body = '<section class="pt-card pt-card--head"><p class="pt-eyebrow">' + d.commission.memberCount + ' membres</p><h2 class="pt-h2">' + e(d.commission.name) + '</h2>' +
          (d.commission.description ? '<p class="pt-lede">' + e(d.commission.description) + '</p>' : '') + warningFor(d.commission.headCount) +
          '<h3 class="pt-h4">Effectif</h3>' + rosterTable(d.members, d.commission.name) + '<div class="pt-ccard__foot"><a class="pt-link" href="#/commission/boite/' + e(d.commission.id) + '">Propositions de cette commission ' + U.icon('right') + '</a></div></section>';
      }
      else if (d.kind === 'inbox') body = (isSuperAdmin() ? proposalSummary(d.list) : '') + inboxList(d.list, d.scope);
      else if (d.kind === 'proposals') body = myProposals(d.list);
      var back = d.kind === 'detail' ? '<p><a class="pt-back" href="#/commission">' + U.icon('back') + 'Toutes les commissions</a></p>' : '';
      var activeTab = d.kind === 'inbox' ? 'boite' : d.kind === 'proposals' ? 'propositions' : tab;
      return head + tabs(activeTab) + back + body;
    },
    mount: function (root, d) {
      if (d.kind === 'admin-bureau' || d.kind === 'admin-heads') {
        P.teamAdmin.mount(root, d.workspace, d.kind === 'admin-bureau' ? 'bureau' : 'chefs');
        return;
      }
      root.querySelectorAll('[data-propose]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var ids = (d.my && d.my.cards || []).map(function (c) { return c.id; });
          P.forms.openProposalForm(btn, { id: btn.dataset.propose, name: btn.dataset.name }, ids);
        });
      });
      root.querySelectorAll('[data-review]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = d.list.filter(function (x) { return x.id === btn.dataset.review; })[0];
          if (p) P.forms.openReviewForm(p);
        });
      });
      root.querySelectorAll('[data-delete-proposal]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var proposal = (d.list || []).filter(function (item) { return item.id === btn.dataset.deleteProposal; })[0];
          if (!proposal || proposal.canDelete !== true || P.session.role !== 'super_admin' || !P.can('proposals:delete')) return;
          P.forms.openDeleteConfirm(btn, {
            eyebrow: 'Administration · propositions',
            heading: 'Supprimer cette proposition ?',
            name: proposal.title,
            note: 'Elle disparaîtra de la boîte de réception et de « Mes propositions » pour tous les comptes. La trace de suppression et les écritures XP déjà comptabilisées restent protégées pour préserver l’audit.',
            run: function () { return P.api.deleteActionProposal(proposal.id); },
            doneText: 'La proposition a été retirée de toutes les vues du portail.',
            onDone: function () { if (P.app) P.app.refresh(); }
          });
        });
      });
      var form = root.querySelector('#selForm');
      if (!form) return;
      var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name=commission]'));
      var count = root.querySelector('#selCount'), submit = root.querySelector('#selSubmit'), err = root.querySelector('#selErr');
      var chosen = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
      var sync = function () {
        var n = chosen().length;
        count.textContent = n + ' sur 2 choisie' + (n > 1 ? 's' : '');
        boxes.forEach(function (b) { b.disabled = !b.checked && n >= 2; });
        submit.disabled = n !== 2;
      };
      boxes.forEach(function (b) { b.addEventListener('change', sync); });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (submit.disabled || form.getAttribute('aria-busy') === 'true') return;   // pas de double envoi
        err.hidden = true; form.setAttribute('aria-busy', 'true'); submit.disabled = true; submit.textContent = 'Enregistrement…';
        boxes.forEach(function (b) { b.disabled = true; });
        P.api.selectMyCommissions(chosen()).then(function (res) {
          U.toast(res.mock ? 'Maquette : commissions choisies en mémoire seulement, rien n’est enregistré dans la base.' : 'Tes deux commissions sont enregistrées.');
          if (P.app) P.app.refresh();
        }, function (error) {
          form.removeAttribute('aria-busy'); submit.textContent = 'Confirmer mes deux commissions'; boxes.forEach(function (b) { b.disabled = false; }); sync();
          err.textContent = error && error.fields && error.fields._form ? error.fields._form : (error && error.coded ? error.message : A.messageFor('WRITE_FAILED').text);
          err.hidden = false; err.focus();
        });
      });
      sync();
    }
  };
})();
