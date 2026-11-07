/* =========================================================================
   ICRM — ESPACE MEMBRES · PAGE DE CONNEXION
   signInWithPassword → profil (RLS) → vérifications → redirection vers le portail.
   Aucune inscription (système sur invitation). Aucun mot de passe conservé ni journalisé.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, A = P.auth;
  var $ = function (id) { return document.getElementById(id); };
  var card = $('card'), errBox = $('formError'), okBox = $('formOk'), loginForm = $('loginForm'), forgotForm = $('forgotForm');
  var email = $('email'), pw = $('password'), client = null;

  function showError(msg) { okBox.hidden = true; errBox.textContent = msg; errBox.hidden = false; }
  function showOk(msg) { errBox.hidden = true; okBox.textContent = msg; okBox.hidden = false; }
  function clearMsg() { errBox.hidden = true; okBox.hidden = true; }
  function busy(btn, on, label) {
    btn.disabled = on;
    btn.innerHTML = on ? '<span class="pta-spin" aria-hidden="true"></span><span>' + label + '…</span>' : '<span>' + label + '</span>';
  }
  function reveal() { card.classList.remove('is-checking'); }
  function disableForms() { document.querySelectorAll('input, button[type=submit]').forEach(function (n) { n.disabled = true; }); }

  /* --- afficher / masquer le mot de passe --- */
  $('pwToggle').addEventListener('click', function () {
    var show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
    this.setAttribute('aria-pressed', show); this.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  /* --- bascule connexion ⇄ mot de passe oublié --- */
  function panel(name) {
    clearMsg();
    var forgot = name === 'forgot';
    loginForm.hidden = forgot; forgotForm.hidden = !forgot;
    $('pta-title').textContent = forgot ? 'Mot de passe oublié' : 'Espace membres';
    $('pta-lede').hidden = forgot;
    if (forgot) { $('forgotEmail').value = email.value; $('forgotEmail').focus(); } else { email.focus(); }
  }
  $('forgotBtn').addEventListener('click', function () { panel('forgot'); });
  $('backBtn').addEventListener('click', function () { panel('login'); });

  /* --- démarrage --- */
  if (P.config.BACKEND.provider !== 'supabase') {
    reveal(); disableForms(); showError('L’authentification est désactivée en mode maquette (provider « mock »). Ouvre directement l’espace membres.');
    return;
  }
  try { client = P.getClient({ detectSessionInUrl: false }); }
  catch (e) { reveal(); disableForms(); showError(A.messageFor(A.classify(e)).text); return; }

  /* Déjà connecté ? On le vérifie auprès du serveur (getUser) avant de rediriger, pour éviter toute boucle de redirection. */
  (async function checkExisting() {
    var timer = setTimeout(reveal, 4000);                          // ne jamais bloquer le formulaire si le réseau traîne
    try {
      var r = await client.auth.getSession();
      if (r.data && r.data.session) {
        var u = await client.auth.getUser();
        if (u.data && u.data.user && !u.error) { location.replace('index.html'); return; }
        await A.signOutQuiet(client);                              // session invalide → on repart propre
      }
    } catch (e) { /* hors-ligne : on affiche simplement le formulaire */ }
    clearTimeout(timer); reveal(); email.focus();
  })();

  /* --- connexion --- */
  loginForm.addEventListener('submit', async function (ev) {
    ev.preventDefault(); clearMsg();
    var mail = email.value.trim(), pass = pw.value;
    if (!mail || !pass) { showError('Saisis ton adresse e-mail et ton mot de passe.'); (mail ? pw : email).focus(); return; }
    var btn = $('submitBtn'); busy(btn, true, 'Connexion');
    try {
      var r = await client.auth.signInWithPassword({ email: mail, password: pass });
      if (r.error) { showError(A.loginMessage(r.error)); pw.value = ''; pw.focus(); return; }
      try { await A.fetchProfile(client, r.data.user); }           // profil présent et utilisable ?
      catch (err) { await A.signOutQuiet(client); showError(A.messageFor(A.classify(err)).text); pw.value = ''; return; }
      location.replace('index.html');
    } catch (e) { showError(A.loginMessage(e)); pw.value = ''; }
    finally { busy(btn, false, 'Se connecter'); }
  });

  /* --- demande de réinitialisation (réponse volontairement identique que le compte existe ou non) --- */
  forgotForm.addEventListener('submit', async function (ev) {
    ev.preventDefault(); clearMsg();
    var mail = $('forgotEmail').value.trim();
    if (!mail) { showError('Saisis l’adresse e-mail de ton compte.'); $('forgotEmail').focus(); return; }
    var btn = $('forgotSubmit'); busy(btn, true, 'Envoi');
    try {
      var r = await client.auth.resetPasswordForEmail(mail, { redirectTo: new URL('reset-password.html', location.href).href });
      var c = r.error ? A.classify(r.error) : null;
      if (c === 'NETWORK' || c === 'RATE_LIMIT') showError(A.messageFor(c).text);
      else showOk('Si cette adresse correspond à un compte, un e-mail avec un lien de réinitialisation vient d’être envoyé. Pense à vérifier tes courriers indésirables.');
    } catch (e) { showError(A.friendly(e)); }
    finally { busy(btn, false, 'Envoyer le lien'); }
  });
})();
