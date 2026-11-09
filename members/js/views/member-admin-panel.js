/* ICRM — admin directory + XP actions + reversible account status + guarded Auth deletion. */
(function (w, d) {
  'use strict';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var roleLabel = function (r) { return ({ bureau: 'Bureau exécutif', super_admin: 'Super Admin', commission_head: 'Responsable de commission', member: 'Membre' })[r] || r || '—'; };
  var statusLabel = function (s) { return ({ active: 'Actif', follow_up: 'À suivre', inactive: 'Inactif' })[s] || s || '—'; };
  var canManageAccounts = function (role) { return role === 'super_admin'; };

  function mount(root, api, session) {
    if (!root || !api) throw new Error('Racine UI ou API manquante.');
    session = session || {};
    var role = session.role || '';
    if (role !== 'bureau' && role !== 'super_admin') {
      root.textContent = 'Accès réservé au Bureau exécutif et au Super Admin.';
      return { destroy: function () {} };
    }
    var members = [], selectedId = '', filter = '', busy = false, preflight = null;
    root.innerHTML = '<section class="icrm-admin-panel">' +
      '<header class="icrm-admin-head"><div><p class="icrm-admin-eyebrow">ADMINISTRATION DU CLUB</p><h2>Gestion des membres</h2><p>Annuaire complet de la plateforme, ajustements XP et suivi des comptes.</p></div><button type="button" data-refresh>Actualiser</button></header>' +
      '<div class="icrm-admin-layout"><aside class="icrm-admin-list"><label for="icrm-member-search">Rechercher un membre</label><input id="icrm-member-search" type="search" placeholder="Nom, rôle ou statut…" autocomplete="off"><div data-member-count></div><div class="icrm-admin-member-items" data-members></div></aside>' +
      '<section class="icrm-admin-detail" data-detail><div class="icrm-admin-empty">Sélectionne un membre pour afficher sa fiche administrative.</div></section></div></section>';
    var listNode = root.querySelector('[data-members]');
    var detailNode = root.querySelector('[data-detail]');
    var countNode = root.querySelector('[data-member-count]');
    var searchNode = root.querySelector('#icrm-member-search');

    function selected() { return members.find(function (m) { return m.id === selectedId; }) || null; }
    function renderList() {
      var needle = filter.trim().toLocaleLowerCase();
      var visible = members.filter(function (m) {
        return !needle || [m.fullName, roleLabel(m.role), statusLabel(m.status)].join(' ').toLocaleLowerCase().includes(needle);
      });
      countNode.textContent = visible.length + ' / ' + members.length + ' comptes';
      listNode.innerHTML = visible.length ? visible.map(function (m) {
        return '<button type="button" class="icrm-admin-member' + (m.id === selectedId ? ' is-selected' : '') + '" data-member="' + esc(m.id) + '">' +
          '<span class="icrm-admin-member__name">' + esc(m.fullName) + '</span><span class="icrm-admin-member__meta">' + esc(roleLabel(m.role)) + ' · ' + esc(statusLabel(m.status)) + '</span>' +
          '<span class="icrm-admin-member__xp">' + esc(m.totalXp) + ' XP</span></button>';
      }).join('') : '<p class="icrm-admin-muted">Aucun résultat.</p>';
    }
    function renderDetail() {
      var m = selected();
      if (!m) { detailNode.innerHTML = '<div class="icrm-admin-empty">Sélectionne un membre pour afficher sa fiche administrative.</div>'; return; }
      var superAdmin = canManageAccounts(role);
      detailNode.innerHTML = '<article class="icrm-admin-profile"><div class="icrm-admin-profile__top"><div><p class="icrm-admin-eyebrow">FICHE MEMBRE</p><h3>' + esc(m.fullName) + '</h3><p>' + esc(roleLabel(m.role)) + ' · ' + esc(statusLabel(m.status)) + '</p></div><strong>' + esc(m.totalXp) + ' XP</strong></div>' +
        '<form data-xp-form class="icrm-admin-card"><h4>Ajustement XP</h4><p>Valeur positive = récompense. Valeur négative = sanction personnalisée. Le solde ne descend jamais sous zéro.</p>' +
        '<label>Montant XP<input name="delta" type="number" step="1" min="-5000" max="5000" required placeholder="Ex. 50 ou -20"></label>' +
        '<label>Motif / sanction<input name="reason" type="text" minlength="3" maxlength="300" required placeholder="Décris précisément la décision…"></label>' +
        '<button type="submit" data-permanent-disabled="' + (m.status === 'inactive' ? 'true' : 'false') + '"' + (m.status === 'inactive' ? ' disabled' : '') + '>Enregistrer l’ajustement</button></form>' +
        (superAdmin ? '<section class="icrm-admin-card"><h4>Statut du compte</h4><p>La désactivation est réversible et conserve les historiques.</p><form data-status-form><label>Nouveau statut<select name="status"><option value="active"' + (m.status === 'active' ? ' selected' : '') + '>Actif</option><option value="follow_up"' + (m.status === 'follow_up' ? ' selected' : '') + '>À suivre</option><option value="inactive"' + (m.status === 'inactive' ? ' selected' : '') + '>Inactif — désactivation</option></select></label><label>Motif<input name="reason" minlength="3" maxlength="300" required placeholder="Motif administratif…"></label><button type="submit">Enregistrer le statut</button></form></section>' +
        '<section class="icrm-admin-card icrm-admin-danger"><h4>Suppression définitive du compte</h4><p>Le système vérifie les références vers le profil et Auth, supprime les données personnelles, détache l’auteur des contenus partagés et retire les fichiers personnels via Storage. La suppression reste protégée par une confirmation explicite.</p><label>Motif<input data-delete-reason maxlength="300" minlength="3" placeholder="Motif obligatoire"></label><button type="button" data-preflight>Prévisualiser le nettoyage</button><div data-preflight-result aria-live="polite"></div><label>Confirmation: tape <b>SUPPRIMER</b><input data-delete-confirm autocomplete="off" placeholder="SUPPRIMER"></label><button type="button" data-hard-delete disabled>Supprimer le compte et ses données</button></section>' : '<p class="icrm-admin-muted">La gestion du statut et la suppression Auth sont réservées au Super Admin.</p>') +
        '<p class="icrm-admin-message" data-message role="status" aria-live="polite"></p></article>';
      bindDetail(m, superAdmin);
    }
    function message(text, isError) {
      var node = detailNode.querySelector('[data-message]');
      if (node) { node.textContent = text; node.dataset.state = isError ? 'error' : 'success'; }
    }
    function setBusy(value) { busy = value; root.querySelectorAll('button,input,select').forEach(function (node) { if (node.hasAttribute('data-hard-delete')) { if (value) node.disabled = true; return; } node.disabled = value || node.dataset.permanentDisabled === 'true'; }); }
    function bindDetail(m, superAdmin) {
      var xpForm = detailNode.querySelector('[data-xp-form]');
      xpForm.addEventListener('submit', async function (event) {
        event.preventDefault(); if (busy) return;
        var fd = new FormData(xpForm), delta = Number(fd.get('delta')), reason = String(fd.get('reason') || '').trim();
        if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 5000 || reason.length < 3 || reason.length > 300) { message('Montant ou motif invalide.', true); return; }
        if (m.status === 'inactive') { message('Réactive le compte avant un ajustement XP.', true); return; }
        setBusy(true);
        try { await api.adminRecordMemberXpAdjustment({ memberId: m.id, delta: delta, reason: reason }); await refresh(m.id); message('Ajustement XP enregistré dans le ledger.', false); }
        catch (err) { message(err.message || 'Échec de l’ajustement XP.', true); }
        finally { setBusy(false); }
      });
      if (!superAdmin) return;
      var statusForm = detailNode.querySelector('[data-status-form]');
      statusForm.addEventListener('submit', async function (event) {
        event.preventDefault(); if (busy) return;
        var fd = new FormData(statusForm), next = String(fd.get('status')), reason = String(fd.get('reason') || '').trim();
        if (reason.length < 3) { message('Motif obligatoire (3 caractères minimum).', true); return; }
        setBusy(true);
        try { await api.adminSetMemberStatus({ memberId: m.id, status: next, reason: reason }); preflight = null; await refresh(m.id); message('Statut du compte mis à jour.', false); }
        catch (err) { message(err.message || 'Échec du changement de statut.', true); }
        finally { setBusy(false); }
      });
      var preflightBtn = detailNode.querySelector('[data-preflight]');
      var hardDeleteBtn = detailNode.querySelector('[data-hard-delete]');
      var confirmInput = detailNode.querySelector('[data-delete-confirm]');
      var reasonInput = detailNode.querySelector('[data-delete-reason]');
      async function runPreflight() {
        if (busy) return;
        setBusy(true); preflight = null;
        var box = detailNode.querySelector('[data-preflight-result]');
        box.textContent = 'Analyse des dépendances et préparation du nettoyage…';
        try {
          preflight = await api.adminMemberDeletePreflight(m.id);
          if (preflight.can_delete) {
            var cascadeRows = Number(preflight.cascade_rows) || 0;
            var detachRows = Number(preflight.detach_rows) || 0;
            var storageOwnedObjects = Number(preflight.storage_owned_objects) || 0;
            var cleanup = Array.isArray(preflight.cleanup) ? preflight.cleanup : [];
            var rows = cleanup.map(function (item) {
              var action = item.action === 'cascade' ? 'supprimée(s)' : 'référence(s) anonymisée(s)';
              return '<li><strong>' + esc(item.table || 'Table') + '</strong> · ' + esc(item.rows || 0) + ' ligne(s) · ' + action + '</li>';
            }).join('');
            box.innerHTML = '<div class="icrm-delete-preview is-ready"><strong>Nettoyage prêt — suppression autorisée</strong>' +
              '<p>' + esc(cascadeRows) + ' ligne(s) seront supprimées en cascade · ' + esc(detachRows) + ' référence(s) d’auteur seront détachées. Les contenus partagés restent disponibles sans identité personnelle.</p>' +
              (rows ? '<ul>' + rows + '</ul>' : '<p>Aucune ligne dépendante détectée dans les tables SQL.</p>') +
              '<p><strong>Storage :</strong> ' + esc(storageOwnedObjects) + ' objet(s) dont le membre est propriétaire ont été détectés. Le serveur vérifie aussi les chemins des documents personnels et retire les fichiers via l’API Storage avant Auth.</p>' +
              '<small>Les chemins sont vérifiés avant toute suppression. Si un chemin manque ou si Auth bloque ensuite, le compte n’est pas annoncé comme supprimé et le détail est affiché.</small></div>';
          } else {
            var blockers = (preflight.blockers || []).map(function (b) {
              return '<li><strong>' + esc(b.table || 'Référence') + '</strong> · ' + (b.rows == null ? 'vérification nécessaire' : esc(b.rows) + ' ligne(s)') + ' · ' + esc(b.reason || 'Règle de suppression non sûre') + '</li>';
            }).join('');
            box.innerHTML = '<div class="icrm-delete-preview is-blocked"><strong>Suppression suspendue — dépendance non cartographiée</strong><p>Le système n’effacera rien tant qu’une référence SQL n’aura pas une règle de conservation ou de suppression explicite.</p><ul>' + blockers + '</ul></div>';
          }
        } catch (err) {
          box.textContent = err.message || 'Prévisualisation impossible.';
          hardDeleteBtn.disabled = true;
        } finally {
          setBusy(false);
          hardDeleteBtn.disabled = !(preflight && preflight.can_delete && confirmInput.value === 'SUPPRIMER' && reasonInput.value.trim().length >= 3);
        }
      }
      preflightBtn.addEventListener('click', runPreflight);
      confirmInput.addEventListener('input', function () {
        hardDeleteBtn.disabled = !(preflight && preflight.can_delete && confirmInput.value === 'SUPPRIMER' && reasonInput.value.trim().length >= 3);
      });
      reasonInput.addEventListener('input', function () {
        hardDeleteBtn.disabled = !(preflight && preflight.can_delete && confirmInput.value === 'SUPPRIMER' && reasonInput.value.trim().length >= 3);
      });
      runPreflight();
      hardDeleteBtn.addEventListener('click', async function () {
        if (busy || !(preflight && preflight.can_delete) || confirmInput.value !== 'SUPPRIMER') return;
        if (!w.confirm('Suppression Auth définitive. Cette action ne peut pas être annulée. Continuer ?')) return;
        setBusy(true);
        try {
          var result = await api.adminDeleteMember({ memberId: m.id, reason: reasonInput.value.trim() });
          if (!result || result.deleted !== true) throw new Error(result?.warning || 'La suppression n’a pas été confirmée.');
          selectedId = ''; preflight = null; await refresh();
          detailNode.innerHTML = '<div class="icrm-admin-empty">Compte et données personnelles supprimés. Audit: ' + (result.auditRecorded ? 'confirmé.' : 'vérification requise.') + (result.storageCleaned === false ? ' Attention : certains fichiers Storage restent à vérifier.' : '') + '</div>';
        } catch (err) {
          // A failed attempt may have removed some Storage files. Force a fresh preview before any retry.
          preflight = null;
          hardDeleteBtn.disabled = true;
          var parts = [String(err && err.message || 'Suppression refusée par Supabase.')];
          if (err && err.status) parts.push('HTTP ' + String(err.status));
          if (err && err.detail) parts.push('Détail technique : ' + String(err.detail).slice(0, 700));
          if (err && err.recommendation) parts.push('À vérifier : ' + String(err.recommendation).slice(0, 500));
          message(parts.join('\n'), true);
        }
        finally { setBusy(false); }
      });
    }
    async function refresh(keepId) {
      var result = await api.getAdminMemberDirectory();
      members = Array.isArray(result) ? result : (result.members || []);
      if (keepId && members.some(function (m) { return m.id === keepId; })) selectedId = keepId;
      else if (!members.some(function (m) { return m.id === selectedId; })) selectedId = '';
      renderList(); renderDetail();
    }
    listNode.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-member]'); if (!btn) return;
      selectedId = btn.getAttribute('data-member'); preflight = null; renderList(); renderDetail();
    });
    searchNode.addEventListener('input', function () { filter = searchNode.value; renderList(); });
    root.querySelector('[data-refresh]').addEventListener('click', function () { refresh(selectedId).catch(function (err) { detailNode.textContent = err.message || 'Chargement impossible.'; }); });
    refresh().catch(function (err) { detailNode.textContent = err.message || 'Chargement impossible.'; });
    return { refresh: refresh, destroy: function () { root.innerHTML = ''; } };
  }
  w.ICRMMemberAdminPanel = { mount: mount };
})(window, document);
