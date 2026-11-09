/* ICRM — Gestion du site public (Super Admin only at route + database RPC). */
(function () {
  'use strict';
  var P = window.ICRMPortal, U = P.ui, e = U.esc, V = P.views;
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  var getDefaults = function () { return clone((window.SITE && window.SITE.PUBLIC_CONTENT) || {}); };

  function input(label, key, value, opts) {
    opts = opts || {};
    var id = 'cms-' + String(key).replace(/[^a-z0-9_-]/gi, '-') + (opts.scope ? '-' + String(opts.scope).replace(/[^a-z0-9_-]/gi, '-') : '');
    return '<div class="pt-field"><label for="' + e(id) + '">' + e(label) + '</label><input id="' + e(id) + '" data-cms-field="' + e(key) + '" type="' + e(opts.type || 'text') + '" maxlength="' + (opts.max || 500) + '" value="' + e(value || '') + '" placeholder="' + e(opts.placeholder || '') + '"' + (opts.required ? ' required' : '') + '></div>';
  }
  function area(label, key, value, opts) {
    opts = opts || {};
    var id = 'cms-' + String(key).replace(/[^a-z0-9_-]/gi, '-') + (opts.scope ? '-' + String(opts.scope).replace(/[^a-z0-9_-]/gi, '-') : '');
    return '<div class="pt-field pt-sitecms__field--wide"><label for="' + e(id) + '">' + e(label) + '</label><textarea id="' + e(id) + '" data-cms-field="' + e(key) + '" rows="' + (opts.rows || 3) + '" maxlength="' + (opts.max || 2000) + '" placeholder="' + e(opts.placeholder || '') + '"' + (opts.required ? ' required' : '') + '>' + e(value || '') + '</textarea>' + (opts.hint ? '<small class="pt-hint">' + e(opts.hint) + '</small>' : '') + '</div>';
  }
  function select(label, key, value, options, opts) {
    opts = opts || {};
    var id = 'cms-' + String(key).replace(/[^a-z0-9_-]/gi, '-') + (opts.scope ? '-' + String(opts.scope).replace(/[^a-z0-9_-]/gi, '-') : '');
    return '<div class="pt-field"><label for="' + e(id) + '">' + e(label) + '</label><select id="' + e(id) + '" data-cms-field="' + e(key) + '">' + options.map(function (x) { return '<option value="' + e(x[0]) + '"' + (x[0] === value ? ' selected' : '') + '>' + e(x[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function details(title, summary, body, open) {
    return '<details class="pt-card pt-sitecms__section"' + (open ? ' open' : '') + '><summary><span><b>' + e(title) + '</b><small>' + e(summary) + '</small></span><span class="pt-sitecms__chevron" aria-hidden="true">⌄</span></summary><div class="pt-sitecms__section-body">' + body + '</div></details>';
  }
  function impactEditor(im, index) {
    var scope = 'impact-' + index + '-' + Date.now().toString(36);
    var fi = function (l,k,v,o) { o = Object.assign({}, o || {}, { scope: scope }); return input(l,k,v,o); };
    var kind = Array.isArray(im) ? 'multi' : (im && im.text ? 'text' : 'metric');
    var multi = Array.isArray(im) ? im.map(function (x) { return (x.display || '') + ' | ' + (x.label || ''); }).join('\n') : '';
    return '<article class="pt-sitecms__repeat" data-cms-impact data-index="' + index + '">' +
      '<div class="pt-sitecms__repeat-head"><b>Indicateur ' + (index + 1) + '</b><div class="pt-sitecms__repeat-actions"><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-impact="-1" aria-label="Monter">↑</button><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-impact="1" aria-label="Descendre">↓</button><button class="pt-btn pt-btn--danger pt-btn--sm" type="button" data-remove-impact>Supprimer</button></div></div>' +
      '<div class="pt-sitecms__fields">' + fi('Valeur numérique', 'value', im.value, {max: 12}) + fi('Préfixe (ex. +)', 'prefix', im.prefix, {max: 8}) + fi('Suffixe (ex. %)', 'suffix', im.suffix, {max: 12}) + fi('Libellé', 'label', im.label, {max: 100, required: true}) + fi('Source', 'source', im.source, {max: 120, required: true}) +
      '<label class="pt-sitecms__toggle"><input type="checkbox" data-impact-accent' + (im.accent ? ' checked' : '') + '> Mettre cet indicateur en accent</label></div></article>';
  }
  function actionEditor(a, index) {
    a = a || {};
    var scope = 'action-' + String(a.id || index).replace(/[^a-z0-9_-]/gi, '-') + '-' + Date.now().toString(36);
    var fi = function (l,k,v,o) { o = Object.assign({}, o || {}, { scope: scope }); return input(l,k,v,o); };
    var fa = function (l,k,v,o) { o = Object.assign({}, o || {}, { scope: scope }); return area(l,k,v,o); };
    var fs = function (l,k,v,options) { return select(l,k,v,options,{ scope: scope }); };
    var impact = a.impact, kind = Array.isArray(impact) ? 'multi' : (impact && impact.text ? 'text' : 'metric');
    var multi = Array.isArray(impact) ? impact.map(function (x) { return (x.display || '') + ' | ' + (x.label || ''); }).join('\n') : '';
    var media = a.media || {};
    return '<article class="pt-sitecms__repeat pt-sitecms__action" data-cms-action data-index="' + index + '" data-action-id="' + e(a.id || ('action-' + (index + 1))) + '">' +
      '<div class="pt-sitecms__repeat-head"><b>Action ' + (index + 1) + '</b><div class="pt-sitecms__repeat-actions"><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-action="-1" aria-label="Monter">↑</button><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-action="1" aria-label="Descendre">↓</button><button class="pt-btn pt-btn--danger pt-btn--sm" type="button" data-remove-action>Supprimer</button></div></div>' +
      '<div class="pt-sitecms__fields">' +
      fi('Titre de l’action', 'title', a.title, {max: 100, required: true}) + fi('Sous-titre', 'subtitle', a.subtitle, {max: 160}) +
      fs('Catégorie', 'category', a.category || 'financiere', [['financiere','Action financière'],['humanitaire','Action humanitaire']]) +
      fs('Disposition du visuel', 'layout', a.layout || 'a', [['a','Visuel à gauche'],['b','Visuel à droite'],['c','Pleine largeur']]) +
      fa('Axes / mots-clés (une ligne par élément)', 'axis', (a.axis || []).join('\n'), {rows: 2, max: 500}) +
      fa('Description (sépare les paragraphes par une ligne vide)', 'description', (a.description || []).join('\n\n'), {rows: 5, max: 5000, required: true}) +
      fs('Type d’impact', 'impactType', kind, [['metric','Chiffre'],['text','Texte descriptif'],['multi','Plusieurs chiffres']]) +
      '<div data-impact-panel="metric"' + (kind !== 'metric' ? ' hidden' : '') + ' class="pt-sitecms__fields pt-sitecms__subfields">' + fi('Valeur', 'impactValue', impact && impact.value, {max: 12}) + fi('Préfixe', 'impactPrefix', impact && impact.prefix, {max: 8}) + fi('Suffixe', 'impactSuffix', impact && impact.suffix, {max: 12}) + fi('Libellé', 'impactLabel', impact && impact.label, {max: 100}) + '</div>' +
      '<div data-impact-panel="text"' + (kind !== 'text' ? ' hidden' : '') + '>' + fa('Description d’impact', 'impactText', impact && impact.text, {rows: 2, max: 500}) + '</div>' +
      '<div data-impact-panel="multi"' + (kind !== 'multi' ? ' hidden' : '') + '>' + fa('Chiffres (une ligne : valeur | libellé)', 'impactMulti', multi, {rows: 3, max: 500, hint: 'Exemple : +1 000 | CARTABLES'}) + '</div>' +
      fs('Type de média', 'mediaType', media.type || 'image', [['image','Image'],['video','Vidéo']]) +
      fa('Chemin du média', 'mediaSrc', media.src, {rows: 1, max: 2048, hint: 'Chemin assets/... ou URL HTTPS. Ajoute le fichier dans assets/ avant de publier si tu utilises un chemin local.'}) +
      fa('Affiche vidéo (poster, facultatif)', 'mediaPoster', media.poster, {rows: 1, max: 2048}) +
      fi('Texte alternatif (accessibilité)', 'mediaAlt', media.alt, {max: 240}) + fi('Position du média', 'mediaPosition', media.position || '50% 50%', {max: 30, placeholder: '50% 50%'}) +
      '</div></article>';
  }

  function sponsorEditor(item, index) {
    item = item || {};
    var scope = 'sponsor-' + index + '-' + Date.now().toString(36);
    var fi = function (l,k,v,o) { o = Object.assign({}, o || {}, { scope: scope }); return input(l,k,v,o); };
    var fa = function (l,k,v,o) { o = Object.assign({}, o || {}, { scope: scope }); return area(l,k,v,o); };
    var fs = function (l,k,v,options) { return select(l,k,v,options,{ scope: scope }); };
    return '<article class="pt-sitecms__repeat" data-cms-sponsor data-index="' + index + '">' +
      '<div class="pt-sitecms__repeat-head"><b>Partenaire ' + (index + 1) + '</b><div class="pt-sitecms__repeat-actions"><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-sponsor="-1" aria-label="Monter">↑</button><button class="pt-btn pt-btn--ghost pt-btn--sm" type="button" data-move-sponsor="1" aria-label="Descendre">↓</button><button class="pt-btn pt-btn--danger pt-btn--sm" type="button" data-remove-sponsor>Supprimer</button></div></div>' +
      '<div class="pt-sitecms__fields">' + fi('Nom du sponsor / partenaire', 'name', item.name, {max: 100, required: true}) +
      fa('Logo (chemin assets/... ou URL HTTPS)', 'logo', item.logo, {rows: 1, max: 2048, hint: 'Laisse vide pour afficher le placeholder du club.'}) +
      fa('Lien du partenaire (facultatif)', 'url', item.url, {rows: 1, max: 2048, hint: 'URL HTTPS uniquement.'}) +
      fs('Ajustement du logo', 'fit', item.fit || 'contain', [['contain','Afficher le logo en entier'],['cover','Remplir le cadre']]) + '</div></article>';
  }
  function defaultSponsor() { return { name: '', logo: '', url: '', fit: 'contain' }; }
  function defaultAction() {
    return { id: 'action-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), category: 'humanitaire', layout: 'a', title: '', subtitle: '', axis: [], description: [''], impact: { text: '' }, media: { type: 'image', src: '', poster: '', alt: '', position: '50% 50%' } };
  }
  function defaultImpact() { return { value: 0, prefix: '', suffix: '', label: '', source: '', accent: false }; }
  function collectLines(v) { return String(v || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function paragraphs(v) { return String(v || '').split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function safeAssetOrHttps(value) {
    var v = String(value || '').trim();
    return !v || /^https:\/\//i.test(v) || (/^assets\/[a-z0-9_./-]+$/i.test(v) && v.indexOf('..') < 0 && v.indexOf('//') < 0);
  }

  V['site-public'] = {
    title: 'Gestion du site public',
    load: function (api) { return api.getPublicSiteContent(); },
    render: function (d) {
      var c = d.content || getDefaults();
      var status = d.configurationReady === false
        ? '<p class="pt-sitecms__notice is-warn">La configuration CMS n’est pas encore initialisée. Applique la migration avant de pouvoir publier.</p>'
        : '<p class="pt-sitecms__notice is-ok">Les modifications enregistrées sont publiées directement sur le site public.</p>';
      var hero = c.hero || {}, intro = c.intro || {}, club = c.club || {}, contact = c.contact || {};
      var body = '<div class="pt-sitecms__intro"><p>Cette page pilote le contenu éditorial du site public. La mise en page et les animations restent inchangées ; les compositions des bureaux restent gérées dans Mon équipe.</p><a class="pt-btn pt-btn--ghost" href="../index.html" target="_blank" rel="noopener">' + U.icon('globe') + 'Voir le site public</a></div>' + status +
        details('01 · Hero', 'Titre, accroche, vidéo de couverture et appels à l’action.',
          '<div class="pt-sitecms__fields">' + input('Titre — ligne 1', 'hero.titleLines.0', hero.titleLines && hero.titleLines[0], {max: 40, required: true}) + input('Titre — ligne 2', 'hero.titleLines.1', hero.titleLines && hero.titleLines[1], {max: 40, required: true}) + input('Titre — ligne 3', 'hero.titleLines.2', hero.titleLines && hero.titleLines[2], {max: 40, required: true}) +
          area('Accroche (4 lignes, une par ligne)', 'hero.tagline', (hero.tagline || []).join('\n'), {rows: 3, max: 240}) + area('Description courte', 'hero.lead', hero.lead, {rows: 2, max: 500, required: true}) +
          area('Vidéo Hero (chemin assets/ ou URL HTTPS)', 'hero.video', hero.video, {rows: 1, max: 2048}) + area('Image poster / couverture', 'hero.poster', hero.poster, {rows: 1, max: 2048}) +
          input('Bouton principal', 'hero.primaryLabel', hero.primaryLabel, {max: 60}) + input('Bouton secondaire', 'hero.secondaryLabel', hero.secondaryLabel, {max: 60}) + '</div>', true) +
        details('02 · Présentation', 'La chaîne Rotary → Interact → Ruspina.',
          '<div class="pt-sitecms__fields">' + input('Titre Rotary', 'intro.rotaryTitle', intro.rotaryTitle, {max: 80}) + area('Texte Rotary', 'intro.rotaryText', intro.rotaryText, {rows: 3, max: 1200}) + input('Titre Interact', 'intro.interactTitle', intro.interactTitle, {max: 80}) + area('Texte Interact', 'intro.interactText', intro.interactText, {rows: 3, max: 1200}) + input('Titre ICRM', 'intro.clubTitle', intro.clubTitle, {max: 100}) + area('Texte ICRM', 'intro.clubText', intro.clubText, {rows: 3, max: 1400}) + input('Lien vers « Qui sommes-nous »', 'intro.linkLabel', intro.linkLabel, {max: 60}) + '</div>', false) +
        details('03 · Qui sommes-nous', 'Photo collective, informations et présentation du club.',
          '<div class="pt-sitecms__fields">' + input('Titre — ligne 1', 'club.titleLines.0', club.titleLines && club.titleLines[0], {max: 40}) + input('Titre — ligne 2', 'club.titleLines.1', club.titleLines && club.titleLines[1], {max: 40}) + input('Sous-titre', 'club.subtitle', club.subtitle, {max: 120}) +
          area('Photo collective (assets/... ou URL HTTPS)', 'club.photo', club.photo, {rows: 1, max: 2048, hint: 'Pour un fichier local, copie-le dans assets/ du projet puis indique son chemin.'}) + input('Texte alternatif de la photo', 'club.photoAlt', club.photoAlt, {max: 240}) +
          input('Fait 1 — intitulé', 'club.factLabel.0', club.facts && club.facts[0] && club.facts[0].label, {max: 60}) + input('Fait 1 — valeur', 'club.factValue.0', club.facts && club.facts[0] && club.facts[0].value, {max: 120}) +
          input('Fait 2 — intitulé', 'club.factLabel.1', club.facts && club.facts[1] && club.facts[1].label, {max: 60}) + input('Fait 2 — valeur', 'club.factValue.1', club.facts && club.facts[1] && club.facts[1].value, {max: 120}) +
          input('Fait 3 — intitulé', 'club.factLabel.2', club.facts && club.facts[2] && club.facts[2].label, {max: 60}) + input('Fait 3 — valeur', 'club.factValue.2', club.facts && club.facts[2] && club.facts[2].value, {max: 120}) +
          input('Fait 4 — intitulé', 'club.factLabel.3', club.facts && club.facts[3] && club.facts[3].label, {max: 60}) + input('Fait 4 — valeur', 'club.factValue.3', club.facts && club.facts[3] && club.facts[3].value, {max: 120}) +
          area('Présentation — paragraphe principal', 'club.lead', club.lead, {rows: 2, max: 800}) + area('Autres paragraphes (séparés par une ligne vide)', 'club.paragraphs', (club.paragraphs || []).join('\n\n'), {rows: 4, max: 3000}) + '</div>', false) +
        details('04 · Nos actions', 'Créer, modifier, réordonner ou retirer une action financière / humanitaire.',
          '<div class="pt-sitecms__fields">' + input('Titre de section', 'actionsSection.title', c.actionsSection && c.actionsSection.title, {max: 80}) + area('Description de section', 'actionsSection.subtitle', c.actionsSection && c.actionsSection.subtitle, {rows: 2, max: 240}) + input('Filtre — actions financières', 'actionsSection.financialLabel', c.actionsSection && c.actionsSection.financialLabel, {max: 40}) + input('Filtre — actions humanitaires', 'actionsSection.humanitarianLabel', c.actionsSection && c.actionsSection.humanitarianLabel, {max: 40}) + '</div>' +
          '<div class="pt-sitecms__repeat-list" id="cmsActions">' + (c.actions || []).map(actionEditor).join('') + '</div><button type="button" class="pt-btn pt-btn--ghost" data-add-action>' + U.icon('plus') + 'Ajouter une action</button>', false) +
        details('05 · Bureau exécutif & Bureau élargi', 'Modifier les titres et les textes introductifs ; les membres et leurs postes restent gérés dans Mon équipe.',
          '<div class="pt-sitecms__fields">' + input('Bureau exécutif — titre, ligne 1', 'teamSection.titleLines.0', c.teamSection && c.teamSection.titleLines && c.teamSection.titleLines[0], {max: 40}) + input('Bureau exécutif — titre, ligne 2', 'teamSection.titleLines.1', c.teamSection && c.teamSection.titleLines && c.teamSection.titleLines[1], {max: 40}) + input('Bureau élargi — titre, ligne 1', 'bureauElargiSection.titleLines.0', c.bureauElargiSection && c.bureauElargiSection.titleLines && c.bureauElargiSection.titleLines[0], {max: 40}) + input('Bureau élargi — titre, ligne 2', 'bureauElargiSection.titleLines.1', c.bureauElargiSection && c.bureauElargiSection.titleLines && c.bureauElargiSection.titleLines[1], {max: 40}) + area('Présentation du Bureau élargi', 'bureauElargiSection.intro', c.bureauElargiSection && c.bureauElargiSection.intro, {rows: 2, max: 240}) + '</div>', false) +
        details('06 · Sponsors & partenaires', 'Ajouter, modifier, retirer et réordonner les logos affichés sur le site.',
          '<div class="pt-sitecms__fields">' + input('Titre de section', 'partnersSection.title', c.partnersSection && c.partnersSection.title, {max: 80}) + area('Description de section', 'partnersSection.subtitle', c.partnersSection && c.partnersSection.subtitle, {rows: 2, max: 240}) + '</div>' +
          '<div class="pt-sitecms__repeat-list" id="cmsSponsors">' + (c.sponsors || []).map(sponsorEditor).join('') + '</div><button type="button" class="pt-btn pt-btn--ghost" data-add-sponsor>' + U.icon('plus') + 'Ajouter un partenaire</button>', false) +
        details('07 · Impact', 'Ajouter, modifier, supprimer et réordonner les indicateurs chiffrés.',
          '<div class="pt-sitecms__fields">' + input('Titre — ligne 1', 'impactSection.titleLines.0', c.impactSection && c.impactSection.titleLines && c.impactSection.titleLines[0], {max: 40}) + input('Titre — ligne 2', 'impactSection.titleLines.1', c.impactSection && c.impactSection.titleLines && c.impactSection.titleLines[1], {max: 40}) + area('Description', 'impactSection.subtitle', c.impactSection && c.impactSection.subtitle, {rows: 2, max: 240}) + '</div>' +
          '<div class="pt-sitecms__repeat-list" id="cmsImpacts">' + (c.impact || []).map(impactEditor).join('') + '</div><button type="button" class="pt-btn pt-btn--ghost" data-add-impact>' + U.icon('plus') + 'Ajouter un indicateur</button>', false) +
        details('08 · Contact & liens', 'Coordonnées et destination des boutons publics.',
          '<div class="pt-sitecms__fields">' + input('Titre de section', 'contact.title', contact.title, {max: 80}) + input('Adresse e-mail', 'contact.email', contact.email, {max: 180, type: 'email'}) + input('Téléphone', 'contact.phone', contact.phone, {max: 40}) + input('Lien Instagram', 'contact.instagram', contact.instagram, {max: 2048}) +
          input('Texte du bouton « Rejoindre »', 'contact.joinLabel', contact.joinLabel, {max: 70}) + area('Lien personnalisé « Rejoindre » (facultatif)', 'contact.joinUrl', contact.joinUrl, {rows: 1, max: 2048, hint: 'Laisse vide pour revenir automatiquement au mailto de l’adresse e-mail ci-dessus.'}) +
          input('Texte du bouton partenaire', 'contact.partnerLabel', contact.partnerLabel, {max: 70}) + area('Lien personnalisé partenaire (facultatif)', 'contact.partnerUrl', contact.partnerUrl, {rows: 1, max: 2048, hint: 'Laisse vide pour utiliser le mailto de contact.'}) + '</div>', false) +
        details('09 · Vision, pied de page & SEO', 'Dernier message avant le contact et phrase du pied de page.',
          '<div class="pt-sitecms__fields">' + input('Titre de la vision', 'vision.title', c.vision && c.vision.title, {max: 80}) + area('Texte de la vision', 'vision.text', c.vision && c.vision.text, {rows: 3, max: 700}) + area('Phrase du pied de page', 'footer.note', c.footer && c.footer.note, {rows: 2, max: 180}) + input('Titre de la page (SEO)', 'metaTitle', c.metaTitle, {max: 100}) + area('Description SEO du site', 'metaDescription', c.metaDescription, {rows: 2, max: 320}) + '</div>', false);
      return U.pageHead('SUPER ADMIN', 'Gestion du site public', 'Modifie les contenus du site sans toucher à sa structure, à ses animations ni à son code.', '<button type="button" class="pt-btn pt-btn--primary" data-cms-save' + (d.configurationReady === false ? ' disabled' : '') + '>' + U.icon('check') + 'Enregistrer et publier</button>') +
        '<section class="pt-sitecms" data-cms-root>' + body + '<div class="pt-sitecms__savebar"><span data-cms-status aria-live="polite">' + (d.configurationReady === false ? 'Migration requise avant publication.' : 'Aucune modification non enregistrée.') + '</span><button type="button" class="pt-btn pt-btn--primary" data-cms-save' + (d.configurationReady === false ? ' disabled' : '') + '>' + U.icon('check') + 'Enregistrer et publier</button></div></section>';
    },
    mount: function (root, d) {
      var cms = root.querySelector('[data-cms-root]');
      if (!cms) return;
      var status = cms.querySelector('[data-cms-status]'), saveButtons = Array.prototype.slice.call(root.querySelectorAll('[data-cms-save]'));
      var setupRequired = d.configurationReady === false, dirty = false;
      function markDirty() { dirty = true; status.textContent = 'Modifications non enregistrées.'; status.classList.add('is-dirty'); }
      function field(scope, key) { var node = scope.querySelector('[data-cms-field="' + key + '"]'); return node ? node.value.trim() : ''; }
      function collect() {
        var c = getDefaults();
        c.metaTitle = field(cms, 'metaTitle');
        c.metaDescription = field(cms, 'metaDescription');
        c.hero = { titleLines: [field(cms,'hero.titleLines.0'),field(cms,'hero.titleLines.1'),field(cms,'hero.titleLines.2')], tagline: collectLines(field(cms,'hero.tagline')), lead: field(cms,'hero.lead'), video: field(cms,'hero.video'), poster: field(cms,'hero.poster'), primaryLabel: field(cms,'hero.primaryLabel'), secondaryLabel: field(cms,'hero.secondaryLabel') };
        c.intro = { rotaryTitle: field(cms,'intro.rotaryTitle'), rotaryText: field(cms,'intro.rotaryText'), interactTitle: field(cms,'intro.interactTitle'), interactText: field(cms,'intro.interactText'), clubTitle: field(cms,'intro.clubTitle'), clubText: field(cms,'intro.clubText'), linkLabel: field(cms,'intro.linkLabel') };
        c.club = { titleLines: [field(cms,'club.titleLines.0'),field(cms,'club.titleLines.1')], subtitle: field(cms,'club.subtitle'), photo: field(cms,'club.photo'), photoAlt: field(cms,'club.photoAlt'), facts: [0,1,2,3].map(function(i){return {label:field(cms,'club.factLabel.'+i),value:field(cms,'club.factValue.'+i)};}), lead: field(cms,'club.lead'), paragraphs: paragraphs(field(cms,'club.paragraphs')) };
        c.actionsSection = { title: field(cms,'actionsSection.title'), subtitle: field(cms,'actionsSection.subtitle'), financialLabel: field(cms,'actionsSection.financialLabel'), humanitarianLabel: field(cms,'actionsSection.humanitarianLabel') };
        c.actions = Array.prototype.slice.call(cms.querySelectorAll('[data-cms-action]')).map(function(card, i) {
          var v = function(k){return field(card,k);}, type = v('impactType'), impact;
          if (type === 'text') impact = { text: v('impactText') };
          else if (type === 'multi') impact = v('impactMulti').split(/\r?\n/).map(function(line){var parts=line.split('|');return {display:(parts.shift()||'').trim(),label:parts.join('|').trim()};}).filter(function(x){return x.display&&x.label;});
          else impact = { value: Number(v('impactValue')) || 0, prefix: v('impactPrefix'), suffix: v('impactSuffix'), label: v('impactLabel') };
          return { id: card.getAttribute('data-action-id') || ('action-' + (i+1)), category: v('category'), layout: v('layout'), title: v('title'), subtitle: v('subtitle'), axis: collectLines(v('axis')), description: paragraphs(v('description')), impact: impact, media: { type:v('mediaType'), src:v('mediaSrc'), poster:v('mediaPoster'), alt:v('mediaAlt'), position:v('mediaPosition') || '50% 50%' } };
        });
        c.teamSection = { titleLines: [field(cms,'teamSection.titleLines.0'),field(cms,'teamSection.titleLines.1')] };
        c.bureauElargiSection = { titleLines: [field(cms,'bureauElargiSection.titleLines.0'),field(cms,'bureauElargiSection.titleLines.1')], intro: field(cms,'bureauElargiSection.intro') };
        c.partnersSection = { title: field(cms,'partnersSection.title'), subtitle: field(cms,'partnersSection.subtitle') };
        c.sponsors = Array.prototype.slice.call(cms.querySelectorAll('[data-cms-sponsor]')).map(function(card){var v=function(k){return field(card,k);};return {name:v('name'),logo:v('logo'),url:v('url'),fit:v('fit')};});
        c.impactSection = { titleLines: [field(cms,'impactSection.titleLines.0'),field(cms,'impactSection.titleLines.1')], subtitle: field(cms,'impactSection.subtitle') };
        c.impact = Array.prototype.slice.call(cms.querySelectorAll('[data-cms-impact]')).map(function(card){var v=function(k){return field(card,k);};return {value:Number(v('value'))||0,prefix:v('prefix'),suffix:v('suffix'),label:v('label'),source:v('source'),accent:!!card.querySelector('[data-impact-accent]').checked};});
        c.contact = { title:field(cms,'contact.title'), email:field(cms,'contact.email'), phone:field(cms,'contact.phone'), instagram:field(cms,'contact.instagram'), joinLabel:field(cms,'contact.joinLabel'), joinUrl:field(cms,'contact.joinUrl'), partnerLabel:field(cms,'contact.partnerLabel'), partnerUrl:field(cms,'contact.partnerUrl') };
        c.vision = { title:field(cms,'vision.title'), text:field(cms,'vision.text') };
        c.footer = { note:field(cms,'footer.note') };
        return c;
      }
      function validate(c) {
        var errors = [];
        if (c.hero.titleLines.some(function(x){return !x;}) || c.hero.tagline.length !== 4) errors.push('Le titre du Hero doit contenir 3 lignes et l’accroche 4 lignes.');
        if (!c.hero.lead || !c.club.photo || !safeAssetOrHttps(c.club.photo)) errors.push('Ajoute une photo de club valide (assets/... ou HTTPS).');
        if (!safeAssetOrHttps(c.hero.video) || !safeAssetOrHttps(c.hero.poster)) errors.push('Le média Hero doit être un chemin assets/ ou une URL HTTPS.');
        if (c.actions.length < 1 || c.actions.length > 20) errors.push('Le site doit contenir entre 1 et 20 actions.');
        var ids = {};
        c.actions.forEach(function(a,i){
          if(!a.title||!a.description.length) errors.push('Action '+(i+1)+' : titre et description obligatoires.');
          if(['financiere','humanitaire'].indexOf(a.category)<0) errors.push('Action '+(i+1)+' : catégorie invalide.');
          if(!safeAssetOrHttps(a.media.src)||!safeAssetOrHttps(a.media.poster)) errors.push('Action '+(i+1)+' : chemin média invalide.');
          if(ids[a.id]) errors.push('Deux actions possèdent le même identifiant.');
          ids[a.id]=true;
          if(Array.isArray(a.impact) && a.impact.length < 1) errors.push('Action '+(i+1)+' : ajoute au moins un indicateur d’impact.');
          if(a.impact && !Array.isArray(a.impact) && typeof a.impact.text === 'string' && !a.impact.text.trim()) errors.push('Action '+(i+1)+' : la description d’impact ne peut pas être vide.');
        });
        if (c.impact.length > 12) errors.push('12 indicateurs maximum.');
        if (c.sponsors.length > 20) errors.push('20 partenaires maximum.');
        c.sponsors.forEach(function(x,i){if(!x.name&&!x.logo)errors.push('Partenaire '+(i+1)+' : ajoute un nom ou un logo.');if(!safeAssetOrHttps(x.logo))errors.push('Partenaire '+(i+1)+' : chemin du logo invalide.');if(x.url&&!/^https:\/\//i.test(x.url))errors.push('Partenaire '+(i+1)+' : le lien doit commencer par HTTPS.');});
        c.impact.forEach(function(x,i){if(!x.label||!x.source)errors.push('Indicateur '+(i+1)+' : libellé et source obligatoires.');if(x.value<0||x.value>1000000000)errors.push('Indicateur '+(i+1)+' : valeur hors limites.');});
        if (c.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact.email)) errors.push('Adresse e-mail invalide.');
        ['joinUrl','partnerUrl'].forEach(function(k){var v=c.contact[k];if(v&&!/^https:\/\//i.test(v)&&!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v))errors.push('Le lien '+k+' doit commencer par HTTPS ou mailto:.');});
        if (c.contact.instagram && !/^https:\/\//i.test(c.contact.instagram)) errors.push('Le lien Instagram doit utiliser HTTPS.');
        if (!c.contact.email && !c.contact.joinUrl) errors.push('Ajoute un e-mail ou un lien personnalisé pour le bouton Rejoindre.');
        if (errors.length) throw new Error(errors[0]);
      }
      function reorder(container, card, delta) { var list = Array.prototype.slice.call(container.children), i = list.indexOf(card), target = i + delta;if(target<0||target>=list.length)return;if(delta<0)container.insertBefore(card,list[target]);else container.insertBefore(list[target],card);renumber(container);markDirty(); }
      function renumber(container) { Array.prototype.slice.call(container.children).forEach(function(card,i){card.dataset.index=i;var b=card.querySelector('.pt-sitecms__repeat-head > b');if(b)b.textContent=(card.hasAttribute('data-cms-action')?'Action ':card.hasAttribute('data-cms-sponsor')?'Partenaire ':'Indicateur ')+(i+1);}); }
      cms.addEventListener('input', function(ev){if(ev.target.matches('input,textarea,select'))markDirty();});
      cms.addEventListener('change', function(ev){var selectNode=ev.target.closest('[data-cms-field="impactType"]');if(selectNode){var card=selectNode.closest('[data-cms-action]');card.querySelectorAll('[data-impact-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-impact-panel')!==selectNode.value;});}if(ev.target.matches('input,textarea,select'))markDirty();});
      cms.addEventListener('click', function(ev){
        var addAction=ev.target.closest('[data-add-action]'), addImpact=ev.target.closest('[data-add-impact]'), addSponsor=ev.target.closest('[data-add-sponsor]');
        var removeAction=ev.target.closest('[data-remove-action]'), removeImpact=ev.target.closest('[data-remove-impact]');
        var moveAction=ev.target.closest('[data-move-action]'), moveImpact=ev.target.closest('[data-move-impact]'), moveSponsor=ev.target.closest('[data-move-sponsor]'), removeSponsor=ev.target.closest('[data-remove-sponsor]');
        if(addAction){var list=cms.querySelector('#cmsActions');if(list.children.length>=20){U.toast('20 actions maximum.');return;}list.insertAdjacentHTML('beforeend',actionEditor(defaultAction(),list.children.length));markDirty();return;}
        if(addImpact){var list2=cms.querySelector('#cmsImpacts');if(list2.children.length>=12){U.toast('12 indicateurs maximum.');return;}list2.insertAdjacentHTML('beforeend',impactEditor(defaultImpact(),list2.children.length));markDirty();return;}
        if(addSponsor){var list3=cms.querySelector('#cmsSponsors');if(list3.children.length>=20){U.toast('20 partenaires maximum.');return;}list3.insertAdjacentHTML('beforeend',sponsorEditor(defaultSponsor(),list3.children.length));markDirty();return;}
        if(removeAction){if(cms.querySelectorAll('[data-cms-action]').length<=1){U.toast('Le site doit conserver au moins une action.');return;}removeAction.closest('[data-cms-action]').remove();renumber(cms.querySelector('#cmsActions'));markDirty();return;}
        if(removeImpact){removeImpact.closest('[data-cms-impact]').remove();renumber(cms.querySelector('#cmsImpacts'));markDirty();return;}
        if(removeSponsor){removeSponsor.closest('[data-cms-sponsor]').remove();renumber(cms.querySelector('#cmsSponsors'));markDirty();return;}
        if(moveAction){reorder(cms.querySelector('#cmsActions'),moveAction.closest('[data-cms-action]'),Number(moveAction.dataset.moveAction));return;}
        if(moveImpact){reorder(cms.querySelector('#cmsImpacts'),moveImpact.closest('[data-cms-impact]'),Number(moveImpact.dataset.moveImpact));return;}
        if(moveSponsor){reorder(cms.querySelector('#cmsSponsors'),moveSponsor.closest('[data-cms-sponsor]'),Number(moveSponsor.dataset.moveSponsor));return;}
      });
      saveButtons.forEach(function(btn){btn.addEventListener('click',function(){if(setupRequired)return;var payload;try{payload=collect();validate(payload);}catch(err){U.toast(err.message||'Vérifie les champs.');return;}saveButtons.forEach(function(b){b.disabled=true;});status.textContent='Enregistrement et publication…';P.api.savePublicSiteContent(payload).then(function(){dirty=false;status.classList.remove('is-dirty');status.textContent='Publié avec succès. Le site public utilise maintenant ces contenus.';U.toast('Le site public a été mis à jour.');saveButtons.forEach(function(b){b.disabled=false;});if(P.app)P.app.refresh();}).catch(function(err){var message=String(err&&err.message||'Erreur inconnue');status.textContent='Publication impossible : '+message;U.toast('Publication impossible : '+message);saveButtons.forEach(function(b){b.disabled=false;});if(window.console&&console.error)console.error('[ICRM CMS] save failed',err);});});});
      window.addEventListener('beforeunload', function(ev){if(dirty){ev.preventDefault();ev.returnValue='';}});
    }
  };
})();
