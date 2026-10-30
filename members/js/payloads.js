/* =========================================================================
   ICRM — ESPACE MEMBRES · CRÉATION : VALIDATION ET CHARGES UTILES
   Fonctions pures (aucun appel réseau), partagées par les formulaires (validation en direct) ET par le
   fournisseur Supabase (défense en profondeur : même si une vue est contournée, rien d'invalide n'est envoyé).

   Rappel : ces règles reflètent les droits attendus pour l'AFFICHAGE. La barrière de sécurité réelle est
   la RLS de PostgreSQL : un refus de la base est toujours reporté tel quel à l'utilisateur.

   Colonnes écrites — uniquement celles confirmées dans la base :
     meetings      : id, title, description, scope, kind, commission_id, location, starts_at, ends_at, created_by
     announcements : id, title, content, audience, commission_id, created_by
   (published_at, created_at, updated_at : valeurs par défaut de la base.)
   JAMAIS envoyées : priority, attachments, agenda, notes, decisions, meeting_id (migrations non appliquées).
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  var X = P.payloads = {};

  /* ---------------------------- listes de choix (enums de la base) ---------------------------- */
  X.KINDS = [['meeting', 'Réunion'], ['event', 'Événement'], ['training', 'Formation'], ['other', 'Autre']];          // meeting_kind
  X.SCOPES = [['club', 'Tout le club'], ['commission', 'Une commission']];                                            // meeting_scope
  X.AUDIENCES = [['all_members', 'Tous les membres'], ['commission', 'Une commission'], ['bureau_elargi', 'Bureau élargi'], ['bureau', 'Bureau exécutif']]; // announcement_audience (libellés UI; clés internes conservées)
  var values = function (list) { return list.map(function (x) { return x[0]; }); };
  X.label = function (list, v) { var f = list.filter(function (x) { return x[0] === v; })[0]; return f ? f[1] : ''; };

  /* Limites de saisie (confort d'interface ; la base reste maîtresse de ses propres contraintes). */
  X.LIMITS = { title: [3, 150], description: 2000, location: 150, content: [3, 10000] };

  /* ---------------------------- heure de Tunis ---------------------------- */
  /* Les dates saisies sont des heures de Tunis (Africa/Tunis), quel que soit le fuseau du navigateur.
     La conversion passe par Intl (jamais un décalage codé en dur) et ne dépend pas du fuseau du poste. */
  var TZ = 'Africa/Tunis', fmt = null;
  function tunisFmt() {
    return fmt || (fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }
  function partsOf(ms) { var o = {}; tunisFmt().formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; }); return o; }
  /* Date et heure de Tunis d'un instant → { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
  X.tunisParts = function (date) { var o = partsOf(date.getTime()); return { date: o.year + '-' + o.month + '-' + o.day, time: o.hour + ':' + o.minute }; };

  var LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  /* « 2026-10-20T18:30 » (heure de Tunis) → « 2026-10-20T17:30:00.000Z » ; null si invalide (ex. 31 février). */
  X.tunisLocalToISO = function (str) {
    var m = LOCAL.exec(String(str == null ? '' : str).trim()); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], wall = Date.UTC(y, mo - 1, d, h, mi), chk = new Date(wall);
    if (h > 23 || mi > 59 || chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
    var guess = wall;
    for (var i = 0; i < 3; i++) {                                    // décalage de Tunis à cet instant, affiné au besoin
      var o = partsOf(guess), asUTC = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second), next = wall - (asUTC - guess);
      if (next === guess) break; guess = next;
    }
    return new Date(guess).toISOString();
  };

  /* ---------------------------- identifiant ---------------------------- */
  /* Un identifiant créé côté client rend l'envoi idempotent : renvoyer le même formulaire ne peut pas créer
     de doublon (un conflit de clé primaire signifie « déjà enregistré »). */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  X.newId = function () {
    var c = window.crypto; if (!c) return null;
    if (c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16); c.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  /* ---------------------------- règles par rôle (affichage ; la RLS décide) ---------------------------- */
  X.meetingRules = function (role) {
    if (role === 'bureau' || role === 'super_admin') return { allowed: true, scopes: ['club', 'commission'], onlyManaged: false };
    if (role === 'commission_head') return { allowed: true, scopes: ['commission'], onlyManaged: true };     // jamais de réunion de tout le club
    return { allowed: false, scopes: [], onlyManaged: false };
  };
  X.announcementRules = function (role) {
    return role === 'bureau' || role === 'super_admin' ? { allowed: true, audiences: values(X.AUDIENCES) } : { allowed: false, audiences: [] };
  };
  /* Commissions proposées : toutes pour le Bureau exécutif / Super Admin ; seulement celles qu'il gère pour un membre du Bureau élargi. */
  X.allowedCommissions = function (role, list) {
    var r = X.meetingRules(role);
    return (list || []).filter(function (c) { return !r.onlyManaged || c.managed; });
  };

  /* ---------------------------- tâches + documents privés ---------------------------- */
  X.TASK_PRIORITIES = [['low', 'Basse'], ['medium', 'Normale'], ['high', 'Haute']];
  X.DOCUMENT_BUCKET = 'icrm-documents';
  X.DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
  X.DOCUMENT_EXTENSIONS = ['pdf','doc','docx','odt','rtf','xls','xlsx','ods','csv','ppt','pptx','odp','txt','jpg','jpeg','png','webp'];
  X.DOCUMENT_MIME = {
    pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    odt:'application/vnd.oasis.opendocument.text', rtf:'application/rtf', xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ods:'application/vnd.oasis.opendocument.spreadsheet',
    csv:'text/csv', ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odp:'application/vnd.oasis.opendocument.presentation', txt:'text/plain', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp'
  };
  X.taskRules = function (role) { return role === 'bureau' || role === 'super_admin' || role === 'commission_head'; };
  X.documentUploadAllowed = function (role) { return role === 'bureau' || role === 'super_admin'; };
  X.documentDeleteAllowed = function (role) { return role === 'bureau' || role === 'super_admin'; };

  /* Assignation : rôle, commission gérée, membre actif et appartenances sont revérifiés côté fournisseur et RLS. */
  X.validateTaskCreate = function (input, ctx) {
    input = input || {}; ctx = ctx || {};
    var errors = {}, role = ctx.role, title = oneLine(input.title), description = multiLine(input.description),
      commissionId = String(input.commission_id || ''), assigneeId = String(input.assigned_to || ''), priority = String(input.priority || 'medium'),
      commissions = X.allowedCommissions(role, ctx.commissions || []), members = ctx.members || [];
    if (!X.taskRules(role)) return done({ _form: 'La création de tâches est réservée au Bureau exécutif, au Super Admin et au Bureau élargi de sa commission.' });
    if (!ctx.uid) errors._form = 'Ta session est introuvable : reconnecte-toi.';
    if (title.length < 3) errors.title = 'Indique un titre d’au moins 3 caractères.';
    else if (title.length > 150) errors.title = 'Le titre est limité à 150 caractères.';
    if (description.length > 2000) errors.description = 'La description est limitée à 2 000 caractères.';
    if (!hasCommission(commissions, commissionId)) errors.commission_id = role === 'commission_head' ? 'Choisis une commission que tu gères.' : 'Choisis une commission valide.';
    if (values(X.TASK_PRIORITIES).indexOf(priority) < 0) errors.priority = 'Choisis une priorité valide.';
    var due = String(input.due_date || '').trim();
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) errors.due_date = 'Choisis une date d’échéance valide.';
    if (due) { var dt = new Date(due + 'T12:00:00Z'); if (isNaN(dt.getTime()) || dt.toISOString().slice(0,10) !== due) errors.due_date = 'Cette date n’existe pas.'; }
    var assignee = members.filter(function (m) { return String(m.id) === assigneeId; })[0];
    if (!assigneeId || !assignee || (!ctx.mock && ['active','watch'].indexOf(assignee.status) < 0)) errors.assigned_to = 'Choisis un membre actif de cette commission.';
    var meetingId = String(input.meeting_id || '').trim();
    if (meetingId && !ctx.mock && !UUID.test(meetingId)) errors.meeting_id = 'La réunion liée est invalide. Recharge la page et réessaie.';
    var payload = { title: title, description: description || '', priority: priority, due_date: due || null,
      status: 'pending', assigned_to: assigneeId || null, commission_id: commissionId || null };
    if (meetingId && (ctx.mock || UUID.test(meetingId))) payload.meeting_id = meetingId;
    if (input.id && UUID.test(input.id)) payload.id = String(input.id).toLowerCase();
    return done(errors, payload);
  };

  X.validateDocumentUpload = function (input, ctx) {
    input = input || {}; ctx = ctx || {};
    var errors = {}, role = ctx.role, file = input.file, access = String(input.access_type || 'all_members'), cid = String(input.commission_id || ''),
      commissions = ctx.commissions || [];
    if (!X.documentUploadAllowed(role)) return done({ _form: 'Le dépôt de documents est réservé au Bureau exécutif et au Super Admin.' });
    if (!ctx.uid) errors._form = 'Ta session est introuvable : reconnecte-toi.';
    if (!file || typeof file.name !== 'string') errors.file = 'Choisis un fichier à déposer.';
    else {
      var parts = /\.([a-z0-9]{1,8})$/i.exec(file.name), ext = parts ? parts[1].toLowerCase() : '';
      if (X.DOCUMENT_EXTENSIONS.indexOf(ext) < 0) errors.file = 'Format non autorisé. Utilise PDF, Office/LibreOffice, texte ou image JPG/PNG/WebP.';
      else if (!Number.isFinite(Number(file.size)) || file.size <= 0) errors.file = 'Le fichier est vide ou illisible.';
      else if (file.size > X.DOCUMENT_MAX_BYTES) errors.file = 'Le fichier dépasse la limite de 20 Mo.';
    }
    if (['all_members','commission','bureau'].indexOf(access) < 0) errors.access_type = 'Choisis un niveau d’accès valide.';
    if (access === 'commission' && !hasCommission(commissions, cid)) errors.commission_id = 'Choisis une commission existante.';
    return done(errors, { file: file || null, access_type: access, commission_id: access === 'commission' ? cid : null });
  };

  /* ---------------------------- validation ---------------------------- */
  var oneLine = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var multiLine = function (s) { return String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim(); };
  var done = function (errors, payload) { var ok = !Object.keys(errors).length; return { ok: ok, errors: errors, payload: ok ? payload : null }; };
  var hasCommission = function (list, id) { return !!id && (list || []).some(function (c) { return c.id === id; }); };

  /* input : { id?, title, description, kind, scope, commission_id, starts, ends, location } — starts/ends = « YYYY-MM-DDTHH:MM » (heure de Tunis)
     ctx   : { role, uid, commissions:[{id,name,managed}] } — commissions lues dans la base (RLS respectée). */
  X.validateMeeting = function (input, ctx) {
    var errors = {}, rules = X.meetingRules(ctx.role), L = X.LIMITS; input = input || {};
    if (!rules.allowed) return done({ _form: 'Tu n’as pas la permission de créer une réunion.' });
    if (!ctx.uid) errors._form = 'Ta session est introuvable : reconnecte-toi.';

    var title = oneLine(input.title);
    if (title.length < L.title[0]) errors.title = 'Indique un titre (' + L.title[0] + ' caractères minimum).';
    else if (title.length > L.title[1]) errors.title = 'Le titre est trop long (' + L.title[1] + ' caractères maximum).';
    var description = multiLine(input.description);
    if (description.length > L.description) errors.description = 'La description est trop longue (' + L.description + ' caractères maximum).';
    var location = oneLine(input.location);
    if (location.length > L.location) errors.location = 'Le lieu est trop long (' + L.location + ' caractères maximum).';

    var kind = String(input.kind || '');
    if (values(X.KINDS).indexOf(kind) < 0) errors.kind = 'Choisis un type valide.';
    var scope = String(input.scope || '');
    if (rules.scopes.indexOf(scope) < 0) errors.scope = 'Cette portée n’est pas autorisée pour ton rôle.';
    var commissionId = null;
    if (scope === 'commission') {
      var allowed = X.allowedCommissions(ctx.role, ctx.commissions);
      if (!hasCommission(allowed, input.commission_id)) errors.commission_id = rules.onlyManaged ? 'Choisis une commission que tu gères.' : 'Choisis une commission.';
      else commissionId = input.commission_id;
    }

    var startsAt = X.tunisLocalToISO(input.starts), endsAt = null;
    if (!startsAt) errors.starts = 'Indique une date et une heure de début valides.';
    if (oneLine(input.ends)) {
      endsAt = X.tunisLocalToISO(input.ends);
      if (!endsAt) errors.ends = 'Indique une date et une heure de fin valides.';
      else if (startsAt && endsAt <= startsAt) errors.ends = 'La fin doit être postérieure au début.';
    }

    var payload = { title: title, description: description || null, scope: scope, kind: kind, commission_id: commissionId,
                    location: location || null, starts_at: startsAt, ends_at: endsAt, created_by: ctx.uid };
    if (input.id && UUID.test(input.id)) payload.id = String(input.id).toLowerCase();
    return done(errors, payload);
  };

  /* input : { id?, title, content, audience, commission_id } */
  X.validateAnnouncement = function (input, ctx) {
    var errors = {}, rules = X.announcementRules(ctx.role), L = X.LIMITS; input = input || {};
    if (!rules.allowed) return done({ _form: 'Tu n’as pas la permission de publier une annonce.' });
    if (!ctx.uid) errors._form = 'Ta session est introuvable : reconnecte-toi.';

    var title = oneLine(input.title);
    if (title.length < L.title[0]) errors.title = 'Indique un titre (' + L.title[0] + ' caractères minimum).';
    else if (title.length > L.title[1]) errors.title = 'Le titre est trop long (' + L.title[1] + ' caractères maximum).';
    var content = multiLine(input.content);
    if (content.length < L.content[0]) errors.content = 'Écris le contenu de l’annonce.';
    else if (content.length > L.content[1]) errors.content = 'Le contenu est trop long (' + L.content[1] + ' caractères maximum).';

    var audience = String(input.audience || ''), commissionId = null;
    if (rules.audiences.indexOf(audience) < 0) errors.audience = 'Choisis un public valide.';
    else if (audience === 'commission') {
      if (!hasCommission(ctx.commissions, input.commission_id)) errors.commission_id = 'Choisis une commission.';
      else commissionId = input.commission_id;
    }

    var payload = { title: title, content: content, audience: audience, commission_id: commissionId, created_by: ctx.uid };
    if (input.id && UUID.test(input.id)) payload.id = String(input.id).toLowerCase();
    return done(errors, payload);
  };

  /* ==================== COMMISSIONS : sélection initiale (exactement deux) ==================== */
  X.isUuid = function (v) { return UUID.test(String(v == null ? '' : v)); };
  /* ids : tableau choisi par le membre ; catalogueIds : commissions ACTIVES renvoyées par la base.
     La base revalide tout (ICR02/ICR03/ICR04) ; cette validation évite un aller-retour inutile. */
  X.validateSelection = function (ids, catalogueIds) {
    var errors = {};
    var list = Array.isArray(ids) ? ids.map(String) : [];
    if (list.length !== 2) errors._form = 'Choisis exactement deux commissions.';
    else if (list[0] === list[1]) errors._form = 'Les deux commissions doivent être différentes.';
    else if (list.some(function (id) { return !X.isUuid(id) || (catalogueIds || []).indexOf(id) < 0; }))
      errors._form = 'Une commission choisie n’est plus disponible. Actualise la page et réessaie.';
    return done(errors, list.length === 2 ? list.map(function (x) { return x.toLowerCase(); }) : null);
  };

  /* ==================== PROPOSITIONS D'ACTIONS ==================== */
  X.PROPOSAL_LIMITS = { title: [5, 150], description: [20, 5000], objective: 1000 };
  X.PROPOSAL_STATUS = [['submitted', 'Soumise'], ['under_review', 'En cours de discussion'], ['needs_revision', 'Révision demandée'],
                       ['accepted', 'Acceptée'], ['rejected', 'Non retenue']];
  /* Miroir EXACT de private.proposal_transition_allowed() (SQL). Une seule source de vérité côté base. */
  var TRANSITIONS = { submitted: ['under_review', 'needs_revision', 'accepted', 'rejected'], under_review: ['needs_revision', 'accepted', 'rejected'],
                      needs_revision: ['under_review', 'accepted', 'rejected'], accepted: [], rejected: [] };
  X.canTransition = function (from, to) {
    if (from === to) return !!TRANSITIONS[from] && from !== 'accepted' && from !== 'rejected';
    return (TRANSITIONS[from] || []).indexOf(to) > -1;
  };
  X.proposalStatusLabel = function (v) { return X.label(X.PROPOSAL_STATUS, v) || 'Statut inconnu'; };
  X.reference = function (id) { return 'PA-' + String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase(); };

  /* input : { title, description, objective, commission_id } ; ctx : { myCommissionIds } */
  X.validateProposal = function (input, ctx) {
    var errors = {}, L = X.PROPOSAL_LIMITS; input = input || {};
    var title = oneLine(input.title), description = multiLine(input.description), objective = multiLine(input.objective);
    if (title.length < L.title[0]) errors.title = 'Indique un titre (' + L.title[0] + ' caractères minimum).';
    else if (title.length > L.title[1]) errors.title = 'Le titre est trop long (' + L.title[1] + ' caractères maximum).';
    if (description.length < L.description[0]) errors.description = 'Décris ton idée (' + L.description[0] + ' caractères minimum).';
    else if (description.length > L.description[1]) errors.description = 'La description est trop longue (' + L.description[1] + ' caractères maximum).';
    if (objective.length > L.objective) errors.objective = 'L’objectif est trop long (' + L.objective + ' caractères maximum).';
    var cid = String(input.commission_id || '').toLowerCase();
    if (!X.isUuid(cid) || (ctx.myCommissionIds || []).indexOf(cid) < 0)
      errors.commission_id = 'Cette commission ne fait pas partie de tes commissions.';
    return done(errors, { commission_id: cid, title: title, description: description, objective: objective || null });
  };

  /* input : { status, note } ; currentStatus : statut lu avant l'envoi (mise à jour conditionnelle). */
  X.validateReview = function (input, currentStatus) {
    var errors = {}, status = String((input && input.status) || ''), note = multiLine(input && input.note);
    if (X.label(X.PROPOSAL_STATUS, status) === '') errors.status = 'Choisis un statut valide.';
    else if (!X.canTransition(currentStatus, status)) errors.status = 'Ce changement de statut n’est pas autorisé.';
    if ((status === 'needs_revision' || status === 'rejected') && !note) errors.note = 'Ajoute une note pour expliquer la décision.';
    if (note.length > 2000) errors.note = 'La note est trop longue (2 000 caractères maximum).';
    return done(errors, { status: status, reviewer_notes: note || null });
  };

  /* ==================== SUPPRESSION (réunions / annonces) ==================== */
  /* Rôles autorisés à supprimer — miroir de private.portal_is_club_reviewer(). Un chef ne supprime jamais. */
  X.canDeleteClubRecords = function (role) { return role === 'bureau' || role === 'super_admin'; };
})();
