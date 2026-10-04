/* =========================================================================
   INTERACT CLUB RUSPINA MONASTIR — MAIN
   Aucune dépendance. Les données viennent de js/data.js (window.SITE).
   ========================================================================= */
(function () {
  'use strict';

  var S = window.SITE;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var LOGO_PH = S.MEDIA.INTERACT_LOGO_WHITE;

  /* ---------------------------------------------------------------------
     0. Médias globaux : <img data-media="CLÉ"> → S.MEDIA[CLÉ]
     --------------------------------------------------------------------- */
  $$('[data-media]').forEach(function (img) {
    var src = S.MEDIA[img.getAttribute('data-media')];
    if (src) img.src = src;
  });

  /* Index de stagger pour les lignes masquées */
  $$('[data-reveal="lines"]').forEach(function (h) { $$('.ln > span', h).forEach(function (s, i) { s.style.setProperty('--i', i); }); });
  $$('.hero__title .ln > span').forEach(function (s, i) { s.style.setProperty('--i', i); });
  $$('.hero__tag span').forEach(function (s, i) { s.style.setProperty('--i', i); });
  $$('.menu__inner a').forEach(function (a, i) { a.style.setProperty('--i', i); });

  /* ---------------------------------------------------------------------
     1. HERO — vidéo + ouverture orchestrée
     --------------------------------------------------------------------- */
  var hero = $('#hero');
  var heroVideo = $('#heroVideo');
  var heroToggle = $('#heroToggle');

  if (S.MEDIA.HERO_POSTER) heroVideo.poster = S.MEDIA.HERO_POSTER;
  if (S.MEDIA.HERO_VIDEO) {
    heroVideo.src = S.MEDIA.HERO_VIDEO;
    heroVideo.setAttribute('preload', 'metadata');
  }
  function setHeroState(playing) {
    heroToggle.classList.toggle('is-paused', !playing);
    heroToggle.setAttribute('aria-label', playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo');
  }
  function heroPlay() {
    var p = heroVideo.play();
    if (p && p.then) p.then(function () { setHeroState(true); }).catch(function () { setHeroState(false); });
  }
  if (reduce) { heroVideo.pause(); setHeroState(false); } else { heroPlay(); }
  heroToggle.addEventListener('click', function () {
    if (heroVideo.paused) heroPlay(); else { heroVideo.pause(); setHeroState(false); }
  });
  /* Pause hors écran (économie batterie/CPU) */
  var heroManual = false;
  heroToggle.addEventListener('click', function () { heroManual = heroVideo.paused; });
  new IntersectionObserver(function (e) {
    if (reduce || heroManual) return;
    if (e[0].isIntersecting) heroPlay(); else heroVideo.pause();
  }, { threshold: 0.05 }).observe(hero);

  requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('is-live'); }); });

  /* ---------------------------------------------------------------------
     2. NOS ACTIONS — rendu depuis S.ACTIONS
     --------------------------------------------------------------------- */
  var CAT = { financiere: 'ACTION FINANCIÈRE', humanitaire: 'ACTION HUMANITAIRE' };
  var rail = $('#rail');
  var actions = S.ACTIONS.slice();
  var slides = [];

  function mediaHTML(a, i) {
    var m = a.media || {};
    if (!m.src) {
      return '<div class="media media--ph"><div><img src="' + esc(LOGO_PH) + '" alt="" width="64" height="64"><span>' +
        (m.type === 'video' ? 'Vidéo à venir' : 'Photo à venir') + '</span></div></div>';
    }
    if (m.type === 'video') {
      return '<div class="media" data-video><span class="media__tag">VIDÉO</span>' +
        '<video muted loop playsinline preload="none" poster="' + esc(m.poster || '') + '" data-src="' + esc(m.src) + '" aria-label="' + esc(m.alt) + '" style="object-position:' + esc(m.position || '50% 50%') + '"></video>' +
        '<button class="vctl" type="button" aria-label="Lire la vidéo : ' + esc(a.title) + '"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button></div>';
    }
    return '<div class="media"><span class="media__tag">PHOTO</span><img src="' + esc(m.src) + '" alt="' + esc(m.alt) + '" ' +
      (i > 0 ? 'loading="lazy" ' : '') + 'draggable="false" width="1600" height="1000" style="object-position:' + esc(m.position || '50% 50%') + '"></div>';
  }
  function impactHTML(im) {
    if (!im) return '';
    if (Array.isArray(im)) return '<div class="slide__impact slide__impact--multi">' + im.map(function (x) {
      return '<div><span class="num">' + esc(x.display || ((x.prefix || '') + x.value + (x.suffix || ''))) + '</span><span class="lab">' + esc(x.label) + '</span></div>';
    }).join('') + '</div>';
    if (im.text) return '<div class="slide__impact"><span class="qlab">IMPACT</span><p class="quote">' + esc(im.text) + '</p></div>';
    return '<div class="slide__impact"><span class="num">' + esc((im.prefix || '') + im.value + (im.suffix || '')) + '</span><span class="lab">' + esc(im.label) + '</span></div>';
  }

  actions.forEach(function (a, i) {
    var n = ('0' + (i + 1)).slice(-2);
    var s = el('article', 'slide slide--' + (a.layout || 'a'));
    s.setAttribute('role', 'group');
    s.setAttribute('aria-roledescription', 'diapositive');
    s.setAttribute('aria-label', (i + 1) + ' sur ' + actions.length + ' : ' + a.title);
    s.dataset.cat = a.category;
    var axis = (a.axis && a.axis.length) ? '<p class="slide__axis">' + a.axis.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</p>' : '';
    var text = a.description.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    s.innerHTML =
      '<span class="slide__ghost" aria-hidden="true">' + n + '</span>' +
      mediaHTML(a, i) +
      '<div class="slide__body">' +
        '<div class="slide__head">' +
          '<p class="slide__cat"><b>' + n + '</b>' + esc(CAT[a.category] || '') + '</p>' +
          '<h3 class="slide__title">' + esc(a.title) + '</h3>' +
          (a.subtitle ? '<p class="slide__sub">' + esc(a.subtitle) + '</p>' : '') +
          axis +
        '</div>' +
        '<div class="slide__rest"><div class="slide__text">' + text + '</div>' + impactHTML(a.impact) + '</div>' +
      '</div>';
    rail.appendChild(s);
    slides.push(s);
  });
  $('#railTotal').textContent = ('0' + actions.length).slice(-2);

  /* Vidéos des actions : chargement tardif + lecture seulement sur la slide active */
  var videos = slides.map(function (s) {
    var v = $('video', s); if (!v) return null;
    var btn = $('.vctl', s);
    var o = { v: v, btn: btn, loaded: false, manual: false };
    function sync() {
      var playing = !v.paused;
      btn.classList.toggle('is-paused', !playing);
      btn.setAttribute('aria-label', (playing ? 'Mettre en pause la vidéo' : 'Lire la vidéo'));
    }
    o.sync = sync;
    o.load = function () { if (!o.loaded) { v.src = v.dataset.src; o.loaded = true; } };
    o.play = function () {
      o.load();
      var p = v.play();
      if (p && p.then) p.then(sync).catch(sync);
    };
    btn.classList.add('is-paused');
    btn.addEventListener('click', function () {
      if (v.paused) { o.manual = false; o.play(); } else { o.manual = true; v.pause(); sync(); }
    });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    return o;
  });

  /* Active slide / progression */
  var now = $('#railNow'), bar = $('#railBar'), prev = $('#prev'), next = $('#next');
  var tabs = $$('.tab');
  var active = -1;

  function nearest() {
    var x = rail.scrollLeft, best = 0, bd = Infinity;
    slides.forEach(function (s, i) {
      var d = Math.abs(s.offsetLeft - parseFloat(getComputedStyle(rail).paddingLeft) - x);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function setActive(i) {
    if (i === active) return;
    active = i;
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    now.textContent = ('0' + (i + 1)).slice(-2);
    prev.disabled = i === 0; next.disabled = i === slides.length - 1;
    var cat = slides[i].dataset.cat;
    tabs.forEach(function (t) { var on = t.dataset.cat === cat; t.classList.toggle('is-on', on); t.setAttribute('aria-pressed', on); });
    videos.forEach(function (o, k) {
      if (!o) return;
      if (k === i) { if (!o.manual && !reduce) o.play(); else o.load(); }
      else { if (o.loaded) o.v.pause(); }
      if (Math.abs(k - i) === 1) o.load(); /* préchargement des voisines */
    });
  }
  function onRail() {
    var max = rail.scrollWidth - rail.clientWidth;
    var p = max > 0 ? rail.scrollLeft / max : 1;
    bar.style.transform = 'scaleX(' + (0.06 + 0.94 * p).toFixed(4) + ')';
    setActive(nearest());
  }
  rail.addEventListener('scroll', function () { requestAnimationFrame(onRail); }, { passive: true });
  window.addEventListener('resize', onRail);

  function go(i) {
    i = clamp(i, 0, slides.length - 1);
    var pad = parseFloat(getComputedStyle(rail).paddingLeft);
    rail.scrollTo({ left: slides[i].offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', function () { go(active - 1); });
  next.addEventListener('click', function () { go(active + 1); });
  rail.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  });
  tabs.forEach(function (t) {
    t.setAttribute('aria-pressed', t.classList.contains('is-on'));
    t.addEventListener('click', function () {
      var i = slides.findIndex(function (s) { return s.dataset.cat === t.dataset.cat; });
      if (i > -1) go(i);
    });
  });

  /* Drag à la souris (desktop). Le tactile utilise le swipe natif + scroll-snap. */
  (function drag() {
    var down = false, sx = 0, sl = 0, moved = 0, startIdx = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
      down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft; startIdx = active;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) { rail.classList.add('is-drag'); rail.scrollLeft = sl - dx; }
    });
    function end(e) {
      if (!down) return; down = false;
      if (!rail.classList.contains('is-drag')) return;
      var dx = (e && e.clientX != null) ? e.clientX - sx : 0;
      rail.classList.remove('is-drag');
      go(Math.abs(dx) > 60 ? startIdx + (dx < 0 ? 1 : -1) : startIdx);
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  })();
  onRail();

  /* ---------------------------------------------------------------------
     3. BUREAU EXÉCUTIF — rendu depuis S.TEAM
     --------------------------------------------------------------------- */
  var grid = $('#teamGrid');
  S.TEAM.forEach(function (m, i) {
    var li = el('li', 'member' + (m.featured ? ' member--lead' : '')); li.style.setProperty('--i', i);
    var hasPhoto = !!m.photo;
    var photo = hasPhoto
      ? '<div class="member__photo"><img src="' + esc(m.photo) + '" alt="' + esc(m.name ? 'Portrait de ' + m.name : 'Portrait d’un membre') + '" loading="lazy" width="640" height="800"></div>'
      : '<div class="member__photo is-ph" role="img" aria-label="' + esc(m.name ? 'Photo de ' + m.name + ' à venir' : 'Photo du membre à venir') + '"><img class="ph-logo" src="' + esc(LOGO_PH) + '" alt="" width="34" height="34"></div>';
    li.innerHTML = photo +
      '<div class="member__info"><h3 class="member__name' + (m.name ? '' : ' is-ph') + '">' + esc(m.name || 'Nom à renseigner') + '</h3>' +
      '<p class="member__role' + (m.role ? '' : ' is-ph') + '">' + esc(m.role || 'Fonction') + '</p></div>';
    grid.appendChild(li);
  });

  /* ---------------------------------------------------------------------
     4. SPONSORS — rendu depuis S.SPONSORS
     --------------------------------------------------------------------- */
  var sg = $('#sponsorGrid');
  S.SPONSORS.forEach(function (p, i) {
    var li = el('li', 'sponsor' + (p.logo ? '' : ' is-ph')); li.style.setProperty('--i', i % 4);
    if (p.logo) {
      var img = '<img src="' + esc(p.logo) + '" alt="' + esc(p.name ? 'Logo ' + p.name : 'Logo d’un sponsor') + '" loading="lazy" width="800" height="800"' + (p.fit ? ' style="object-fit:' + esc(p.fit) + '"' : '') + '>';
      li.innerHTML = p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + img + '</a>' : img;
    } else {
      li.setAttribute('role', 'img'); li.setAttribute('aria-label', 'Logo sponsor à venir');
      li.innerHTML = '<img src="' + esc(S.MEDIA.INTERACT_LOGO) + '" alt="" width="34" height="34">';
    }
    sg.appendChild(li);
  });

  /* ---------------------------------------------------------------------
     5. IMPACT — rendu + compteurs
     --------------------------------------------------------------------- */
  var stats = $('#stats');
  S.IMPACT.forEach(function (d) {
    var s = el('div', 'stat' + (d.accent ? ' is-accent' : ''));
    s.innerHTML = '<div class="stat__n" data-count="' + d.value + '" data-prefix="' + esc(d.prefix || '') + '" data-suffix="' + esc(d.suffix || '') + '" aria-label="' + esc((d.prefix || '') + d.value + (d.suffix || '') + ' ' + d.label + ', ' + d.source) + '">' +
      esc((d.prefix || '') + (reduce ? d.value : 0) + (d.suffix || '')) + '</div>' +
      '<p class="stat__l"><b>' + esc(d.label) + '</b><span>' + esc(d.source) + '</span></p>';
    stats.appendChild(s);
  });
  function countUp(node) {
    var end = +node.dataset.count, pre = node.dataset.prefix, suf = node.dataset.suffix;
    if (reduce) { node.textContent = pre + end + suf; return; }
    var t0 = null, dur = 1900 + Math.min(end, 600) * 1.2;
    function step(t) {
      if (t0 == null) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
      node.textContent = pre + Math.round(end * e) + suf;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------------
     6. CONTACT — coordonnées uniquement si fournies
     --------------------------------------------------------------------- */
  var C = S.CONTACT;
  function fill(id, val, mk) {
    var n = $(id);
    if (val) n.innerHTML = mk(val); else { n.textContent = 'À renseigner'; n.classList.add('is-ph'); }
  }
  fill('#dEmail', C.EMAIL, function (v) { return '<a href="mailto:' + esc(v) + '">' + esc(v).replace('@', '<wbr>@') + '</a>'; });
  fill('#dPhone', C.PHONE, function (v) { return '<a href="tel:' + esc(v.replace(/\s/g, '')) + '">' + esc(v) + '</a>'; });
  fill('#dInsta', C.INSTAGRAM, function (v) { return '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + 'Instagram' + '</a>'; });
  if (C.EMAIL) {
    $('#ctaJoin').href = 'mailto:' + C.EMAIL + '?subject=' + encodeURIComponent('Rejoindre l’Interact Club Ruspina Monastir');
    $('#ctaPartner').href = 'mailto:' + C.EMAIL + '?subject=' + encodeURIComponent('Devenir partenaire de l’Interact Club Ruspina Monastir');
  }

  /* ---------------------------------------------------------------------
     7. VISION — mots révélés par le scroll
     --------------------------------------------------------------------- */
  var vText = $('#visionText');
  var words = vText.textContent.trim().split(/\s+/);
  vText.setAttribute('aria-label', vText.textContent.trim());
  vText.innerHTML = words.map(function (w, i) {
    return '<span class="w' + (i >= words.length - 2 ? ' last' : '') + '" aria-hidden="true">' + esc(w) + '</span>';
  }).join(' ');
  var wEls = $$('.w', vText);

  /* ---------------------------------------------------------------------
     8. REVEALS (IntersectionObserver)
     --------------------------------------------------------------------- */
  var ro = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var t = en.target;
      t.classList.add('in');
      if (t.classList.contains('stat')) countUp($('.stat__n', t));
      if (t.id === 'teamGrid') $$('.member', t).forEach(function (m) { m.classList.add('in'); });
      ro.unobserve(t);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  /* .member est révélé via son conteneur : un élément entièrement masqué par clip-path ne déclenche pas l'observer */
  $$('[data-reveal], .stat, .sponsor, #teamGrid').forEach(function (n) { ro.observe(n); });

  /* ---------------------------------------------------------------------
     9. NAVIGATION — barre, progression, section active, menu mobile
     --------------------------------------------------------------------- */
  var nav = $('#nav'), progress = $('#progress');
  var burger = $('#burger'), menu = $('#menu');
  var links = $$('.nav__links a');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', !open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.classList.toggle('menu-open', open);
    if (open) setTimeout(function () { var a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 350);
    else burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu'); document.body.classList.remove('menu-open'); }); });
  document.addEventListener('keydown', function (e) {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') setMenu(false);
    if (e.key === 'Tab') {
      var f = [burger].concat($$('a', menu)), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', function (m) { if (m.matches && menu.classList.contains('is-open')) setMenu(false); });

  var sectionIds = ['hero', 'introduction', 'club', 'actions', 'team', 'partners', 'impact', 'vision', 'contact'];
  var so = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      links.forEach(function (l) { l.classList.toggle('is-active', l.dataset.nav.split(' ').indexOf(id) > -1); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sectionIds.forEach(function (id) { var n = document.getElementById(id); if (n) so.observe(n); });

  /* ---------------------------------------------------------------------
     10. SCROLL STORYTELLING — un seul rAF, lectures puis écritures
     --------------------------------------------------------------------- */
  var chain = $('#chain'), clubStage = $('.club__stage'), clubPhoto = $('#clubPhoto');
  var vision = $('#vision');
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset, vh = window.innerHeight;
    var doc = document.documentElement.scrollHeight - vh;

    nav.classList.toggle('is-scrolled', y > 40);
    progress.style.transform = 'scaleX(' + (doc > 0 ? clamp(y / doc, 0, 1) : 0).toFixed(4) + ')';

    if (reduce) return;

    /* Hero → section suivante : le média se réduit, le texte remonte */
    var hp = clamp(y / Math.max(1, hero.offsetHeight - vh), 0, 1);
    hero.style.setProperty('--p', hp.toFixed(4));

    /* Chaîne Rotary → Interact → ICRM : le trait se dessine */
    var cr = chain.getBoundingClientRect();
    chain.style.setProperty('--line', clamp((vh * 0.62 - cr.top) / cr.height, 0, 1).toFixed(4));

    /* Photo du club : le masque s'ouvre jusqu'au plein cadre */
    var pr = clubPhoto.getBoundingClientRect();
    var t = clamp((vh - pr.top) / (vh * 0.95), 0, 1);
    var e = 1 - Math.pow(1 - t, 3);
    clubStage.style.setProperty('--ci', ((1 - e) * 14).toFixed(2) + '%');

    /* Vision : texte révélé mot à mot + anneau qui s'ouvre vers l'avenir */
    var vr = vision.getBoundingClientRect();
    var vp = clamp(-vr.top / Math.max(1, vr.height - vh), 0, 1);
    vision.style.setProperty('--v', vp.toFixed(4));
    var lit = Math.round(clamp((vp - 0.12) / 0.6, 0, 1) * wEls.length);
    for (var i = 0; i < wEls.length; i++) wEls[i].classList.toggle('on', i < lit);
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);
  if (reduce) { wEls.forEach(function (w) { w.classList.add('on'); }); }
  frame();

  /* Les ancres du menu pendant un hero « sticky » : on atterrit proprement */
  window.addEventListener('load', function () { frame(); onRail(); });
})();
