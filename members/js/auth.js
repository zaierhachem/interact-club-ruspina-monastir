/* =========================================================================
   ICRM — ESPACE MEMBRES · AUTHENTIFICATION (helpers partagés)
   Utilisé par members.js, providers/supabase.js, login.js et reset-password.js.

   Principe : toute erreur (Supabase, réseau, base de données, JavaScript) est
   ramenée à un CODE ; chaque code a un texte français. Aucun message technique
   (SQL, Postgres, trace) n'est jamais affiché ; les détails ne vont qu'à la
   console, au niveau « debug ».

   NB : ces vérifications servent l'interface. L'autorisation réelle des données
   est imposée par PostgreSQL (Row Level Security), jamais par ce code.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  var A = P.auth = {};

  /* ---------------------------- messages (français) ---------------------------- */
  var MESSAGES = {
    NO_SESSION:       { title: 'Connexion requise',        text: 'Connecte-toi pour accéder à ton espace membre.' },
    PROFILE_MISSING:  { title: 'Profil introuvable',       text: 'Ton compte est bien connecté, mais ton profil membre est introuvable. Contacte le bureau exécutif pour qu’il soit créé.' },
    PROFILE_INACTIVE: { title: 'Compte non actif',         text: 'Ton compte n’est pas actif pour le moment. Contacte le bureau exécutif.' },
    NETWORK:          { title: 'Connexion impossible',     text: 'Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.' },
    RATE_LIMIT:       { title: 'Trop de tentatives',       text: 'Trop de tentatives. Patiente quelques minutes avant de réessayer.' },
    QUERY:            { title: 'Données indisponibles',    text: 'Nous n’avons pas pu charger tes données. Réessaie dans un instant ; si le problème persiste, contacte le Bureau exécutif.' },
    LIB_UNAVAILABLE:  { title: 'Service indisponible',     text: 'Le service d’authentification n’a pas pu être chargé. Vérifie ta connexion internet puis recharge la page.' },
    CONFIG:           { title: 'Configuration incomplète', text: 'L’espace membres n’est pas encore configuré correctement. Contacte le bureau exécutif.' },
    SIGNOUT_FAILED:   { title: 'Déconnexion impossible',   text: 'La déconnexion n’a pas pu être effectuée. Vérifie ta connexion internet et réessaie.' },
    /* --- écriture (création de réunions / annonces) : chaque message dit clairement que RIEN n'a été enregistré --- */
    VALIDATION:       { title: 'Informations invalides',   text: 'Certaines informations sont invalides. Corrige les champs signalés puis réessaie.' },
    SELECTION_INVALID:   { title: 'Sélection invalide',       text: 'Choisis exactement deux commissions différentes. Rien n’a été enregistré.' },
    COMMISSION_UNAVAILABLE: { title: 'Commission indisponible', text: 'Une des commissions choisies n’est plus disponible. Actualise la page et réessaie. Rien n’a été enregistré.' },
    ALREADY_ASSIGNED:    { title: 'Affectation déjà faite',   text: 'Tes commissions sont déjà attribuées. Pour toute modification, contacte le bureau exécutif.' },
    NOT_MEMBER:          { title: 'Action non autorisée',     text: 'Tu ne peux proposer une action que pour une commission dont tu fais partie. Rien n’a été enregistré.' },
    REVIEW_FORBIDDEN:    { title: 'Mise à jour refusée',      text: 'Tu n’es pas autorisé à relire cette proposition. Rien n’a été modifié.' },
    REVIEW_INVALID:      { title: 'Changement refusé',        text: 'Ce changement de statut n’est pas autorisé. Rien n’a été modifié.' },
    REVIEW_NOTE_REQUIRED:{ title: 'Note requise',             text: 'Ajoute une note pour expliquer cette décision. Rien n’a été modifié.' },
    CONFLICT:            { title: 'Modification concurrente', text: 'Cette proposition a été modifiée entre-temps. Recharge la page pour voir son statut actuel. Rien n’a été modifié.' },
    NOT_DELETED:         { title: 'Suppression non confirmée', text: 'La suppression n’a pas été confirmée : droits insuffisants ou élément déjà supprimé. Rien n’a été supprimé.' },
    HAS_DEPENDENTS:      { title: 'Suppression impossible',   text: 'Cette réunion a encore des données liées (présences enregistrées). Elle ne peut pas être supprimée en l’état. Rien n’a été supprimé.' },
    DELETE_FAILED:       { title: 'Suppression impossible',   text: 'La suppression a échoué. Rien n’a été supprimé ; réessaie dans un instant.' },
    NOT_ELIGIBLE:       { title: 'Compte non éligible',    text: 'Ton compte ne peut pas choisir de commission. Contacte le bureau exécutif. Rien n’a été enregistré.' },
    REVIEW_NOT_APPLIED: { title: 'Décision non enregistrée', text: 'La décision n’a pas été enregistrée : le statut a déjà changé ou tes droits ne permettent pas cette action. Recharge la page. Rien n’a été modifié.' },
    TASK_FORBIDDEN:      { title: 'Validation impossible',  text: 'Tu ne peux pas valider cette tâche : elle n’est pas dans ton périmètre. Rien n’a été modifié.' },
    SELF_VALIDATION:     { title: 'Validation impossible',  text: 'Tu ne peux pas valider ta propre tâche : un autre responsable doit le faire. Rien n’a été modifié.' },
    TASK_NOT_COMPLETED:  { title: 'Validation impossible',  text: 'La tâche doit d’abord être marquée comme terminée. Rien n’a été modifié.' },
    ALREADY_VALIDATED:   { title: 'Déjà validée',           text: 'Cette tâche a déjà été validée. Aucun XP supplémentaire n’a été attribué.' },
    ADJUST_FORBIDDEN:    { title: 'Ajustement refusé',      text: 'Seul le Bureau exécutif ou le Super Admin peut effectuer un ajustement d’XP. Rien n’a été enregistré.' },
    ADJUST_INVALID:      { title: 'Ajustement invalide',    text: 'L’ajustement doit être non nul (entre −500 et 500 XP) et accompagné d’un motif. Rien n’a été enregistré.' },
    PROGRESS_FORBIDDEN:  { title: 'Progression indisponible', text: 'Ta progression ne peut pas être affichée pour le moment. Reconnecte-toi ou réessaie plus tard.' },
    LEDGER_IMMUTABLE:    { title: 'Historique protégé',     text: 'L’historique des XP ne peut pas être modifié. Une correction se fait par un ajustement motivé. Rien n’a été modifié.' },
    KEYS_IMMUTABLE:      { title: 'Présence protégée',      text: 'Le membre ou la réunion d’une présence ne peuvent pas être modifiés. Supprime puis recrée la présence. Rien n’a été modifié.' },
    ATTENDANCE_FORBIDDEN:{ title: 'Présence non autorisée', text: 'Seul un membre du Bureau élargi responsable de la commission concernée, le Bureau exécutif ou le Super Admin peut enregistrer une présence. Rien n’a été enregistré.' },
    NOT_PERMITTED:    { title: 'Action non disponible pour ton rôle', text: 'Cette action n’est pas disponible pour ton rôle. Rien n’a été modifié.' },
    FORBIDDEN:        { title: 'Action non autorisée',     text: 'Tu n’as pas l’autorisation d’effectuer cette action : la base de données l’a refusée. Rien n’a été enregistré.' },
    INVALID_REF:      { title: 'Élément introuvable',      text: 'Un élément lié (par exemple la commission choisie) n’existe plus ou n’est pas accessible. Rien n’a été enregistré.' },
    INVALID_DATA:     { title: 'Données refusées',         text: 'La base de données refuse certaines informations saisies. Vérifie les champs puis réessaie. Rien n’a été enregistré.' },
    DOCUMENT_STORAGE_SETUP: { title: 'Stockage des documents non prêt', text: 'Le bucket privé des documents est absent ou mal configuré. Le fichier n’a pas été enregistré. Vérifie que les migrations Supabase ICRM sont appliquées, puis recharge la page.' },
    DOCUMENT_STORAGE_FORBIDDEN: { title: 'Dépôt refusé par les permissions', text: 'Supabase a refusé le téléversement. Vérifie que ton profil est actif et a le rôle Bureau exécutif ou Super Admin, et que les politiques Storage de la migration ICRM sont appliquées.' },
    DOCUMENT_UPLOAD_FAILED: { title: 'Téléversement échoué', text: 'Le fichier n’a pas pu être téléversé. Vérifie le réseau, le format et la limite de 20 Mo. Si le problème persiste, vérifie les migrations du bucket privé.' },
    DOCUMENT_METADATA_FAILED: { title: 'Document non enregistré', text: 'Le fichier a été envoyé au stockage, mais sa fiche Documents a été refusée. Le système a tenté de supprimer le fichier incomplet. Vérifie les colonnes et les règles RLS de public.documents avant de réessayer.' },
    DOCUMENT_DOWNLOAD_FAILED: { title: 'Téléchargement indisponible', text: 'Le fichier n’a pas pu être ouvert. Vérifie ton accès à ce document et que son fichier existe encore dans le stockage privé.' },
    DOCUMENT_STORAGE_DELETE_FAILED: { title: 'Fichier non supprimé', text: 'Le fichier est toujours dans le stockage. La fiche Documents a été restaurée ; vérifie les règles de suppression du bucket privé puis réessaie.' },
    DOCUMENT_METADATA_DELETE_FAILED: { title: 'Suppression incomplète', text: 'Le fichier a été supprimé du stockage, mais sa fiche Documents n’a pas pu être supprimée. Recharge la page et contacte un administrateur si elle reste affichée.' },
    DOCUMENT_DELETE_INCONSISTENT: { title: 'Suppression à vérifier', text: 'Le système n’a pas pu terminer la suppression ni restaurer la fiche. N’essaie pas de répéter plusieurs fois ; un administrateur doit vérifier le document dans Supabase.' },
    WRITE_NETWORK:    { title: 'Enregistrement non confirmé', text: 'La connexion a été interrompue : l’enregistrement n’est pas confirmé. Tu peux réessayer sans risque de doublon.' },
    TASK_SCHEMA_MISMATCH: { title: 'Schéma des tâches à vérifier', text: 'La base ne reconnaît pas le champ d’échéance attendu. Aucune tâche n’a été confirmée comme enregistrée. Vérifie la migration des tâches et le schéma API, puis recharge la page.' },
    TASK_STATUS_FORBIDDEN: { title: 'Mise à jour refusée', text: 'Seul le membre assigné peut modifier l’avancement de cette tâche. Rien n’a été modifié.' },
    TASK_STATUS_LOCKED: { title: 'Tâche déjà terminée', text: 'Une tâche terminée ne peut pas être rouverte depuis le compte membre. Contacte le Bureau exécutif si une correction est nécessaire.' },
    TASK_DELETE_FORBIDDEN: { title: 'Suppression refusée', text: 'La suppression d’une tâche est réservée au Super Admin actif.' },
    WRITE_FAILED:     { title: 'Enregistrement impossible', text: 'L’enregistrement a échoué. Rien n’a été enregistré ; réessaie dans un instant.' },
    UNEXPECTED:       { title: 'Une erreur est survenue',  text: 'Une erreur inattendue est survenue. Réessaie dans un instant.' }
  };
  A.messageFor = function (code) { return MESSAGES[code] || MESSAGES.UNEXPECTED; };

  /* ---------------------------- classification des erreurs ---------------------------- */
  function isNetwork(err) {
    return !!err && (err.name === 'AuthRetryableFetchError' || err.status === 0 ||
      /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out/i.test(String(err.message || '')));
  }
  /* Seuls 401 et les codes « jeton invalide / session absente » signifient « reconnecte-toi ».
     Un 403 de la base (droit refusé) n'est PAS une session expirée : il reste une erreur de requête. */
  var NO_AUTH_CODES = ['PGRST301', 'PGRST303', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used',
                       'bad_jwt', 'invalid_jwt', 'user_not_found', 'no_authorization', 'not_authenticated'];
  A.classify = function (err) {
    if (!err) return 'UNEXPECTED';
    if (err.coded && MESSAGES[err.code]) return err.code;
    if (isNetwork(err)) return 'NETWORK';
    if (err.status === 429 || err.code === 'over_request_rate_limit' || err.code === 'over_email_send_rate_limit') return 'RATE_LIMIT';
    if (err.status === 401 || NO_AUTH_CODES.indexOf(err.code) > -1 || /jwt/i.test(String(err.message || ''))) return 'NO_SESSION';
    return 'UNEXPECTED';
  };

  /* Erreur codée : son `message` est déjà le texte français destiné à l'utilisateur. */
  A.coded = function (code, cause) {
    var known = !!MESSAGES[code], e = new Error(A.messageFor(code).text);
    e.code = known ? code : 'UNEXPECTED'; e.coded = true; e.cause = cause;
    if (cause && window.console && console.debug) console.debug('[ICRM] ' + e.code, cause.code || cause.status || cause.message || cause);
    return e;
  };
  /* Convertit n'importe quelle erreur en erreur codée ; `fallback` remplace « UNEXPECTED ». */
  A.toError = function (err, fallback) {
    if (err && err.coded) return err;
    var c = A.classify(err); if (c === 'UNEXPECTED' && fallback) c = fallback;
    return A.coded(c, err);
  };
  A.friendly = function (err) { return A.messageFor(A.classify(err)).text; };

  /* Erreur de validation côté client : `fields` = { champ: message } (affiché champ par champ). */
  A.validation = function (fields) { var e = A.coded('VALIDATION'); e.fields = fields || {}; return e; };
  /* Échec d'une ÉCRITURE → erreur codée, sans texte technique. Le refus de la RLS (42501 / HTTP 403) est dit tel quel :
     on ne simule jamais un succès et on ne se rabat jamais sur des données fictives. */
  var INVALID_DATA_CODES = ['23514', '22P02', '22007', '22008', '22023', '22001', '23502', '23505'];
  /* Codes SQLSTATE de la base (ICR0x) → message français. Jamais le texte brut renvoyé par la base. */
  var ICR = { ICR01: 'NOT_ELIGIBLE', ICR02: 'SELECTION_INVALID', ICR03: 'COMMISSION_UNAVAILABLE', ICR04: 'ALREADY_ASSIGNED',
              ICR06: 'REVIEW_INVALID', ICR07: 'REVIEW_NOTE_REQUIRED',
              ICR10: 'TASK_FORBIDDEN', ICR11: 'SELF_VALIDATION', ICR12: 'TASK_NOT_COMPLETED', ICR13: 'ALREADY_VALIDATED',
              ICR14: 'ADJUST_FORBIDDEN', ICR15: 'ADJUST_INVALID', ICR16: 'PROGRESS_FORBIDDEN', ICR30: 'LEDGER_IMMUTABLE',
              ICR17: 'TASK_STATUS_FORBIDDEN', ICR18: 'TASK_STATUS_LOCKED', ICR19: 'TASK_DELETE_FORBIDDEN', ICR20: 'NOT_DELETED', ICR31: 'KEYS_IMMUTABLE', ICR32: 'ATTENDANCE_FORBIDDEN' };
  A.featureError = function (err) {
    if (err && err.coded) return err;
    var c = err && err.code;
    if (ICR[c]) return A.coded(ICR[c], err);
    if (c === '23505') return A.coded('CONFLICT', err);
    return null;
  };
  /* Suppression : une réponse « 0 ligne » n'est PAS un succès (refus silencieux de la RLS). */
  A.deleteError = function (err) {
    if (err && err.coded) return err;
    var c = err && err.code;
    if (c === '23503') return A.coded('HAS_DEPENDENTS', err);
    if (c === '42501' || (err && err.status === 403)) return A.coded('NOT_DELETED', err);
    if (A.classify(err) === 'NETWORK') return A.coded('WRITE_NETWORK', err);
    return A.coded('DELETE_FAILED', err);
  };
  A.writeError = function (err) {
    var feat = A.featureError(err); if (feat) return feat;
    if (err && err.coded) return err;
    var k = A.classify(err), c = err && err.code, s = err && err.status;
    if (k === 'NETWORK') return A.coded('WRITE_NETWORK', err);
    if (k === 'NO_SESSION' || k === 'RATE_LIMIT') return A.coded(k, err);
    if (c === '42501' || s === 403) return A.coded('FORBIDDEN', err);
    if (c === '23503') return A.coded('INVALID_REF', err);
    if (INVALID_DATA_CODES.indexOf(c) > -1) return A.coded('INVALID_DATA', err);
    return A.coded('WRITE_FAILED', err);
  };

  /* Connexion : réponse volontairement identique que le compte existe ou non. */
  A.loginMessage = function (err) {
    var k = A.classify(err);
    if (k === 'NETWORK' || k === 'RATE_LIMIT') return A.messageFor(k).text;
    var c = err && err.code, s = err && err.status;
    if (c === 'invalid_credentials' || c === 'email_not_confirmed' || c === 'user_banned' || c === 'user_not_found' || s === 400 || s === 401 || s === 422) return 'Adresse e-mail ou mot de passe incorrect.';
    return 'Une erreur est survenue. Réessaie dans un instant.';
  };

  /* ---------------------------- rôles et statuts ---------------------------- */
  var ROLES = ['member', 'commission_head', 'bureau', 'super_admin'];
  /* La valeur vient de profiles.role (base). Valeur inconnue → « member » (affichage le plus restreint). */
  A.normalizeRole = function (raw) {
    var r = String(raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (ROLES.indexOf(r) > -1) return r;
    if (window.console) console.warn('[ICRM] rôle inconnu dans le profil : affichage « membre » par défaut.');
    return 'member';
  };
  /* Statuts : enum profiles.status = active | follow_up | inactive (config.js › USABLE_STATUSES).
       active    → 'active'   (actif)
       follow_up → 'watch'    (« À suivre » : utilisable, jamais affiché comme pleinement actif)
       inactive  → 'inactive' (refusé) ; valeur inconnue ou vide → refusée aussi (fail-closed côté interface). */
  var statusKey = function (raw) { return String(raw == null ? '' : raw).toLowerCase().trim().replace(/[\s-]+/g, '_'); };
  A.isUsableStatus = function (raw) { return ((P.config && P.config.USABLE_STATUSES) || []).indexOf(statusKey(raw)) > -1; };
  A.normalizeStatus = function (raw) {
    var s = statusKey(raw);
    return s === 'active' ? 'active' : s === 'follow_up' ? 'watch' : 'inactive';
  };

  /* ---------------------------- profil de l'utilisateur connecté ---------------------------- */
  A.PROFILE_COLUMNS = 'id, full_name, avatar_url, phone, role, status, joined_at, mandate';

  /* Ligne profiles → objet « user » attendu par les vues. */
  function toSessionUser(profile, authUser) {
    var full = String(profile.full_name || '').trim(), parts = full.split(/\s+/).filter(Boolean);
    var role = A.normalizeRole(profile.role), emailName = String((authUser && authUser.email) || '').split('@')[0];
    return {
      id: profile.id, fullName: full || emailName, firstName: parts[0] || emailName || 'Membre', lastName: parts.slice(1).join(' '),
      role: role, position: P.config.ROLES[role].label, commissionId: null,
      email: (authUser && authUser.email) || '', phone: profile.phone || '—', avatarUrl: profile.avatar_url || null,
      joinedAt: profile.joined_at ? String(profile.joined_at).slice(0, 10) : null,
      mandate: profile.mandate ? String(profile.mandate) : null, status: A.normalizeStatus(profile.status)
    };
  }

  /* Lit public.profiles pour l'UUID authentifié (la RLS ne renvoie que ce que la base autorise),
     vérifie que le profil existe et que le compte est utilisable, puis renvoie l'objet « user ».
     Erreurs codées : PROFILE_MISSING, PROFILE_INACTIVE, NETWORK, NO_SESSION, QUERY. */
  A.fetchProfile = async function (client, authUser) {
    var r;
    try { r = await client.from('profiles').select(A.PROFILE_COLUMNS).eq('id', authUser.id).maybeSingle(); }
    catch (e) { throw A.toError(e, 'NETWORK'); }
    if (r.error) throw A.toError(r.error, 'QUERY');
    if (!r.data) throw A.coded('PROFILE_MISSING');
    if (!A.isUsableStatus(r.data.status)) throw A.coded('PROFILE_INACTIVE');
    return toSessionUser(r.data, authUser);
  };

  /* Termine la session via Supabase Auth (portée « local » : seul cet appareil est déconnecté).
     Ne lève jamais d'exception ; renvoie true si la session a bien pris fin. */
  A.signOutQuiet = async function (client) {
    try { var r = await client.auth.signOut({ scope: 'local' }); return !(r && r.error); }
    catch (e) { return false; }
  };
})();
