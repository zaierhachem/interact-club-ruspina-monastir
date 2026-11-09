/* ICRM — Public site content loader.
   Public data is exposed through a read-only SECURITY DEFINER RPC. If Supabase
   is unavailable, the static values in js/data.js remain the graceful fallback. */
(function () {
  'use strict';
  var SITE = window.SITE;
  var cfg = window.ICRMPortal && window.ICRMPortal.config && window.ICRMPortal.config.BACKEND && window.ICRMPortal.config.BACKEND.supabase;
  var fallback = SITE && SITE.PUBLIC_CONTENT;

  function text(value, max, def) {
    var out = typeof value === 'string' ? value.trim() : '';
    if (!out) return def || '';
    return out.slice(0, max || 2000);
  }
  function lines(value, count, defaults) {
    if (!Array.isArray(value)) return defaults.slice();
    return value.slice(0, count).map(function (v, i) { return text(v, 120, defaults[i] || ''); });
  }
  function safePath(value) {
    var v = text(value, 2048, '');
    if (!v) return '';
    if (/^https:\/\//i.test(v)) return v;
    if (/^assets\/[a-z0-9_./-]+$/i.test(v) && v.indexOf('..') < 0 && v.indexOf('//') < 0) return v;
    return '';
  }
  function safeLink(value) {
    var v = text(value, 2048, '');
    return (/^https:\/\//i.test(v) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) ? v : '';
  }
  function safeHttps(value) {
    var v = text(value, 2048, '');
    return /^https:\/\//i.test(v) ? v : '';
  }
  function optionalText(object, key, max, fallbackValue) {
    if (!object || !Object.prototype.hasOwnProperty.call(object, key)) return fallbackValue || '';
    return typeof object[key] === 'string' ? object[key].trim().slice(0, max || 2000) : '';
  }
  function optionalLink(object, key, fallbackValue, httpsOnly) {
    if (!object || !Object.prototype.hasOwnProperty.call(object, key)) return fallbackValue || '';
    return httpsOnly ? safeHttps(object[key]) : safeLink(object[key]);
  }
  function paragraphs(value, defaults) {
    if (!Array.isArray(value)) return defaults.slice();
    return value.slice(0, 6).map(function (v) { return text(v, 2000, ''); }).filter(Boolean);
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    var d = fallback || {}, hero = raw.hero || {}, intro = raw.intro || {}, club = raw.club || {};
    var actionRows = Array.isArray(raw.actions) ? raw.actions.slice(0, 20) : (d.actions || []);
    var actions = actionRows.map(function (a, i) {
      a = a && typeof a === 'object' ? a : {};
      var media = a.media || {}, impact = a.impact;
      var category = a.category === 'humanitaire' ? 'humanitaire' : 'financiere';
      var layout = ['a', 'b', 'c'].indexOf(a.layout) > -1 ? a.layout : 'a';
      var kind = media.type === 'video' ? 'video' : 'image';
      var cleanImpact;
      if (Array.isArray(impact)) cleanImpact = impact.slice(0, 4).map(function (x) { return { display: text(x && x.display, 80, ''), label: text(x && x.label, 100, '') }; }).filter(function (x) { return x.display && x.label; });
      else if (impact && typeof impact.text === 'string') cleanImpact = { text: text(impact.text, 500, '') };
      else if (impact && typeof impact === 'object') cleanImpact = { value: Math.max(0, Math.min(1000000000, Number(impact.value) || 0)), prefix: text(impact.prefix, 8, ''), suffix: text(impact.suffix, 12, ''), label: text(impact.label, 100, '') };
      else cleanImpact = null;
      return {
        id: text(a.id, 64, 'action-' + (i + 1)), category: category, layout: layout,
        title: text(a.title, 100, 'Action sans titre'), subtitle: text(a.subtitle, 160, ''),
        axis: paragraphs(a.axis, []).slice(0, 4), description: paragraphs(a.description, ['Description à compléter.']),
        impact: cleanImpact,
        media: { type: kind, src: safePath(media.src), poster: safePath(media.poster), alt: text(media.alt, 240, ''), position: /^(\d{1,3}%\s+\d{1,3}%|center|top|bottom|left|right)$/i.test(String(media.position || '')) ? media.position : '50% 50%' }
      };
    }).filter(function (a) { return !!a.title; });

    var impactRows = Array.isArray(raw.impact) ? raw.impact.slice(0, 12) : (d.impact || []);
    var impact = impactRows.map(function (x) {
      x = x || {};
      return { value: Math.max(0, Math.min(1000000000, Number(x.value) || 0)), prefix: text(x.prefix, 8, ''), suffix: text(x.suffix, 12, ''), label: text(x.label, 100, ''), source: text(x.source, 120, ''), accent: x.accent === true };
    }).filter(function (x) { return x.label && x.source; });

    var contact = raw.contact || {}, facts = Array.isArray(club.facts) ? club.facts.slice(0, 4) : (d.club && d.club.facts || []);
    return {
      metaTitle: text(raw.metaTitle, 100, d.metaTitle || 'Interact Club Ruspina Monastir'),
      metaDescription: optionalText(raw, 'metaDescription', 320, d.metaDescription || ''),
      hero: {
        titleLines: lines(hero.titleLines, 3, d.hero.titleLines), tagline: lines(hero.tagline, 4, d.hero.tagline),
        lead: text(hero.lead, 500, d.hero.lead), video: safePath(hero.video), poster: safePath(hero.poster),
        primaryLabel: text(hero.primaryLabel, 60, d.hero.primaryLabel), secondaryLabel: text(hero.secondaryLabel, 60, d.hero.secondaryLabel)
      },
      intro: {
        rotaryTitle: text(intro.rotaryTitle, 80, d.intro.rotaryTitle), rotaryText: text(intro.rotaryText, 1200, d.intro.rotaryText),
        interactTitle: text(intro.interactTitle, 80, d.intro.interactTitle), interactText: text(intro.interactText, 1200, d.intro.interactText),
        clubTitle: text(intro.clubTitle, 100, d.intro.clubTitle), clubText: text(intro.clubText, 1400, d.intro.clubText), linkLabel: text(intro.linkLabel, 60, d.intro.linkLabel)
      },
      club: {
        titleLines: lines(club.titleLines, 2, d.club.titleLines), subtitle: text(club.subtitle, 120, d.club.subtitle),
        photo: safePath(club.photo), photoAlt: text(club.photoAlt, 240, d.club.photoAlt),
        facts: facts.map(function (f, i) { return { label: text(f && f.label, 60, d.club.facts[i] && d.club.facts[i].label || ''), value: text(f && f.value, 120, d.club.facts[i] && d.club.facts[i].value || '') }; }),
        lead: text(club.lead, 800, d.club.lead), paragraphs: paragraphs(club.paragraphs, d.club.paragraphs)
      },
      actionsSection: { title: text(raw.actionsSection && raw.actionsSection.title, 80, d.actionsSection.title), subtitle: text(raw.actionsSection && raw.actionsSection.subtitle, 240, d.actionsSection.subtitle), financialLabel: text(raw.actionsSection && raw.actionsSection.financialLabel, 40, d.actionsSection.financialLabel), humanitarianLabel: text(raw.actionsSection && raw.actionsSection.humanitarianLabel, 40, d.actionsSection.humanitarianLabel) },
      teamSection: { titleLines: lines(raw.teamSection && raw.teamSection.titleLines, 2, d.teamSection.titleLines) },
      bureauElargiSection: { titleLines: lines(raw.bureauElargiSection && raw.bureauElargiSection.titleLines, 2, d.bureauElargiSection.titleLines), intro: text(raw.bureauElargiSection && raw.bureauElargiSection.intro, 240, d.bureauElargiSection.intro) },
      partnersSection: { title: text(raw.partnersSection && raw.partnersSection.title, 80, d.partnersSection.title), subtitle: text(raw.partnersSection && raw.partnersSection.subtitle, 240, d.partnersSection.subtitle) },
      sponsors: (Array.isArray(raw.sponsors) ? raw.sponsors.slice(0, 20) : (d.sponsors || [])).map(function (s) { s = s || {}; return { name: text(s.name, 100, ''), logo: safePath(s.logo), url: safeHttps(s.url), fit: s.fit === 'cover' ? 'cover' : 'contain' }; }).filter(function (s) { return s.name || s.logo; }),
      actions: actions.length ? actions : d.actions,
      impactSection: { titleLines: lines(raw.impactSection && raw.impactSection.titleLines, 2, d.impactSection.titleLines), subtitle: text(raw.impactSection && raw.impactSection.subtitle, 240, d.impactSection.subtitle) },
      impact: impact,
      vision: { title: text(raw.vision && raw.vision.title, 80, d.vision.title), text: text(raw.vision && raw.vision.text, 700, d.vision.text) },
      contact: {
        title: text(contact.title, 80, d.contact.title), email: optionalText(contact, 'email', 180, d.contact.email),
        phone: optionalText(contact, 'phone', 40, d.contact.phone), instagram: optionalLink(contact, 'instagram', d.contact.instagram, true),
        joinLabel: text(contact.joinLabel, 70, d.contact.joinLabel), joinUrl: safeLink(contact.joinUrl),
        partnerLabel: text(contact.partnerLabel, 70, d.contact.partnerLabel), partnerUrl: safeLink(contact.partnerUrl)
      },
      footer: { note: text(raw.footer && raw.footer.note, 180, d.footer.note) }
    };
  }
  function apply(content) {
    if (!SITE || !content) return false;
    content = normalize(content);
    if (!content) return false;
    SITE.PUBLIC_CONTENT = content;
    SITE.MEDIA.HERO_VIDEO = content.hero.video;
    SITE.MEDIA.HERO_POSTER = content.hero.poster;
    SITE.MEDIA.CLUB_PHOTO = content.club.photo;
    SITE.ACTIONS = content.actions;
    SITE.IMPACT = content.impact;
    SITE.SPONSORS = content.sponsors;
    SITE.CONTACT.EMAIL = content.contact.email;
    SITE.CONTACT.PHONE = content.contact.phone;
    SITE.CONTACT.INSTAGRAM = content.contact.instagram;
    return true;
  }

  window.ICRMSiteContent = { normalize: normalize, apply: apply };
  window.SITE_CONTENT_READY = Promise.resolve(false);
  if (!cfg || !cfg.url || !cfg.publishableKey || typeof window.fetch !== 'function') return;

  var endpoint = cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/get_public_site_content';
  var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
  var expired = false, timeoutId = null;
  var requestOptions = {
    method: 'POST',
    /* A publishable key is an API key, not a JWT: send it only in apikey.
       The public RPC then runs as anon and is protected by its narrow EXECUTE grant. */
    headers: { 'apikey': cfg.publishableKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: '{}', cache: 'no-store'
  };
  if (controller) requestOptions.signal = controller.signal;
  var request = fetch(endpoint, requestOptions).then(function (response) {
    if (!response.ok) throw new Error('Public site content unavailable (' + response.status + ')');
    return response.json();
  }).then(function (result) {
    if (expired) return false;
    if (result && result.content) apply(result.content);
    return !!(result && result.content);
  });
  var timeout = new Promise(function (resolve) {
    timeoutId = setTimeout(function () {
      expired = true;
      if (controller) controller.abort();
      resolve(false);
    }, 3000);
  });
  window.SITE_CONTENT_READY = Promise.race([request, timeout]).catch(function (err) {
    if (window.console && console.info) console.info('[ICRM] Public CMS fallback enabled.', err && err.message);
    return false;
  }).then(function (result) {
    if (timeoutId !== null) clearTimeout(timeoutId);
    return result;
  });
})();
