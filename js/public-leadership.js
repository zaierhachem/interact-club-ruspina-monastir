/* ICRM — Bureau exécutif public.
   Source unique : RPC get_public_club_leadership, alimentée par Mon équipe.
   L'ancienne composition codée en dur a été retirée : aucun roster obsolète
   ne doit réapparaître si la publication est désactivée ou l'API indisponible. */
(function () {
  'use strict';

  var INSTANCE_KEY = '__ICRM_PUBLIC_LEADERSHIP_SYNC__';
  if (window[INSTANCE_KEY]) return;
  window[INSTANCE_KEY] = true;

  var PROJECT_URL = 'https://izxhzmllfdbbvlyoeifz.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_jpQqgCWB6BcbOKKo4XtbsA_KaurghnW';
  var ENDPOINT = PROJECT_URL + '/rest/v1/rpc/get_public_club_leadership';
  var grid = document.getElementById('teamGrid');
  var inFlight = false;
  var lastRenderSignature = null;
  var hasRemoteState = false;
  if (!grid) return;

  function safePhoto(value) {
    var url = String(value || '').trim();
    if (/^https:\/\//i.test(url) || (/^\/?assets\/[a-z0-9_./-]+$/i.test(url) && !/(^|\/)\.\.(\/|$)/.test(url))) return url;
    return '';
  }
  function makeCard(member, index) {
    var name = String(member.name || '').trim();
    var role = String(member.role || '').trim();
    var photo = safePhoto(member.photo);
    var featured = member.featured === true || /président/i.test(role);
    var li = document.createElement('li');
    li.className = 'member' + (featured ? ' member--lead' : '') + ' in';
    li.style.setProperty('--i', String(index));

    var picture = document.createElement('div');
    picture.className = 'member__photo' + (photo ? '' : ' is-ph');
    if (!photo) {
      picture.setAttribute('role', 'img');
      picture.setAttribute('aria-label', 'Photo de ' + (name || 'membre') + ' à venir');
      var placeholder = document.createElement('img');
      placeholder.className = 'ph-logo';
      placeholder.src = window.SITE && window.SITE.MEDIA ? window.SITE.MEDIA.INTERACT_LOGO_WHITE : '';
      placeholder.alt = '';
      placeholder.width = 34;
      placeholder.height = 34;
      picture.appendChild(placeholder);
    } else {
      var img = document.createElement('img');
      img.src = photo;
      img.alt = 'Portrait de ' + (name || 'un membre du Bureau');
      img.loading = 'lazy';
      img.width = 640;
      img.height = 800;
      picture.appendChild(img);
    }

    var info = document.createElement('div');
    info.className = 'member__info';
    var heading = document.createElement('h3');
    heading.className = 'member__name' + (name ? '' : ' is-ph');
    heading.textContent = name || 'Nom à renseigner';
    var position = document.createElement('p');
    position.className = 'member__role' + (role ? '' : ' is-ph');
    position.textContent = role || 'Fonction';
    info.appendChild(heading);
    info.appendChild(position);
    li.appendChild(picture);
    li.appendChild(info);
    return li;
  }
  function renderStatus(message, signature) {
    if (signature === lastRenderSignature) return;
    var item = document.createElement('li');
    item.className = 'team__empty';
    item.setAttribute('role', 'status');
    item.textContent = message;
    var fragment = document.createDocumentFragment();
    fragment.appendChild(item);
    grid.replaceChildren(fragment);
    lastRenderSignature = signature;
  }
  function renderRoster(members) {
    var signature = JSON.stringify(members);
    if (signature === lastRenderSignature) return;
    var fragment = document.createDocumentFragment();
    members.forEach(function (member, index) {
      if (member && typeof member === 'object') fragment.appendChild(makeCard(member, index));
    });
    if (!fragment.childNodes.length) {
      renderStatus('Aucun membre du Bureau exécutif n’est actuellement publié.', '__empty_published_roster__');
      return;
    }
    grid.replaceChildren(fragment);
    lastRenderSignature = signature;
  }

  async function synchronize() {
    if (inFlight || document.visibilityState === 'hidden') return;
    inFlight = true;
    try {
      var response = await fetch(ENDPOINT, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          /* A publishable key is an API key, not a JWT/Bearer token. */
          apikey: PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: '{}'
      });
      if (!response.ok) throw new Error('Public roster unavailable (' + response.status + ')');
      var data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid public roster response');
      hasRemoteState = true;
      if (data.published !== true) {
        renderStatus('La composition du Bureau exécutif n’est pas encore publiée.', '__not_published__');
        return;
      }
      if (!Array.isArray(data.members)) throw new Error('Invalid public roster members');
      renderRoster(data.members);
    } catch (_) {
      /* Keep the last published roster if available; never resurrect hard-coded members. */
      if (!hasRemoteState) renderStatus('La composition du Bureau exécutif est momentanément indisponible.', '__unavailable__');
    } finally {
      inFlight = false;
    }
  }

  function boot() {
    if (window[INSTANCE_KEY + '_BOOTED']) return;
    window[INSTANCE_KEY + '_BOOTED'] = true;
    synchronize();
    window.addEventListener('focus', synchronize);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') synchronize();
    });
    window.setInterval(synchronize, 15000);
  }

  var contentReady = window.SITE_CONTENT_READY;
  if (contentReady && typeof contentReady.then === 'function') contentReady.then(boot, boot);
  else boot();
})();
