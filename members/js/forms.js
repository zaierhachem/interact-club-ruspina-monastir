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
      if (cfg.closeImmediately) { ev.preventDefault(); closePollDialogOnce(); return; }
      if (cfg.isDirty && cfg.isDirty(form)) { ev.preventDefault(); discard.hidden = false; discard.querySelector('[data-keep]').focus(); }
    });
    dlg.addEventListener('close', function () { dlg.remove(); if (opener && opener.isConnected && opener.focus) opener.focus(); });
    var discard = form.querySelector('.pt-discard');
  /* ICRM poll cancel one-click hotfix — 20261029234500 */
  var isPollDialog = cfg.closeImmediately === true || cfg.title === 'Créer un sondage';
  var pollCloseStarted = false;
  function closePollDialogOnce() {
    if (!isPollDialog || busy || pollCloseStarted) return;
    pollCloseStarted = true;
    try {
      if (typeof dlg.close === 'function' && dlg.open) { dlg.close(); return; }
    } catch (_) { /* fallback for an incomplete/native-dialog implementation */ }
    dlg.removeAttribute('open');
    if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
  }
  if (isPollDialog) {
    /* Make the intent explicit even when this hotfix meets an older poll-form implementation. */
    cfg.closeImmediately = true;
    /* Bind directly to the two real buttons. No event.target/closest delegation is needed. */
    Array.prototype.forEach.call(form.querySelectorAll('button[data-close]'), function (button) {
      button.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        closePollDialogOnce();
      }, true);
    });
    /* Escape uses the same one-shot close path and suppresses the older dirty-form prompt. */
    dlg.addEventListener('cancel', function (ev) {
      ev.preventDefault();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      closePollDialogOnce();
    }, true);
  }
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
  /* ---------------------------- compte rendu de réunion ---------------------------- */
  F.openMeetingMinutesForm = function (trigger, meeting) {
    if (!meeting || !meeting.id) { U.toast('Réunion introuvable.'); return; }
    if (!meeting.canEditMinutes) { U.toast('Tu n’as pas les droits pour modifier ce compte rendu.'); return; }
    var initial = null;
    function lines(value) { return Array.isArray(value) ? value.join('\n') : String(value || ''); }
    function snapshot(form) { return [read(form, 'agenda'), read(form, 'notes'), read(form, 'decisions')].join('\u0000'); }
    function parseLines(value) { return String(value || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
    openDialog({
      eyebrow: 'Réunion · Compte rendu', title: 'Modifier le compte rendu', submitLabel: 'Enregistrer le compte rendu',
      intro: 'Renseigne l’ordre du jour, les notes et les décisions. Les changements sont enregistrés dans la base et visibles selon les autorisations du club.',
      html: field({ name: 'agenda', label: 'Ordre du jour · un point par ligne', type: 'textarea', rows: 5, max: 10000, placeholder: 'Point 1\nPoint 2\nDivers', hint: '50 points maximum · 500 caractères par point.' }) +
        field({ name: 'notes', label: 'Notes / compte rendu', type: 'textarea', rows: 7, max: 20000, placeholder: 'Résumé des échanges, suivi et éléments importants.', hint: '20 000 caractères maximum.' }) +
        field({ name: 'decisions', label: 'Décisions · une décision par ligne', type: 'textarea', rows: 5, max: 10000, placeholder: 'Décision 1\nDécision 2', hint: '50 décisions maximum · 500 caractères par décision.' }),
      onOpen: function (form) {
        form.elements.agenda.value = lines(meeting.agenda);
        form.elements.notes.value = String(meeting.notes || '');
        form.elements.decisions.value = lines(meeting.decisions);
        initial = snapshot(form);
      },
      isDirty: function (form) { return initial !== null && snapshot(form) !== initial; },
      collect: function (form) { return { agenda: parseLines(read(form, 'agenda')), notes: read(form, 'notes').trim(), decisions: parseLines(read(form, 'decisions')) }; },
      validate: function (input) {
        var errors = {};
        [['agenda', input.agenda, 'point'], ['decisions', input.decisions, 'décision']].forEach(function (item) {
          if (item[1].length > 50) errors[item[0]] = '50 ' + item[2] + 's maximum.';
          else if (item[1].some(function (x) { return x.length > 500; })) errors[item[0]] = 'Chaque élément est limité à 500 caractères.';
        });
        if (input.notes.length > 20000) errors.notes = '20 000 caractères maximum.';
        return { ok: Object.keys(errors).length === 0, errors: errors };
      },
      submit: function (input) { return P.api.saveMeetingMinutes(meeting.id, input); },
      onSuccess: function (res) {
        U.toast(res && res.mock ? 'Maquette : compte rendu modifié en mémoire seulement.' : 'Compte rendu enregistré.');
        if (P.app) P.app.refresh();
      }
    });
  };

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

  /* ==================== NOUVELLE TÂCHE : Bureau élargi/Bureau exécutif/Super Admin ==================== */
  F.openTaskForm = async function (trigger, linkedMeeting) {
    if (trigger && trigger.getAttribute('aria-busy') === 'true') return;
    lock(trigger, true);
    var role = P.session && P.session.role, loaded, commissions, initialRoster;
    try {
      if (!X.taskRules(role)) throw A.coded('NOT_PERMITTED');
      loaded = await P.api.getCommissionOptions();
      commissions = X.allowedCommissions(role, loaded.commissions || []);
      if (linkedMeeting && linkedMeeting.scope === 'commission') commissions = commissions.filter(function (c) { return String(c.id) === String(linkedMeeting.commissionId || ''); });
      if (!commissions.length) throw A.coded('NO_COMMISSION_FOR_TASK');
      initialRoster = await P.api.getCommissionDirectory(commissions[0].id);
    } catch (err) { lock(trigger, false); U.toast(err && err.code === 'NO_COMMISSION_FOR_TASK' ? 'Aucune commission accessible pour créer une tâche.' : A.friendly(err)); return; }
    lock(trigger, false);

    var draftId = X.newId(), roster = initialRoster.members || [], mock = P.api.isMock();
    var commissionOptions = commissions.map(function (c, i) { return '<option value="' + e(c.id) + '"' + (!i ? ' selected' : '') + '>' + e(c.name) + '</option>'; }).join('');
    function eligible(list) { return (list || []).filter(function (m) { return mock ? (!m.status || ['active','watch'].indexOf(m.status) > -1) : ['active','watch'].indexOf(m.status) > -1; }); }
    function assigneeOptions(list) {
      var m = eligible(list);
      return '<option value="">— Choisir un membre actif —</option>' + m.map(function (x) { return '<option value="' + e(x.id) + '">' + e(x.name) + (x.position === 'responsable' ? ' · Responsable' : '') + '</option>'; }).join('');
    }
    openDialog({
      eyebrow: 'Organisation du club', title: 'Créer une tâche', submitLabel: 'Créer la tâche',
      intro: linkedMeeting ? 'Cette tâche sera rattachée à « ' + String(linkedMeeting.title || 'la réunion') + ' ». Elle restera liée à cette réunion après sa création.' : 'Définis un résultat concret, une personne responsable et une échéance réaliste.',
      html: (linkedMeeting ? '<input type="hidden" name="meeting_id" value="' + e(linkedMeeting.id) + '"><p class="pt-hint">Réunion d’origine : <b>' + e(linkedMeeting.title || 'Réunion') + '</b></p>' : '') + '<div class="pt-task-create-tip"><span class="pt-task-create-tip__icon">' + U.icon('check') + '</span><p><b>Une tâche claire fait avancer l’équipe.</b><small>Elle sera visible selon les droits du membre et de sa commission.</small></p></div>' +
        field({ name: 'title', label: 'Tâche à réaliser', required: true, max: 150, placeholder: 'Ex. : Contacter trois sponsors' }) +
        field({ name: 'description', label: 'Résultat attendu / consignes', type: 'textarea', rows: 3, max: 2000, placeholder: 'Décris le livrable ou les prochaines étapes.' }) +
        '<div class="pt-dform__row">' + field({ name: 'commission_id', label: 'Commission', type: 'select', required: true, options: commissionOptions }) +
        field({ name: 'assigned_to', label: 'Responsable de la tâche', type: 'select', required: true, options: assigneeOptions(roster) }) + '</div>' +
        '<div class="pt-dform__row">' + field({ name: 'priority', label: 'Priorité', type: 'select', required: true, options: options(X.TASK_PRIORITIES, 'medium') }) +
        field({ name: 'due_date', label: 'Échéance (facultative)', type: 'date' }) + '</div>',
      onOpen: function (form) {
        var com = form.elements.commission_id, assignee = form.elements.assigned_to;
        async function reloadRoster() {
          var cid = com.value;
          assignee.disabled = true; assignee.innerHTML = '<option value="">Chargement des membres…</option>';
          try {
            var data = await P.api.getCommissionDirectory(cid);
            if (com.value !== cid) return;
            roster = data.members || [];
            assignee.innerHTML = assigneeOptions(roster);
            if (eligible(roster).length) assignee.disabled = false;
            else { assignee.disabled = true; assignee.innerHTML = '<option value="">Aucun membre actif disponible</option>'; }
          } catch (err) {
            if (com.value !== cid) return;
            roster = []; assignee.innerHTML = '<option value="">Annuaire indisponible</option>'; assignee.disabled = true;
            U.toast(A.friendly(err));
          }
        }
        if (linkedMeeting && linkedMeeting.scope === 'commission') com.disabled = true;
        com.addEventListener('change', reloadRoster);
        if (eligible(roster).length) assignee.disabled = false;
        else { assignee.disabled = true; assignee.innerHTML = '<option value="">Aucun membre actif disponible</option>'; }
        if (!roster.length) reloadRoster();
      },
      collect: function (form) {
        return { id: draftId, title: read(form, 'title'), description: read(form, 'description'), commission_id: read(form, 'commission_id'),
          meeting_id: linkedMeeting ? linkedMeeting.id : read(form, 'meeting_id'), assigned_to: read(form, 'assigned_to'), priority: read(form, 'priority'), due_date: read(form, 'due_date') };
      },
      validate: function (input) { return X.validateTaskCreate(input, { role: role, uid: P.session.user.id, commissions: commissions, members: roster, mock: mock }); },
      submit: function (input) { return P.api.createTask(input); },
      onSuccess: function (res) {
        U.toast(res.mock ? 'Maquette : tâche ajoutée en mémoire seulement ; rien n’est enregistré dans la base.' : 'Tâche créée et assignée.');
        if (P.app) P.app.refresh();
      }
    });
  };

  /* ==================== DÉPÔT DE DOCUMENT : Bureau exécutif / Super Admin uniquement ==================== */
  F.openDocumentUpload = async function (trigger) {
    if (trigger && trigger.getAttribute('aria-busy') === 'true') return;
    lock(trigger, true);
    var role = P.session && P.session.role, loaded;
    try {
      if (!X.documentUploadAllowed(role)) throw A.coded('NOT_PERMITTED');
      loaded = await P.api.getCommissionOptions();
    } catch (err) { lock(trigger, false); U.toast(A.friendly(err)); return; }
    lock(trigger, false);
    var commissions = loaded.commissions || [];
    var comOptions = '<option value="">— Choisir une commission —</option>' + commissions.map(function (c) { return '<option value="' + e(c.id) + '">' + e(c.name) + '</option>'; }).join('');
    var drop = '<div class="pt-field" data-field="file"><label for="f-file">Fichier à partager <span class="pt-req" aria-hidden="true"> *</span></label>' +
      '<div class="pt-upload-drop" data-doc-drop><span class="pt-upload-drop__icon">' + U.icon('upload') + '</span>' +
      '<span class="pt-upload-drop__title">Glisse le fichier ici</span><span class="pt-upload-drop__sub">ou appuie pour parcourir tes fichiers</span>' +
      '<span class="pt-upload-drop__browse">Choisir un fichier</span><span class="pt-upload-drop__chosen" data-doc-file-name>Aucun fichier choisi</span>' +
      '<input id="f-file" name="file" type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.txt,.jpg,.jpeg,.png,.webp" aria-describedby="f-file-hint f-file-err" aria-required="true"></div>' +
      '<p class="pt-hint" id="f-file-hint">PDF, Word, Excel, PowerPoint, texte ou image · 20 Mo maximum.</p><p class="pt-fielderr" id="f-file-err" hidden></p></div>';
    var accessOpts = '<option value="all_members">Tous les membres actifs</option><option value="commission">Une commission précise</option><option value="bureau">Bureau exécutif et Super Admin</option>';
    openDialog({
      eyebrow: 'Ressources du club', title: 'Déposer un document', submitLabel: 'Téléverser le document',
      intro: 'Les fichiers restent dans un espace privé. Le niveau d’accès détermine qui pourra les télécharger.',
      html: drop + field({ name: 'access_type', label: 'Niveau d’accès', type: 'select', required: true, options: accessOpts }) +
        field({ name: 'commission_id', label: 'Commission autorisée', type: 'select', required: true, options: comOptions, hidden: true }),
      onOpen: function (form) {
        var fileInput = form.elements.file, zone = form.querySelector('[data-doc-drop]'), chosen = form.querySelector('[data-doc-file-name]'),
          access = form.elements.access_type, comWrap = form.querySelector('[data-field="commission_id"]');
        function showFile() { var f = fileInput.files && fileInput.files[0]; chosen.textContent = f ? f.name + ' · ' + (f.size < 1024*1024 ? Math.max(1, Math.round(f.size/1024)) + ' Ko' : (f.size/1024/1024).toFixed(1) + ' Mo') : 'Aucun fichier choisi'; }
        function syncAccess() { var on = access.value === 'commission'; comWrap.hidden = !on; if (!on) form.elements.commission_id.value = ''; }
        access.addEventListener('change', syncAccess); syncAccess(); fileInput.addEventListener('change', showFile);
        ['dragenter','dragover'].forEach(function (name) { zone.addEventListener(name, function (ev) { ev.preventDefault(); zone.classList.add('is-dragging'); }); });
        ['dragleave','dragend'].forEach(function (name) { zone.addEventListener(name, function () { zone.classList.remove('is-dragging'); }); });
        zone.addEventListener('drop', function (ev) {
          ev.preventDefault(); zone.classList.remove('is-dragging');
          var files = ev.dataTransfer && ev.dataTransfer.files;
          if (!files || !files.length) return;
          try { fileInput.files = files; fileInput.dispatchEvent(new Event('change', { bubbles: true })); }
          catch (_) { U.toast('Ton navigateur ne permet pas ce dépôt : appuie sur « Choisir un fichier ».'); }
        });
      },
      collect: function (form) { return { file: form.elements.file.files && form.elements.file.files[0], access_type: read(form, 'access_type'), commission_id: read(form, 'commission_id') }; },
      validate: function (input) { return X.validateDocumentUpload(input, { role: role, uid: P.session.user.id, commissions: commissions }); },
      submit: function (input) { return P.api.uploadDocument(input); },
      onSuccess: function (res) {
        U.toast(res.mock ? 'Maquette : le fichier n’a pas été téléversé dans le stockage réel.' : 'Document téléversé et accès configuré.');
        if (P.app) P.app.refresh();
      }
    });
  };

  /* ---------------------------- Sondage lié à une réunion / activité ---------------------------- */
  /* ICRM poll form UX — 20261029223000 */
  F.openMeetingPollForm = function (trigger, meeting) {
    if (!meeting || !meeting.id) { U.toast('Activité introuvable.'); return; }

    function optionRow(n) {
      var label = 'Choix ' + n;
      var placeholder = n === 1 ? 'Ex. : Samedi matin' : n === 2 ? 'Ex. : Samedi après-midi' : 'Ex. : Troisième option';
      return '<div class="pt-poll-form__option-row" data-poll-option-row="' + n + '">' +
        field({ name: 'option_' + n, label: label, required: true, max: 120, placeholder: placeholder }) +
        '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm pt-poll-form__remove" data-remove-poll-option aria-label="Retirer ' + label + '">Retirer</button>' +
        '</div>';
    }

    openDialog({
      eyebrow: 'Réunion · Événement · Activité', title: 'Créer un sondage', submitLabel: 'Publier le sondage',
      closeImmediately: true,
      intro: 'Activité : ' + String(meeting.title || 'Sans titre') + '. Les membres autorisés pourront voter une fois, puis modifier leur choix tant que le sondage reste ouvert.',
      html: field({ name: 'question', label: 'Question du sondage', required: true, max: 200, placeholder: 'Ex. : Quelle date vous convient le mieux ?' }) +
        field({ name: 'description', label: 'Précisions (facultatif)', type: 'textarea', rows: 3, max: 2000, placeholder: 'Ajoute le contexte utile pour prendre une décision.' }) +
        '<fieldset class="pt-poll-form__options"><legend class="pt-h4">Choix de réponse</legend>' +
        '<div class="pt-poll-form__option-list" data-poll-option-list>' + optionRow(1) + optionRow(2) + '</div>' +
        '<div class="pt-poll-form__option-tools"><button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-poll-add-option>+ Ajouter un choix</button>' +
        '<span class="pt-poll-form__option-count" data-poll-option-count aria-live="polite">2 / 8 choix</span></div>' +
        '<p class="pt-hint">Deux choix minimum, huit maximum. Tu peux retirer un choix ajouté tant que le sondage n’est pas publié.</p></fieldset>',
      onOpen: function (form) {
        var list = form.querySelector('[data-poll-option-list]');
        var add = form.querySelector('[data-poll-add-option]');
        var count = form.querySelector('[data-poll-option-count]');
        if (!list || !add || !count) return;

        function renumber() {
          var rows = Array.prototype.slice.call(list.querySelectorAll('[data-poll-option-row]'));
          var total = rows.length;
          rows.forEach(function (row, index) {
            var visualNumber = index + 1;
            var label = row.querySelector('label');
            var remove = row.querySelector('[data-remove-poll-option]');
            if (label && label.firstChild) label.firstChild.nodeValue = 'Choix ' + visualNumber;
            if (remove) {
              remove.disabled = total <= 2;
              remove.setAttribute('aria-label', 'Retirer Choix ' + visualNumber);
              remove.title = total <= 2 ? 'Deux choix minimum' : 'Retirer ce choix';
            }
          });
          count.textContent = total + ' / 8 choix';
          add.disabled = total >= 8;
          add.setAttribute('aria-disabled', String(total >= 8));
          add.textContent = total >= 8 ? 'Maximum de 8 choix atteint' : '+ Ajouter un choix';
        }

        add.addEventListener('click', function (ev) {
          ev.preventDefault();
          var rows = list.querySelectorAll('[data-poll-option-row]');
          if (rows.length >= 8) return;
          var next = 1;
          while (next <= 8 && list.querySelector('[data-poll-option-row="' + next + '"]')) next++;
          if (next > 8) { renumber(); return; }
          list.insertAdjacentHTML('beforeend', optionRow(next));
          renumber();
          var newInput = form.elements['option_' + next];
          if (newInput && newInput.focus) newInput.focus();
        });

        list.addEventListener('click', function (ev) {
          var button = ev.target && ev.target.closest ? ev.target.closest('[data-remove-poll-option]') : null;
          if (!button || !list.contains(button)) return;
          ev.preventDefault();
          if (list.querySelectorAll('[data-poll-option-row]').length <= 2) return;
          var row = button.closest('[data-poll-option-row]');
          if (row) row.remove();
          renumber();
        });
        renumber();
      },
      collect: function (form) {
        var rows = Array.prototype.slice.call(form.querySelectorAll('[data-poll-option-row]'));
        return {
          question: read(form, 'question').trim(),
          description: read(form, 'description').trim(),
          options: rows.map(function (row, index) {
            var input = row.querySelector('input[name^="option_"]');
            return { name: input ? input.name : 'option_' + (index + 1), value: input ? input.value.trim() : '' };
          })
        };
      },
      validate: function (input) {
        var errors = {}, seen = Object.create(null);
        if (input.question.length < 5 || input.question.length > 200) errors.question = 'La question doit contenir entre 5 et 200 caractères.';
        if (input.description.length > 2000) errors.description = 'Maximum 2 000 caractères.';
        if (input.options.length < 2 || input.options.length > 8) errors._form = 'Le sondage doit contenir entre deux et huit choix.';
        input.options.forEach(function (choice, idx) {
          var value = choice.value, key = value.toLocaleLowerCase('fr').trim();
          if (!value) errors[choice.name] = 'Ce choix est obligatoire. Retire-le ou complète-le.';
          else if (value.length > 120) errors[choice.name] = 'Maximum 120 caractères.';
          else if (seen[key]) errors[choice.name] = 'Ce choix est identique à un autre.';
          if (key) seen[key] = true;
        });
        var count = input.options.filter(function (choice) { return !!choice.value; }).length;
        if (count < 2) errors._form = 'Ajoute au moins deux choix différents.';
        return { ok: Object.keys(errors).length === 0, errors: errors };
      },
      submit: function (input) {
        return P.api.createMeetingPoll({
          meeting_id: meeting.id,
          question: input.question,
          description: input.description,
          options: input.options.map(function (choice) { return choice.value; })
        });
      },
      onSuccess: function (res) {
        U.toast(res && res.mock ? 'Maquette : sondage conservé en mémoire uniquement.' : 'Sondage publié.');
        if (P.app) P.app.refresh();
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
      intro: 'Ta proposition sera transmise au responsable principal et à son éventuel adjoint.',
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
