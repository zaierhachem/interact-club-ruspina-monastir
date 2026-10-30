/* ICRM — SUPER ADMIN · GESTION DU BUREAU EXÉCUTIF ET DU BUREAU ÉLARGI
   Toutes les écritures passent par des RPC sécurisées ; aucune table administrative n'est modifiée directement. */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc;
  var TEAM_ROLES = P.config.ROLES;

  function roleLabel(role) {
    return TEAM_ROLES[role] ? TEAM_ROLES[role].label : (role || 'Membre');
  }
  function statusLabel(status) {
    return status === 'active' ? 'Actif' : status === 'follow_up' ? 'À suivre' : status === 'inactive' ? 'Inactif' : 'Statut inconnu';
  }
  function statusTone(status) {
    return status === 'active' ? 'ok' : status === 'follow_up' ? 'warn' : 'neutral';
  }
  function peopleOptions(people, selectedId) {
    var list = (people || []).slice().sort(function (a, b) {
      return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'fr');
    });
    var html = '<option value="">Poste vacant — aucun membre</option>';
    return html + list.map(function (p) {
      var active = p.status === 'active' || p.status === 'follow_up';
      var selected = String(p.id) === String(selectedId || '') ? ' selected' : '';
      var disabled = !active && !selected ? ' disabled' : '';
      return '<option value="' + e(p.id) + '"' + selected + disabled + '>' + e(p.fullName || 'Nom non renseigné') + ' · ' + e(roleLabel(p.role)) + (active ? '' : ' — compte inactif') + '</option>';
    }).join('');
  }
  function positionCard(position, workspace, index, draft) {
    var p = position || { id: '', title: '', profileId: null, photoUrl: '', displayOrder: ((workspace.positions || []).length + 1) * 10, isPublic: true };
    var id = p.id || '', titleId = 'team-position-title-' + (id || 'new-' + index);
    var publicChecked = p.isPublic !== false ? ' checked' : '';
    var assignedName = p.profileName || ((workspace.profiles || []).filter(function (x) { return x.id === p.profileId; })[0] || {}).fullName;
    var warning = p.profileId && p.profileStatus && p.profileStatus !== 'active' && p.profileStatus !== 'follow_up'
      ? '<p class="pt-team-admin__warning" role="status">Ce profil est inactif. Remplace-le avant de publier ce poste.</p>' : '';
    return '<article class="pt-team-admin__position' + (draft ? ' pt-team-admin__position--draft' : '') + '">' +
      '<form data-team-position-form data-position-id="' + e(id) + '">' +
        '<header class="pt-team-admin__position-head"><div><p class="pt-eyebrow">' + (draft ? 'NOUVEAU POSTE' : 'POSTE ' + String(index + 1).padStart(2, '0')) + '</p>' +
          '<h3 class="pt-h3">' + e(p.title || 'Nouveau poste') + '</h3></div>' +
          (p.isPublic ? U.chip(['Site public', 'ok']) : U.chip(['Privé', 'neutral'])) +
        '</header>' + warning +
        '<div class="pt-team-admin__fields">' +
          '<div class="pt-field"><label for="' + e(titleId) + '">Intitulé du poste</label><input id="' + e(titleId) + '" name="title" type="text" minlength="2" maxlength="100" required value="' + e(p.title) + '" placeholder="Ex. Président(e)"></div>' +
          '<div class="pt-field"><label for="team-position-person-' + e(id || 'new-' + index) + '">Membre affecté</label><select id="team-position-person-' + e(id || 'new-' + index) + '" name="profile_id">' + peopleOptions(workspace.profiles, p.profileId) + '</select></div>' +
          '<div class="pt-field"><label for="team-position-order-' + e(id || 'new-' + index) + '">Ordre d’affichage</label><input id="team-position-order-' + e(id || 'new-' + index) + '" name="display_order" type="number" min="0" max="999" step="10" required value="' + e(p.displayOrder == null ? 100 : p.displayOrder) + '"></div>' +
          '<div class="pt-field pt-team-admin__photo-field"><label for="team-position-photo-' + e(id || 'new-' + index) + '">Photo publique (facultatif)</label><input id="team-position-photo-' + e(id || 'new-' + index) + '" name="photo_url" type="text" maxlength="2048" value="' + e(p.photoUrl || '') + '" placeholder="https://… ou assets/team/portrait.jpg" autocomplete="url"><small class="pt-hint">URL HTTPS ou chemin du dossier assets/. Si vide, la photo du profil est utilisée si elle est définie ; sinon un visuel de remplacement apparaît.</small></div>' +
        '</div>' +
        '<div class="pt-team-admin__position-foot"><label class="pt-team-admin__check"><input type="checkbox" name="is_public"' + publicChecked + '><span>Afficher sur le site public</span></label><div class="pt-team-admin__actions">' +
          '<button type="submit" class="pt-btn pt-btn--primary">' + U.icon('check') + (draft ? 'Créer le poste' : 'Enregistrer') + '</button>' +
          (draft ? '' : '<button type="button" class="pt-btn pt-btn--danger" data-team-position-delete="' + e(id) + '">Supprimer</button>') +
        '</div></div>' +
      '</form></article>';
  }

  function renderBureau(workspace) {
    var positions = workspace.positions || [];
    var assigned = positions.filter(function (p) { return !!p.profileId; }).length;
    var publicCount = positions.filter(function (p) { return p.isPublic; }).length;
    var published = workspace.published === true;
    var state = published ? 'Synchronisation publique active' : 'En attente d’une composition publique complète';
    var note = published
      ? 'Chaque enregistrement ou suppression est synchronisé automatiquement avec le site public. Les postes privés, vacants ou liés à un profil inactif/sans nom ne sont pas affichés. Le site public actualise les changements automatiquement.'
      : 'Aucune publication manuelle n’est nécessaire. Pour la première synchronisation, affecte un membre actif ou « À suivre » avec un nom renseigné à chaque poste public, ou masque les postes vacants. Dès que la composition est complète, elle est publiée automatiquement. Ensuite, chaque ajout, modification ou suppression est répercuté sans redéployer le site.';
    return '<section class="pt-card pt-team-admin__summary"><div class="pt-team-admin__summary-copy"><span class="pt-team-admin__status ' + (published ? 'is-published' : 'is-draft') + '"><span aria-hidden="true"></span>' + state + '</span>' +
      '<p class="pt-hint">' + assigned + ' poste' + (assigned > 1 ? 's' : '') + ' affecté' + (assigned > 1 ? 's' : '') + ' sur ' + positions.length + ' · ' + publicCount + ' poste' + (publicCount > 1 ? 's' : '') + ' prévu' + (publicCount > 1 ? 's' : '') + ' pour le site.</p></div>' +
      '<p class="pt-team-admin__note">' + note + '</p></section>' +
      '<div class="pt-team-admin__toolbar"><div><p class="pt-eyebrow">COMPOSITION</p><h2 class="pt-h2">Les postes du Bureau exécutif</h2></div><div class="pt-team-admin__toolbar-actions"><button type="button" class="pt-btn pt-btn--ghost" data-team-add-position>' + U.icon('plus') + 'Ajouter un poste</button></div></div>' +
      '<div class="pt-team-admin__grid">' +
        positions.map(function (p, i) { return positionCard(p, workspace, i, false); }).join('') +
        positionCard(null, workspace, positions.length, true) +
      '</div>';
  }

  function headOptions(people, selectedId) {
    var eligible = (people || []).filter(function (p) { return p.status === 'active' || p.status === 'follow_up'; });
    var html = '<option value="">Choisir un responsable</option>';
    return html + eligible.slice().sort(function (a, b) { return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'fr'); }).map(function (p) {
      return '<option value="' + e(p.id) + '"' + (String(p.id) === String(selectedId || '') ? ' selected' : '') + '>' + e(p.fullName || 'Nom non renseigné') + ' · ' + e(roleLabel(p.role)) + (p.status === 'follow_up' ? ' — À suivre' : '') + '</option>';
    }).join('');
  }
  function renderHeadCard(commission, workspace, index) {
    var heads = (commission.heads || []).slice().sort(function (a, b) {
      var ar = Number(a.rank) || 99, br = Number(b.rank) || 99;
      return ar - br || String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    var primary = heads.filter(function (h) { return Number(h.rank) === 1; })[0] || heads[0] || null;
    var deputy = heads.filter(function (h) { return Number(h.rank) === 2; })[0] || heads.filter(function (h) { return h.id !== (primary && primary.id); })[0] || null;
    var usable = function (h) { return !!h && (h.status === 'active' || h.status === 'follow_up'); };
    var primaryId = usable(primary) ? primary.id : '';
    var deputyId = usable(deputy) ? deputy.id : '';
    var activeCount = heads.filter(usable).length;
    var warning = !primaryId || activeCount > 2;
    return '<article class="pt-team-admin__commission" data-team-head-card data-commission-id="' + e(commission.id) + '">' +
      '<header class="pt-team-admin__position-head"><div><p class="pt-eyebrow">' + (commission.isActive ? 'COMMISSION ACTIVE' : 'COMMISSION INACTIVE') + '</p><h3 class="pt-h3">' + e(commission.name) + '</h3></div>' +
      (commission.isActive ? U.chip(['Active', 'ok']) : U.chip(['Inactive', 'neutral'])) + '</header>' +
      (commission.description ? '<p class="pt-ccard__desc">' + e(commission.description) + '</p>' : '') +
      (warning ? '<p class="pt-team-admin__warning" role="status">' + (!primaryId ? 'Un chef actif ou « À suivre » est obligatoire. Le deuxième co-chef reste facultatif.' : 'Plus de deux responsables sont enregistrés : enregistre une composition propre.') + '</p>' : '') +
      '<div class="pt-team-admin__fields"><div class="pt-field"><label for="head-one-' + e(commission.id) + '">Chef de commission <span aria-hidden="true">· obligatoire</span></label><select id="head-one-' + e(commission.id) + '" data-head-select required>' + headOptions(workspace.profiles, primaryId) + '</select><small class="pt-hint">Ce profil devient chef de commission et rejoint automatiquement la commission si nécessaire.</small></div>' +
      '<div class="pt-field"><label for="head-two-' + e(commission.id) + '">Deuxième co-chef <span aria-hidden="true">· facultatif</span></label><select id="head-two-' + e(commission.id) + '" data-head-select>' + headOptions(workspace.profiles, deputyId) + '</select><small class="pt-hint">Tu peux laisser ce champ vide ou choisir un deuxième co-chef, avec les mêmes droits dans la commission.</small></div></div>' +
      '<div class="pt-team-admin__position-foot"><p class="pt-hint">Le rôle interne est synchronisé par la base. Les profils inactifs ne peuvent pas être affectés.</p><button type="button" class="pt-btn pt-btn--primary" data-team-save-heads>' + U.icon('check') + 'Enregistrer les responsables</button></div>' +
      '</article>';
  }
  function renderHeads(workspace) {
    var commissions = workspace.commissions || [];
    return '<section class="pt-card pt-team-admin__summary"><p class="pt-team-admin__note">Choisis un responsable principal ; l’adjoint est facultatif. Tout profil actif ou « À suivre » peut rejoindre le Bureau élargi et être désigné responsable de cette commission.</p></section>' +
      (commissions.length ? '<div class="pt-team-admin__commission-grid">' + commissions.map(function (c, i) { return renderHeadCard(c, workspace, i); }).join('') + '</div>' : '<section class="pt-card">' + U.empty('Aucune commission n’est enregistrée dans la base.') + '</section>');
  }

  function errorText(err) {
    var m = String(err && err.message || '').toLowerCase();
    if (/super admin|42501|permission denied|forbidden/.test(m)) return 'Accès refusé : cette fonction est réservée au Super Admin.';
    if (/another|autre poste|23505|duplicate key|unique constraint/.test(m)) return 'Cette personne ou cet intitulé est déjà utilisé. Vérifie la composition et réessaie.';
    if (/inactif|active ou à suivre|actif ou à suivre/.test(m)) return 'Choisis un profil actif ou « À suivre » avant d’enregistrer.';
    if (/publier|publication|poste vacant/.test(m)) return 'Pour publier, affecte un membre actif ou à suivre à chaque poste public, ou masque les postes vacants.';
    if (/responsable principal|choisis un responsable|responsable différent/.test(m)) return 'Choisis un responsable principal actif. Le responsable adjoint est facultatif, mais doit être différent du principal.';
    if (/introuvable|n'existe pas/.test(m)) return 'La donnée a changé ou n’existe plus. Recharge la page puis réessaie.';
    return 'L’enregistrement a échoué. Vérifie la connexion à Supabase puis réessaie.';
  }
  function busy(button, busyText, work, successText) {
    var old = button.textContent;
    button.disabled = true;
    button.textContent = busyText || 'Enregistrement…';
    Promise.resolve().then(work).then(function () {
      U.toast(successText);
      if (P.app) P.app.refresh();
    }).catch(function (err) {
      button.disabled = false;
      button.textContent = old;
      U.toast(errorText(err));
    });
  }
  function mount(root, workspace, kind) {
    if (P.session.role !== 'super_admin') return;
    if (kind === 'bureau') {
      root.querySelectorAll('[data-team-position-form]').forEach(function (form) {
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var title = form.querySelector('[name="title"]').value.trim();
          var order = Number(form.querySelector('[name="display_order"]').value);
          var profileId = form.querySelector('[name="profile_id"]').value || null;
          var isPublic = form.querySelector('[name="is_public"]').checked;
          var photoUrl = form.querySelector('[name="photo_url"]').value.trim();
          var validPhoto = !photoUrl || (/^https:\/\//i.test(photoUrl) && !/\s/.test(photoUrl)) || (/^\/?assets\/[a-z0-9_./-]+$/i.test(photoUrl) && !/(^|\/)\.\.(\/|$)/.test(photoUrl));
          if (title.length < 2 || title.length > 100) { U.toast('Le titre doit contenir entre 2 et 100 caractères.'); return; }
          if (!Number.isInteger(order) || order < 0 || order > 999) { U.toast('L’ordre doit être un nombre entre 0 et 999.'); return; }
          if (photoUrl.length > 2048 || !validPhoto) { U.toast('Utilise une URL HTTPS ou un chemin assets/ valide pour la photo.'); return; }
          var button = form.querySelector('button[type="submit"]');
          busy(button, 'Enregistrement…', function () {
            return P.api.adminSaveClubPosition({ positionId: form.getAttribute('data-position-id') || null, title: title, profileId: profileId, displayOrder: order, isPublic: isPublic, photoUrl: photoUrl || null });
          }, 'Le poste du Bureau exécutif a été enregistré.');
        });
      });
      root.querySelectorAll('[data-team-position-delete]').forEach(function (button) {
        button.addEventListener('click', function () {
          if (typeof window.confirm === 'function' && !window.confirm('Supprimer ce poste du Bureau exécutif ? La personne ne sera pas supprimée du club.')) return;
          busy(button, 'Suppression…', function () { return P.api.adminDeleteClubPosition(button.getAttribute('data-team-position-delete')); }, 'Le poste a été supprimé.');
        });
      });
      var add = root.querySelector('[data-team-add-position]');
      if (add) add.addEventListener('click', function () {
        var draft = root.querySelector('.pt-team-admin__position--draft');
        if (draft) {
          var title = draft.querySelector('[name="title"]');
          if (title) title.focus();
          draft.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
    if (kind === 'chefs') {
      root.querySelectorAll('[data-team-head-card]').forEach(function (card) {
        var selects = Array.prototype.slice.call(card.querySelectorAll('[data-head-select]'));
        function syncOptions() {
          selects.forEach(function (select, idx) {
            var other = selects[1 - idx];
            Array.prototype.forEach.call(select.options, function (opt) {
              opt.disabled = !!opt.value && opt.value === other.value && opt.value !== select.value;
            });
          });
        }
        selects.forEach(function (s) { s.addEventListener('change', syncOptions); });
        syncOptions();
        var save = card.querySelector('[data-team-save-heads]');
        if (save) save.addEventListener('click', function () {
          var primaryId = selects[0] && selects[0].value;
          var deputyId = selects[1] && selects[1].value;
          if (!primaryId) { U.toast('Choisis le chef de commission. Le deuxième co-chef reste facultatif.'); if (selects[0]) selects[0].focus(); return; }
          if (deputyId && deputyId === primaryId) { U.toast('Le deuxième co-chef doit être différent du chef déjà choisi.'); selects[1].focus(); return; }
          var ids = [primaryId];
          if (deputyId) ids.push(deputyId);
          busy(save, 'Enregistrement…', function () { return P.api.adminSetCommissionHeads({ commissionId: card.getAttribute('data-commission-id'), headIds: ids }); }, 'La composition des responsables a été enregistrée.');
        });
      });
    }
  }

  P.teamAdmin = { renderBureau: renderBureau, renderHeads: renderHeads, mount: mount };
})();
