/* ICRM — Bureau élargi public. Données publiques limitées aux noms, fonctions et portraits. */
(function () {
  'use strict';
  var PROJECT_URL = 'https://izxhzmllfdbbvlyoeifz.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_jpQqgCWB6BcbOKKo4XtbsA_KaurghnW';
  var target = document.getElementById('bureauElargiGrid');
  if (!target) return;
  var endpoint = PROJECT_URL + '/rest/v1/rpc/get_public_commission_leadership';
  var busy = false;
  function safePhoto(value) {
    var s = String(value || '').trim();
    if (/^https:\/\//i.test(s)) return s;
    if (/^\/?assets\/[a-z0-9_./-]+$/i.test(s) && !/(^|\/)\.\.(\/|$)/.test(s)) return s;
    return '';
  }
  function card(commission) {
    var article = document.createElement('article');
    article.className = 'icrm-public-wide-card';
    var title = document.createElement('h3');
    title.className = 'icrm-public-wide-card__title';
    title.textContent = String(commission.name || 'Commission');
    article.appendChild(title);
    (Array.isArray(commission.leaders) ? commission.leaders : []).forEach(function (leader) {
      var row = document.createElement('div'); row.className = 'icrm-public-wide-person';
      var photo = safePhoto(leader.photo);
      if (photo) {
        var img = document.createElement('img'); img.src = photo; img.alt = 'Portrait de ' + String(leader.name || 'un responsable de commission'); img.loading = 'lazy'; row.appendChild(img);
      } else {
        var avatar = document.createElement('span'); avatar.className = 'icrm-public-wide-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = String(leader.name || 'M').trim().charAt(0).toUpperCase(); row.appendChild(avatar);
      }
      var info = document.createElement('span'); info.className = 'icrm-public-wide-person__info';
      var name = document.createElement('strong'); name.className = 'icrm-public-wide-person__name'; name.textContent = String(leader.name || 'Membre');
      var role = document.createElement('span'); role.className = 'icrm-public-wide-person__role'; role.textContent = String(leader.role || 'Responsable');
      info.appendChild(name); info.appendChild(role); row.appendChild(info); article.appendChild(row);
    });
    return article;
  }
  async function refresh() {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      var response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: {
        apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + PUBLISHABLE_KEY, 'Content-Type': 'application/json'
      }, body: '{}' });
      if (!response.ok) return;
      var data = await response.json();
      if (!data || typeof data !== 'object') return;
      if (data.published !== true) {
        var pending = document.createElement('p');
        pending.className = 'team__empty';
        pending.textContent = 'La composition du Bureau élargi sera publiée prochainement.';
        target.replaceChildren(pending);
        return;
      }
      if (!Array.isArray(data.commissions)) return;
      var fragment = document.createDocumentFragment();
      data.commissions.forEach(function (item) { if (item && Array.isArray(item.leaders) && item.leaders.length) fragment.appendChild(card(item)); });
      if (!fragment.childNodes.length) {
        var empty = document.createElement('p'); empty.className = 'team__empty'; empty.textContent = 'La composition du Bureau élargi sera publiée prochainement.'; fragment.appendChild(empty);
      }
      target.replaceChildren(fragment);
    } catch (_) { /* Conserver le contenu de secours si le réseau est indisponible. */ }
    finally { busy = false; }
  }
  refresh(); window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });
  window.setInterval(refresh, 15000);
})();
