/* =========================================================================
   ICRM — ESPACE MEMBRES · CONVERSION BASE DE DONNÉES → INTERFACE
   Fonctions pures (aucun appel réseau) utilisées par providers/supabase.js.
   Le contrat colonne par colonne est documenté dans supabase/docs/db-frontend-contract.md.

   Règles :
   - une valeur de la base n'est jamais « devinée » : une valeur inconnue devient 'unknown' (jamais un
     état favorable comme « accès libre ») ;
   - un libellé affiché n'accorde ni ne retire aucun droit : l'accès réel est décidé par la RLS ;
   - une fonctionnalité dont la colonne n'existe pas (encore) dans la base est signalée comme telle
     (M.has → true / false / null « inconnu, aucune ligne »), jamais présentée comme « vide ».
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  var M = P.mappers = {};

  /* ---------------------------- utilitaires ---------------------------- */
  var pad = function (n) { return ('0' + n).slice(-2); };
  M.iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  M.hhmm = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  /* « Aujourd'hui » et les heures affichées sont celles de TUNIS (voir payloads.js), pas celles du navigateur. */
  M.today = function () {
    /* Dépend de payloads.js (chargé avant ce fichier). Repli sur la date locale seulement si ce module manque. */
    if (P.payloads && P.payloads.tunisParts) return P.payloads.tunisParts(new Date()).date;
    return M.iso(new Date());
  };
  M.pick = function (o, keys) {
    for (var i = 0; i < keys.length; i++) { var v = o[keys[i]]; if (v !== undefined && v !== null && v !== '') return v; }
    return null;
  };
  /* Clé du membre dans commission_members / attendance (nom de colonne toléré : à confirmer sur le schéma). */
  M.memberId = function (r) { return M.pick(r, ['profile_id', 'user_id', 'member_id']); };
  /* La colonne existe-t-elle ? true / false ; null = impossible à savoir (aucune ligne retournée). */
  M.has = function (rows, key) { return rows && rows.length ? Object.prototype.hasOwnProperty.call(rows[0], key) : null; };

  M.dateParts = function (v, timeV) {
    if (!v) return { date: null, time: '' };
    var s = String(v);
    if (s.indexOf('T') > -1) { var d = new Date(s); if (!isNaN(d)) return (P.payloads && P.payloads.tunisParts) ? P.payloads.tunisParts(d) : { date: M.iso(d), time: M.hhmm(d) }; }
    return { date: s.slice(0, 10), time: timeV ? String(timeV).slice(0, 5) : '' };
  };
  M.toList = function (v) {
    if (Array.isArray(v)) return v.map(function (x) { return typeof x === 'string' ? x : (x && (x.title || x.text || x.label)) || ''; }).filter(Boolean);
    if (typeof v === 'string') return v.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  };
  M.relTime = function (v, now) {
    var t = new Date(v); if (isNaN(t)) return '';
    var m = Math.round(((now || Date.now()) - t) / 60000);
    if (m < 2) return 'À l’instant'; if (m < 60) return 'Il y a ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'Il y a ' + h + ' h';
    var d = Math.round(h / 24); return d === 1 ? 'Hier' : 'Il y a ' + d + ' jours';
  };

  /* ---------------------------- présence (enum attendance.status) ---------------------------- */
  var ATT = ['present', 'absent', 'excused', 'late'];
  /* Les 4 états sont conservés tels quels. Vide → « expected » (pas encore de pointage) ; autre → « unknown ». */
  M.attendanceStatus = function (v) {
    var s = String(v == null ? '' : v).toLowerCase().trim();
    return !s ? 'expected' : ATT.indexOf(s) > -1 ? s : 'unknown';
  };
  /* CALCUL DE LA PRÉSENCE (indicateur « Présence » du dashboard et colonne de la page Commission) :
       suivies   = présent + en retard   (le membre était là)
       comptées  = suivies + absent      (les absences NON excusées pèsent dans le taux)
       excusées  = exclues du numérateur ET du dénominateur : une absence excusée n'est pas une présence,
                   et ne pénalise pas non plus le taux. Elle est affichée à part.
       taux      = suivies / comptées (null si aucune réunion comptée). */
  M.attendanceStats = function (rows) {
    var n = { present: 0, late: 0, absent: 0, excused: 0 };
    (rows || []).forEach(function (r) { var s = M.attendanceStatus(r.status); if (n[s] !== undefined) n[s]++; });
    var attended = n.present + n.late, counted = attended + n.absent;
    return { present: n.present, late: n.late, absent: n.absent, excused: n.excused, attended: attended, counted: counted,
             rate: counted ? Math.round(attended / counted * 100) : null };
  };

  /* ---------------------------- tâches (valeurs de statut/priorité non confirmées : tolérant) ---------------------------- */
  M.prio = function (v) { v = String(v || '').toLowerCase(); return /high|urgent|haute|critical/.test(v) ? 'high' : /low|basse|faible/.test(v) ? 'low' : 'medium'; };
  M.taskStatus = function (v) { v = String(v || '').toLowerCase(); return /done|complet|termin|closed/.test(v) ? 'completed' : /progress|doing|ongoing|cours/.test(v) ? 'in_progress' : 'pending'; };

  /* ---------------------------- documents ---------------------------- */
  /* documents.access_type : all_members | commission | bureau. Toute autre valeur → 'unknown' (jamais « libre »). */
  var ACCESS = { all_members: 'all', commission: 'commission', bureau: 'bureau' };
  M.docAccess = function (r) {
    var v = String(r.access_type == null ? '' : r.access_type).toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(ACCESS, v) ? ACCESS[v] : 'unknown';
  };
  /* Type de fichier : extension de documents.name, sinon de documents.storage_path. Aucune URL n'est fabriquée. */
  var EXT = { pdf: 'pdf', doc: 'docx', docx: 'docx', odt: 'docx', rtf: 'docx', xls: 'xlsx', xlsx: 'xlsx', ods: 'xlsx', csv: 'xlsx',
              ppt: 'pptx', pptx: 'pptx', odp: 'pptx', png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img', heic: 'img' };
  var extOf = function (s) { var m = /\.([a-z0-9]{1,5})$/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : ''; };
  M.docType = function (r) { return EXT[extOf(r.name)] || EXT[extOf(r.storage_path)] || 'file'; };
  /* Dossier : la base n'a pas (encore) de colonne dédiée ; lue seulement si elle apparaît. */
  M.docFolder = function (r) {
    var s = String(M.pick(r, ['folder', 'category']) || '').toLowerCase().trim();
    return /even/.test(s) ? 'events' : /form/.test(s) ? 'forms' : /arch/.test(s) ? 'archives' : s;
  };
  M.mapDocument = function (r, x) {
    return { id: String(r.id), name: M.pick(r, ['name', 'title', 'file_name']) || 'Document', type: M.docType(r), folder: M.docFolder(r),
      date: M.dateParts(M.pick(r, ['created_at', 'uploaded_at'])).date || M.today(),
      uploadedBy: x.names[M.pick(r, ['uploaded_by', 'created_by', 'author_id'])] || 'Bureau exécutif', access: M.docAccess(r), storagePath: M.pick(r, ['storage_path']) || null };
  };

  /* ---------------------------- contexte, tâches, réunions, annonces ---------------------------- */
  M.context = function (d) {
    var names = {}, status = {}, comName = {};
    (d.profiles || []).forEach(function (p) { names[p.id] = p.full_name || null; status[p.id] = p.status; });
    (d.commissions || []).forEach(function (c) { comName[c.id] = M.pick(c, ['name', 'title']) || 'Commission'; });
    return { names: names, status: status, comName: comName };
  };
  M.mapTask = function (r, x) {
    var assigneeId = M.pick(r, ['assigned_to', 'assignee_id', 'profile_id', 'user_id']);
    return { id: String(r.id), title: M.pick(r, ['title', 'name']) || 'Tâche', description: M.pick(r, ['description', 'details']) || '',
      assignee: x.names[assigneeId] || 'Membre', assigneeId: assigneeId, commission: x.comName[r.commission_id] || '',
      priority: M.prio(r.priority), deadline: M.dateParts(M.pick(r, ['due_date', 'deadline', 'due_at'])).date || '', status: M.taskStatus(r.status),
      progressNote: M.pick(r, ['progress_note']) || '', meetingId: r.meeting_id || null };
  };
  M.mapMeeting = function (r, x, d, tasks) {
    var st = M.dateParts(M.pick(r, ['starts_at', 'start_at', 'scheduled_at', 'meeting_at', 'date', 'meeting_date']), M.pick(r, ['start_time', 'time']));
    var en = M.dateParts(M.pick(r, ['ends_at', 'end_at']), M.pick(r, ['end_time']));
    var date = st.date || M.today();
    return { id: String(r.id), title: M.pick(r, ['title', 'name']) || 'Réunion', date: date, start: st.time, end: en.time,
      location: M.pick(r, ['location', 'place']) || 'À préciser',
      /* scope (club | commission), kind (meeting | event | training | other) et description : colonnes confirmées. */
      scope: r.scope || (r.commission_id ? 'commission' : 'club'), commissionId: r.commission_id || null, kind: r.kind || 'meeting', description: r.description || '',
      commission: (r.scope === 'commission' || (r.scope == null && r.commission_id)) ? (x.comName[r.commission_id] || 'Commission') : 'Toutes les commissions',
      status: date < M.today() ? 'past' : 'upcoming',
      /* Les 4 statuts de présence sont conservés ; un pointage sans statut = « attendu ». */
      participants: (d.attendance || []).filter(function (a) { return a.meeting_id === r.id; }).map(function (a) { return [x.names[M.memberId(a)] || 'Membre', M.attendanceStatus(a.status)]; }),
      /* agenda / notes / decisions : colonnes absentes du schéma initial. Lues seulement si elles existent. */
      agenda: M.toList(r.agenda), notes: M.pick(r, ['notes', 'minutes']) || '', decisions: M.toList(r.decisions),
      tasks: tasks.filter(function (t) { return t.meetingId === r.id; }).map(function (t) { return t.title; }) };
  };
  /* Fonctionnalités de réunion non supportées par le schéma (true = colonne absente, certainement). */
  M.meetingUnsupported = function (d) {
    return { agenda: M.has(d.meetings, 'agenda') === false, notes: M.has(d.meetings, 'notes') === false && M.has(d.meetings, 'minutes') === false,
             decisions: M.has(d.meetings, 'decisions') === false, tasks: M.has(d.tasks, 'meeting_id') === false };
  };
  M.mapAnnouncement = function (r, x) {
    var p = String(r.priority || '').toLowerCase(), aud = String(M.pick(r, ['audience', 'target']) || '').toLowerCase();
    return { id: String(r.id), title: M.pick(r, ['title', 'subject']) || 'Annonce',
      priority: /important|high|urgent/.test(p) ? 'important' : /info|low/.test(p) ? 'info' : 'normal',   // pas de colonne priority dans le schéma initial → « normal »
      date: M.dateParts(M.pick(r, ['published_at', 'created_at'])).date || M.today(),
      author: x.names[M.pick(r, ['author_id', 'created_by'])] || M.pick(r, ['author']) || 'Bureau exécutif',
      audience: !aud || /^(all|tous)/.test(aud) ? 'Tous les membres' : aud === 'bureau_elargi' ? 'Bureau élargi' : aud === 'bureau' ? 'Bureau exécutif' : /commission/.test(aud) ? (x.comName[r.commission_id] ? 'Commission ' + x.comName[r.commission_id] : 'Ma commission') : String(M.pick(r, ['audience', 'target'])),
      body: String(M.pick(r, ['content', 'body', 'message']) || '').split(/\n{2,}/).map(function (s) { return s.trim(); }).filter(Boolean),
      attachments: M.toList(r.attachments) };                                                              // pas de pièces jointes dans le schéma initial → []
  };

  /* ---------------------------- journal d'activité (action, entity_type, entity_id, metadata jsonb, created_at) ---------------------------- */
  var ENTITY = [[/attendance|pr[ée]sence/, 'meeting', 'Présence', 'f'], [/meeting|r[ée]union/, 'meeting', 'Réunion', 'f'], [/task|t[âa]che/, 'task', 'Tâche', 'f'],
                [/document/, 'document', 'Document', 'm'], [/announce|annonce/, 'announcement', 'Annonce', 'f'],
                [/commission/, 'other', 'Commission', 'f'], [/profile|member|membre/, 'other', 'Profil', 'm']];
  var VERB = [[/complet|done|finish|termin/, 'terminé'], [/creat|insert|add|ajout/, 'ajouté'], [/updat|edit|chang|modif/, 'modifié'], [/delet|remov|archiv|suppr/, 'supprimé'], [/assign/, 'assigné']];
  var metaOf = function (v) { if (v && typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return {}; } } return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  /* Lit `metadata` (jsonb) — il n'existe pas de colonnes description / details / message. */
  M.mapActivity = function (r, i, now) {
    var ent = String(r.entity_type || '').toLowerCase(), act = String(r.action || '').toLowerCase().replace(/[._:-]+/g, ' ');
    var e = ENTITY.filter(function (x) { return x[0].test(ent); })[0] || [null, 'other', 'Activité', 'f'];
    var v = VERB.filter(function (x) { return x[0].test(act); })[0];
    var text = v ? e[2] + ' ' + v[1] + (e[3] === 'f' ? 'e' : '') : (e[2] + (act ? ' — ' + act : ''));
    var md = metaOf(r.metadata), detail = M.pick(md, ['title', 'name', 'label', 'summary', 'description']);
    return { id: String(r.id || i), kind: e[1], text: text, detail: typeof detail === 'string' ? detail : '', when: M.relTime(r.created_at, now) };
  };

  /* ---------------------------- commission ---------------------------- */
  /* Ligne commission_members de l'utilisateur (la RLS ne renvoie que ce qu'il a le droit de voir). */
  M.myMembership = function (uid, d) { return (d.commission_members || []).filter(function (r) { return M.memberId(r) === uid; })[0] || null; };
  /* dir = annuaire renvoyé par la fonction SQL commission_directory (facultatif ; sinon repli sur profiles, soumis à la RLS). */
  M.myCommission = function (uid, d, x, dir) {
    var mine = M.myMembership(uid, d); if (!mine) return null;
    var com = (d.commissions || []).filter(function (c) { return c.id === mine.commission_id; })[0]; if (!com) return null;
    var members = dir
      ? dir.map(function (m) { return { id: m.profile_id, name: m.full_name || null, position: m.member_position || 'member', status: m.status == null ? null : m.status }; })
      : (d.commission_members || []).filter(function (r) { return r.commission_id === com.id; }).map(function (r) {
          var id = M.memberId(r); return { id: id, name: x.names[id] || null, position: r.position || 'member', status: x.status[id] == null ? null : x.status[id] };
        });
    /* RESPONSABLE : commission_members.position = 'responsable' (et non « role »). Plusieurs possibles. */
    var heads = members.filter(function (m) { return m.position === 'responsable'; }).map(function (m) { return m.name; }).filter(Boolean);
    var name = x.comName[com.id], tasks = (d.tasks || []).map(function (t) { return M.mapTask(t, x); });
    members.sort(function (a, b) { return (b.position === 'responsable') - (a.position === 'responsable') || String(a.name || '').localeCompare(String(b.name || ''), 'fr'); });
    return { id: com.id, name: name, headName: heads.length ? heads.join(', ') : null, status: 'active', memberCount: members.length,
      upcomingProjects: null,                                    // pas de table « projets » : affiché « — »
      openTasks: tasks.filter(function (t) { return t.commission === name && t.status !== 'completed'; }).length,
      meetings: (d.meetings || []).filter(function (m) { return m.commission_id === com.id; }).length, _members: members };
  };
  M.strip = function (c) { if (!c) return null; var o = {}; Object.keys(c).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = c[k]; }); return o; };
})();
