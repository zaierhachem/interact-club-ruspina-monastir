/* =========================================================================
   ICRM — ACCEPTATION D'UNE INVITATION SUPABASE
   - Vérifie un token_hash de type invite (lien recommandé dans le template e-mail).
   - Accepte aussi une session d'invitation renvoyée dans le fragment URL.
   - Le membre choisit son mot de passe et complète uniquement son nom/téléphone.
   - Aucun rôle, statut, commission ou privilège n'est modifiable depuis cette page.
   ========================================================================= */
(function () {
  'use strict';

  var P = window.ICRMPortal || {}, $ = function (id) { return document.getElementById(id); };
  var client = null, invitedUser = null, passwordSaved = false;
  var state = {
    checking: $('checkingState'), start: $('inviteStartState'), setup: $('setupState'), invalid: $('invalidState'), done: $('doneState')
  };

  function show(name) {
    Object.keys(state).forEach(function (key) { state[key].hidden = key !== name; });
    var heading = name === 'setup' ? $('inviteTitle') : (name === 'invalid' ? $('invalidState').querySelector('h1') : name === 'done' ? $('doneState').querySelector('h1') : null);
    if (heading) heading.focus();
  }

  function showInvalid(message) {
    if (message) $('invalidMessage').textContent = message;
    show('invalid');
  }

  function showError(message) {
    var box = $('inviteError');
    box.textContent = message;
    box.hidden = false;
    box.focus();
  }

  function clearError() {
    var box = $('inviteError');
    box.textContent = '';
    box.hidden = true;
  }

  function cleanVerifiedUrl() {
    try { window.history.replaceState({}, document.title, window.location.pathname + '?setup=1'); }
    catch (_) { /* La session Supabase reste valide même si le navigateur refuse l'URL propre. */ }
  }

  function safeAuthError(error) {
    var code = String(error && error.code || '').toLowerCase();
    var message = String(error && error.message || '').toLowerCase();
    if (code === 'otp_expired' || code === 'otp_disabled' || /expired|invalid.*token|token.*invalid/.test(message)) {
      return 'Ce lien est expiré, invalide ou a déjà été utilisé. Demande au bureau exécutif de renvoyer une invitation.';
    }
    if (code === 'same_password' || /same password/.test(message)) return null;
    if (code === 'weak_password' || /password.*weak|weak password/.test(message)) {
      return 'Ce mot de passe est trop facile à deviner. Choisis-en un autre, d’au moins 8 caractères.';
    }
    if (error && (error.status === 429 || code === 'over_request_rate_limit')) {
      return 'Trop de tentatives. Attends quelques minutes avant de réessayer.';
    }
    return 'La vérification n’a pas abouti. Vérifie ta connexion puis réessaie. Si le problème persiste, contacte le bureau.';
  }

  var pendingTokenHash = null;

  async function establishInviteSession() {
    var query = new URLSearchParams(window.location.search);
    var fragment = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
    pendingTokenHash = query.get('token_hash');
    var type = query.get('type') || fragment.get('type');

    /* Le token_hash n'est PAS consommé au chargement : le membre doit cliquer
       sur « Confirmer mon invitation ». Cela réduit le risque qu'un scanner
       automatique d'e-mail consomme le lien avant le membre. */
    if (pendingTokenHash) {
      if (type !== 'invite') throw new Error('INVALID_INVITE');
      show('start');
      return;
    }

    if (type === 'invite' && fragment.get('access_token') && fragment.get('refresh_token')) {
      var sessionResult = await client.auth.setSession({
        access_token: fragment.get('access_token'),
        refresh_token: fragment.get('refresh_token')
      });
      if (sessionResult.error || !sessionResult.data || !sessionResult.data.session) throw (sessionResult.error || new Error('INVITE_SESSION_MISSING'));
      cleanVerifiedUrl();
    } else if (query.get('code')) {
      var exchanged = await client.auth.exchangeCodeForSession(query.get('code'));
      if (exchanged.error || !exchanged.data || !exchanged.data.session) throw (exchanged.error || new Error('INVITE_SESSION_MISSING'));
      cleanVerifiedUrl();
    } else if (query.get('setup') !== '1') {
      throw new Error('INVALID_INVITE');
    }

    await loadInvitedProfile();
  }

  async function loadInvitedProfile() {
    var userResult = await client.auth.getUser();
    if (userResult.error || !userResult.data || !userResult.data.user) throw (userResult.error || new Error('NO_INVITE_USER'));
    invitedUser = userResult.data.user;

    var profileResult = await client.from('profiles')
      .select('id, full_name, phone, role, status')
      .eq('id', invitedUser.id)
      .maybeSingle();
    if (profileResult.error) throw new Error('PROFILE_READ_FAILED');
    if (!profileResult.data || profileResult.data.id !== invitedUser.id) throw new Error('PROFILE_NOT_PROVISIONED');

    $('inviteEmail').textContent = invitedUser.email || 'Adresse vérifiée';
    $('fullName').value = String(profileResult.data.full_name || '').slice(0, 100);
    $('phone').value = String(profileResult.data.phone || '').slice(0, 32);
    show('setup');
  }

  async function confirmInvite() {
    var button = $('verifyInviteBtn');
    button.disabled = true;
    button.textContent = 'Vérification en cours…';
    try {
      var verified = await client.auth.verifyOtp({ token_hash: pendingTokenHash, type: 'invite' });
      if (verified.error || !verified.data || !verified.data.session) throw (verified.error || new Error('INVITE_SESSION_MISSING'));
      cleanVerifiedUrl();
      pendingTokenHash = null;
      await loadInvitedProfile();
    } catch (error) {
      showInvalid(friendlySetupError(error));
    } finally {
      button.disabled = false;
      button.innerHTML = 'Confirmer mon invitation <span aria-hidden="true">→</span>';
    }
  }

  function friendlySetupError(error) {
    if (error && error.message === 'PROFILE_NOT_PROVISIONED') {
      return 'Ton invitation est confirmée, mais le profil membre n’a pas été créé automatiquement. Ne demande pas une deuxième invitation : contacte le Super Admin pour vérifier la création du profil.';
    }
    if (error && error.message === 'PROFILE_READ_FAILED') {
      return 'Le profil n’a pas pu être chargé. Recharge la page ; si le problème persiste, contacte le bureau.';
    }
    return safeAuthError(error) || 'Une étape de configuration doit être réessayée.';
  }

  document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
    button.addEventListener('click', function () {
      var field = $(button.getAttribute('data-toggle-password'));
      var visible = field.type === 'password';
      field.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', visible ? 'true' : 'false');
      button.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  });

  $('verifyInviteBtn').addEventListener('click', function () { confirmInvite(); });

  async function start() {
    if (!P.config || !P.config.BACKEND || P.config.BACKEND.provider !== 'supabase') {
      showInvalid('L’authentification Supabase n’est pas disponible. Contacte le bureau exécutif.');
      return;
    }
    try {
      client = P.getClient({ detectSessionInUrl: false });
      await establishInviteSession();
    } catch (error) {
      showInvalid(friendlySetupError(error));
    }
  }

  $('inviteForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError();
    var fullName = String($('fullName').value || '').trim();
    var phone = String($('phone').value || '').trim();
    var password = $('password').value;
    var confirmation = $('passwordConfirm').value;

    if (fullName.length < 2 || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName)) {
      showError('Saisis ton nom et prénom (entre 2 et 100 caractères).'); $('fullName').focus(); return;
    }
    if (phone.length > 32 || /[\u0000-\u001f\u007f]/.test(phone)) {
      showError('Le numéro de téléphone ne doit pas dépasser 32 caractères.'); $('phone').focus(); return;
    }
    if (password.length < 8) { showError('Le mot de passe doit contenir au moins 8 caractères.'); $('password').focus(); return; }
    if (password !== confirmation) { showError('Les deux mots de passe ne correspondent pas.'); $('passwordConfirm').focus(); return; }
    if (!invitedUser || !invitedUser.id) { showInvalid('La session d’invitation a expiré. Demande un nouveau lien au bureau.'); return; }

    var button = $('inviteSubmit');
    button.disabled = true;
    button.innerHTML = '<span class="pta-spin" aria-hidden="true"></span><span>Création du compte…</span>';

    try {
      /* Même périmètre que « Mon Profil » : uniquement full_name et phone. */
      var profileUpdate = await client.from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', invitedUser.id)
        .select('id, full_name, phone, role, status')
        .maybeSingle();
      if (profileUpdate.error) throw new Error('PROFILE_SAVE_FAILED');
      if (!profileUpdate.data || profileUpdate.data.id !== invitedUser.id) throw new Error('PROFILE_SAVE_FAILED');

      /* Le compte garde le rôle et le statut provisionnés par la base (jamais par le formulaire). */
      if (!passwordSaved) {
        var passwordUpdate = await client.auth.updateUser({ password: password });
        if (passwordUpdate.error) {
          var passwordMessage = safeAuthError(passwordUpdate.error);
          if (passwordMessage) throw new Error(passwordMessage);
          /* same_password : le mot de passe avait déjà été enregistré lors d'une tentative précédente. */
        }
        passwordSaved = true;
      }

      var status = String(profileUpdate.data.status || '').toLowerCase();
      if (status === 'active' || status === 'follow_up') {
        $('doneMessage').textContent = 'Ton compte membre est prêt. Ton rôle initial est Membre ; le bureau pourra ensuite gérer tes affectations.';
        $('continueLink').setAttribute('href', 'index.html');
        $('continueLink').textContent = 'Accéder à l’espace membres →';
      } else {
        $('doneMessage').textContent = 'Ton profil et ton mot de passe sont enregistrés. Le bureau exécutif doit encore activer ton accès avant ta première connexion.';
        $('continueLink').setAttribute('href', 'login.html');
        $('continueLink').textContent = 'Retour à la connexion';
      }
      show('done');
    } catch (error) {
      if (error && (error.message === 'PROFILE_SAVE_FAILED')) {
        showError('Le profil n’a pas pu être enregistré. Vérifie ta connexion et réessaie ; ton invitation reste ouverte sur cet appareil.');
      } else {
        showError(error && error.message && /^(Ce mot de passe|Trop de tentatives|La vérification)/.test(error.message)
          ? error.message
          : 'La création du compte n’est pas terminée. Aucune autorisation de rôle n’a été modifiée. Réessaie ou contacte le bureau.');
      }
    } finally {
      button.disabled = false;
      button.innerHTML = '<span>Créer mon compte</span><span class="pta-invite-arrow" aria-hidden="true">→</span>';
    }
  });

  start();
})();
