/* =========================================================================
   ICRM — ESPACE MEMBRES · FORMULAIRES DE CRÉATION (réunion, annonce)
   Fenêtre modale native <dialog> : piège à focus, Échap et arrière-plan inerte fournis par le navigateur.
   Ce fichier ne parle JAMAIS à Supabase : tout passe par ICRMPortal.api (createMeeting, createAnnouncement,
   getCommissionOptions). La validation vient de payloads.js (la même que celle du fournisseur).
   Un succès n'est annoncé que si la base a accepté l'écriture ; en cas d'échec, les valeurs saisies sont conservées.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, A = P.auth, X = P.payloads, e = U.esc;
  var F = P.forms = {};

  var options = function (list, selected) {
    return list.map(function (o) { return '<option value="' + e(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + e(o[1]) + '</option>'; }).join('');
  };

  /* Champ avec libellé, aide et message d'erreur reliés (aria-describedby). `f.options` est du HTML déjà échappé. */
  function field(f) {
    var id = 'f-' + f.name, describedBy = (f.hint ? id + '-hint ' : '') + id + '-err';
    var attrs = ' id="' + id + '" name="' + f.name + '" aria-describedby="' + describedBy + '"' + (f.required ? ' aria-required="true"' : '');
    var ph = f.placeholder ? ' placeholder="' + e(f.placeholder) + '"' : '';
    var control = f.type === 'select' ? '<select' + attrs + '>' + f.options + '</select>'
      : f.type === 'textarea' ? '<textarea' + attrs + ph + ' rows="' + (f.rows || 4) + '" maxlength="' + f.max + '"></textarea>'
      : '<input' + attrs + ph + ' type="' + (f.type || 'text') + '"' + (f.max ? ' maxlength="' + f.max + '"' : '') + ' autocomplete="off">';
    return '<div class="pt-field" data-field="' + f.name + '"' + (f.hidden ? ' hidden' : '') + '><label for="' + id + '">' + e(f.label) +
      (f.required ? '<span class="pt-req" aria-hidden="true"> *</span>' : '') + '</label>' + control +
      (f.hint ? '<p class="pt-hint" id="' + id + '-hint">' + e(f.hint) + '</p>' : '') + '<p class="pt-fielderr" id="' + id + '-err" hidden></p></div>';
  }

  /* ---------------------------- fenêtre modale générique ---------------------------- */
  /* cfg : { eyebrow, title, intro, html, submitLabel, onOpen(form), collect(form), validate(input), submit(input) → Promise, onSuccess(res) } */
  function openDialog(cfg) {
    var opener = document.activeElement, busy = false, dlg = document.createElement('dialog');
    dlg.className = 'pt-dialog'; dlg.setAttribute('aria-labelledby', 'pt-dlg-title');
    dlg.innerHTML = '<form class="pt-dform" novalidate>' +
      '<header class="pt-dform__head"><div><p class="pt-eyebrow">' + e(cfg.eyebrow) + '</p><h2 class="pt-h3" id="pt-dlg-title">' + e(cfg.title) + '</h2></div>' +
        '<button type="button" class="pt-iconbtn" data-close aria-label="Fermer">' + U.icon('close') + '</button></header>' +
      '<div class="pt-dform__body">' + (cfg.intro ? '<p class="pt-hint">' + e(cfg.intro) + '</p>' : '') + cfg.html + '</div>' +
      '<p class="pt-formerr" role="alert" tabindex="-1" hidden></p>' +
      '<div class="pt-discard" hidden><p class="pt-discard__text"><b>Abandonner la saisie ?</b> Les informations saisies seront perdues.</p>' +
        '<div class="pt-dform__actions"><button type="button" class="pt-btn pt-btn--ghost" data-keep>Continuer la saisie</button>' +
        '<button type="button" class="pt-btn pt-btn--primary" data-discard>Abandonner</button></div></div>' +
      '<footer class="pt-dform__foot"><p class="pt-hint">* champ obligatoire</p><div class="pt-dform__actions">' +
        '<button type="button" class="pt-btn pt-btn--ghost" data-close>Annuler</button>' +
        '<button type="submit" class="pt-btn pt-btn--primary" data-submit>' + e(cfg.submitLabel) + '</button></div></footer></form>';
    document.body.appendChild(dlg);
    var form = dlg.querySelector('form'), body = form.querySelector('.pt-dform__body'), formErr = form.querySelector('.pt-formerr'), submit = form.querySelector('[data-submit]');

    function clearErrors() {
      formErr.hidden = true; formErr.textContent = '';
      form.querySelectorAll('.pt-fielderr').forEach(function (n) { n.hidden = true; n.textContent = ''; });
      form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    }
    function showErrors(errors) {
      clearErrors(); var first = null;
      Object.keys(errors).forEach(function (k) {
        if (k === '_form') { formErr.textContent = errors._form; formErr.hidden = false; return; }
        var wrap = form.querySelector('[data-field="' + k + '"]'); if (!wrap) return;
        var msg = wrap.querySelector('.pt-fielderr'), ctl = wrap.querySelector('input,select,textarea');
        msg.textContent = errors[k]; msg.hidden = false;
        if (ctl) { ctl.setAttribute('aria-invalid', 'true'); first = first || ctl; }
      });
      if (first) first.focus(); else if (!formErr.hidden) formErr.focus();
    }
    function setBusy(b) {                                     // pendant l'envoi : pas de double envoi, pas de modification
      busy = b; submit.disabled = b; submit.textContent = b ? 'Enregistrement…' : cfg.submitLabel;
      form.setAttribute('aria-busy', String(b)); body.inert = b;
    }

    dlg.addEventListener('cancel', function (ev) {                    // Échap : même protection que le bouton Annuler
      if (busy) { ev.preventDefault(); return; }
      if (cfg.isDirty && cfg.isDirty(form)) { ev.preventDefault(); discard.hidden = false; discard.querySelector('[data-keep]').focus(); }
    });
    dlg.addEventListener('close', function () { dlg.remove(); if (opener && opener.isConnected && opener.focus) opener.focus(); });
    var discard = form.querySelector('.pt-discard');
    form.addEventListener('click', function (ev) {
      if (busy) return;
      if (ev.target.closest('[data-keep]')) { discard.hidden = true; return; }
      if (ev.target.closest('[data-discard]')) { dlg.close(); return; }
      if (ev.target.closest('[data-close]')) {
        if (cfg.isDirty && cfg.isDirty(form)) { discard.hidden = false; discard.querySelector('[data-keep]').focus(); }
        else dlg.close();
      }
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy) return;                                       // double clic / double Entrée : un seul envoi
      var input = cfg.collect(form), v = cfg.validate(input);
      if (!v.ok) { showErrors(v.errors); return; }
      clearErrors(); setBusy(true);
      cfg.submit(input).then(function (res) {
        busy = false; dlg.close(); cfg.onSuccess(res);
      }, function (err) {                                      // échec : la fenêtre reste ouverte, les valeurs sont conservées
        setBusy(false);
        if (err && err.code === 'VALIDATION' && err.fields) showErrors(err.fields);
        else { formErr.textContent = err && err.coded ? err.message : A.messageFor('WRITE_FAILED').text; formErr.hidden = false; formErr.focus(); }
      });
    });

    if (cfg.onOpen) cfg.onOpen(form);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var firstControl = form.querySelector('input:not([type=hidden]),select,textarea'); if (firstControl) firstControl.focus();
    return dlg;
  }

  function lock(btn, on) { if (!btn) return; btn.disabled = on; if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy'); }
  function goTo(hash) { if (location.hash === hash) { if (P.app) P.app.refresh(); } else location.hash = hash; }   // navigation interne : relit les données, la session est conservée
  var read = function (form, n) { var el = form.elements[n]; return el ? el.value : ''; };

  /* ---------------------------- Nouvelle réunion ---------------------------- */
  F.openMeetingForm = async function (trigger) {
    if (trigger && trigger.getAttribute('aria-busy') === 'true') return;
    lock(trigger, true);
    var role = P.session.role, rules = X.meetingRules(role), loaded;
    try {
      if (!rules.allowed) throw A.coded('NOT_PERMITTED');
      loaded = await P.api.getCommissionOptions();             // commissions réelles, selon la RLS
    } catch (err) { lock(trigger, false); U.toast(A.friendly(err)); return; }
    lock(trigger, false);

    var commissions = X.allowedCommissions(role, loaded.commissions);
    if (rules.scopes.indexOf('club') < 0 && !commissions.length) { U.toast('Tu ne gères aucune commission : tu ne peux pas créer de réunion.'); return; }
    var multiScope = rules.scopes.length > 1, draftId = X.newId();     // même identifiant à chaque renvoi → aucun doublon

    var scopeHTML = multiScope
      ? field({ name: 'scope', label: 'Portée', type: 'select', required: true, options: options(X.SCOPES, 'club') })
      : '<input type="hidden" name="scope" value="commission"><p class="pt-static">Réunion de commission : tu ne peux créer que des réunions pour les commissions que tu gères.</p>';
    var commissionOptions = '<option value="">— Choisir une commission —</option>' + commissions.map(function (c) {
      return '<option value="' + e(c.id) + '"' + (commissions.length === 1 && rules.onlyManaged ? ' selected' : '') + '>' + e(c.name) + '</option>';
    }).join('');

    openDialog({
      eyebrow: 'Vie du club', title: 'Nouvelle réunion', submitLabel: 'Enregistrer la réunion',
      intro: 'Les dates et heures sont celles de Tunis.',
      html: field({ name: 'title', label: 'Titre', required: true, max: X.LIMITS.title[1] }) +
        field({ name: 'description', label: 'Description', type: 'textarea', rows: 3, max: X.LIMITS.description }) +
        '<div class="pt-dform__row">' + field({ name: 'kind', label: 'Type', type: 'select', required: true, options: options(X.KINDS, 'meeting') }) + scopeHTML + '</div>' +
        field({ name: 'commission_id', label: 'Commission', type: 'select', required: true, options: commissionOptions, hidden: multiScope }) +
        '<div class="pt-dform__row">' + field({ name: 'starts', label: 'Début', type: 'datetime-local', required: true }) +
        field({ name: 'ends', label: 'Fin (facultatif)', type: 'datetime-local' }) + '</div>' +
        field({ name: 'location', label: 'Lieu (facultatif)', max: X.LIMITS.location }),
      onOpen: function (form) {                                // la commission n'est demandée que pour une réunion de commission
        var scope = form.elements.scope, wrap = form.querySelector('[data-field="commission_id"]');
        function sync() { var on = scope.value === 'commission'; wrap.hidden = !on; if (!on) form.elements.commission_id.value = ''; }
        if (scope.tagName === 'SELECT') scope.addEventListener('change', sync);
        sync();
      },
      collect: function (form) {
        return { id: draftId, title: read(form, 'title'), description: read(form, 'description'), kind: read(form, 'kind'), scope: read(form, 'scope'),
                 commission_id: read(form, 'commission_id'), starts: read(form, 'starts'), ends: read(form, 'ends'), location: read(form, 'location') };
      },
      validate: function (input) { return X.validateMeeting(input, { role: role, uid: P.session.user.id, commissions: loaded.commissions }); },
      submit: function (input) { return P.api.createMeeting(input); },
      onSuccess: function (res) {
        U.toast(res.mock ? 'Mode maquette : réunion ajoutée en mémoire, rien n’est enregistré dans la base.' : 'Réunion enregistrée.');
        goTo('#/reunions/' + res.id);                          // affiche la nouvelle réunion (données relues)
      }
    });
  };

  /* ---------------------------- Nouvelle annonce ---------------------------- */
  F.openAnnouncementForm = async function (trigger) {
    if (trigger && trigger.getAttribute('aria-busy') === 'true') return;
    lock(trigger, true);
    var role = P.session.role, rules = X.announcementRules(role), loaded;
    try {
      if (!rules.allowed) throw A.coded('NOT_PERMITTED');
      loaded = await P.api.getCommissionOptions();
    } catch (err) { lock(trigger, false); U.toast(A.friendly(err)); return; }
    lock(trigger, false);

    var draftId = X.newId();
    var commissionOptions = '<option value="">— Choisir une commission —</option>' + loaded.commissions.map(function (c) { return '<option value="' + e(c.id) + '">' + e(c.name) + '</option>'; }).join('');
    openDialog({
      eyebrow: 'Communication officielle', title: 'Nouvelle annonce', submitLabel: 'Publier l’annonce',
      intro: 'L’annonce est publiée dès l’enregistrement.',
      html: field({ name: 'title', label: 'Titre', required: true, max: X.LIMITS.title[1] }) +
        field({ name: 'content', label: 'Contenu', type: 'textarea', rows: 6, required: true, max: X.LIMITS.content[1], hint: 'Sépare les paragraphes par une ligne vide.' }) +
        field({ name: 'audience', label: 'Public', type: 'select', required: true, options: options(X.AUDIENCES, 'all_members') }) +
        field({ name: 'commission_id', label: 'Commission', type: 'select', required: true, options: commissionOptions, hidden: true }),
      onOpen: function (form) {
        var audience = form.elements.audience, wrap = form.querySelector('[data-field="commission_id"]');
        function sync() { var on = audience.value === 'commission'; wrap.hidden = !on; if (!on) form.elements.commission_id.value = ''; }
        audience.addEventListener('change', sync); sync();
      },
      collect: function (form) { return { id: draftId, title: read(form, 'title'), content: read(form, 'content'), audience: read(form, 'audience'), commission_id: read(form, 'commission_id') }; },
      validate: function (input) { return X.validateAnnouncement(input, { role: role, uid: P.session.user.id, commissions: loaded.commissions }); },
      submit: function (input) { return P.api.createAnnouncement(input); },
      onSuccess: function (res) {
        U.toast(res.mock ? 'Mode maquette : annonce ajoutée en mémoire, rien n’est enregistré dans la base.' : 'Annonce publiée.');
        goTo('#/annonces/' + res.id);
      }
    });
  };

  /* ==================== PROPOSITION D'ACTION (depuis la carte d'une commission) ==================== */
  F.openProposalForm = function (trigger, commission, myCommissionIds) {
    var X2 = X, L = X2.PROPOSAL_LIMITS, draftId = X2.newId() || null;
    var snapshot = function (form) { return { t: read(form, 'title'), d: read(form, 'description'), o: read(form, 'objective') }; };
    var initial = null;
    openDialog({
      eyebrow: 'Ma commission · ' + commission.name, title: 'Proposer une action', submitLabel: 'Envoyer la proposition',
      intro: 'Ta proposition sera transmise à la boîte de réception des deux responsables de la commission.',
      html: '<div class="pt-field"><span class="pt-label-static">Commission concernée</span><p class="pt-static">' + e(commission.name) + '</p></div>' +
        field({ name: 'title', label: 'Titre de l’action', required: true, max: L.title[1], placeholder: 'Ex. : Journée de sensibilisation à l’environnement', hint: L.title[0] + ' à ' + L.title[1] + ' caractères.' }) +
        field({ name: 'description', label: 'Description de l’idée', type: 'textarea', rows: 6, required: true, max: L.description[1],
                placeholder: 'Présente ton idée, son déroulement, les activités envisagées et les personnes concernées.', hint: 'Entre ' + L.description[0] + ' et ' + L.description[1] + ' caractères.' }) +
        field({ name: 'objective', label: 'Objectif attendu (facultatif)', type: 'textarea', rows: 3, max: L.objective,
                placeholder: 'Quel impact souhaites-tu avoir grâce à cette action ?' }),
      onOpen: function (form) { initial = snapshot(form); },
      isDirty: function (form) { var c = snapshot(form); return c.t !== initial.t || c.d !== initial.d || c.o !== initial.o; },
      collect: function (form) { return { title: read(form, 'title'), description: read(form, 'description'), objective: read(form, 'objective'), commission_id: commission.id }; },
      validate: function (input) { return X2.validateProposal(input, { myCommissionIds: myCommissionIds || [] }); },
      submit: function (input) { return P.api.createActionProposal(input); },
      onSuccess: function (res) {
        U.toast((res.mock ? 'Maquette : proposition ajoutée en mémoire seulement. ' : 'Proposition envoyée. ') + 'Référence ' + res.reference + '.');
        if (P.app) P.app.refresh();
      }
    });
  };

  /* ==================== REVUE : changement de statut + note ==================== */
  F.openReviewForm = function (proposal) {
    var options = X.PROPOSAL_STATUS.filter(function (x) { return X.canTransition(proposal.status, x[0]); });
    if (!options.length) { U.toast('Cette proposition est terminée : son statut ne peut plus changer.'); return; }
    var initial = null;
    openDialog({
      eyebrow: 'Boîte de réception · ' + proposal.commissionName, title: 'Décision sur « ' + proposal.title + ' »', submitLabel: 'Enregistrer la décision',
      intro: 'Statut actuel : ' + proposal.statusLabel + '. Les décisions « Révision demandée » et « Non retenue » exigent une note.',
      html: field({ name: 'status', label: 'Nouveau statut', type: 'select', required: true, options: options.map(function (o) { return '<option value="' + e(o[0]) + '">' + e(o[1]) + '</option>'; }).join('') }) +
        field({ name: 'note', label: 'Note de révision', type: 'textarea', rows: 4, max: 2000, hint: 'Visible par la personne qui a fait la proposition.' }),
      onOpen: function (form) { initial = read(form, 'status') + '|' + read(form, 'note'); },
      isDirty: function (form) { return (read(form, 'status') + '|' + read(form, 'note')) !== initial && read(form, 'note') !== ''; },
      collect: function (form) { return { status: read(form, 'status'), note: read(form, 'note') }; },
      validate: function (input) { return X.validateReview(input, proposal.status); },
      submit: function (input) { return P.api.updateProposalReview(proposal.id, input, proposal.status); },
      onSuccess: function () { U.toast('Décision enregistrée.'); if (P.app) P.app.refresh(); }
    });
  };

  /* ==================== CONFIRMATION DE SUPPRESSION ====================
     Rien n'est envoyé avant « Confirmer ». Annuler ne fait aucune requête. Pendant l'envoi : bouton désactivé,
     double envoi impossible. Échec : la fenêtre reste ouverte avec le message, et « Réessayer » est possible. */
  F.openDeleteConfirm = function (opener, cfg) {
    var busy = false, dlg = document.createElement('dialog');
    dlg.className = 'pt-dialog'; dlg.setAttribute('aria-labelledby', 'pt-del-title'); dlg.setAttribute('aria-describedby', 'pt-del-text');
    dlg.innerHTML = '<div class="pt-dform"><header class="pt-dform__head"><div><p class="pt-eyebrow">' + e(cfg.eyebrow) + '</p>' +
      '<h2 class="pt-h3" id="pt-del-title">' + e(cfg.heading) + '</h2></div></header>' +
      '<div class="pt-dform__body"><p id="pt-del-text">Vous êtes sur le point de supprimer « ' + e(cfg.name) + ' ». Cette action peut être irréversible.</p>' +
      '<p class="pt-hint">' + e(cfg.note || '') + '</p></div>' +
      '<p class="pt-formerr" role="alert" tabindex="-1" hidden></p>' +
      '<footer class="pt-dform__foot"><span></span><div class="pt-dform__actions">' +
      '<button type="button" class="pt-btn pt-btn--ghost" data-cancel>Annuler</button>' +
      '<button type="button" class="pt-btn pt-btn--danger" data-confirm>Confirmer la suppression</button></div></footer></div>';
    document.body.appendChild(dlg);
    var err = dlg.querySelector('.pt-formerr'), btnOk = dlg.querySelector('[data-confirm]'), btnNo = dlg.querySelector('[data-cancel]');
    function setBusy(b) { busy = b; btnOk.disabled = b; btnNo.disabled = b; btnOk.textContent = b ? 'Suppression…' : 'Confirmer la suppression'; dlg.setAttribute('aria-busy', String(b)); }
    dlg.addEventListener('cancel', function (ev) { if (busy) ev.preventDefault(); });
    dlg.addEventListener('close', function () { dlg.remove(); if (opener && opener.isConnected) opener.focus(); });
    btnNo.addEventListener('click', function () { if (!busy) dlg.close(); });
    btnOk.addEventListener('click', function () {
      if (busy) return;                                  // un seul envoi à la fois
      err.hidden = true; setBusy(true);
      cfg.run().then(function (res) {
        busy = false; dlg.close(); U.toast(res && res.mock ? 'Maquette : supprimé des données de démonstration uniquement.' : cfg.doneText);
        if (cfg.onDone) cfg.onDone(res);
      }, function (error) {
        setBusy(false); err.textContent = error && error.coded ? error.message : A.messageFor('DELETE_FAILED').text; err.hidden = false; err.focus();
      });
    });
    dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    btnNo.focus();
  };
})();
