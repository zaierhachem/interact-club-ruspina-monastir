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
  function previewGenderedTitle(title, gender) {
    var raw = String(title || '').trim(), key = raw.toLocaleLowerCase('fr');
    if (!raw || (gender !== 'female' && gender !== 'male')) return raw;
    var female = {
      'président': 'Présidente', 'président(e)': 'Présidente', 'vice-président': 'Vice-Présidente', 'vice-président(e)': 'Vice-Présidente',
      'secrétaire général(e)': 'Secrétaire Générale', 'chef(fe) du protocole': 'Cheffe du Protocole',
      'représentant(e) cnit': 'Représentante CNIT', 'conseiller(ère) général(e)': 'Conseillère Générale',
      'trésorier': 'Trésorière', 'trésorier(e)': 'Trésorière', 'directeur': 'Directrice',
      'coordinateur': 'Coordinatrice', 'animateur': 'Animatrice', 'ambassadeur': 'Ambassadrice',
      'ingénieur': 'Ingénieure', 'chef de commission': 'Cheffe de commission'
    };
    var male = {
      'président(e)': 'Président', 'présidente': 'Président', 'vice-président(e)': 'Vice-Président',
      'vice-présidente': 'Vice-Président', 'secrétaire général(e)': 'Secrétaire Général',
      'secrétaire générale': 'Secrétaire Général', 'chef(fe) du protocole': 'Chef du Protocole',
      'cheffe du protocole': 'Chef du Protocole', 'représentant(e) cnit': 'Représentant CNIT',
      'représentante cnit': 'Représentant CNIT', 'conseiller(ère) général(e)': 'Conseiller Général',
      'conseillère générale': 'Conseiller Général', 'trésorière': 'Trésorier', 'directrice': 'Directeur',
      'coordinatrice': 'Coordinateur', 'animatrice': 'Animateur', 'ambassadrice': 'Ambassadeur',
      'ingénieure': 'Ingénieur', 'cheffe de commission': 'Chef de commission'
    };
    var exact = (gender === 'female' ? female : male)[key];
    if (exact) return exact;
    if (gender === 'female' && /^co-chef(?:\s|$)/i.test(raw)) return raw.replace(/^co-chef/i, 'Co-cheffe');
    if (gender === 'female' && /^chef(?:\s|$)/i.test(raw)) return raw.replace(/^chef/i, 'Cheffe');
    if (gender === 'male' && /^co-cheffe(?:\s|$)/i.test(raw)) return raw.replace(/^co-cheffe/i, 'Co-chef');
    if (gender === 'male' && /^cheffe(?:\s|$)/i.test(raw)) return raw.replace(/^cheffe/i, 'Chef');
    if (gender === 'female' && /teur(?=$|\s)/i.test(raw)) return raw.replace(/teur/i, 'trice');
    if (gender === 'female' && /eur(?=$|\s)/i.test(raw)) return raw.replace(/eur/i, 'euse');
    if (gender === 'male' && /trice(?=$|\s)/i.test(raw)) return raw.replace(/trice/i, 'teur');
    if (gender === 'male' && /euse(?=$|\s)/i.test(raw)) return raw.replace(/euse/i, 'eur');
    return raw;
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
          '<h3 class="pt-h3" data-position-title-preview>' + e(p.displayTitle || p.title || 'Nouveau poste') + '</h3></div>' +
          (p.isPublic ? U.chip(['Site public', 'ok']) : U.chip(['Privé', 'neutral'])) +
        '</header>' + warning +
        '<div class="pt-team-admin__fields">' +
          '<div class="pt-field"><label for="' + e(titleId) + '">Intitulé du poste</label><input id="' + e(titleId) + '" name="title" type="text" minlength="2" maxlength="100" required value="' + e(p.title) + '" placeholder="Ex. Président(e)"></div>' +
          '<div class="pt-field"><label for="team-position-person-' + e(id || 'new-' + index) + '">Membre affecté</label><select id="team-position-person-' + e(id || 'new-' + index) + '" name="profile_id" data-position-profile-select>' + peopleOptions(workspace.profiles, p.profileId) + '</select></div>' +
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
    var eligible = (people || []).filter(function (p) { return (p.status === 'active' || p.status === 'follow_up') && p.role !== 'bureau' && p.role !== 'super_admin'; });
    var html = '<option value="">Choisir un responsable</option>';
    return html + eligible.slice().sort(function (a, b) { return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'fr'); }).map(function (p) {
      return '<option value="' + e(p.id) + '"' + (String(p.id) === String(selectedId || '') ? ' selected' : '') + '>' + e(p.fullName || 'Nom non renseigné') + ' · ' + e(roleLabel(p.role)) + (p.status === 'follow_up' ? ' — À suivre' : '') + '</option>';
    }).join('');
  }
  function safePortrait(value) {
    var url = String(value || '').trim();
    if (/^https:\/\//i.test(url)) return url;
    if (/^\/?assets\/[a-z0-9_./-]+$/i.test(url) && !/(^|\/)\.\.(\/|$)/.test(url)) return url;
    return '';
  }
  function adminPortraitSrc(value) {
    var photo = safePortrait(value);
    if (/^\/?assets\//i.test(photo)) return '../' + photo.replace(/^\//, '');
    return photo;
  }
  function renderHeadPreview(head, rankLabel) {
    if (!head) return '<div class="pt-team-admin__head-preview is-empty"><span class="pt-team-admin__head-avatar" aria-hidden="true">—</span><span><strong>' + e(rankLabel) + '</strong><small>Poste vacant</small></span></div>';
    var photo = adminPortraitSrc(head.photoUrl) || adminPortraitSrc(head.avatarUrl);
    var genderClass = head.gender === 'female' ? ' pt-team-admin__head-avatar--female' : head.gender === 'male' ? ' pt-team-admin__head-avatar--male' : ' pt-team-admin__head-avatar--unknown';
    var avatar = photo
      ? '<img class="pt-team-admin__head-avatar' + genderClass + '" src="' + e(photo) + '" alt="" loading="lazy">'
      : '<span class="pt-team-admin__head-avatar' + genderClass + '" aria-hidden="true">' + e(U.initials(head.name || 'Membre')) + '</span>'; 
    var status = statusLabel(head.status);
    return '<div class="pt-team-admin__head-preview' + (usableStatus(head.status) ? '' : ' is-inactive') + '">' + avatar +
      '<span><strong>' + e(head.name || 'Nom non renseigné') + '</strong><small>' + e(rankLabel) + ' · ' + e(status) + '</small></span></div>';
  }
  // Shared by renderHeadCard() and mount(). Keeping this at module scope is
  // essential: mount()->syncPreview() runs after the HTML is rendered.
  function publicCommissionTitle(head, isPaired) {
    var gender = head && head.gender;
    if (isPaired) return gender === 'female' ? 'Co-cheffe de commission' : gender === 'male' ? 'Co-chef de commission' : 'Co-chef(fe) de commission';
    return gender === 'female' ? 'Cheffe de commission' : gender === 'male' ? 'Chef de commission' : 'Chef(fe) de commission';
  }
  function usableStatus(status) { return status === 'active' || status === 'follow_up'; }
  function renderHeadCard(commission, workspace, index) {
    var heads = (commission.heads || []).slice().sort(function (a, b) {
      var ar = Number(a.rank) || 99, br = Number(b.rank) || 99;
      return ar - br || String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    // Les rangs restent internes : en public, un binôme est présenté comme deux co-chefs.
    var primary = heads.filter(function (h) { return Number(h.rank) === 1; })[0] || null;
    var deputy = heads.filter(function (h) { return Number(h.rank) === 2; })[0] || null;
    var usable = function (h) { return !!h && usableStatus(h.status); };
    var primaryId = usable(primary) ? primary.id : '';
    var deputyId = usable(deputy) ? deputy.id : '';
    var activeCount = heads.filter(usable).length;
    var invalidRankCount = heads.filter(function (h) { return ![1, 2].includes(Number(h.rank)); }).length;
    var paired = !!(primaryId && deputyId);
    var warning = !primaryId || activeCount > 2 || invalidRankCount > 0;
    var warningText = !primaryId
      ? 'Un premier responsable actif ou « À suivre » est obligatoire. Le deuxième responsable reste facultatif.'
      : (activeCount > 2 || invalidRankCount > 0
        ? 'Des affectations de responsables supplémentaires ou sans rang valide existent. Enregistre une composition limitée à deux personnes.'
        : '');
    var primaryPreviewLabel = primary ? publicCommissionTitle(primary, paired) : 'Chef(fe) de commission';
    var deputyPreviewLabel = deputy ? publicCommissionTitle(deputy, true) : 'Co-chef(fe) de commission';
    return '<article class="pt-team-admin__commission" data-team-head-card data-commission-id="' + e(commission.id) + '">' +
      '<header class="pt-team-admin__position-head"><div><p class="pt-eyebrow">' + (commission.isActive ? 'COMMISSION ACTIVE' : 'COMMISSION INACTIVE') + '</p><h3 class="pt-h3">' + e(commission.name) + '</h3></div>' +
      (commission.isActive ? U.chip(['Active', 'ok']) : U.chip(['Inactive', 'neutral'])) + '</header>' +
      (commission.description ? '<p class="pt-ccard__desc">' + e(commission.description) + '</p>' : '') +
      '<div class="pt-team-admin__head-current" data-head-preview><p class="pt-eyebrow">APERÇU DES INTITULÉS AUTOMATIQUES</p>' +
        '<div data-head-preview-slot="primary">' + renderHeadPreview(primary, primaryPreviewLabel) + '</div><div data-head-preview-slot="deputy">' + renderHeadPreview(deputy, deputyPreviewLabel) + '</div></div>' +
      (warning ? '<p class="pt-team-admin__warning" role="status">' + e(warningText) + '</p>' : '') +
      '<div class="pt-team-admin__fields">' +
        '<div class="pt-field"><label for="head-one-' + e(commission.id) + '">Premier responsable <span aria-hidden="true">· obligatoire</span></label><select id="head-one-' + e(commission.id) + '" data-head-select required>' + headOptions(workspace.profiles, primaryId) + '</select><small class="pt-hint">Le rang principal reste interne. Si la commission a deux responsables, les deux seront affichés comme co-chefs.</small></div>' +
        '<div class="pt-field"><label for="head-two-' + e(commission.id) + '">Deuxième responsable <span aria-hidden="true">· facultatif</span></label><select id="head-two-' + e(commission.id) + '" data-head-select>' + headOptions(workspace.profiles, deputyId) + '</select><small class="pt-hint">Sélectionne ici un deuxième membre différent, puis clique sur « Enregistrer les responsables ». En public, les deux seront affichés comme co-chefs.</small></div>' +
        '<p class="pt-team-admin__auto-title-note">Intitulés automatiques selon le genre renseigné dans chaque profil : une personne reçoit Chef/Cheffe de commission ; deux personnes reçoivent chacune Co-chef/Co-cheffe de commission.</p>' +
        '<div class="pt-field"><label for="head-photo-one-' + e(commission.id) + '">Portrait du premier responsable (facultatif)</label><input id="head-photo-one-' + e(commission.id) + '" type="text" data-head-photo data-photo-owner="' + e(primaryId) + '" maxlength="2048" value="' + e(primary && primary.photoUrl || '') + '" placeholder="https://… ou assets/team/portrait.jpg" autocomplete="url"><small class="pt-hint">URL HTTPS ou chemin assets/. Si vide, le portrait du profil est utilisé.</small></div>' +
        '<div class="pt-field"><label for="head-photo-two-' + e(commission.id) + '">Portrait du deuxième responsable (facultatif)</label><input id="head-photo-two-' + e(commission.id) + '" type="text" data-head-photo data-photo-owner="' + e(deputyId) + '" maxlength="2048" value="' + e(deputy && deputy.photoUrl || '') + '" placeholder="https://… ou assets/team/portrait.jpg" autocomplete="url"><small class="pt-hint">Tu peux utiliser une URL HTTPS ou une image déjà présente dans assets/.</small></div>' +
      '</div>' +
      '<div class="pt-team-admin__position-foot"><p class="pt-hint">Les rôles internes et les appartenances restent synchronisés par la base. Les profils inactifs ne peuvent pas être affectés.</p><button type="button" class="pt-btn pt-btn--primary" data-team-save-heads>' + U.icon('check') + 'Enregistrer les responsables</button></div>' +
      '</article>';
  }

  function renderHeads(workspace) {
    var commissions = workspace.commissions || [];
    var activeCount = Number(workspace.activeCommissionCount) || commissions.filter(function (c) { return c.isActive; }).length;
    var readyCount = Number(workspace.readyCommissionCount) || 0;
    var ready = workspace.publicReady === true;
    var state = ready ? 'Composition publique prête' : 'Publication en attente';
    var note = ready
      ? 'Toutes les commissions actives ont un premier responsable valide. Avec deux responsables, chacun apparaît comme co-chef ; avec une seule personne, son intitulé est automatiquement féminisé ou masculinisé selon le profil. Les portraits sont personnalisables et le site se synchronise automatiquement.'
      : 'Pour publier le Bureau élargi, chaque commission active doit avoir au moins un responsable actif ou « À suivre » avec un nom renseigné. Le deuxième responsable est facultatif. L’intitulé est automatiquement adapté au genre du profil. Tu peux ajouter un portrait par URL HTTPS ou chemin assets/.';
    return '<section class="pt-card pt-team-admin__summary"><div class="pt-team-admin__summary-copy"><span class="pt-team-admin__status ' + (ready ? 'is-published' : 'is-draft') + '"><span aria-hidden="true"></span>' + state + '</span>' +
      '<p class="pt-hint">' + readyCount + ' / ' + activeCount + ' commissions actives avec chef principal</p></div>' +
      '<p class="pt-team-admin__note">' + note + '</p>' +
      '<div class="pt-team-admin__wide-stats"><span><strong>' + readyCount + '</strong><small>Prêtes</small></span><span><strong>' + Math.max(0, activeCount - readyCount) + '</strong><small>À compléter</small></span><span><strong>' + activeCount + '</strong><small>Actives</small></span></div>' +
      '</section>' +
      '<div class="pt-team-admin__toolbar"><div><p class="pt-eyebrow">RESPONSABLES DES COMMISSIONS</p><h2 class="pt-h2">Le Bureau élargi</h2></div></div>' +
      '<p class="pt-team-admin__note">Une seule source de vérité : les responsables restent des membres de leur commission (rang 1 ou 2). Le rang sert à organiser l’administration ; le site public affiche un binôme comme deux co-chefs et adapte automatiquement Chef/Cheffe et Co-chef/Co-cheffe selon le genre de chaque responsable. Aucun registre parallèle n’est créé.</p>' +
      (commissions.length ? '<div class="pt-team-admin__commission-grid">' + commissions.map(function (c, i) { return renderHeadCard(c, workspace, i); }).join('') + '</div>' : '<section class="pt-card">' + U.empty('Aucune commission n’est enregistrée dans la base.') + '</section>');
  }

  function errorText(err) {
    var m = String(err && err.message || '').toLowerCase();
    if (/super admin|42501|permission denied|forbidden/.test(m)) return 'Accès refusé : cette fonction est réservée au Super Admin.';
    if (/commission_one_responsable_idx/.test(m)) return 'La base utilise encore l’ancienne règle « un seul responsable ». Applique la migration de correction des deux responsables, puis réessaie.';
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
        var titleInput = form.querySelector('[name="title"]');
        var profileSelect = form.querySelector('[data-position-profile-select]');
        var titlePreview = form.querySelector('[data-position-title-preview]');
        function updateTitlePreview() {
          if (!titlePreview || !titleInput) return;
          var selected = (workspace.profiles || []).filter(function (person) { return profileSelect && String(person.id) === String(profileSelect.value); })[0];
          titlePreview.textContent = previewGenderedTitle(titleInput.value, selected && selected.gender);
        }
        if (profileSelect) profileSelect.addEventListener('change', updateTitlePreview);
        if (titleInput) titleInput.addEventListener('input', updateTitlePreview);
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
        var photoInputs = Array.prototype.slice.call(card.querySelectorAll('[data-head-photo]'));
        var commission = (workspace.commissions || []).filter(function (item) { return String(item.id) === String(card.getAttribute('data-commission-id')); })[0];
        var currentHeads = commission && Array.isArray(commission.heads) ? commission.heads : [];
        function syncPreview() {
          var selected = selects.map(function (select) {
            var id = select && select.value;
            if (!id) return null;
            var person = (workspace.profiles || []).filter(function (p) { return String(p.id) === String(id); })[0] || {};
            var existing = currentHeads.filter(function (head) { return String(head.id) === String(id); })[0] || {};
            var photoInput = photoInputs[selects.indexOf(select)];
            return { id: id, name: person.fullName || existing.name || 'Membre', status: person.status || existing.status || 'active',
              gender: person.gender || null, avatarUrl: person.avatarUrl || existing.avatarUrl || null,
              photoUrl: photoInput && photoInput.value.trim() || existing.photoUrl || null };
          });
          var selectedCount = selected.filter(Boolean).length;
          var primarySlot = card.querySelector('[data-head-preview-slot="primary"]');
          var deputySlot = card.querySelector('[data-head-preview-slot="deputy"]');
          if (primarySlot) primarySlot.innerHTML = renderHeadPreview(selected[0], selectedCount > 1 ? publicCommissionTitle(selected[0], true) : publicCommissionTitle(selected[0], false));
          if (deputySlot) deputySlot.innerHTML = selected[1] ? renderHeadPreview(selected[1], publicCommissionTitle(selected[1], true)) : renderHeadPreview(null, 'Deuxième responsable (facultatif)');
        }
        function syncOptions() {
          selects.forEach(function (select, idx) {
            var other = selects[1 - idx];
            Array.prototype.forEach.call(select.options, function (opt) {
              opt.disabled = !!opt.value && opt.value === other.value && opt.value !== select.value;
            });
          });
          if (photoInputs[0]) photoInputs[0].disabled = !(selects[0] && selects[0].value);
          if (photoInputs[1]) photoInputs[1].disabled = !(selects[1] && selects[1].value);
          syncPreview();
        }
        selects.forEach(function (select, index) {
          select.addEventListener('change', function () {
            var selectedId = select.value;
            var photoInput = photoInputs[index];
            if (photoInput && photoInput.dataset.photoOwner !== selectedId) {
              var previous = currentHeads.filter(function (head) { return String(head.id) === String(selectedId); })[0];
              photoInput.value = previous && previous.photoUrl ? previous.photoUrl : '';
              photoInput.dataset.photoOwner = selectedId;
            }
            syncOptions();
          });
        });
        photoInputs.forEach(function (input) { if (input) input.addEventListener('input', syncPreview); });
        syncOptions();
        var save = card.querySelector('[data-team-save-heads]');
        if (save) save.addEventListener('click', function () {
          var primaryId = selects[0] && selects[0].value;
          var deputyId = selects[1] && selects[1].value;
          if (!primaryId) { U.toast('Choisis le premier responsable. Le deuxième reste facultatif.'); if (selects[0]) selects[0].focus(); return; }
          if (deputyId && deputyId === primaryId) { U.toast('Les deux responsables doivent être différents.'); selects[1].focus(); return; }
          var ids = [primaryId];
          if (deputyId) ids.push(deputyId);
          var photos = photoInputs.slice(0, ids.length).map(function (input) { return input ? input.value.trim() : ''; });
          busy(save, 'Enregistrement…', function () {
            return P.api.adminSetCommissionHeads({
              commissionId: card.getAttribute('data-commission-id'),
              headIds: ids,
              photoUrls: photos
            });
          }, 'Les responsables et leurs portraits ont été enregistrés. Les intitulés genrés se mettent à jour automatiquement sur le site public.');
        });
      });
    }
  }

  P.teamAdmin = { renderBureau: renderBureau, renderHeads: renderHeads, mount: mount };
})();
