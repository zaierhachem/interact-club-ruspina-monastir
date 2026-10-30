/* ICRM — ESPACE MEMBRES · VUES : Dashboard, Profil, Paramètres
   Contrat d'une vue : { title, load(api, params), render(data, ctx) → html, mount?(root, data, ctx) } */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views;

  /* ============================ DASHBOARD ============================ */
  V.dashboard = {
    title: 'Dashboard',
    load: function (api) { return api.getDashboard(); },
    render: function (d) {
      var s = d.stats, m = d.nextMeeting, c = d.commission;
      var att = s.attendance, tk = s.tasks, dash = '—';                      // null = donnée non disponible → « — »
      var pctAtt = att && att.total ? att.present / att.total * 100 : 0, pctTask = tk && tk.total ? tk.done / tk.total * 100 : 0;
      var mandate = d.user.mandate ? ' · mandat ' + e(d.user.mandate) : '';

      var kpis =
        '<section class="pt-kpis" aria-label="Mes indicateurs">' +
          '<div class="pt-kpi"><p class="pt-kpi__label">Statut</p><p class="pt-kpi__value pt-kpi__value--text">' + U.statusChip('memberStatus', d.user.status).replace('pt-chip ', 'pt-chip pt-chip--lg ') + '</p><p class="pt-kpi__sub">' + e(P.config.ROLES[d.user.role].label) + mandate + '</p></div>' +
          '<div class="pt-kpi"><p class="pt-kpi__label">Activité</p><p class="pt-kpi__value">' + (s.activity == null ? dash : s.activity + '<small>%</small>') + '</p>' + U.bar(s.activity || 0, s.activity == null ? 'Activité : non disponible' : 'Activité : ' + s.activity + ' %') + '<p class="pt-kpi__sub">Indice d’engagement</p></div>' +
          '<div class="pt-kpi"><p class="pt-kpi__label">Présence</p><p class="pt-kpi__value">' + (att ? att.present + '<small> / ' + att.total + '</small>' : dash) + '</p>' + U.bar(pctAtt, att ? 'Présence : ' + att.present + ' réunions sur ' + att.total : 'Présence : non disponible') + '<p class="pt-kpi__sub">Réunions suivies' + (att && att.excused ? ' · ' + att.excused + ' excusée' + (att.excused > 1 ? 's' : '') : '') + '</p></div>' +
          '<div class="pt-kpi"><p class="pt-kpi__label">Tâches</p><p class="pt-kpi__value">' + (tk ? tk.done + '<small> / ' + tk.total + '</small>' : dash) + '</p>' + U.bar(pctTask, tk ? 'Tâches : ' + tk.done + ' terminées sur ' + tk.total : 'Tâches : aucune') + '<p class="pt-kpi__sub">Tâches terminées</p></div>' +
        '</section>';

      var meeting = m
        ? '<article class="pt-card pt-card--feature pt-span-7" aria-labelledby="pt-nm">' +
            '<svg class="pt-card__rings" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><circle cx="200" cy="200" r="198"/><circle cx="200" cy="200" r="140"/><circle cx="200" cy="200" r="82"/></svg>' +
            '<p class="pt-eyebrow pt-eyebrow--light">Prochaine réunion</p>' +
            '<div class="pt-next">' +
              '<div class="pt-next__date" aria-hidden="true"><span>' + e(U.date.day(m.date)) + '</span><b>' + e(U.date.monthName(m.date)) + '</b></div>' +
              '<div><h2 class="pt-h2" id="pt-nm">' + e(m.commission) + '</h2>' +
                '<p class="pt-next__line">' + e(U.date.weekday(m.date)) + ' ' + Number(U.date.day(m.date)) + ' ' + e(U.date.monthName(m.date)) + '</p>' +
                '<ul class="pt-meta pt-meta--light"><li>' + U.icon('clock') + '<span>' + e(m.start) + '</span></li><li>' + U.icon('pin') + '<span>' + e(m.location) + '</span></li></ul></div>' +
            '</div>' +
            '<div class="pt-card__foot"><span class="pt-chip pt-chip--light">' + e(U.date.relative(d.today, m.date)) + '</span><a class="pt-link pt-link--light" href="#/reunions/' + e(m.id) + '">Voir la réunion ' + U.icon('right') + '</a></div>' +
          '</article>'
        : '<article class="pt-card pt-span-7">' + U.empty('Aucune réunion planifiée.') + '</article>';

      var pendingPolls = d.myPollTasks || [];
      var pollInbox = pendingPolls.length ? '<div class="pt-poll-inbox"><div class="pt-poll-inbox__head"><b>À voter</b><span class="pt-poll__status">' + pendingPolls.length + '</span></div><ul class="pt-poll-inbox__list">' + pendingPolls.slice(0, 3).map(function (p) { return '<li><a class="pt-poll-inbox__item" href="#/reunions/' + e(p.meetingId) + '"><span class="pt-poll-inbox__badge">' + U.icon('check') + '</span><span class="pt-poll-inbox__copy"><b>' + e(p.title) + '</b><small>' + e(p.meetingTitle || 'Activité') + (p.deadline ? ' · ' + e(U.date.short(p.deadline)) : '') + '</small></span><span class="pt-poll-inbox__arrow">' + U.icon('right') + '</span></a></li>'; }).join('') + '</ul></div>' : (d.pollsAvailable === false ? '<p class="pt-hint">Les sondages seront disponibles après activation de la fonctionnalité.</p>' : '');
      var tasks = '<article class="pt-card pt-span-5" aria-labelledby="pt-mt"><header class="pt-card__head"><h2 class="pt-h3" id="pt-mt">Mes tâches</h2><a class="pt-link" href="#/taches">Tout voir</a></header>' + pollInbox + (!d.myTasks.length ? (pendingPolls.length ? '' : U.empty('Aucune tâche pour le moment.')) : '<ul class="pt-checks">' +
        d.myTasks.slice(0, 3).map(function (t) {
          var done = t.status === 'completed';
          return '<li class="pt-check' + (done ? ' is-done' : '') + '"><span class="pt-check__box" aria-hidden="true">' + (done ? U.icon('check') : '') + '</span>' +
            '<span class="pt-check__text"><b>' + e(t.title) + '</b><small><span class="pt-sr">' + (done ? 'Terminée. ' : 'À faire. ') + '</span>' + (done ? 'Terminée' : 'Pour le ' + e(U.date.short(t.deadline))) + '</small></span></li>';
        }).join('') + '</ul>') + '</article>';

      var cards = d.commissions || (c ? [{ name: c.name, headName: c.headName, memberCount: c.memberCount }] : []);
      var commission = '<article class="pt-card pt-span-4" aria-labelledby="pt-cm"><header class="pt-card__head"><h2 class="pt-h3" id="pt-cm">Ma commission</h2></header>' +
        (!cards.length ? U.empty('Tu n’es rattaché à aucune commission pour le moment.') :
          cards.map(function (k) {
            return '<div class="pt-dash-com"><p class="pt-bignote">' + e(k.name) + '</p>' +
              '<dl class="pt-dl pt-dl--stack"><div><dt>Responsables</dt><dd>' + e(k.headName || '—') + '</dd></div><div><dt>Membres</dt><dd>' + k.memberCount + '</dd></div></dl></div>';
          }).join('')) +
        '<a class="pt-link" href="#/commission">Voir ma commission ' + U.icon('right') + '</a></article>';

      var ann = '<article class="pt-card pt-span-8" aria-labelledby="pt-an"><header class="pt-card__head"><h2 class="pt-h3" id="pt-an">Annonces</h2><a class="pt-link" href="#/annonces">Toutes les annonces</a></header>' + (!d.announcements.length ? U.empty('Aucune annonce pour le moment.') : '<ul class="pt-rows">' +
        d.announcements.map(function (a) {
          return '<li><a class="pt-row" href="#/annonces/' + e(a.id) + '"><span class="pt-row__main"><b>' + e(a.title) + '</b><small>' + e(a.author) + ' · ' + e(U.date.short(a.date)) + '</small></span>' + U.statusChip('announce', a.priority) + '</a></li>';
        }).join('') + '</ul>') + '</article>';

      var act = '<article class="pt-card pt-span-12" aria-labelledby="pt-ac"><header class="pt-card__head"><h2 class="pt-h3" id="pt-ac">Activité récente</h2></header>' + (!d.activity.length ? U.empty('Aucune activité récente.') : '<ol class="pt-timeline">' +
        d.activity.map(function (a) {
          var ico = { meeting: 'message', task: 'tasks', document: 'file', announcement: 'megaphone' }[a.kind] || 'flag';
          return '<li><span class="pt-timeline__ico">' + U.icon(ico) + '</span><span class="pt-timeline__text"><b>' + e(a.text) + '</b><small>' + e(a.detail) + '</small></span><time class="pt-timeline__when">' + e(a.when) + '</time></li>';
        }).join('') + '</ol>') + '</article>';

      return U.pageHead('Espace membres' + (d.user.mandate ? ' · Mandat ' + d.user.mandate : ''),
          'Bonjour, ' + e(d.user.firstName) + ' <span class="pt-wave" role="img" aria-label="main qui salue">👋</span>', 'Content de te revoir.') +
        kpis + '<div class="pt-grid">' + meeting + tasks + commission + ann + act + '</div>';
    }
  };

  /* ============================ PROFIL ============================ */
  V.profil = {
    title: 'Mon Profil',
    load: function (api) {
      /* La progression est lue à part : son échec n'empêche jamais l'affichage du profil. */
      return api.getProfile().then(function (p) {
        return P.progressionUI.load(api).then(function (prog) { p.progression = prog; return p; });
      });
    },
    render: function (d) {
      var u = d.user, name = (u.firstName + ' ' + u.lastName).trim(), roleLabel = P.config.ROLES[u.role].label;
      var rows = [
        ['Rôle', roleLabel], ['Commission', d.commission ? 'Commission ' + d.commission.name : 'Aucune commission'], ['Poste', u.position],
        ['Email', u.email], ['Téléphone', u.phone], ['Membre depuis', (u.joinedAt ? U.date.my(u.joinedAt) : '—')],
        ['Mandat / promotion', u.mandate || '—'], ['Statut', U.statusChip('memberStatus', u.status)]
      ];
      var phoneValue = u.phone && u.phone !== '—' ? u.phone : '';
      return U.pageHead('Mon compte', 'Mon profil', 'Les informations qui te concernent au sein du club.',
          P.can('profile:edit-own') ? '<button type="button" class="pt-btn pt-btn--ghost" data-profile-edit>' + U.icon('user') + 'Modifier mes informations</button>' : '') +
        '<div class="pt-profile">' +
          '<section class="pt-card pt-card--feature pt-profile__id" aria-labelledby="pt-pn">' +
            '<svg class="pt-card__rings" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><circle cx="200" cy="200" r="198"/><circle cx="200" cy="200" r="140"/></svg>' +
            '<span class="pt-avatar pt-avatar--xl pt-avatar--v0" role="img" aria-label="Initiales du membre">' + e(U.initials(name)) + '</span>' +
            '<h2 class="pt-h2" id="pt-pn">' + e(name) + '</h2>' +
            '<p class="pt-profile__role">' + e(roleLabel) + '</p><p class="pt-profile__sub">' + e(d.commission ? 'Commission ' + d.commission.name : 'Aucune commission') + '</p>' +
            (u.mandate ? '<p class="pt-profile__sub">Mandat ' + e(u.mandate) + '</p>' : '') +
          '</section>' +
          '<section class="pt-card" aria-labelledby="pt-pd"><header class="pt-card__head"><h2 class="pt-h3" id="pt-pd">Informations</h2></header><dl class="pt-dl pt-dl--grid">' +
            rows.map(function (r) { return '<div><dt>' + e(r[0]) + '</dt><dd>' + (r[0] === 'Statut' ? r[1] : e(r[1])) + '</dd></div>'; }).join('') +
          '</dl><p class="pt-note">Tu peux modifier ton nom affiché et ton téléphone. Le rôle, le statut, l’adresse e-mail et les commissions restent gérés par le Bureau exécutif via les procédures autorisées.</p></section>' +
        '</div>' +
        '<dialog class="pt-dialog" id="profileEditDialog" aria-labelledby="profileEditTitle">' +
          '<form class="pt-dform" id="profileEditForm" novalidate>' +
            '<header class="pt-dform__head"><div><p class="pt-eyebrow">Mon compte</p><h2 class="pt-h3" id="profileEditTitle">Modifier mes informations</h2></div>' +
              '<button type="button" class="pt-iconbtn" data-profile-close aria-label="Fermer">' + U.icon('close') + '</button></header>' +
            '<div class="pt-dform__body">' +
              '<p class="pt-hint">Mets à jour les informations de contact qui apparaissent dans ton espace membre.</p>' +
              '<div class="pt-field" data-field="full_name"><label for="profileFullName">Nom et prénom <span class="pt-req" aria-hidden="true">*</span></label>' +
                '<input id="profileFullName" name="full_name" type="text" required minlength="2" maxlength="100" autocomplete="name" value="' + e(name) + '" aria-describedby="profileFullNameHint profileFullNameError">' +
                '<p class="pt-hint" id="profileFullNameHint">Utilisé pour ton nom affiché dans le portail.</p><p class="pt-fielderr" id="profileFullNameError" hidden></p></div>' +
              '<div class="pt-field" data-field="phone"><label for="profilePhone">Téléphone</label>' +
                '<input id="profilePhone" name="phone" type="tel" maxlength="32" autocomplete="tel" value="' + e(phoneValue) + '" aria-describedby="profilePhoneHint profilePhoneError">' +
                '<p class="pt-hint" id="profilePhoneHint">Facultatif. Laisse vide pour effacer le numéro enregistré.</p><p class="pt-fielderr" id="profilePhoneError" hidden></p></div>' +
            '</div>' +
            '<p class="pt-formerr" id="profileEditError" role="alert" tabindex="-1" hidden></p>' +
            '<footer class="pt-dform__foot"><p class="pt-hint">Les autres informations ne sont pas modifiables ici.</p><div class="pt-dform__actions">' +
              '<button type="button" class="pt-btn pt-btn--ghost" data-profile-close>Annuler</button>' +
              '<button type="submit" class="pt-btn pt-btn--primary" data-profile-save>Enregistrer</button></div></footer>' +
          '</form></dialog>' +
        '<div id="progSection">' + (d.progression ? P.progressionUI.html(d.progression) : '') + '</div>';
    },
    mount: function (root, d) {
      var openBtn = root.querySelector('[data-profile-edit]'), dlg = root.querySelector('#profileEditDialog');
      var form = root.querySelector('#profileEditForm');
      if (openBtn && dlg && form) {
        var initialName = form.elements.full_name.value, initialPhone = form.elements.phone.value, busy = false;
        function dirty() { return form.elements.full_name.value !== initialName || form.elements.phone.value !== initialPhone; }
        function closeDialog() {
          if (busy) return;
          if (dirty() && !window.confirm('Abandonner les modifications non enregistrées ?')) return;
          dlg.close();
        }
        openBtn.addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
        form.querySelectorAll('[data-profile-close]').forEach(function (b) { b.addEventListener('click', closeDialog); });
        dlg.addEventListener('cancel', function (ev) {
          if (busy) { ev.preventDefault(); return; }
          if (dirty() && !window.confirm('Abandonner les modifications non enregistrées ?')) ev.preventDefault();
        });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault(); if (busy) return;
          var nameField = form.elements.full_name, phoneField = form.elements.phone;
          var fullName = String(nameField.value || '').trim(), phone = String(phoneField.value || '').trim();
          var errorBox = form.querySelector('#profileEditError');
          var nameErr = form.querySelector('#profileFullNameError'), phoneErr = form.querySelector('#profilePhoneError');
          [nameField, phoneField].forEach(function (el) { el.removeAttribute('aria-invalid'); });
          nameErr.hidden = true; phoneErr.hidden = true; errorBox.hidden = true;
          if (fullName.length < 2 || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName)) {
            nameErr.textContent = 'Saisis un nom complet de 2 à 100 caractères.'; nameErr.hidden = false; nameField.setAttribute('aria-invalid', 'true'); nameField.focus(); return;
          }
          if (phone.length > 32 || /[\u0000-\u001f\u007f]/.test(phone)) {
            phoneErr.textContent = 'Le numéro ne doit pas dépasser 32 caractères.'; phoneErr.hidden = false; phoneField.setAttribute('aria-invalid', 'true'); phoneField.focus(); return;
          }
          busy = true; form.setAttribute('aria-busy', 'true');
          var saveBtn = form.querySelector('[data-profile-save]'); saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
          form.querySelector('.pt-dform__body').inert = true;
          form.querySelectorAll('[data-profile-close]').forEach(function (b) { b.disabled = true; });
          P.api.updateMyProfile({ full_name: fullName, phone: phone }).then(function (res) {
            /* Fermer avant le rerendu : profileUpdated peut remplacer le nœud du dialogue. */
            dlg.close();
            U.toast(res && res.mock ? 'Maquette : profil modifié en mémoire uniquement.' : 'Profil mis à jour.');
            if (res && res.user && P.app && P.app.profileUpdated) P.app.profileUpdated(res.user);
            else if (P.app) P.app.refresh();
          }).catch(function (err) {
            busy = false; form.removeAttribute('aria-busy'); saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
            form.querySelector('.pt-dform__body').inert = false;
            form.querySelectorAll('[data-profile-close]').forEach(function (b) { b.disabled = false; });
            errorBox.textContent = err && err.coded ? err.message : A.messageFor('WRITE_FAILED').text; errorBox.hidden = false; errorBox.focus();
          });
        });
      }
      if (d && d.progression) P.progressionUI.mount(root, d.progression, P.api);
    }
  };

  /* ============================ PARAMÈTRES ============================ */
  V.parametres = {
    title: 'Paramètres',
    load: function (api) { return api.getSettings(); },
    render: function (d) {
      var s = d.settings;
      var sw = function (n) {
        return '<div class="pt-switch"><input type="checkbox" id="' + e(n.id) + '" name="' + e(n.key) + '" data-notification-setting="' + e(n.key) + '"' + (n.enabled ? ' checked' : '') + '><label for="' + e(n.id) + '"><b>' + e(n.label) + '</b><small>' + e(n.hint) + '</small></label></div>';
      };
      var mockMode = P.api.isMock();
      return U.pageHead('Mon compte', 'Paramètres', 'Personnalise tes préférences de compte.') +
        '<form class="pt-card pt-form" id="settingsForm" novalidate>' +
          '<fieldset><legend class="pt-h3">Langue de l’interface</legend>' +
            '<div class="pt-setting-language"><span class="pt-setting-language__icon">' + U.icon('globe') + '</span><span><b>Français</b><small>Langue actuellement disponible</small></span><span class="pt-chip pt-chip--info">Active</span></div>' +
            '<p class="pt-hint">Le français est la seule langue entièrement disponible dans cette version. Le choix d’une autre langue sera proposé lorsque ses traductions seront prêtes.</p>' +
          '</fieldset>' +
          '<fieldset class="pt-install-section" data-install-section hidden><legend class="pt-h3">Application mobile</legend>' +
            '<div class="pt-install-row"><span class="pt-setting-language__icon">' + U.icon('download') + '</span><div class="pt-install-copy"><b>Installer ICRM sur cet appareil</b><small>Ajoute l’espace membres à ton écran d’accueil pour le lancer comme une application.</small></div>' +
            '<button type="button" class="pt-btn pt-btn--primary" data-install-app hidden>Installer l’application</button></div>' +
          '</fieldset>' +
          '<fieldset><legend class="pt-h3">Préférences de notification</legend>' +
            '<p class="pt-hint">' + (mockMode ? 'Mode maquette : ces choix sont temporaires et seront perdus au rechargement. ' : 'Tes choix sont enregistrés dans ton compte. ') + 'Ces préférences déterminent les alertes envoyées une fois les notifications activées sur un appareil.</p>' +
            s.notifications.map(sw).join('') +
          '</fieldset>' +
          '<fieldset class="pt-push-device" data-push-settings><legend class="pt-h3">Notifications sur cet appareil</legend>' +
            '<p class="pt-hint" data-push-status role="status" aria-live="polite">Vérification de la disponibilité des notifications…</p>' +
            '<div class="pt-form__actions pt-push-device__actions"><button type="button" class="pt-btn pt-btn--primary" data-push-enable>Activer les notifications sur cet appareil</button><button type="button" class="pt-btn pt-btn--ghost" data-push-disable hidden>Désactiver sur cet appareil</button></div>' +
            '<p class="pt-hint">Les alertes sont envoyées à cet appareil lorsque le navigateur les autorise. Les alertes à venir restent régies par les préférences ci-dessus.</p>' +
          '</fieldset>' +
          '<fieldset><legend class="pt-h3">Sécurité du compte</legend>' +
            '<div class="pt-setting-info"><span class="pt-setting-info__icon">' + U.icon('lock') + '</span><div><b>Adresse e-mail de connexion</b><p>' + e(d.user.email) + '</p><small>Pour protéger ton compte, l’adresse e-mail et les rôles ne se modifient pas depuis cette page.</small></div></div>' +
          '</fieldset>' +
          '<div class="pt-form__actions"><button type="submit" class="pt-btn pt-btn--primary" data-settings-save>Enregistrer mes préférences</button><p class="pt-hint" id="settingsDirty" aria-live="polite">Aucune modification en attente.</p></div>' +
          '<p class="pt-formerr" id="settingsError" role="alert" tabindex="-1" hidden></p>' +
          '<p class="pt-setting-success" id="settingsSuccess" role="status" hidden></p>' +
        '</form>';
    },
    mount: function (root) {
      if (window.ICRMInstall && typeof window.ICRMInstall.refresh === 'function') window.ICRMInstall.refresh(root);
      var form = root.querySelector('#settingsForm'); if (!form) return;
      if (P.notifications && typeof P.notifications.mount === 'function') P.notifications.mount(root);
      var saveBtn = form.querySelector('[data-settings-save]'), dirtyLabel = form.querySelector('#settingsDirty');
      var errorBox = form.querySelector('#settingsError'), successBox = form.querySelector('#settingsSuccess');
      var checks = Array.prototype.slice.call(form.querySelectorAll('[data-notification-setting]'));
      var initial = {};
      checks.forEach(function (el) { initial[el.name] = el.checked; });
      function isDirty() { return checks.some(function (el) { return initial[el.name] !== el.checked; }); }
      checks.forEach(function (el) { el.addEventListener('change', function () {
        errorBox.hidden = true; successBox.hidden = true;
        dirtyLabel.textContent = isDirty() ? 'Modifications non enregistrées.' : 'Aucune modification en attente.';
      }); });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault(); if (saveBtn.disabled) return;
        var notifications = {};
        checks.forEach(function (el) { notifications[el.name] = el.checked; });
        errorBox.hidden = true; successBox.hidden = true;
        saveBtn.disabled = true; saveBtn.setAttribute('aria-busy', 'true'); saveBtn.textContent = 'Enregistrement…';
        checks.forEach(function (el) { el.disabled = true; });
        P.api.saveSettings({ notifications: notifications }).then(function (res) {
          checks.forEach(function (el) { initial[el.name] = el.checked; });
          dirtyLabel.textContent = 'Préférences enregistrées.';
          successBox.textContent = res && res.mock
            ? 'Mode maquette : tes préférences sont gardées en mémoire uniquement et seront perdues au rechargement. Aucun e-mail ou push n’est envoyé.'
            : 'Tes préférences ont été enregistrées dans ton compte. Elles sont appliquées aux alertes Push sur les appareils autorisés.';
          successBox.hidden = false;
          U.toast(res && res.mock ? 'Maquette : préférences conservées en mémoire uniquement.' : 'Préférences enregistrées.');
        }).catch(function (err) {
          errorBox.textContent = err && err.coded ? err.message : A.messageFor('WRITE_FAILED').text;
          errorBox.hidden = false; errorBox.focus();
        }).finally(function () {
          saveBtn.disabled = false; saveBtn.removeAttribute('aria-busy'); saveBtn.textContent = 'Enregistrer mes préférences';
          checks.forEach(function (el) { el.disabled = false; });
        });
      });
    }
  };

})();
