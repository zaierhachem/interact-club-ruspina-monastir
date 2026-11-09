/* =========================================================================
   ICRM — ESPACE MEMBRES · FOURNISSEUR « MOCK »
   Implémente le contrat de données de l'application avec des données
   fictives (js/mock-data.js). C'est le SEUL fichier qui lit ICRMPortal.mock.
   Un futur js/providers/supabase.js devra exposer exactement les mêmes méthodes.
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal, M = P.mock;
  P.providers = P.providers || {};

  /* État de progression de démonstration : entrées en mémoire, sans écriture. */
  function progressState() {
    var d = M.progression, entries = d.entries.slice();
    (M.progressionSession || []).forEach(function (e) { entries.push(e); });
    var xp = entries.reduce(function (t, e) { return t + e.xp_delta; }, 0);
    var stats = Object.assign({}, d.stats, { xp: xp, verifiedContributions: entries.filter(function (e) { return e.source_type !== 'adjustment'; }).length, validatedTasks: d.stats.validatedTasks + (M.progressionSession || []).length });
    var codes = P.progression.evaluateBadges(stats);
    var badges = d.badgeCatalog.map(function (b) { return { code: b.code, name: b.name, description: b.description, criteria: b.criteria, earned: codes.indexOf(b.code) > -1, earnedAt: codes.indexOf(b.code) > -1 ? '2026-10-30T12:00:00Z' : null }; });
    var events = d.events.filter(function (ev) { return !(M.progressionSeen && M.progressionSeen[ev.id]); });
    return { entries: entries, xp: xp, badges: badges, events: events };
  }

  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var resolve = function (v) { return Promise.resolve(clone(v)); };
  var fullName = function () { return M.user.firstName + ' ' + M.user.lastName; };

  /* Sondages mock : uniquement en mémoire, jamais présentés comme enregistrés en production. */
  var mockPolls = [], mockPollVotes = {}, mockSiteContent = null;
  function canManageMockPoll(meetingId) {
    var role = M.user.role, meeting = M.meetings.filter(function (m) { return String(m.id) === String(meetingId); })[0];
    return role === 'bureau' || role === 'super_admin' || (role === 'commission_head' && meeting && meeting.scope === 'commission');
  }
  function mappedMockPolls(meetingId) {
    return mockPolls.filter(function (p) { return !meetingId || String(p.meeting_id) === String(meetingId); }).map(function (p) {
      var meeting = M.meetings.filter(function (m) { return String(m.id) === String(p.meeting_id); })[0] || {};
      var voted = mockPollVotes[p.id] || null, canManage = canManageMockPoll(p.meeting_id), visible = !!voted || p.status === 'closed' || canManage;
      var counts = {};
      if (voted) counts[voted] = 1;
      return { id: p.id, meeting_id: p.meeting_id, meeting_title: meeting.title || 'Activité', meeting_starts_at: meeting.date || M.today,
        meeting_kind: meeting.kind || 'meeting', question: p.question, description: p.description, status: p.status,
        created_by: p.created_by, created_at: p.created_at, closed_at: p.closed_at, my_option_id: voted, voted: !!voted,
        can_manage: canManage, results_visible: visible, total_votes: visible ? (voted ? 1 : 0) : null,
        options: p.options.map(function (o) { return { id: o.id, label: o.label, vote_count: visible ? (counts[o.id] || 0) : null }; }) };
    });
  }
  function mockPollTasks() {
    return mappedMockPolls().filter(function (p) { return p.status === 'open' && !p.my_option_id; }).map(function (p) {
      return { id: 'poll-' + p.id, pollId: p.id, meetingId: p.meeting_id, title: p.question,
        meetingTitle: p.meeting_title, deadline: String(p.meeting_starts_at || M.today).slice(0, 10), status: 'pending' };
    });
  }


  P.providers.mock = {
    name: 'mock',

    /* Identité + profil + rôle + permissions.
       SUPABASE : auth.getUser() → profiles (id = auth.uid()) → role, commission_id. */
    getSession: function () {
      var role = M.user.role, cfg = P.config.ROLES[role];
      var isExecutive = role === 'bureau' || role === 'super_admin';
      return resolve({ user: M.user, role: role, roleLabel: cfg.label, permissions: cfg.permissions, commission: isExecutive ? null : M.commission });
    },

    getMeetingPolls: function (meetingId) { return resolve(mappedMockPolls(meetingId)); },

    /* SUPABASE : agrégations (vues SQL / RPC) filtrées par RLS sur l'utilisateur. */
    getDashboard: function () {
      var mine = M.tasks.filter(function (t) { return t.assignee === fullName(); });
      var isExecutive = M.user.role === 'bureau' || M.user.role === 'super_admin';
      var next = M.meetings.filter(function (m) { return m.status === 'upcoming' && (isExecutive || m.commission === M.commission.name); })[0] || null;
      return resolve({
        user: M.user, stats: M.stats, commission: isExecutive ? null : M.commission, commissions: isExecutive ? [] : undefined, nextMeeting: next, today: M.today,
        myTasks: mine.sort(function (a, b) { return (a.status === 'completed') - (b.status === 'completed') || a.deadline.localeCompare(b.deadline); }),
        myPollTasks: mockPollTasks(), pollsAvailable: true,
        announcements: M.announcements.slice(0, 3), activity: M.activity
      });
    },
    getProfile:       function () { var isExecutive = M.user.role === 'bureau' || M.user.role === 'super_admin'; return resolve({ user: M.user, commission: isExecutive ? null : M.commission }); },
    updateMyProfile: function (input) {
      var fullName = String(input && input.full_name || '').trim(), phone = String(input && input.phone || '').trim();
      if (fullName.length < 2 || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName)) return Promise.reject(P.auth.validation({ full_name: 'Le nom doit contenir entre 2 et 100 caractères.' }));
      if (phone.length > 32 || /[\u0000-\u001f\u007f]/.test(phone)) return Promise.reject(P.auth.validation({ phone: 'Le numéro ne doit pas dépasser 32 caractères.' }));
      var parts = fullName.split(/\s+/); M.user.firstName = parts.shift() || ''; M.user.lastName = parts.join(' '); M.user.phone = phone || '—';
      return resolve({ saved: true, user: M.user, mock: true });
    },
    getCalendar:      function () { return resolve({ events: M.events, today: M.today }); },
    getCommission:    function () { var isExecutive = M.user.role === 'bureau' || M.user.role === 'super_admin'; return resolve({ commission: isExecutive ? null : M.commission, members: isExecutive ? [] : M.commissionMembers }); },
    saveMeetingMinutes: function (meetingId, input) {
      var meeting = (M.meetings || []).filter(function (m) { return String(m.id) === String(meetingId); })[0];
      if (!meeting) return Promise.reject(P.auth.coded('QUERY'));
      var role = M.user.role, allowed = role === 'bureau' || role === 'super_admin' || (role === 'commission_head' && (meeting.scope || (meeting.commission === 'Toutes les commissions' ? 'club' : 'commission')) === 'commission' && (M.myMemberships || []).some(function (r) { return String(r.commission_id || r.commissionId || '') === String(meeting.commissionId || '') && r.position === 'responsable'; }));
      if (!allowed) return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      meeting.agenda = (input.agenda || []).slice(); meeting.notes = String(input.notes || ''); meeting.decisions = (input.decisions || []).slice();
      return resolve({ saved: true, meeting_id: meetingId, mock: true });
    },
    getMeetings:      function () {
      var role = M.user.role;
      var meetings = M.meetings.map(function (raw) {
        var m = {}; Object.keys(raw).forEach(function (k) { m[k] = raw[k]; });
        if (!m.commissionId && m.commission && m.commission !== 'Toutes les commissions') {
          var c = (M.commissions || []).filter(function (x) { return x.name === m.commission; })[0]; if (c) m.commissionId = c.id;
        }
        if (!m.scope) m.scope = m.commission === 'Toutes les commissions' ? 'club' : 'commission';
        m.canEditMinutes = role === 'bureau' || role === 'super_admin' || (role === 'commission_head' && m.scope === 'commission' && (M.myMemberships || []).some(function (r) { return String(r.commission_id || r.commissionId || '') === String(m.commissionId || '') && r.position === 'responsable'; }));
        m.canManageLifecycle = role === 'bureau' || role === 'super_admin';
        m.actualStartedAt = m.actualStartedAt || null;
        m.completedAt = m.completedAt || null;
        m.actualStartEstimated = m.actualStartEstimated === true;
        m.status = m.completedAt ? 'past' : (m.date && m.date < M.today ? 'past' : (m.status || 'upcoming'));
        return m;
      });
      return resolve({ meetings: meetings, today: M.today, polls: mappedMockPolls(), pollsAvailable: true });
    },
    getTasks: function () {
      var validatedIds = {}, uid = M.user.id;
      (M.progressionSession || []).forEach(function (x) {
        if (x && x.source_type === 'task' && x.rule_code === 'task_validated' && x.id) validatedIds[String(x.id).replace(/^ps-/, '')] = true;
      });
      var tasks = M.tasks.filter(function (t) { return !t.deletedAt; }).map(function (t) {
        var copy = Object.assign({}, t);
        if (!copy.assigneeId && copy.assignee === fullName()) copy.assigneeId = uid;
        copy.progressNote = copy.progressNote || '';
        copy.validated = !!validatedIds[String(copy.id)];
        return copy;
      });
      return resolve({ tasks: tasks, me: fullName(), meId: uid, today: M.today, pendingPolls: mockPollTasks(), pollsAvailable: true });
    },
    /* SUPABASE STORAGE : documents.path → createSignedUrl() à la demande (jamais d'URL publique permanente). */
    getDocuments:     function () { return resolve({ documents: M.documents }); },
    getAnnouncements: function () { return resolve({ announcements: M.announcements }); },
    getCommissionAnnouncements: function (commissionId) {
      var c = M.catalog.filter(function (x) { return x.id === commissionId; })[0];
      var list = M.announcements.filter(function (a) { return /commission/i.test(String(a.audience || '')) && (!c || String(a.audience || '').indexOf(c.name) > -1); });
      return resolve({ announcements: list.slice(0, 4), error: false, mock: true });
    },
    savePushSubscription: function () { return resolve({ saved: true, mock: true }); },
    removePushSubscription: function () { return resolve({ removed: true, mock: true }); },
    getPublicSiteContent: function () {
      if (M.user.role !== 'super_admin') return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      return resolve({ content: mockSiteContent || (window.SITE && window.SITE.PUBLIC_CONTENT) || {}, updatedAt: null, configurationReady: true, mock: true });
    },
    savePublicSiteContent: function (content) {
      if (M.user.role !== 'super_admin') return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      mockSiteContent = clone(content); return resolve({ saved: true, mock: true });
    },
    getSettings: function () {
      var defs = [
        { id: 'n-ann', key: 'announcements', label: 'Annonces du club', hint: 'Nouvelles annonces selon leur audience.', fallback: true },
        { id: 'n-meet', key: 'meetings', label: 'Réunions et rappels', hint: 'Nouvelles réunions, modifications et rappels avant le début (dont 2 heures).', fallback: true },
        { id: 'n-task', key: 'tasks', label: 'Tâches et échéances', hint: 'Nouvelle tâche attribuée et rappels avant les échéances.', fallback: true },
        { id: 'n-doc', key: 'documents', label: 'Nouveaux documents', hint: 'Documents accessibles à ton compte ou à ta commission.', fallback: true },
        { id: 'n-xp', key: 'xp', label: 'XP, badges et niveaux', hint: 'XP gagnés, badge débloqué ou niveau franchi.', fallback: true },
        { id: 'n-prop', key: 'proposals', label: 'Propositions d’action', hint: 'Nouvelle proposition à examiner ou décision concernant ta proposition.', fallback: true },
        { id: 'n-poll', key: 'polls', label: 'Sondages', hint: 'Nouveau sondage publié pour une réunion ou activité accessible.', fallback: true }
      ];
      var prior = {};
      (M.settings.notifications || []).forEach(function (n) {
        var key = n.key || (n.id === 'n-ann' ? 'announcements' : n.id === 'n-meet' ? 'meetings' : n.id === 'n-task' ? 'tasks' : null);
        if (key) prior[key] = n.enabled;
      });
      return resolve({ user: M.user, settings: { language: 'fr', notifications: defs.map(function (d) {
        return { id: d.id, key: d.key, label: d.label, hint: d.hint, enabled: typeof prior[d.key] === 'boolean' ? prior[d.key] : d.fallback };
      }) } });
    },
    saveSettings: function (input) {
      var ns = input && input.notifications || {};
      var defs = [
        { id: 'n-ann', key: 'announcements', label: 'Annonces du club', fallback: true },
        { id: 'n-meet', key: 'meetings', label: 'Réunions et rappels', fallback: true },
        { id: 'n-task', key: 'tasks', label: 'Tâches et échéances', fallback: true },
        { id: 'n-doc', key: 'documents', label: 'Nouveaux documents', fallback: true },
        { id: 'n-xp', key: 'xp', label: 'XP, badges et niveaux', fallback: true },
        { id: 'n-prop', key: 'proposals', label: 'Propositions d’action', fallback: true },
        { id: 'n-poll', key: 'polls', label: 'Sondages', fallback: true }
      ];
      var prior = {};
      (M.settings.notifications || []).forEach(function (n) { if (n.key) prior[n.key] = n.enabled; });
      var normalized = {};
      defs.forEach(function (d) {
        if (Object.prototype.hasOwnProperty.call(ns, d.key) && typeof ns[d.key] !== 'boolean') {
          throw P.auth.validation({ _form: 'Vérifie les préférences de notification puis réessaie.' });
        }
        normalized[d.key] = Object.prototype.hasOwnProperty.call(ns, d.key) ? ns[d.key]
          : (typeof prior[d.key] === 'boolean' ? prior[d.key] : d.fallback);
      });
      M.settings.language = 'fr';
      M.settings.notifications = defs.map(function (d) {
        return { id: d.id, key: d.key, label: d.label, enabled: normalized[d.key] };
      });
      return resolve({ saved: true, language: 'fr', notifications: normalized, mock: true });
    },

    /* ----- création : validée comme en production, ajoutée EN MÉMOIRE seulement (perdue au rechargement).
       Le résultat porte `mock: true` : l'interface l'annonce comme une maquette, jamais comme une écriture réelle. ----- */
    getCommissionOptions: function () { return resolve({ commissions: M.commissions }); },
    createMeeting: function (input) {
      var v = P.payloads.validateMeeting(input, { role: M.user.role, uid: M.user.id, commissions: M.commissions });
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      var p = v.payload, st = P.payloads.tunisParts(new Date(p.starts_at)), en = p.ends_at ? P.payloads.tunisParts(new Date(p.ends_at)) : { time: '' };
      var com = M.commissions.filter(function (c) { return c.id === p.commission_id; })[0];
      M.meetings.push({ id: p.id || 'mock-' + (M.meetings.length + 1), title: p.title, description: p.description || '', kind: p.kind, scope: p.scope,
        date: st.date, start: st.time, end: en.time, location: p.location || 'À préciser', commission: com ? com.name : 'Toutes les commissions',
        status: st.date < M.today ? 'past' : 'upcoming', participants: [], agenda: [], notes: '', decisions: [], tasks: [] });
      return resolve({ saved: true, id: p.id || 'mock-' + M.meetings.length, mock: true });
    },
    createMeetingPoll: function (input) {
      if (['bureau','super_admin','commission_head'].indexOf(M.user.role) < 0) return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      var opts = Array.isArray(input && input.options) ? input.options.map(function (x) { return String(x || '').trim(); }).filter(Boolean) : [];
      if (!input || !input.meeting_id || String(input.question || '').trim().length < 5 || opts.length < 2 || opts.length > 8 || opts.some(function (x) { return x.length > 120; }) || new Set(opts.map(function (x) { return x.toLocaleLowerCase('fr'); })).size !== opts.length) return Promise.reject(P.auth.validation({ _form: 'Vérifie la question et les 2 à 8 choix différents.' }));
      var id = P.payloads.newId() || 'mock-poll-' + (mockPolls.length + 1);
      mockPolls.push({ id: id, meeting_id: input.meeting_id, question: String(input.question).trim(), description: String(input.description || '').trim(),
        status: 'open', created_by: M.user.id, created_at: new Date().toISOString(), options: opts.map(function (label, i) { return { id: id + '-o' + (i + 1), label: label }; }) });
      return resolve({ saved: true, id: id, mock: true });
    },
    voteMeetingPoll: function (pollId, optionId) {
      var p = mockPolls.filter(function (x) { return String(x.id) === String(pollId); })[0];
      if (!p || p.status !== 'open' || !p.options.some(function (o) { return String(o.id) === String(optionId); })) return Promise.reject(P.auth.coded('WRITE_FAILED'));
      mockPollVotes[pollId] = optionId; return resolve({ saved: true, changed: false, mock: true });
    },
    closeMeetingPoll: function (pollId, closed) {
      var p = mockPolls.filter(function (x) { return String(x.id) === String(pollId); })[0];
      if (!p || !canManageMockPoll(p.meeting_id)) return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      p.status = closed === false ? 'open' : 'closed'; p.closed_at = p.status === 'closed' ? new Date().toISOString() : null;
      return resolve({ saved: true, status: p.status, mock: true });
    },
    createAnnouncement: function (input) {
      var v = P.payloads.validateAnnouncement(input, { role: M.user.role, uid: M.user.id, commissions: M.commissions });
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      var p = v.payload, com = M.commissions.filter(function (c) { return c.id === p.commission_id; })[0];
      M.announcements.unshift({ id: p.id || 'mock-a' + (M.announcements.length + 1), title: p.title, priority: 'normal', date: M.today, author: M.user.firstName + ' ' + M.user.lastName,
        audience: p.audience === 'bureau_elargi' ? 'Bureau élargi' : p.audience === 'bureau' ? 'Bureau exécutif' : p.audience === 'commission' ? 'Commission ' + (com ? com.name : '') : 'Tous les membres',
        body: p.content.split(/\n{2,}/).map(function (t) { return t.trim(); }).filter(Boolean), attachments: [] });
      return resolve({ saved: true, id: p.id || 'mock-a' + M.announcements.length, mock: true });
    },
    createTask: function (input) {
      var role = M.user.role, commissions = P.payloads.allowedCommissions(role, M.commissions), roster = P.providers.mock.getCommissionDirectory(input && input.commission_id).then(function (r) { return r.members; });
      return roster.then(function (members) {
        var v = P.payloads.validateTaskCreate(input, { role: role, uid: M.user.id, commissions: commissions, members: members, mock: true });
        if (!v.ok) throw P.auth.validation(v.errors);
        var p = v.payload, c = M.commissions.filter(function (x) { return x.id === p.commission_id; })[0], person = members.filter(function (x) { return x.id === p.assigned_to; })[0];
        var id = p.id || 'mock-task-' + (M.tasks.length + 1);
        M.tasks.unshift({ id: id, title: p.title, description: p.description || '', assignee: person ? person.name : 'Membre', assigneeId: p.assigned_to,
          commission: c ? c.name : 'Commission', commissionId: p.commission_id || null, meetingId: p.meeting_id || null, priority: p.priority, deadline: p.due_date || '', status: 'pending' });
        if (p.meeting_id) { var sourceMeeting = (M.meetings || []).filter(function (m) { return String(m.id) === String(p.meeting_id); })[0]; if (sourceMeeting) sourceMeeting.tasks = (sourceMeeting.tasks || []).concat([p.title]); }
        return { saved: true, id: id, mock: true };
      });
    },
    uploadDocument: function (input) {
      var v = P.payloads.validateDocumentUpload(input, { role: M.user.role, uid: M.user.id, commissions: M.commissions });
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      var file = v.payload.file, access = v.payload.access_type, ext = /\.([a-z0-9]{1,8})$/i.exec(file.name), typ = ext ? ext[1].toLowerCase() : 'file';
      var id = 'mock-doc-' + (M.documents.length + 1);
      M.documents.unshift({ id: id, name: file.name, type: typ === 'jpg' || typ === 'jpeg' || typ === 'png' || typ === 'webp' ? 'img' : typ,
        folder: '', date: M.today, uploadedBy: fullName(), access: access === 'all_members' ? 'all' : access === 'bureau' ? 'bureau' : 'commission', storagePath: null });
      return resolve({ saved: true, id: id, mock: true });
    },
    getDocumentDownloadUrl: function () { return Promise.reject(P.auth.coded('NOT_IMPLEMENTED')); },
    deleteDocument: function (id) {
      if (!P.payloads.documentDeleteAllowed(M.user.role)) return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      var before = M.documents.length;
      M.documents = M.documents.filter(function (d) { return d.id !== id; });
      return before === M.documents.length ? Promise.reject(P.auth.coded('NOT_DELETED')) : resolve({ deleted: true, mock: true });
    },

    /* ===================== MAQUETTE : même contrat, données fictives, JAMAIS d'écriture réelle =====================
       Chaque résultat d'écriture porte `mock: true`. Aucun appel Supabase n'est fait par ce fournisseur. */
    getCommissionCatalog: function () { return resolve({ commissions: M.catalog }); },
    getMyCommissions: function () {
      if (!M.myMemberships.length) return resolve({ state: 'none', cards: [] });
      var cards = M.myMemberships.map(function (m) {
        var c = M.catalog.filter(function (x) { return x.id === m.commission_id; })[0] || { name: 'Commission', description: '' };
        var heads = (M.catalogHeads[m.commission_id] || []).map(function (n, i) { return { id: 'h' + i, name: n }; });
        return { id: m.commission_id, name: c.name, description: c.description, myPosition: 'member', heads: heads,
                 members: [{ id: 'me', name: M.user.firstName + ' ' + M.user.lastName, position: 'member', status: null }], headCount: heads.length, warning: heads.length < 1 || heads.length > 2, rosterError: false };
      });
      return resolve({ state: M.myMemberships.length === 2 ? 'two' : 'incomplete', cards: cards });
    },
    getCommissionOverview: function () {
      return resolve({ commissions: M.catalog.map(function (c) { var h = M.catalogHeads[c.id] || []; return { id: c.id, name: c.name, description: c.description, memberCount: 0, headCount: h.length, heads: h, warning: h.length < 1 || h.length > 2 }; }) });
    },
    getCommissionDirectory: function (id) {
      /* Annuaire de démonstration cohérent avec le catalogue utilisé par les formulaires de création. */
      var c = M.commissions.filter(function (x) { return x.id === id; })[0];
      if (!c) return resolve({ members: [] });
      var list = c.id === 'communication' ? M.commissionMembers : [
        { name: 'Membre maquette A', status: 'active' }, { name: 'Membre maquette B', status: 'watch' }, { name: 'Membre maquette C', status: 'active' }
      ];
      return resolve({ members: list.map(function (m, i) { return { id: 'mock-' + c.id + '-member-' + i, name: m.name, position: i < 2 ? 'responsable' : 'member', status: m.status || 'active' }; }) });
    },
    getAdminTeamWorkspace: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    getAdminCommissionWorkspace: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    adminSaveClubPosition: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    adminDeleteClubPosition: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    adminSetCommissionHeads: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    adminPublishClubLeadership: function () { return Promise.reject(P.auth.coded('NOT_PERMITTED')); },
    selectMyCommissions: function (ids) {
      var v = P.payloads.validateSelection(ids, M.catalog.map(function (c) { return c.id; }));
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      M.myMemberships = v.payload.map(function (id) { return { commission_id: id, position: 'member' }; });
      return resolve({ saved: true, commissionIds: v.payload, mock: true });
    },
    createActionProposal: function (input) {
      var v = P.payloads.validateProposal(input, { myCommissionIds: M.myMemberships.map(function (m) { return m.commission_id; }) });
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      var id = P.payloads.newId() || ('mock-' + (M.proposals.length + 1));
      M.proposals.unshift({ id: id, commission_id: v.payload.commission_id, title: v.payload.title, description: v.payload.description, objective: v.payload.objective || '',
                            status: 'submitted', reviewer_notes: '', created_at: new Date().toISOString(), reviewed_at: null, history: [] });
      return resolve({ saved: true, id: id, reference: P.payloads.reference(id), mock: true });
    },
    getMyActionProposals: function () {
      return resolve({ proposals: M.proposals.map(function (p) {
        var c = M.catalog.filter(function (x) { return x.id === p.commission_id; })[0] || { name: 'Commission' };
        return { id: p.id, reference: P.payloads.reference(p.id), title: p.title, status: p.status, statusLabel: P.payloads.proposalStatusLabel(p.status), commissionName: c.name, reviewerNotes: p.reviewer_notes, reviewedAt: p.reviewed_at, createdAt: p.created_at };
      }) });
    },
    getInboxProposals: function (commissionId) {
      return resolve({ proposals: M.proposals.filter(function (p) { return !commissionId || p.commission_id === commissionId; }).map(function (p) {
        var c = M.catalog.filter(function (x) { return x.id === p.commission_id; })[0] || { name: 'Commission' };
        return { id: p.id, reference: P.payloads.reference(p.id), title: p.title, description: p.description, objective: p.objective, status: p.status, statusLabel: P.payloads.proposalStatusLabel(p.status),
                 commissionId: p.commission_id, commissionName: c.name, proposerName: 'Membre (maquette)', reviewerNotes: p.reviewer_notes, reviewedAt: p.reviewed_at, createdAt: p.created_at, canReview: M.user.role === 'bureau' || (M.user.role === 'commission_head' && M.myMemberships.some(function (m) { return m.commission_id === p.commission_id; })), canDelete: M.user.role === 'super_admin', history: p.history };
      }) });
    },
    updateProposalReview: function (id, input, currentStatus) {
      var v = P.payloads.validateReview(input, currentStatus);
      if (!v.ok) return Promise.reject(P.auth.validation(v.errors));
      var p = M.proposals.filter(function (x) { return x.id === id && x.status === currentStatus; })[0];
      if (!p) return Promise.reject(P.auth.coded('REVIEW_NOT_APPLIED'));
      p.history.push({ from: p.status, to: v.payload.status, note: v.payload.reviewer_notes || '', at: new Date().toISOString(), reviewer: M.user.firstName + ' (maquette)' });
      p.status = v.payload.status; p.reviewer_notes = v.payload.reviewer_notes || ''; p.reviewed_at = new Date().toISOString();
      return resolve({ saved: true, mock: true });
    },
    deleteActionProposal: function (id) {
      if (M.user.role !== 'super_admin') return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      var before = M.proposals.length;
      M.proposals = M.proposals.filter(function (p) { return p.id !== id; });
      if (before === M.proposals.length) return Promise.reject(P.auth.coded('NOT_DELETED'));
      return resolve({ deleted: true, mock: true });
    },
    setMeetingLifecycle: function (meetingId, action) {
      if (['bureau', 'super_admin'].indexOf(M.user.role) < 0) return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      if (['start', 'complete'].indexOf(String(action)) < 0) return Promise.reject(P.auth.coded('VALIDATION'));
      var meeting = (M.meetings || []).filter(function (m) { return String(m.id) === String(meetingId); })[0];
      if (!meeting) return Promise.reject(P.auth.coded('QUERY'));
      var now = new Date().toISOString();
      if (action === 'start') {
        if (meeting.completedAt || meeting.completed_at) return Promise.reject(P.auth.coded('WRITE_FAILED'));
        if (!meeting.actualStartedAt && !meeting.actual_started_at) {
          meeting.actualStartedAt = now; meeting.actualStartEstimated = false; meeting.startedBy = M.user.id;
        }
      } else if (!(meeting.completedAt || meeting.completed_at)) {
        if (!meeting.actualStartedAt && !meeting.actual_started_at) {
          var scheduledStart = meeting.starts_at || (meeting.date && meeting.start ? meeting.date + 'T' + meeting.start + ':00' : null);
          var scheduledDate = scheduledStart ? new Date(scheduledStart) : null;
          meeting.actualStartedAt = scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() <= Date.now() ? scheduledDate.toISOString() : now;
          meeting.actualStartEstimated = true;
        }
        meeting.completedAt = now; meeting.completedBy = M.user.id; meeting.status = 'past';
      }
      return resolve({ meeting_id: String(meetingId), action: action, actual_started_at: meeting.actualStartedAt || meeting.actual_started_at,
        completed_at: meeting.completedAt || meeting.completed_at || null, actual_start_estimated: meeting.actualStartEstimated === true, changed: true, mock: true });
    },
    deleteMeeting: function (id) {
      var before = M.meetings.length; M.meetings = M.meetings.filter(function (m) { return m.id !== id; });
      return before === M.meetings.length ? Promise.reject(P.auth.coded('NOT_DELETED')) : resolve({ deleted: true, mock: true });
    },
    deleteAnnouncement: function (id) {
      var before = M.announcements.length; M.announcements = M.announcements.filter(function (a) { return a.id !== id; });
      return before === M.announcements.length ? Promise.reject(P.auth.coded('NOT_DELETED')) : resolve({ deleted: true, mock: true });
    },

    /* ===== ICRM IMPACT (MAQUETTE) : calculs identiques à la règle, données fictives, JAMAIS écrites en base ===== */
    getMyProgress: function () {
      var st = progressState();
      var info = P.progression.levelInfo(st.xp), next = P.progression.LEVELS[info.level] || null;
      return resolve({ xp: info.xp, level: info.level, title: info.title, currentMin: info.currentMin, nextMin: info.nextMin,
        remaining: info.remaining, progressPct: info.progressPct, isMax: info.isMax, unseen: st.events.length, mock: true,
        message: P.progression.message(info), badges: st.badges, nextTitle: next ? next.title : null });
    },
    getMyBadges: function () { return resolve({ badges: progressState().badges, mock: true }); },
    getMyXpHistory: function () {
      return resolve({ entries: P.progression.sortHistory(progressState().entries).map(function (e) {
        return { id: e.id, sourceType: e.source_type, ruleCode: e.rule_code, xpDelta: e.xp_delta, reason: e.reason, createdAt: e.created_at };
      }), mock: true });
    },
    getMyProgressNotifications: function () {
      return resolve({ events: progressState().events.map(function (ev) { return { id: ev.id, kind: ev.kind, code: ev.code, createdAt: ev.created_at, label: P.progression.eventLabel(ev) }; }), mock: true });
    },
    markProgressNotificationsSeen: function (ids) {
      (ids || []).forEach(function (id) { M.progressionSeen = (M.progressionSeen || {}); M.progressionSeen[id] = true; });
      return resolve({ saved: true, count: (ids || []).length, mock: true });
    },
    validateTask: function (taskId) {
      M.progressionSession = P.progression.recordOnce(M.progressionSession || [], 'task-' + taskId, {
        id: 'ps-' + taskId, source_type: 'task', rule_code: 'task_validated', xp_delta: 25,
        reason: 'Tâche validée (maquette : non enregistrée)', created_at: new Date().toISOString() });
      return resolve({ validated: true, xp: 25, mock: true });
    },

    /* Maquette locale uniquement : ces opérations ne touchent jamais Supabase. */
    getMeetingRollCall: function (meetingId) {
      var meeting = M.meetings.filter(function (m) { return String(m.id) === String(meetingId); })[0];
      if (!meeting) return Promise.reject(P.auth.coded('NOT_FOUND'));
      M.rollCallSessions = M.rollCallSessions || {}; M.rollCallRecords = M.rollCallRecords || {};
      var session = M.rollCallSessions[meetingId] || { openedAt: null, closedAt: null };
      var rec = M.rollCallRecords[meetingId] || {};
      var participants = meeting.participants || [];
      var people = (M.commissionMembers || []).filter(function (m) { return m.status !== 'inactive'; });
      return resolve({ meetingId: meetingId, title: meeting.title, commissionId: null, openedAt: session.openedAt,
        lateAfterAt: session.openedAt ? new Date(Date.parse(session.openedAt) + 30 * 60000).toISOString() : null, closedAt: session.closedAt,
        members: people.map(function (m, i) {
          var id = 'mock-member-' + i, old = participants.filter(function (p) { return p[0] === m.name; })[0];
          var status = Object.prototype.hasOwnProperty.call(rec, id) ? rec[id] : (old && old[1] !== 'expected' ? old[1] : null);
          return { id: id, fullName: m.name, role: 'member', status: m.status === 'watch' ? 'follow_up' : m.status,
            attendanceStatus: status || null };
        }) });
    },
    setMeetingAttendance: function (meetingId, memberId, requestedStatus) {
      if (['present', 'absent', 'excused'].indexOf(requestedStatus) < 0) return Promise.reject(P.auth.validation({ status: 'Statut invalide.' }));
      M.rollCallSessions = M.rollCallSessions || {}; M.rollCallRecords = M.rollCallRecords || {};
      var session = M.rollCallSessions[meetingId] || { openedAt: null, closedAt: null };
      var status = requestedStatus;
      if (requestedStatus === 'present') {
        if (!session.openedAt) session.openedAt = new Date().toISOString();
        status = Date.now() < Date.parse(session.openedAt) + 30 * 60000 ? 'present' : 'late';
        session.closedAt = null;
      }
      M.rollCallSessions[meetingId] = session;
      M.rollCallRecords[meetingId] = M.rollCallRecords[meetingId] || {};
      M.rollCallRecords[meetingId][memberId] = status;
      return resolve({ saved: true, status: status, xpDue: status === 'present' ? 20 : status === 'late' ? 10 : 0,
        openedAt: session.openedAt, lateAfterAt: session.openedAt ? new Date(Date.parse(session.openedAt) + 30 * 60000).toISOString() : null, mock: true });
    },
    finalizeMeetingRollCall: function (meetingId) {
      var self = this;
      M.rollCallSessions = M.rollCallSessions || {}; M.rollCallRecords = M.rollCallRecords || {};
      var session = M.rollCallSessions[meetingId] || { openedAt: null, closedAt: null };
      var rec = M.rollCallRecords[meetingId] = M.rollCallRecords[meetingId] || {};
      var people = (M.commissionMembers || []).filter(function (m) { return m.status !== 'inactive'; });
      people.forEach(function (_, i) { var id = 'mock-member-' + i; if (!rec[id]) rec[id] = 'absent'; });
      session.closedAt = new Date().toISOString(); M.rollCallSessions[meetingId] = session;
      return self.getMeetingRollCall(meetingId).then(function (d) { d.mock = true; return d; });
    },
    getXpAdjustmentMembers: function () {
      var adj = M.xpAdminAdjustments || [];
      var people = (M.commissionMembers || []).filter(function (m) { return m.status !== 'inactive'; });
      return resolve({ members: people.map(function (m, i) {
        var id = 'mock-member-' + i, base = i === 0 ? progressState().xp : 0;
        return { id: id, fullName: m.name, role: 'member', status: m.status === 'watch' ? 'follow_up' : m.status,
          totalXp: Math.max(0, base + adj.filter(function (a) { return a.memberId === id; }).reduce(function (n, a) { return n + a.delta; }, 0)) };
      }), mock: true });
    },
    recordXpAdjustment: function (memberId, delta, reason) {
      var n = Number(delta), why = String(reason || '').trim();
      if (!memberId || !Number.isInteger(n) || n === 0 || Math.abs(n) > 500 || why.length < 3 || why.length > 300) return Promise.reject(P.auth.validation({ _form: 'Vérifie le membre, le delta et le motif.' }));
      M.xpAdminAdjustments = M.xpAdminAdjustments || [];
      M.xpAdminAdjustments.push({ memberId: memberId, delta: n, reason: why, createdAt: new Date().toISOString() });
      return resolve({ saved: true, delta: n, mock: true });
    },
    getAdminMemberDirectory: function () { return this.getXpAdjustmentMembers(); },
    adminRecordMemberXpAdjustment: function (input) { return this.recordXpAdjustment(input.memberId, input.delta, input.reason); },
    adminSetMemberStatus: function () { return Promise.reject(P.auth.coded('NOT_IMPLEMENTED')); },
    adminMemberDeletePreflight: function () { return Promise.reject(P.auth.coded('NOT_IMPLEMENTED')); },
    adminDeleteMember: function () { return Promise.reject(P.auth.coded('NOT_IMPLEMENTED')); },

    updateMyTaskStatus: function (taskId, status, progressNote) {
      if (['pending', 'in_progress', 'completed'].indexOf(status) < 0 || String(progressNote || '').length > 1000) {
        return Promise.reject(P.auth.coded('VALIDATION'));
      }
      var t = M.tasks.filter(function (x) { return String(x.id) === String(taskId) && (String(x.assigneeId || '') === String(M.user.id) || (!x.assigneeId && x.assignee === fullName())); })[0];
      if (!t) return Promise.reject(P.auth.coded('TASK_STATUS_FORBIDDEN'));
      if (t.status === 'completed' && status !== 'completed') return Promise.reject(P.auth.coded('TASK_STATUS_LOCKED'));
      if (t.status !== 'completed') { t.status = status; t.progressNote = String(progressNote || '').trim(); }
      return resolve({ saved: true, status: t.status, awaitingValidation: t.status === 'completed', mock: true });
    },
    adminDeleteTask: function (taskId) {
      if (M.user.role !== 'super_admin') return Promise.reject(P.auth.coded('NOT_PERMITTED'));
      var before = M.tasks.length;
      M.tasks = M.tasks.filter(function (t) { return String(t.id) !== String(taskId); });
      return before === M.tasks.length ? Promise.reject(P.auth.coded('NOT_DELETED')) : resolve({ deleted: true, mock: true });
    },

    /* Pas d'authentification en mode maquette : aucun événement à écouter. */
    onAuthChange: function () { return function () {}; },

    /* Le fournisseur Supabase implémente la vraie déconnexion. Ici : volontairement non implémenté (pas de fausse session). */
    signOut: function () {
      var e = new Error('Déconnexion : non disponible dans cette phase (aucun backend connecté).'); e.code = 'NOT_IMPLEMENTED';
      return Promise.reject(e);
    }
  };
})();
