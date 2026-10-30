/* ICRM IMPACT — espace Bureau/Super Admin pour les ajustements XP motivés. */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views;
  var ROLE = { member: 'Membre', commission_head: 'Chef de commission', bureau: 'Bureau', super_admin: 'Super Admin' };
  var STATUS = { active: 'Actif', follow_up: 'À suivre' };

  function membersTable(members) {
    if (!members.length) return U.empty('Aucun membre actif ou à suivre.');
    return '<div class="pt-xpa__table-wrap"><table class="pt-xpa__table"><thead><tr><th scope="col">Membre</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">XP actuel</th></tr></thead><tbody>' +
      members.map(function (m) {
        return '<tr><th scope="row">' + e(m.fullName) + '</th><td>' + e(ROLE[m.role] || m.role || 'Membre') + '</td><td>' + e(STATUS[m.status] || m.status || '—') + '</td><td><b>' + e(m.totalXp) + '</b> XP</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  V['gestion-xp'] = {
    title: 'Gestion XP',
    load: function (api) { return api.getXpAdjustmentMembers(); },
    render: function (d) {
      var members = d.members || [];
      var opts = '<option value="">Choisir un membre</option>' + members.map(function (m) {
        return '<option value="' + e(m.id) + '">' + e(m.fullName) + ' · ' + e(m.totalXp) + ' XP · ' + e(ROLE[m.role] || m.role || 'Membre') + '</option>';
      }).join('');
      return U.pageHead('Administration du club', 'Gestion XP', 'Effectue un ajustement exceptionnel, documenté et traçable. Les gains normaux restent calculés automatiquement par la base.') +
        '<div class="pt-xpa__layout">' +
          '<section class="pt-card pt-xpa__form-card" aria-labelledby="xpa-title"><header class="pt-card__head"><div><p class="pt-eyebrow">ICRM IMPACT</p><h2 class="pt-h3" id="xpa-title">Ajustement administratif</h2></div></header>' +
            '<p class="pt-hint">Réservé au Bureau et au Super Admin. Chaque écriture ajoute une ligne au journal XP ; l’historique existant n’est jamais modifié.</p>' +
            '<form id="xpAdjustmentForm" class="pt-xpa__form" novalidate>' +
              '<div class="pt-field"><label for="xpa-member">Membre concerné</label><select id="xpa-member" name="memberId" required>' + opts + '</select><small class="pt-hint">La liste affiche les profils actifs ou « À suivre » et leur total XP actuel.</small></div>' +
              '<div class="pt-field"><label for="xpa-delta">Ajustement XP (+ ou −)</label><input id="xpa-delta" name="delta" type="number" min="-500" max="500" step="1" required inputmode="numeric" placeholder="Ex. 25 ou -10"><small class="pt-hint">Entre −500 et +500 XP par opération ; 0 est interdit.</small></div>' +
              '<div class="pt-field"><label for="xpa-reason">Motif obligatoire</label><textarea id="xpa-reason" name="reason" rows="3" minlength="3" maxlength="300" required placeholder="Ex. correction documentée après vérification du rapport d’activité."></textarea><small class="pt-hint">3 à 300 caractères. Le motif est enregistré avec l’identité de l’administrateur.</small></div>' +
              '<p class="pt-formerr" id="xpa-error" role="alert" hidden></p>' +
              '<button type="submit" class="pt-btn pt-btn--primary"' + (members.length ? '' : ' disabled') + '>' + U.icon('check') + 'Enregistrer l’ajustement</button>' +
            '</form>' +
          '</section>' +
          '<section class="pt-card pt-xpa__roster" aria-labelledby="xpa-roster-title"><header class="pt-card__head"><div><p class="pt-eyebrow">VUE DE CONTRÔLE</p><h2 class="pt-h3" id="xpa-roster-title">Situation XP des membres</h2></div><span class="pt-chip">' + members.length + ' profil' + (members.length > 1 ? 's' : '') + '</span></header>' +
            '<p class="pt-hint">Le total est fourni par Supabase. Les corrections de présence et les ajustements apparaissent dans l’historique personnel du membre.</p>' + membersTable(members) +
          '</section>' +
        '</div>';
    },
    mount: function (root) {
      var form = root.querySelector('#xpAdjustmentForm');
      if (!form) return;
      var error = root.querySelector('#xpa-error'), submit = form.querySelector('[type="submit"]');
      function fail(message) { error.textContent = message; error.hidden = false; }
      form.addEventListener('submit', function (event) {
        event.preventDefault(); error.hidden = true; error.textContent = '';
        var memberId = form.elements.memberId.value;
        var delta = Number(form.elements.delta.value);
        var reason = String(form.elements.reason.value || '').trim();
        if (!memberId) { fail('Choisis le membre concerné.'); form.elements.memberId.focus(); return; }
        if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 500) { fail('Entre un nombre entier entre −500 et +500, différent de zéro.'); form.elements.delta.focus(); return; }
        if (reason.length < 3 || reason.length > 300) { fail('Le motif doit contenir entre 3 et 300 caractères.'); form.elements.reason.focus(); return; }
        if (delta < 0 && !window.confirm('Confirmer une correction négative de ' + delta + ' XP ? Le motif sera ajouté à l’historique du membre.')) return;
        submit.disabled = true; submit.setAttribute('aria-busy', 'true');
        P.api.recordXpAdjustment(memberId, delta, reason).then(function (result) {
          U.toast(result && result.mock ? 'Maquette : aucune donnée réelle n’a été enregistrée.' : 'Ajustement XP ajouté au journal avec son motif.');
          if (P.app && P.app.refresh) P.app.refresh();
        }).catch(function (err) {
          submit.disabled = false; submit.removeAttribute('aria-busy');
          fail(P.auth.friendly(err) || 'L’ajustement n’a pas été enregistré. Réessaie.');
        });
      });
    }
  };
})();
