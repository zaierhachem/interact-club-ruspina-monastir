/* =========================================================================
   ICRM — ESPACE MEMBRES · FOURNISSEUR « SUPABASE »
   Implémente le même contrat que providers/mock.js :
     Vues → ICRMPortal.api → providers/supabase.js → Supabase (Auth + PostgREST)

   SÉCURITÉ : ce code ne contient aucune clé (config.js : URL + clé publishable uniquement).
   Les rôles lus ici servent à l'AFFICHAGE ; l'autorisation réelle est imposée par la RLS
   de PostgreSQL : on demande, la base décide de ce qui est renvoyé.

   Les tables sont lues avec select('*') puis converties par providers/mappers.js (fonctions pures,
   testées dans tests/members-mappers.test.js). Contrat colonne par colonne :
   supabase/docs/db-frontend-contract.md.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, A = P.auth;
  P.providers = P.providers || {};

  var sb = function () { return P.getClient({ detectSessionInUrl: false }); };
  var cached = null;                                            // dernière session résolue (profil inclus)
  var M = P.mappers;                                            // conversions base → interface (providers/mappers.js)
  var pick = M.pick, memberId = M.memberId, today = M.today;

  /* ---------------------------- accès aux tables ---------------------------- */
  async function run(build) {
    var r; try { r = await build(); } catch (e) { throw A.toError(e, 'NETWORK'); }
    if (r.error) throw A.toError(r.error, 'QUERY');
    return r.data || [];
  }
  var table = function (name, cols) { return run(function () { return sb().from(name).select(cols || '*'); }); };

  async function current() { return cached || (cached = await provider.getSession()); }

  /* Charge les tables demandées. tolerant=true : une table illisible devient [] (le dashboard ne doit jamais tomber). */
  async function load(keys, tolerant) {
    var out = {}, jobs = keys.map(function (k) {
      var p = k === 'profiles' ? table('profiles', 'id, full_name, status') : table(k);
      return (tolerant ? p.catch(function () { return []; }) : p).then(function (rows) { out[k] = rows; });
    });
    await Promise.all(jobs);
    return out;
  }

  /* Annuaire d'une commission : fonction SQL à privilèges limités (migration proposée, non appliquée).
     Absente ou refusée → null : repli sur la table profiles, soumise à la RLS (noms souvent illisibles). */
  async function directory(commissionId) {
    try {
      var r = await sb().rpc('commission_directory', { p_commission_id: commissionId });
      return !r.error && Array.isArray(r.data) ? r.data : null;
    } catch (e) { return null; }
  }
  async function myCommission(uid, d, x) {
    var mine = M.myMembership(uid, d);
    return M.myCommission(uid, d, x, mine ? await directory(mine.commission_id) : null);
  }

  /* Commissions lues dans la base (la RLS décide de ce qui est visible) ; `managed` = l'utilisateur en est
     responsable (commission_members.position = 'responsable'). Aucune commission n'est codée en dur. */
  async function commissionOptions() {
    var s = await current(), uid = s.user.id, d = await load(['commissions', 'commission_members']), managed = {};
    d.commission_members.forEach(function (r) { if (memberId(r) === uid && r.position === 'responsable') managed[r.commission_id] = true; });
    return d.commissions.map(function (c) { return { id: c.id, name: pick(c, ['name', 'title']) || 'Commission', managed: !!managed[c.id] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
  }
  /* Appel RPC renvoyant un objet ou un tableau (jsonb / table) : erreurs codées, jamais de valeur inventée. */
  async function rpcRaw(name, args) {
    var r;
    try { r = await sb().rpc(name, args || {}); } catch (e) { throw A.writeError(e); }
    if (r.error) throw A.featureError(r.error) || A.toError(r.error, 'QUERY');
    return r.data;
  }

  /* Les sondages restent non bloquants pour le dashboard si la migration n'est pas encore déployée. */
  async function readVisibleMeetingPolls(tolerant) {
    try {
      var rows = await rpcRaw('get_meeting_polls', { p_meeting_id: null });
      return { rows: Array.isArray(rows) ? rows : [], available: true };
    } catch (err) {
      if (tolerant) return { rows: [], available: false };
      throw err;
    }
  }
  function pendingPollTasks(rows) {
    return (rows || []).filter(function (p) { return p.status === 'open' && !p.my_option_id; }).map(function (p) {
      return { id: 'poll-' + p.id, pollId: p.id, meetingId: p.meeting_id, title: p.question,
        meetingTitle: p.meeting_title || 'Activité', description: 'Vote demandé pour : ' + (p.meeting_title || 'Activité'),
        deadline: M.dateParts(p.meeting_starts_at).date || today(), status: 'pending', taskType: 'poll' };
    });
  }

  /* Appel RPC : erreur réseau/base → erreur codée ; jamais un résultat vide présenté comme succès. */
  async function rpcCall(name, args) {
    var r;
    try { r = await sb().rpc(name, args || {}); } catch (e) { throw A.writeError(e); }
    if (r.error) throw A.featureError(r.error) || A.toError(r.error, 'QUERY');
    return r.data || [];
  }

  /* Les erreurs Storage sont traduites selon l'étape ; l'erreur technique reste en console debug. */
  function documentStageError(err, stage) {
    var message = String(err && (err.message || err.error || err.statusText) || '').toLowerCase();
    var code = String(err && err.code || '').toLowerCase();
    var status = Number(err && (err.status || err.statusCode || err.status_code) || 0);
    if (A.classify(err) === 'NETWORK') return A.coded('WRITE_NETWORK', err);
    if (/bucket.{0,30}(not found|does not exist)|no such bucket|bucket not found/.test(message)) return A.coded('DOCUMENT_STORAGE_SETUP', err);
    if (status === 403 || code === '42501' || /row.level security|permission denied|not authorized|unauthorized|forbidden/.test(message)) return A.coded(stage === 'delete' ? 'DOCUMENT_STORAGE_DELETE_FAILED' : 'DOCUMENT_STORAGE_FORBIDDEN', err);
    return A.coded(stage === 'metadata' ? 'DOCUMENT_METADATA_FAILED' : stage === 'download' ? 'DOCUMENT_DOWNLOAD_FAILED' : 'DOCUMENT_UPLOAD_FAILED', err);
  }

  async function catalogMap() {
    var rows = await rpcCall('list_selectable_commissions');
    var m = {}; rows.forEach(function (c) { m[c.id] = { name: c.name || 'Commission', description: c.description || '' }; });
    return m;
  }
  /* Annuaire d'une commission (fonction SQL). Une erreur sur UNE commission n'efface pas les autres. */
  async function roster(commissionId) {
    try { return { rows: await rpcCall('commission_directory', { p_commission_id: commissionId }), error: false }; }
    catch (e) { return { rows: [], error: true }; }
  }
  async function commissionLeadershipRoles(commissionId) {
    /* null = RPC indisponible (repli possible) ; [] = RPC disponible mais aucun responsable actif. */
    try { return await rpcCall('commission_leadership_roles', { p_commission_id: commissionId }); }
    catch (_) { return null; }
  }
  async function commissionAnnouncementsData(commissionId) {
    var rows = await run(function () {
      return sb().from('announcements').select('*').eq('audience', 'commission')
        .eq('commission_id', commissionId).order('created_at', { ascending: false }).limit(4);
    });
    var d = await load(['profiles', 'commissions'], true), x = M.context(d);
    return { announcements: rows.map(function (row) { return M.mapAnnouncement(row, x); }), error: false };
  }
  function leadershipRankMap(rows) {
    var map = {}; (rows || []).forEach(function (row) { map[row.profile_id] = Number(row.leadership_rank) || null; });
    return map;
  }
  /* DELETE : la base doit confirmer EXACTEMENT une ligne. 0 ligne = refus RLS ou élément absent → pas de succès. */
  async function deleteRow(tableName, id) {
    var r;
    try { r = await sb().from(tableName).delete({ count: 'exact' }).eq('id', id); } catch (e) { throw A.deleteError(e); }
    if (r.error) throw A.deleteError(r.error);
    if (r.count !== 1) throw A.coded('NOT_DELETED');
    return { deleted: true };
  }

  /* Une carte par appartenance (nom, responsables, effectif) pour le tableau de bord. */
  async function dashboardCommissions(uid) {
    /* Section secondaire : si les fonctions ne sont pas (encore) déployées, le tableau de bord reste utilisable. */
    var mine, names;
    try { mine = await rpcCall('my_commission_memberships'); names = await catalogMap(); } catch (e) { return []; }
    if (!mine.length) return [];
    return Promise.all(mine.map(async function (m) {
      var pair = await Promise.all([roster(m.commission_id), commissionLeadershipRoles(m.commission_id)]);
      var r = pair[0], ranked = pair[1];
      var heads = Array.isArray(ranked) ? ranked : r.rows.filter(function (x) { return x.member_position === 'responsable'; });
      return { id: m.commission_id, name: (names[m.commission_id] || {}).name || 'Commission',
               headName: heads.length ? heads.map(function (h) { return h.full_name || 'Responsable'; }).join(' · ') : '—',
               memberCount: r.rows.length, warning: heads.length < 1 || heads.length > 2 };
    }));
  }

  /* INSERT sans .select() : seul le droit d'insertion est requis (aucune lecture de retour supposée permise).
     Le succès n'est annoncé que si la base a accepté l'écriture. Un conflit de clé primaire sur NOTRE identifiant
     (renvoi après une réponse perdue) signifie « déjà enregistré » : aucun doublon, aucune fausse erreur. */
  async function insertRow(tableName, payload) {
    var r;
    try { r = await sb().from(tableName).insert(payload); } catch (e) { throw A.writeError(e); }
    if (r.error) {
      var already = r.error.code === '23505' && payload.id && /_pkey/.test(String(r.error.message || '') + ' ' + String(r.error.details || ''));
      if (!already) throw A.writeError(r.error);
    }
    return { saved: true, id: payload.id || null };
  }


  /* ICRM task date schema compatibility — 20261029213000 */
  function taskColumnMissing(err, column) {
    var code = String(err && err.code || '').toUpperCase();
    var detail = [err && err.message, err && err.details, err && err.hint].filter(Boolean).join(' ');
    var quoted = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var namesColumn = new RegExp("(?:column|field)\\s+[\\\"']?" + quoted + "[\\\"']?|[\\\"']" + quoted + "[\\\"']\\s+(?:column|field)", 'i').test(detail);
    var namesTable = /(?:table|relation)\\s+[\\\"']?tasks[\\\"']?/i.test(detail) || /of ['\"]tasks['\"] in the schema cache/i.test(detail);
    var schemaCode = code === 'PGRST204' || code === '42703';
    return schemaCode && namesColumn && (namesTable || /schema cache|does not exist|could not find/i.test(detail));
  }
  function taskSchemaError(err) {
    var code = String(err && err.code || '').toUpperCase();
    var detail = [err && err.message, err && err.details, err && err.hint].filter(Boolean).join(' ');
    return (code === 'PGRST204' || code === '42703') && /tasks|due_date|deadline|due_at|column|schema cache/i.test(detail);
  }
  function taskInsertAlreadySaved(err, payload) {
    return !!(err && err.code === '23505' && payload && payload.id && /_pkey/.test(String(err.message || '') + ' ' + String(err.details || '')));
  }
  async function rawTaskInsert(payload) {
    try { return await sb().from('tasks').insert(payload); }
    catch (error) { return { error: error }; }
  }
  async function insertTaskRow(payload) {
    var first = await rawTaskInsert(payload);
    if (!first || !first.error) return { saved: true, id: payload.id || null };
    if (taskInsertAlreadySaved(first.error, payload)) return { saved: true, id: payload.id || null };

    /* Compatibility for existing ICRM schemas: the deadline column has appeared as due_date,
       deadline, or due_at. Retry only when PostgreSQL/PostgREST explicitly says due_date is missing;
       never retry network/RLS/validation failures and never fall back to mock data. */
    if (Object.prototype.hasOwnProperty.call(payload, 'due_date') && taskColumnMissing(first.error, 'due_date')) {
      var dueValue = payload.due_date, aliases = ['deadline', 'due_at'], lastError = first.error;
      for (var i = 0; i < aliases.length; i++) {
        var alias = aliases[i], adapted = Object.assign({}, payload);
        delete adapted.due_date;
        adapted[alias] = dueValue;
        var retry = await rawTaskInsert(adapted);
        if (!retry || !retry.error) return { saved: true, id: payload.id || null };
        if (taskInsertAlreadySaved(retry.error, payload)) return { saved: true, id: payload.id || null };
        lastError = retry.error;
        if (taskColumnMissing(retry.error, alias)) continue;
        if (taskSchemaError(retry.error)) throw A.coded('TASK_SCHEMA_MISMATCH', retry.error);
        throw A.writeError(retry.error);
      }
      throw A.coded('TASK_SCHEMA_MISMATCH', lastError);
    }
    if (taskSchemaError(first.error)) throw A.coded('TASK_SCHEMA_MISMATCH', first.error);
    throw A.writeError(first.error);
  }

  /* ============================== CONTRAT ============================== */
  var provider = P.providers.supabase = {
    name: 'supabase',

    /* Session réelle : getSession() → getUser() (validé par le serveur d'authentification) → profil → rôle. */
    getSession: async function () {
      var client = sb(), r;
      try { r = await client.auth.getSession(); } catch (e) { throw A.toError(e, 'NETWORK'); }
      if (r.error) throw A.toError(r.error, 'UNEXPECTED');
      if (!r.data || !r.data.session) throw A.coded('NO_SESSION');
      var u; try { u = await client.auth.getUser(); } catch (e2) { throw A.toError(e2, 'NETWORK'); }
      if (u.error || !u.data || !u.data.user) {
        var c = u.error ? A.classify(u.error) : 'NO_SESSION';
        if (c === 'UNEXPECTED' || c === 'NO_SESSION') { await A.signOutQuiet(client); throw A.coded('NO_SESSION', u.error); }
        throw A.coded(c, u.error);
      }
      var profile = await A.fetchProfile(client, u.data.user), role = P.config.ROLES[profile.role];
      cached = { user: profile, role: profile.role, roleLabel: role.label, permissions: role.permissions, commission: null };
      return cached;
    },

    /* Déconnexion réelle. Redirection : à la charge de l'appelant (members.js). */
    signOut: async function () {
      var ok = await A.signOutQuiet(sb()); cached = null;
      if (!ok) throw A.coded('SIGNOUT_FAILED');
      return true;
    },

    /* Abonnement aux événements d'authentification. Le callback est reporté (setTimeout) : la documentation
       Supabase interdit d'appeler d'autres fonctions Supabase directement dans le callback (risque de blocage). */
    onAuthChange: function (cb) {
      var res = sb().auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_OUT') cached = null;
        setTimeout(function () { cb(event, { userId: session && session.user ? session.user.id : null }); }, 0);
      });
      var sub = res && res.data && res.data.subscription;
      return function () { if (sub) sub.unsubscribe(); };
    },

    /* ----- création (réunions, annonces) : validation partagée, puis INSERT réel ----- */
    getCommissionOptions: async function () { return { commissions: await commissionOptions() }; },

    createMeeting: async function (input) {
      var s = await current(), list = await commissionOptions();
      var v = P.payloads.validateMeeting(input, { role: s.user.role, uid: s.user.id, commissions: list });
      if (!v.ok) throw A.validation(v.errors);
      return insertRow('meetings', v.payload);
    },
    createAnnouncement: async function (input) {
      var s = await current(), list = await commissionOptions();
      var v = P.payloads.validateAnnouncement(input, { role: s.user.role, uid: s.user.id, commissions: list });
      if (!v.ok) throw A.validation(v.errors);
      return insertRow('announcements', v.payload);
    },

    createTask: async function (input) {
      var s = await current(), list = await commissionOptions();
      if (!P.payloads.taskRules(s.user.role)) throw A.coded('NOT_PERMITTED');
      var allowed = P.payloads.allowedCommissions(s.user.role, list);
      var roster = await provider.getCommissionDirectory(input && input.commission_id);
      var v = P.payloads.validateTaskCreate(input, { role: s.user.role, uid: s.user.id, commissions: allowed, members: roster.members || [], mock: false });
      if (!v.ok) throw A.validation(v.errors);
      return insertTaskRow(v.payload);
    },

    uploadDocument: async function (input) {
      var s = await current(), role = s.user.role;
      if (!P.payloads.documentUploadAllowed(role)) throw A.coded('NOT_PERMITTED');
      var list = await commissionOptions(), v = P.payloads.validateDocumentUpload(input, { role: role, uid: s.user.id, commissions: list });
      if (!v.ok) throw A.validation(v.errors);
      var file = v.payload.file, extMatch = /\.([a-z0-9]{1,8})$/i.exec(file.name), ext = extMatch ? extMatch[1].toLowerCase() : '';
      var mime = P.payloads.DOCUMENT_MIME[ext];
      if (!mime) throw A.validation({ file: 'Ce format de document n’est pas autorisé.' });
      var safeName = file.name.normalize ? file.name.normalize('NFKD') : file.name;
      safeName = safeName.replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(-100) || ('document.' + ext);
      var path = 'club/' + s.user.id + '/' + (P.payloads.newId() || String(Date.now())) + '-' + safeName;
      var storage = sb().storage.from(P.payloads.DOCUMENT_BUCKET), upload;
      try { upload = await storage.upload(path, file, { cacheControl: '3600', upsert: false, contentType: mime }); }
      catch (e) { throw documentStageError(e, 'storage'); }
      if (upload.error) throw documentStageError(upload.error, 'storage');
      var row = { name: file.name, storage_path: path, access_type: v.payload.access_type, commission_id: v.payload.commission_id, uploaded_by: s.user.id };
      try { await insertRow('documents', row); }
      catch (err) {
        try {
          var cleanup = await storage.remove([path]);
          if (cleanup && cleanup.error && window.console && console.debug) console.debug('[ICRM] document cleanup failed', cleanup.error.code || cleanup.error.status || cleanup.error.message);
        } catch (cleanupError) { if (window.console && console.debug) console.debug('[ICRM] document cleanup failed', cleanupError.code || cleanupError.status || cleanupError.message); }
        throw documentStageError(err, 'metadata');
      }
      return { saved: true, storagePath: path };
    },

    getDocumentDownloadUrl: async function (path, name) {
      await current();
      if (typeof path !== 'string' || !path || path.length > 512 || path.indexOf('..') > -1) throw A.coded('VALIDATION');
      var r;
      try { r = await sb().storage.from(P.payloads.DOCUMENT_BUCKET).createSignedUrl(path, 90, { download: name || true }); }
      catch (e) { throw documentStageError(e, 'download'); }
      if (r.error || !r.data || !r.data.signedUrl) throw documentStageError(r.error || new Error('URL de téléchargement indisponible'), 'download');
      return { url: r.data.signedUrl };
    },

    deleteDocument: async function (documentId) {
      var s = await current();
      if (!P.payloads.documentDeleteAllowed(s.user.role)) throw A.coded('NOT_PERMITTED');
      if (typeof documentId !== 'string' || !documentId || documentId.length > 80) throw A.coded('VALIDATION');
      var found;
      try { found = await sb().from('documents').select('*').eq('id', documentId).maybeSingle(); }
      catch (e) { throw A.deleteError(e); }
      if (found.error) throw A.deleteError(found.error);
      if (!found.data) throw A.coded('NOT_DELETED');
      var row = found.data;
      /* Retire d'abord la fiche. Si Storage refuse ensuite, restaure la fiche et signale l'échec au lieu de mentir. */
      await deleteRow('documents', documentId);
      if (row.storage_path) {
        var removed;
        try { removed = await sb().storage.from(P.payloads.DOCUMENT_BUCKET).remove([row.storage_path]); }
        catch (e2) { removed = { error: e2 }; }
        if (removed && removed.error) {
          var restored;
          try { restored = await sb().from('documents').insert(row); }
          catch (e3) { restored = { error: e3 }; }
          if (!restored || restored.error) {
            if (window.console && console.error) console.error('[ICRM] document delete compensation failed', restored && restored.error && restored.error.code);
            throw A.coded('DOCUMENT_DELETE_INCONSISTENT', removed.error);
          }
          throw documentStageError(removed.error, 'delete');
        }
      }
      return { deleted: true };
    },

    /* ===== Ma Commission : catalogue, appartenances (plusieurs), sélection initiale ===== */
    getCommissionCatalog: async function () {
      await current();
      var m = await catalogMap();
      return { commissions: Object.keys(m).map(function (id) { return { id: id, name: m[id].name, description: m[id].description }; }) };
    },

    /* Cartes de l'utilisateur (une par appartenance). state : none | two | incomplete (membre) | managed (responsable). */
    getMyCommissions: async function () {
      var s = await current(), role = s.user.role;
      var mine = await rpcCall('my_commission_memberships');
      if (!mine.length) return { state: 'none', cards: [] };
      var names = await catalogMap();
      var cards = await Promise.all(mine.map(async function (m) {
        var results = await Promise.all([
          roster(m.commission_id),
          commissionLeadershipRoles(m.commission_id),
          commissionAnnouncementsData(m.commission_id).catch(function () { return { announcements: [], error: true }; })
        ]);
        var r = results[0], ranked = results[1], announcementData = results[2], rankMap = leadershipRankMap(ranked);
        var heads = Array.isArray(ranked) ? ranked : r.rows.filter(function (x) { return x.member_position === 'responsable'; });
        var info = names[m.commission_id] || { name: 'Commission', description: '' };
        return {
          id: m.commission_id, name: info.name, description: info.description, myPosition: m.position,
          heads: heads.map(function (h) { return { id: h.profile_id, name: h.full_name || 'Responsable', rank: Number(h.leadership_rank) || rankMap[h.profile_id] || null }; })
            .sort(function (a, b) { return (a.rank || 99) - (b.rank || 99) || a.name.localeCompare(b.name, 'fr'); }),
          members: r.rows.map(function (x) { return { id: x.profile_id, name: x.full_name || 'Membre', position: x.member_position, leadershipRank: rankMap[x.profile_id], status: x.status == null ? null : A.normalizeStatus(x.status) }; }),
          headCount: heads.length, warning: heads.length < 1 || heads.length > 2, rosterError: r.error,
          announcements: announcementData.announcements || [], announcementsError: announcementData.error === true
        };
      }));
      cards.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
      var state = role === 'member' ? (mine.length === 2 ? 'two' : 'incomplete') : 'managed';
      return { state: state, cards: cards };
    },

    /* Vue d'ensemble (Bureau exécutif / Super Admin) : la fonction SQL ne renvoie rien à quiconque d'autre. */
    getCommissionOverview: async function () {
      var rows = await rpcCall('commission_overview');
      var commissions = await Promise.all(rows.map(async function (r) {
        var ranked = await commissionLeadershipRoles(r.commission_id);
        var hasRankedResponse = Array.isArray(ranked);
        var heads = hasRankedResponse ? ranked.map(function (h) { return { id: h.profile_id, name: h.full_name || 'Responsable', rank: Number(h.leadership_rank) || null }; }) : (r.head_names || []);
        var headCount = hasRankedResponse ? heads.length : (Number(r.head_count) || heads.length);
        return { id: r.commission_id, name: r.name || 'Commission', description: r.description || '', memberCount: Number(r.member_count) || 0,
                 headCount: headCount, heads: heads, warning: headCount < 1 || headCount > 2 };
      }));
      return { commissions: commissions };
    },

    getCommissionDirectory: async function (commissionId) {
      var results = await Promise.all([rpcCall('commission_directory', { p_commission_id: commissionId }), commissionLeadershipRoles(commissionId)]);
      var rows = results[0], ranks = leadershipRankMap(results[1]);
      return { members: rows.map(function (x) { return { id: x.profile_id, name: x.full_name || 'Membre', position: x.member_position, leadershipRank: ranks[x.profile_id], status: x.status == null ? null : A.normalizeStatus(x.status) }; }) };
    },

    /* Administration d'équipe : chaque RPC vérifie le rôle Super Admin côté PostgreSQL. */
    getAdminTeamWorkspace: async function () {
      await current();
      var data = await rpcCall('admin_team_workspace');
      if (!data || Array.isArray(data) || typeof data !== 'object') throw A.coded('QUERY');
      return data;
    },
    adminSaveClubPosition: async function (input) {
      await current();
      input = input || {};
      return rpcRaw('admin_save_club_position', {
        p_position_id: input.positionId || null,
        p_title: input.title,
        p_profile_id: input.profileId || null,
        p_display_order: input.displayOrder,
        p_is_public: input.isPublic === true,
        p_photo_url: input.photoUrl || null
      }).then(function (id) { if (typeof id !== 'string' || !id) throw A.coded('WRITE_FAILED'); return { saved: true, id: id }; });
    },
    adminDeleteClubPosition: async function (positionId) {
      await current();
      return rpcRaw('admin_delete_club_position', { p_position_id: positionId }).then(function (deleted) {
        if (deleted !== true) throw A.coded('WRITE_FAILED');
        return { deleted: true };
      });
    },
    adminSetCommissionHeads: async function (input) {
      await current();
      input = input || {};
      var ids = Array.isArray(input.headIds) ? input.headIds.map(function (id) { return String(id || '').trim(); }).filter(Boolean) : [];
      if (!input.commissionId || ids.length < 1 || ids.length > 2 || ids.some(function (id, i) { return ids.indexOf(id) !== i; })) throw A.validation({ _form: 'Choisis un responsable principal et, si nécessaire, un adjoint différent.' });
      return rpcRaw('admin_set_commission_heads', {
        p_commission_id: input.commissionId,
        p_head_ids: ids
      }).then(function (result) {
        if (!result || result.saved !== true || result.primary_head_id !== ids[0]) throw A.coded('WRITE_FAILED');
        if (ids.length === 2 && result.deputy_head_id !== ids[1]) throw A.coded('WRITE_FAILED');
        if (ids.length === 1 && result.deputy_head_id != null) throw A.coded('WRITE_FAILED');
        return result;
      });
    },
    adminPublishClubLeadership: async function (published) {
      await current();
      return rpcRaw('admin_publish_club_leadership', { p_published: published === true }).then(function (result) {
        if (!result || result.published !== (published === true)) throw A.coded('WRITE_FAILED');
        return result;
      });
    },

    /* Sélection : validée localement puis par la fonction SQL (qui revérifie tout, sous verrou). */
    selectMyCommissions: async function (ids) {
      await current();
      var cat = await catalogMap();
      var v = P.payloads.validateSelection(ids, Object.keys(cat));
      if (!v.ok) throw A.validation(v.errors);
      var r;
      try { r = await sb().rpc('select_my_commissions', { p_commission_ids: v.payload }); } catch (e) { throw A.writeError(e); }
      if (r.error) throw A.featureError(r.error) || A.writeError(r.error);
      return { saved: true, commissionIds: v.payload };
    },

    /* ===== Propositions d'actions ===== */
    createActionProposal: async function (input) {
      await current();
      var mine = await rpcCall('my_commission_memberships');
      var v = P.payloads.validateProposal(input, { myCommissionIds: mine.map(function (m) { return m.commission_id; }) });
      if (!v.ok) throw A.validation(v.errors);
      var id = P.payloads.newId(); if (!id) throw A.coded('UNEXPECTED');
      var row = { id: id, commission_id: v.payload.commission_id, title: v.payload.title, description: v.payload.description, objective: v.payload.objective };
      var r;
      try { r = await sb().from('action_proposals').insert(row); } catch (e) { throw A.writeError(e); }
      if (r.error) {
        /* Réponse perdue puis renvoi : si la ligne existe déjà, c'est un succès (pas de doublon, pas de fausse erreur). */
        if (r.error.code === '23505') {
          var ex = await sb().from('action_proposals').select('id').eq('id', id).maybeSingle();
          if (ex.data && ex.data.id === id) return { saved: true, id: id, reference: P.payloads.reference(id) };
        }
        throw A.writeError(r.error);
      }
      return { saved: true, id: id, reference: P.payloads.reference(id) };
    },

    /* Mes propositions : RLS + filtre explicite sur l'auteur. */
    getMyActionProposals: async function () {
      var s = await current();
      var r = await sb().from('action_proposals')
        .select('id, commission_id, title, status, reviewer_notes, reviewed_at, created_at')
        .eq('proposer_id', s.user.id).order('created_at', { ascending: false });
      if (r.error) throw A.toError(r.error, 'QUERY');
      var names = await catalogMap();
      return { proposals: (r.data || []).map(function (p) {
        return { id: p.id, reference: P.payloads.reference(p.id), title: p.title, status: p.status, statusLabel: P.payloads.proposalStatusLabel(p.status),
                 commissionName: (names[p.commission_id] || {}).name || 'Commission', reviewerNotes: p.reviewer_notes || '',
                 createdAt: p.created_at, reviewedAt: p.reviewed_at };
      }) };
    },

    /* Boîte de réception : propositions visibles selon la RLS (Bureau élargi, Bureau exécutif, Super Admin). */
    getInboxProposals: async function (commissionId) {
      var s = await current(), uid = s.user.id, role = s.user.role;
      var q = sb().from('action_proposals')
        .select('id, proposer_id, commission_id, title, description, objective, status, reviewer_notes, reviewed_by, reviewed_at, created_at')
        .order('created_at', { ascending: false });
      if (commissionId) q = q.eq('commission_id', commissionId);
      var r = await q;
      if (r.error) throw A.toError(r.error, 'QUERY');
      var rows = r.data || [], comIds = [];
      rows.forEach(function (p) { if (comIds.indexOf(p.commission_id) < 0) comIds.push(p.commission_id); });
      var names = await catalogMap(), people = {}, heads = {};
      await Promise.all(comIds.map(async function (cid) {
        var rs = await roster(cid);
        rs.rows.forEach(function (x) { people[x.profile_id] = x.full_name || 'Membre'; });
        heads[cid] = rs.rows.filter(function (x) { return x.member_position === 'responsable'; }).map(function (x) { return x.profile_id; });
      }));
      var hist = {}, ids = rows.map(function (p) { return p.id; });
      if (ids.length) {
        var h = await sb().from('action_proposal_reviews').select('proposal_id, reviewer_id, from_status, to_status, note, created_at').in('proposal_id', ids).order('created_at');
        if (h.error) throw A.toError(h.error, 'QUERY');
        (h.data || []).forEach(function (x) { (hist[x.proposal_id] = hist[x.proposal_id] || []).push(x); });
      }
      var bureau = role === 'bureau';
      return { proposals: rows.map(function (p) {
        var hs = hist[p.id] || [];
        return { id: p.id, reference: P.payloads.reference(p.id), title: p.title, description: p.description, objective: p.objective || '',
                 status: p.status, statusLabel: P.payloads.proposalStatusLabel(p.status), commissionId: p.commission_id,
                 commissionName: (names[p.commission_id] || {}).name || 'Commission', proposerName: people[p.proposer_id] || 'Membre',
                 reviewerNotes: p.reviewer_notes || '', reviewedAt: p.reviewed_at, createdAt: p.created_at,
                 canReview: bureau || (role === 'commission_head' && (heads[p.commission_id] || []).indexOf(uid) > -1),
                 canDelete: role === 'super_admin',
                 history: hs.map(function (x) { return { from: x.from_status, to: x.to_status, note: x.note || '', at: x.created_at, reviewer: people[x.reviewer_id] || 'Relecteur' }; }) };
      }) };
    },

    /* Changement de statut : mise à jour CONDITIONNELLE (statut attendu) + contrôle par déclencheur côté base. */
    updateProposalReview: async function (id, input, currentStatus) {
      var v = P.payloads.validateReview(input, currentStatus);
      if (!v.ok) throw A.validation(v.errors);
      var r;
      try { r = await sb().from('action_proposals').update(v.payload, { count: 'exact' }).eq('id', id).eq('status', currentStatus); }
      catch (e) { throw A.writeError(e); }
      if (r.error) throw A.writeError(r.error);
      if (r.count !== 1) throw A.coded('REVIEW_NOT_APPLIED');
      return { saved: true };
    },

    /* ===== Suppression (Bureau exécutif et Super Admin ; la base refuse les autres) ===== */
    /* Suppression d’une proposition : le RPC revalide le rôle Super Admin côté PostgreSQL. */
    deleteActionProposal: async function (id) {
      var session = await current();
      if (!session || session.role !== 'super_admin') throw A.coded('DELETE_FORBIDDEN');
      if (!P.payloads.isUuid(id)) throw A.coded('VALIDATION');
      var result = await rpcRaw('admin_delete_action_proposal', {
        p_proposal_id: String(id).toLowerCase(),
        p_reason: 'Suppression administrative depuis l’Espace Membres'
      });
      if (!result || result.deleted !== true) throw A.coded('DELETE_FAILED');
      return { deleted: true };
    },

    deleteMeeting: async function (id) { await current(); return deleteRow('meetings', id); },
    deleteAnnouncement: async function (id) { await current(); return deleteRow('announcements', id); },

    /* ===== ICRM IMPACT : progression (toutes les valeurs viennent de la base) ===== */
    getMyProgress: async function () {
      await current();
      var d = await rpcRaw('get_my_progression');
      var info = { xp: d.xp, level: d.level, title: d.title, currentMin: d.current_min, nextMin: d.next_min,
                   remaining: d.remaining, progressPct: d.progress_pct, isMax: d.next_min == null };
      return { xp: d.xp, level: d.level, title: d.title, currentMin: d.current_min, nextMin: d.next_min,
               remaining: d.remaining, progressPct: d.progress_pct, isMax: d.next_min == null, unseen: d.unseen_events,
               message: P.progression.message(info),
               badges: (d.badges || []).map(function (b) {
                 return { code: b.code, name: b.name, description: b.description, criteria: b.criteria, earned: !!b.earned_at, earnedAt: b.earned_at || null };
               }) };
    },
    getMyBadges: async function () { var p = await this.getMyProgress(); return { badges: p.badges }; },
    getMyXpHistory: async function (limit) {
      await current();
      var rows = P.progression.sortHistory(await rpcRaw('get_my_xp_history', { p_limit: limit || 50 }));
      return { entries: rows.map(function (r) {
        return { id: r.id, sourceType: r.source_type, ruleCode: r.rule_code, xpDelta: r.xp_delta, reason: r.reason, createdAt: r.created_at };
      }) };
    },
    getMyProgressNotifications: async function () {
      await current();
      var rows = await rpcRaw('get_my_progress_notifications');
      return { events: (rows || []).map(function (r) {
        return { id: r.id, kind: r.kind, code: r.code, createdAt: r.created_at, label: P.progression.eventLabel(r) };
      }) };
    },
    markProgressNotificationsSeen: async function (ids) {
      await current();
      var list = P.progression.unseenIds((ids || []).map(function (id) { return { id: id }; }));
      if (!list.length) return { saved: true, count: 0 };
      var n = await rpcRaw('mark_progress_notifications_seen', { p_ids: list });
      return { saved: true, count: Number(n) || 0 };
    },
    /* Validation d'une tâche terminée : seule la base décide (périmètre, auto-validation, statut, unicité). */
    validateTask: async function (taskId) {
      await current();
      var d = await rpcRaw('validate_task', { p_task_id: taskId });
      return { validated: !!(d && d.validated), xp: (d && d.xp) || 0 };
    },
    /* ICRM task lifecycle + Super Admin delete — 20261029220000 */
    updateMyTaskStatus: async function (taskId, status, progressNote) {
      await current();
      if (!taskId || ['pending', 'in_progress', 'completed'].indexOf(status) < 0 || String(progressNote || '').length > 1000) {
        throw A.coded('VALIDATION');
      }
      var d = await rpcRaw('update_my_task_status', { p_task_id: taskId, p_status: status, p_progress_note: String(progressNote || '') });
      if (!d || d.saved !== true) throw A.coded('WRITE_FAILED');
      return { saved: true, status: d.status || status, awaitingValidation: !!d.awaiting_validation, mock: false };
    },
    adminDeleteTask: async function (taskId) {
      var s = await current();
      if (s.user.role !== 'super_admin') throw A.coded('NOT_PERMITTED');
      if (!taskId) throw A.coded('VALIDATION');
      var d = await rpcRaw('admin_delete_task', { p_task_id: taskId, p_reason: 'Suppression administrative par le Super Admin' });
      if (!d || d.deleted !== true) throw A.coded('NOT_DELETED');
      return { deleted: true, mock: false };
    },

    getMeetingPolls: async function (meetingId) {
      await current();
      var rows = await rpcRaw('get_meeting_polls', { p_meeting_id: meetingId || null });
      return { polls: Array.isArray(rows) ? rows : [], available: true };
    },
    createMeetingPoll: async function (input) {
      await current();
      var question = String(input && input.question || '').trim();
      var description = String(input && input.description || '').trim();
      var options = Array.isArray(input && input.options) ? input.options.map(function (x) { return String(x || '').trim(); }).filter(Boolean) : [];
      if (!input || !input.meeting_id || question.length < 5 || question.length > 200 || description.length > 2000 || options.length < 2 || options.length > 8) {
        throw A.validation({ _form: 'Vérifie la question, la description et les 2 à 8 choix du sondage.' });
      }
      var id = await rpcRaw('create_meeting_poll', { p_meeting_id: input.meeting_id, p_question: question, p_description: description, p_options: options });
      return { saved: true, id: id, mock: false };
    },
    voteMeetingPoll: async function (pollId, optionId) {
      await current();
      var result = await rpcRaw('cast_meeting_poll_vote', { p_poll_id: pollId, p_option_id: optionId });
      return { saved: !!(result && result.saved), changed: !!(result && result.changed), mock: false };
    },
    closeMeetingPoll: async function (pollId, closed) {
      await current();
      var result = await rpcRaw('close_meeting_poll', { p_poll_id: pollId, p_closed: closed !== false });
      return { saved: !!(result && result.saved), status: result && result.status, mock: false };
    },

    /* Dashboard : jamais bloquant (une lecture qui échoue donne une section vide). */
    getDashboard: async function () {
      var s = await current(), uid = s.user.id;
      var d = await load(['profiles', 'commissions', 'commission_members', 'tasks', 'meetings', 'attendance', 'announcements', 'activity_log'], true);
      var pollsSnapshot = await readVisibleMeetingPolls(true);
      var x = M.context(d), all = d.tasks.map(function (t) { return M.mapTask(t, x); });
      var mine = all.filter(function (t) { return t.assigneeId === uid; });
      var att = M.attendanceStats(d.attendance.filter(function (a) { return memberId(a) === uid; }));
      var com = await myCommission(uid, d, x);
      var meetings = d.meetings.map(function (m) { return M.mapMeeting(m, x, d, all); }).filter(function (m) { return m.status === 'upcoming'; }).sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
      var next = (com && meetings.filter(function (m) { return m.commission === com.name; })[0]) || meetings[0] || null;
      return {
        user: s.user, today: today(), commission: M.strip(com), nextMeeting: next,
        commissions: await dashboardCommissions(s.user.id),
        stats: {
          activity: null,                                        // aucune formule d'« activité » définie : affiché « — »
          /* Présence : voir M.attendanceStats (présent + en retard / comptées ; absences excusées exclues). */
          attendance: att.counted ? { present: att.attended, total: att.counted, excused: att.excused } : null,
          tasks: mine.length ? { done: mine.filter(function (t) { return t.status === 'completed'; }).length, total: mine.length } : null
        },
        myTasks: mine.sort(function (a, b) { return (a.status === 'completed') - (b.status === 'completed') || String(a.deadline).localeCompare(String(b.deadline)); }),
        myPollTasks: pendingPollTasks(pollsSnapshot.rows), pollsAvailable: pollsSnapshot.available,
        announcements: d.announcements.map(function (a) { return M.mapAnnouncement(a, x); }).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 3),
        activity: d.activity_log.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); }).slice(0, 4).map(function (r, i) { return M.mapActivity(r, i); })
      };
    },

    getProfile: async function () {
      var s = await current(), d = await load(['profiles', 'commissions', 'commission_members', 'tasks', 'meetings'], true);
      return { user: s.user, commission: M.strip(await myCommission(s.user.id, d, M.context(d))) };
    },

    /* Modifier uniquement les champs personnels autorisés. Les rôles, statuts, email et commissions ne sont jamais acceptés ici. */
    updateMyProfile: async function (input) {
      var s = await current(), client = sb(), fullName = String(input && input.full_name || '').trim();
      var phone = String(input && input.phone || '').trim();
      if (fullName.length < 2 || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName)) {
        throw A.validation({ full_name: 'Le nom doit contenir entre 2 et 100 caractères.' });
      }
      if (phone.length > 32 || /[\u0000-\u001f\u007f]/.test(phone)) {
        throw A.validation({ phone: 'Le numéro ne doit pas dépasser 32 caractères.' });
      }
      var r;
      try {
        r = await client.from('profiles').update({ full_name: fullName, phone: phone || null })
          .eq('id', s.user.id).select(A.PROFILE_COLUMNS).maybeSingle();
      } catch (err) { throw A.writeError(err); }
      if (r.error) throw A.writeError(r.error);
      if (!r.data || r.data.id !== s.user.id) throw A.coded('WRITE_FAILED');
      var authResult;
      try { authResult = await client.auth.getUser(); } catch (err2) { throw A.toError(err2, 'NETWORK'); }
      if (authResult.error || !authResult.data || !authResult.data.user) throw A.toError(authResult.error || null, 'NO_SESSION');
      var freshUser = await A.fetchProfile(client, authResult.data.user);
      cached = Object.assign({}, s, { user: freshUser });
      return { saved: true, user: freshUser };
    },

    getCommission: async function () {
      var s = await current(), d = await load(['profiles', 'commissions', 'commission_members', 'tasks', 'meetings', 'attendance']), x = M.context(d);
      var com = await myCommission(s.user.id, d, x); if (!com) return { commission: null, members: [] };
      var tasks = d.tasks.map(function (t) { return M.mapTask(t, x); });
      var members = com._members.map(function (m) {
        var att = M.attendanceStats(d.attendance.filter(function (a) { return memberId(a) === m.id; })), theirs = tasks.filter(function (t) { return t.assigneeId === m.id; });
        /* status : null si le profil n'est pas lisible (jamais « Inactif » par défaut). follow_up → 'watch'. */
        return { name: m.name || 'Membre', position: m.position, status: m.status == null ? null : A.normalizeStatus(m.status),
          attendance: att.rate, tasks: [theirs.filter(function (t) { return t.status === 'completed'; }).length, theirs.length] };
      });
      return { commission: M.strip(com), members: members };
    },

    getCalendar: async function () {
      var s = await current(), d = await load(['profiles', 'commissions', 'tasks', 'meetings', 'attendance']), x = M.context(d);
      var tasks = d.tasks.map(function (t) { return M.mapTask(t, x); });
      var events = d.meetings.map(function (m) { return M.mapMeeting(m, x, d, tasks); }).map(function (m) {
        return { id: m.id, date: m.date, title: m.title, type: m.kind === 'event' ? 'event' : m.kind === 'training' ? 'training' : m.kind === 'other' ? 'other' : m.scope === 'commission' ? 'commission-meeting' : 'club-meeting', time: m.start, location: m.location };
      }).concat(tasks.filter(function (t) { return t.assigneeId === s.user.id && t.deadline && t.status !== 'completed'; }).map(function (t) {
        return { id: 'task-' + t.id, date: t.deadline, title: 'Échéance — ' + t.title, type: 'deadline', time: '23:59', location: '' };
      }));
      return { events: events, today: today() };
    },

    /* Appel de présence : le serveur fixe opened_at et décide present/late après 30 minutes. */
    getMeetingRollCall: async function (meetingId) {
      await current();
      var d = await rpcRaw('get_meeting_roll_call', { p_meeting_id: meetingId });
      if (!d || !Array.isArray(d.members)) throw A.coded('QUERY_FAILED');
      return { meetingId: d.meeting_id, title: d.title || '', commissionId: d.commission_id || null,
        openedAt: d.opened_at || null, lateAfterAt: d.late_after_at || null, closedAt: d.closed_at || null,
        members: d.members.map(function (m) { return { id: m.id, fullName: m.full_name || 'Nom non renseigné',
          role: m.role || 'member', status: m.status || 'unknown', attendanceStatus: m.attendance_status || null }; }) };
    },
    setMeetingAttendance: async function (meetingId, memberId, status) {
      await current();
      if (['present', 'absent', 'excused'].indexOf(status) < 0) throw A.validation({ status: 'Statut de présence invalide.' });
      var d = await rpcRaw('set_meeting_attendance', { p_meeting_id: meetingId, p_member_id: memberId, p_status: status });
      return { saved: !!(d && d.saved), status: d && d.status, xpDue: Number(d && d.xp_due) || 0,
        openedAt: d && d.opened_at || null, lateAfterAt: d && d.late_after_at || null };
    },
    finalizeMeetingRollCall: async function (meetingId) {
      await current();
      var d = await rpcRaw('finalize_meeting_roll_call', { p_meeting_id: meetingId });
      if (!d || !Array.isArray(d.members)) throw A.coded('QUERY_FAILED');
      return { meetingId: d.meeting_id, title: d.title || '', commissionId: d.commission_id || null,
        openedAt: d.opened_at || null, lateAfterAt: d.late_after_at || null, closedAt: d.closed_at || null,
        members: d.members.map(function (m) { return { id: m.id, fullName: m.full_name || 'Nom non renseigné',
          role: m.role || 'member', status: m.status || 'unknown', attendanceStatus: m.attendance_status || null }; }) };
    },
    getXpAdjustmentMembers: async function () {
      await current();
      var rows = await rpcCall('get_xp_adjustment_members');
      return { members: (rows || []).map(function (m) { return { id: m.member_id, fullName: m.full_name || 'Nom non renseigné',
        role: m.role || 'member', status: m.status || 'unknown', totalXp: Math.max(0, Number(m.total_xp) || 0) }; }) };
    },
    recordXpAdjustment: async function (memberId, delta, reason) {
      await current();
      var n = Number(delta), why = String(reason || '').trim();
      if (!memberId || !Number.isInteger(n) || n === 0 || Math.abs(n) > 500 || why.length < 3 || why.length > 300) {
        throw A.validation({ _form: 'Choisis un membre, un ajustement entier de −500 à +500 non nul, et un motif de 3 à 300 caractères.' });
      }
      await rpcRaw('record_xp_adjustment', { p_member: memberId, p_delta: n, p_reason: why });
      return { saved: true, delta: n };
    },

    getMeetings: async function () {
      var s = await current();
      var d = await load(['profiles', 'commissions', 'commission_members', 'tasks', 'meetings', 'attendance']), x = M.context(d), tasks = d.tasks.map(function (t) { return M.mapTask(t, x); });
      var pollsSnapshot = await readVisibleMeetingPolls(true);
      var uid = s.user.id, role = s.user.role;
      var meetings = d.meetings.map(function (raw) {
        var m = M.mapMeeting(raw, x, d, tasks);
        var canEdit = role === 'bureau' || role === 'super_admin';
        if (!canEdit && role === 'commission_head' && m.scope === 'commission' && m.commissionId) {
          canEdit = (d.commission_members || []).some(function (r) {
            return String(memberId(r)) === String(uid) && String(r.commission_id) === String(m.commissionId) && String(r.position) === 'responsable';
          });
        }
        m.canEditMinutes = canEdit;
        return m;
      });
      /* UI affordance only; save_meeting_minutes rechecks roles and membership inside PostgreSQL. */
      return { meetings: meetings, today: today(), unsupported: M.meetingUnsupported(d), polls: pollsSnapshot.rows, pollsAvailable: pollsSnapshot.available };
    },

    saveMeetingMinutes: async function (meetingId, input) {
      await current();
      if (!meetingId || !input || !Array.isArray(input.agenda) || !Array.isArray(input.decisions)) throw A.coded('VALIDATION');
      return rpcRaw('save_meeting_minutes', { p_meeting_id: meetingId, p_agenda: input.agenda, p_notes: input.notes == null ? '' : String(input.notes), p_decisions: input.decisions });
    },

    getTasks: async function () {
      var s = await current(), d = await load(['profiles', 'commissions', 'tasks', 'task_validations']), x = M.context(d), validatedIds = {};
      (d.task_validations || []).forEach(function (v) { validatedIds[String(v.task_id)] = true; });
      var pollsSnapshot = await readVisibleMeetingPolls(true);
      return { tasks: d.tasks.filter(function (t) { return !t.deleted_at; }).map(function (t) { var mapped = M.mapTask(t, x); mapped.validated = !!validatedIds[String(t.id)]; return mapped; }), me: s.user.fullName, meId: s.user.id, today: today(), pendingPolls: pendingPollTasks(pollsSnapshot.rows), pollsAvailable: pollsSnapshot.available };
    },

    /* Documents privés : liste issue de RLS ; l'ouverture passe par une URL signée à courte durée. */
    getDocuments: async function () {
      var d = await load(['profiles', 'documents']), x = M.context(d);
      return { documents: d.documents.map(function (r) { return M.mapDocument(r, x); }),
               foldersSupported: !!(M.has(d.documents, 'folder') || M.has(d.documents, 'category')) };   // pas de colonne dossier dans le schéma initial
    },

    getAnnouncements: async function () {
      var d = await load(['profiles', 'announcements']), x = M.context(d);
      return { announcements: d.announcements.map(function (a) { return M.mapAnnouncement(a, x); }) };
    },
    getCommissionAnnouncements: async function (commissionId) {
      await current();
      if (typeof commissionId !== 'string' || !commissionId || commissionId.length > 80) throw A.coded('VALIDATION');
      return commissionAnnouncementsData(commissionId);
    },

    savePushSubscription: async function (input) {
      await current();
      var p = input || {};
      if (!p.endpoint || !p.p256dh || !p.auth) throw A.validation({ _form: 'Abonnement de notification incomplet.' });
      await rpcRaw('register_push_subscription', {
        p_endpoint: p.endpoint, p_p256dh: p.p256dh, p_auth: p.auth, p_device_name: p.deviceName || null
      });
      return { saved: true };
    },
    removePushSubscription: async function (endpoint) {
      await current();
      if (!endpoint) throw A.validation({ _form: 'Appareil de notification introuvable.' });
      var result = await rpcRaw('remove_push_subscription', { p_endpoint: endpoint });
      return { removed: !!(result && result.removed) };
    },

    /* Préférences personnelles stockées dans user_metadata (aucun changement de schéma requis).
       Ces interrupteurs enregistrent les choix; ils n'envoient pas encore de push/e-mails automatiques. */
    getSettings: async function () {
      var s = await current(), r;
      try { r = await sb().auth.getUser(); } catch (err) { throw A.toError(err, 'NETWORK'); }
      if (r.error || !r.data || !r.data.user) throw A.toError(r.error || null, 'NO_SESSION');
      var meta = r.data.user.user_metadata || {}, prefs = meta.icrm_preferences || {}, n = prefs.notifications || {};
      return { user: s.user, settings: { language: 'fr',
        notifications: [
          { id: 'n-ann', key: 'announcements', label: 'Annonces du club', hint: 'Garder cette préférence pour les annonces importantes du club.', enabled: typeof n.announcements === 'boolean' ? n.announcements : true },
          { id: 'n-meet', key: 'meetings', label: 'Rappels de réunion', hint: 'Préférence pour les rappels avant les réunions.', enabled: typeof n.meetings === 'boolean' ? n.meetings : true },
          { id: 'n-task', key: 'tasks', label: 'Échéances de tâches', hint: 'Préférence pour les rappels avant les échéances.', enabled: typeof n.tasks === 'boolean' ? n.tasks : false }
        ], notificationDeliveryEnabled: false } };
    },

    saveSettings: async function (input) {
      await current();
      var ns = input && input.notifications || {};
      var keys = ['announcements', 'meetings', 'tasks'], normalized = {};
      keys.forEach(function (key) {
        if (typeof ns[key] !== 'boolean') throw A.validation({ _form: 'Vérifie les préférences de notification puis réessaie.' });
        normalized[key] = ns[key];
      });
      var client = sb(), authState;
      try { authState = await client.auth.getUser(); } catch (err) { throw A.toError(err, 'NETWORK'); }
      if (authState.error || !authState.data || !authState.data.user) throw A.toError(authState.error || null, 'NO_SESSION');
      /* Conserver les autres métadonnées utilisateur : on ne remplace que notre espace de préférences. */
      var metadata = authState.data.user.user_metadata || {}, prior = metadata.icrm_preferences || {}, nextMetadata = {};
      Object.keys(metadata).forEach(function (key) { nextMetadata[key] = metadata[key]; });
      nextMetadata.icrm_preferences = Object.assign({}, prior, { language: 'fr', notifications: normalized });
      var r;
      try { r = await client.auth.updateUser({ data: nextMetadata }); }
      catch (err2) { throw A.writeError(err2); }
      if (r.error || !r.data || !r.data.user) throw A.writeError(r.error || new Error('Profil utilisateur non renvoyé.'));
      return { saved: true, language: 'fr', notifications: normalized };
    }
  };
})();
