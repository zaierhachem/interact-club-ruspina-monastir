/* ICRM — ESPACE MEMBRES · VUES : Commission, Documents, Annonces */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views, T = U.META;

  /* ============================ DOCUMENTS ============================ */
  V.documents = {
    title: 'Documents',
    load: function (api) { return api.getDocuments(); },
    render: function (d) {
      var byFolder = d.foldersSupported !== false;               // false : la base n'a pas de colonne dossier → filtres par niveau d'accès
      var filters = byFolder ? T.folders : [['all', 'Tous'], ['access:all', T.access.all[0]], ['access:commission', T.access.commission[0]], ['access:bureau', T.access.bureau[0]]];
      var match = function (x, k) { return k === 'all' || (k.indexOf('access:') === 0 ? x.access === k.slice(7) : x.folder === k); };
      var count = function (k) { return d.documents.filter(function (x) { return match(x, k); }).length; };
      var uploadAction = P.can('documents:upload') ? '<button type="button" class="pt-btn pt-btn--primary" data-upload-document>' + U.icon('upload') + 'Déposer un document</button>' : '';
      return U.pageHead('Ressources du club', 'Documents', byFolder ? 'Les documents partagés, classés par dossier et par niveau d’accès.' : 'Les documents partagés, selon leur niveau d’accès.', uploadAction) +
        '<div class="pt-toolbar pt-toolbar--docs">' +
          '<div class="pt-field pt-field--search"><label for="docSearch" class="pt-sr">Rechercher un document</label>' + U.icon('search') + '<input id="docSearch" type="search" placeholder="Rechercher un document" autocomplete="off"></div>' +
          '<div class="pt-folders" role="group" aria-label="' + (byFolder ? 'Dossiers' : 'Niveau d’accès') + '">' + filters.map(function (f, i) {
            return '<button type="button" class="pt-folder" data-folder="' + f[0] + '" aria-pressed="' + (i === 0) + '">' + (i && byFolder ? U.icon('folder') : '') + e(f[1]) + ' <span>' + count(f[0]) + '</span></button>';
          }).join('') + '</div></div>' +
        '<section class="pt-card pt-tablecard" aria-label="Liste des documents" id="docCard"></section>';
    },
    mount: function (root, d) {
      var folder = 'all', q = '', card = root.querySelector('#docCard');
      var match = function (x, k) { return k === 'all' || (k.indexOf('access:') === 0 ? x.access === k.slice(7) : x.folder === k); };
      var folderName = function (k) { return (T.folders.filter(function (f) { return f[0] === k; })[0] || [0, k])[1]; };
      function draw() {
        var rows = d.documents.filter(function (x) { return match(x, folder) && x.name.toLowerCase().indexOf(q) > -1; })
          .sort(function (a, b) { return b.date.localeCompare(a.date); });
        card.innerHTML = rows.length
          ? '<table class="pt-table pt-table--docs"><thead><tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">Date</th><th scope="col">Ajouté par</th><th scope="col">Accès</th><th scope="col">Fichier</th></tr></thead><tbody>' +
            rows.map(function (x) {
              var fileAction = x.storagePath
                ? '<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-download-document="' + e(x.storagePath) + '" data-download-name="' + e(x.name) + '">' + U.icon('download') + 'Télécharger</button>'
                : '<span class="pt-hint">' + (P.api.isMock() ? 'Démonstration' : 'Fichier indisponible') + '</span>';
              var deleteAction = P.can('documents:delete') ? '<button type="button" class="pt-btn pt-btn--danger pt-btn--sm" data-delete-document="' + e(x.id) + '" data-document-title="' + e(x.name) + '">' + U.icon('close') + 'Supprimer</button>' : '';
              return '<tr><th scope="row" data-label="Nom"><span class="pt-file"><span class="pt-file__ico pt-file__ico--' + e(x.type) + '">' + U.icon('file') + '</span><span><b>' + e(x.name) + '</b>' + (x.folder ? '<small>' + e(folderName(x.folder)) + '</small>' : '') + '</span></span></th>' +
                '<td data-label="Type">' + e(U.fileTypeLabel[x.type] || x.type) + '</td><td data-label="Date">' + e(U.date.short(x.date)) + ' ' + e(U.date.parse(x.date).getFullYear()) + '</td>' +
                '<td data-label="Ajouté par">' + e(x.uploadedBy) + '</td><td data-label="Accès">' + U.statusChip('access', x.access) + '</td><td data-label="Action"><div class="pt-doc-actions">' + fileAction + deleteAction + '</div></td></tr>';
            }).join('') + '</tbody></table>'
          : U.empty('Aucun document ne correspond à ta recherche.');
      }
      root.querySelector('#docSearch').addEventListener('input', function (ev) { q = ev.target.value.trim().toLowerCase(); draw(); });
      var uploadButton = root.querySelector('[data-upload-document]');
      if (uploadButton) uploadButton.addEventListener('click', function () { P.forms.openDocumentUpload(uploadButton); });
      card.addEventListener('click', function (ev) {
        var deleteBtn = ev.target.closest('[data-delete-document]');
        if (deleteBtn && !deleteBtn.disabled) {
          P.forms.openDeleteConfirm(deleteBtn, { eyebrow: 'Ressources du club', heading: 'Supprimer ce document ?', name: deleteBtn.dataset.documentTitle,
            note: 'Le fichier privé et sa fiche Documents seront supprimés. Cette action est définitive.',
            run: function () { return P.api.deleteDocument(deleteBtn.dataset.deleteDocument); },
            doneText: 'Document et fichier supprimés.', onDone: function () { if (P.app) P.app.refresh(); } });
          return;
        }
        var btn = ev.target.closest('[data-download-document]'); if (!btn || btn.disabled) return;
        var path = btn.getAttribute('data-download-document'), name = btn.getAttribute('data-download-name') || 'document';
        btn.disabled = true; btn.setAttribute('aria-busy', 'true');
        var original = btn.innerHTML; btn.textContent = 'Préparation…';
        P.api.getDocumentDownloadUrl(path, name).then(function (result) {
          if (!result || !result.url) throw new Error('URL de téléchargement indisponible.');
          window.location.assign(result.url);
        }).catch(function (err) {
          btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = original;
          U.toast(err && err.coded ? err.message : P.auth.messageFor('QUERY_FAILED').text);
        });
      });
      root.querySelectorAll('[data-folder]').forEach(function (b) {
        b.addEventListener('click', function () { folder = b.dataset.folder; root.querySelectorAll('[data-folder]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(); });
      });
      draw();
    }
  };

  /* ============================ ANNONCES ============================ */
  V.annonces = {
    title: 'Annonces',
    load: function (api) { return api.getAnnouncements(); },
    render: function (d, ctx) {
      var sel = ctx.params[0] ? d.announcements.filter(function (a) { return a.id === ctx.params[0]; })[0] : null;
      if (sel) {
        var del = P.can('announcements:delete') ? '<p class="pt-article__danger"><button type="button" class="pt-btn pt-btn--danger pt-btn--sm" data-delete-announcement="' + e(sel.id) + '" data-title="' + e(sel.title) + '">' + U.icon('close') + 'Supprimer</button></p>' : '';
        return '<article class="pt-article" aria-labelledby="pt-h1"><a class="pt-back" href="#/annonces">' + U.icon('back') + 'Toutes les annonces</a>' + del +
          '<div class="pt-article__meta">' + U.statusChip('announce', sel.priority) + '<span>' + e(U.date.full(sel.date)) + '</span></div>' +
          '<h1 class="pt-h1 pt-h1--article" id="pt-h1" tabindex="-1">' + e(sel.title) + '</h1>' +
          '<p class="pt-article__by">Par <b>' + e(sel.author) + '</b> · Destinataires : ' + e(sel.audience) + '</p>' +
          '<div class="pt-article__body">' + sel.body.map(function (p) { return '<p>' + e(p) + '</p>'; }).join('') + '</div>' +
          (sel.attachments.length ? '<section class="pt-attach" aria-label="Pièces jointes"><h2 class="pt-h4">Pièces jointes</h2><ul>' + sel.attachments.map(function (a) { return '<li>' + U.icon('clip') + '<span>' + e(a) + '</span></li>'; }).join('') + '</ul></section>' : '') +
          '</article>';
      }
      var action = P.can('announcements:create') ? '<button type="button" class="pt-btn pt-btn--primary" data-new-announcement>' + U.icon('plus') + 'Nouvelle annonce</button>' : '';
      return U.pageHead('Communication officielle', 'Annonces', 'Les informations officielles du club, de la plus récente à la plus ancienne.', action) +
        '<ul class="pt-annlist">' + d.announcements.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (a) {
          return '<li><a class="pt-ann pt-ann--' + e(a.priority) + '" href="#/annonces/' + e(a.id) + '"><span class="pt-ann__meta">' + U.statusChip('announce', a.priority) + '<time>' + e(U.date.short(a.date)) + '</time></span>' +
            '<b class="pt-ann__title">' + e(a.title) + '</b><span class="pt-ann__excerpt">' + e(a.body[0]) + '</span>' +
            '<span class="pt-ann__foot">' + e(a.author) + ' · ' + e(a.audience) + (a.attachments.length ? ' · ' + U.icon('clip') + a.attachments.length : '') + '</span></a></li>';
        }).join('') + '</ul>';
    },
    mount: function (root) {
      var del = root.querySelector('[data-delete-announcement]');
      if (del) del.addEventListener('click', function () {
        P.forms.openDeleteConfirm(del, { eyebrow: 'Communication officielle', heading: 'Supprimer cette annonce ?', name: del.dataset.title,
          note: 'La suppression est tracée dans le journal du club.',
          run: function () { return P.api.deleteAnnouncement(del.dataset.deleteAnnouncement); },
          doneText: 'Annonce supprimée.', onDone: function () { P.app ? (location.hash === '#/annonces' ? P.app.refresh() : location.hash = '#/annonces') : null; } });
      });
      var b = root.querySelector('[data-new-announcement]');
      if (b) b.addEventListener('click', function () { P.forms.openAnnouncementForm(b); });
    }
  };
})();
