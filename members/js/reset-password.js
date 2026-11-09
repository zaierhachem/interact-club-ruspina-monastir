/* =========================================================================
   ICRM — ESPACE MEMBRES · NOUVEAU MOT DE PASSE (après e-mail de réinitialisation)
   Le lien reçu par e-mail est traité par le client Supabase (detectSessionInUrl) : il crée une
   session « récupération » ; on appelle ensuite auth.updateUser({ password }).
   Aucun mot de passe n'est envoyé par e-mail, stocké ou journalisé par ce code.
   PRÉREQUIS (tableau de bord Supabase) : cette page doit figurer dans Authentication → URL Configuration → Redirect URLs.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, A = P.auth, $ = function (id) { return document.getElementById(id); };
  var S = { check: $('sCheck'), form: $('sForm'), invalid: $('sInvalid'), done: $('sDone') };
  var settled = false, client = null;

  function show(name) {
    settled = true;
    Object.keys(S).forEach(function (k) { S[k].hidden = k !== name; });
    var focus = name === 'form' ? $('np') : $('rs-title'); if (focus) focus.focus();
  }
  function err(msg) { var b = $('rsError'); b.textContent = msg; b.hidden = !msg; }

  if (P.config.BACKEND.provider !== 'supabase') { show('invalid'); return; }
  /* Indices dans l'URL (avant que le client ne les consomme) : jeton de récupération, code PKCE ou erreur. */
  var url = location.hash + '&' + location.search;
  var hasError = /error(_code|_description)?=/.test(url), hasHint = /type=recovery|access_token=|[?&]code=/.test(url);
  if (hasError) { show('invalid'); return; }
  try { client = P.getClient({ detectSessionInUrl: true }); }
  catch (e) { show('invalid'); $('sInvalid').querySelector('.pta-alert').textContent = A.messageFor(A.classify(e)).text; return; }

  /* PASSWORD_RECOVERY : événement émis par Supabase quand le lien est valide. Pas d'appel Supabase dans le callback. */
  client.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') setTimeout(function () { if (!settled) show('form'); }, 0); });
  /* Filet de sécurité : session déjà établie (ex. page rechargée après traitement du lien) ou lien invalide. */
  setTimeout(async function () {
    if (settled) return;
    try { var r = await client.auth.getSession(); show(r.data && r.data.session ? 'form' : 'invalid'); }
    catch (e) { show('invalid'); }
  }, hasHint ? 6000 : 1500);

  $('npToggle').addEventListener('click', function () {
    var show1 = $('np').type === 'password'; $('np').type = $('np2').type = show1 ? 'text' : 'password';
    this.setAttribute('aria-pressed', show1); this.setAttribute('aria-label', show1 ? 'Masquer les mots de passe' : 'Afficher les mots de passe');
  });

  S.form.addEventListener('submit', async function (ev) {
    ev.preventDefault(); err('');
    var a = $('np').value, b = $('np2').value;
    if (a.length < 8) { err('Le mot de passe doit contenir au moins 8 caractères.'); $('np').focus(); return; }
    if (a !== b) { err('Les deux mots de passe ne correspondent pas.'); $('np2').focus(); return; }
    var btn = $('rsSubmit'); btn.disabled = true; btn.innerHTML = '<span class="pta-spin" aria-hidden="true"></span><span>Enregistrement…</span>';
    try {
      var r = await client.auth.updateUser({ password: a });
      if (r.error) {
        var c = r.error.code || '', k = A.classify(r.error);
        if (c === 'same_password') err('Choisis un mot de passe différent de l’ancien.');
        else if (c === 'weak_password') err('Ce mot de passe est trop faible. Ajoute des lettres, des chiffres et des symboles.');
        else if (k === 'NO_SESSION') show('invalid');
        else err(A.messageFor(k === 'UNEXPECTED' ? 'UNEXPECTED' : k).text);
        return;
      }
      show('done'); setTimeout(function () { location.replace('index.html'); }, 3500);
    } catch (e) { err(A.friendly(e)); }
    finally { btn.disabled = false; btn.innerHTML = '<span>Enregistrer le mot de passe</span>'; }
  });
})();
