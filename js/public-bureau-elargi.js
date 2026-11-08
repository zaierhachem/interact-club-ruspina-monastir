/* ICRM — Bureau élargi public.
   Même carte, même grille et même traitement des portraits que le Bureau exécutif.
   Les données restent publiques et limitées aux noms, intitulés, commissions et portraits. */
(function () {
  'use strict';
  var PROJECT_URL = 'https://izxhzmllfdbbvlyoeifz.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_jpQqgCWB6BcbOKKo4XtbsA_KaurghnW';
  var ENDPOINT = PROJECT_URL + '/rest/v1/rpc/get_public_commission_leadership';
  var target = document.getElementById('bureauElargiGrid');
  var inFlight = false;
  if (!target) return;

  function safePhoto(value) {
    var url = String(value || '').trim();
    if (/^https:\/\//i.test(url)) return url;
    if (/^\/?assets\/[a-z0-9_./-]+$/i.test(url) && !/(^|\/)\.\.(\/|$)/.test(url)) return url;
    return '';
  }

  function fallbackPhoto(name) {
    var wanted = String(name || '').trim().toLocaleLowerCase('fr');
    var team = window.SITE && Array.isArray(window.SITE.TEAM) ? window.SITE.TEAM : [];
    var match = team.filter(function (person) {
      return String(person.name || '').trim().toLocaleLowerCase('fr') === wanted;
    })[0];
    return match && safePhoto(match.photo) ? safePhoto(match.photo) : '';
  }

  function makeCard(leader, index) {
    var name = String(leader.name || '').trim();
    var role = String(leader.role || 'Responsable').trim();
    var photo = safePhoto(leader.photo) || fallbackPhoto(name);
    var item = document.createElement('li');
    item.className = 'member in';
    item.style.setProperty('--i', String(index));

    var picture = document.createElement('div');
    picture.className = 'member__photo' + (photo ? '' : ' is-ph');
    if (photo) {
      var image = document.createElement('img');
      image.src = photo;
      image.alt = 'Portrait de ' + (name || 'un responsable de commission');
      image.loading = 'lazy';
      image.width = 640;
      image.height = 800;
      picture.appendChild(image);
    } else {
      picture.setAttribute('role', 'img');
      picture.setAttribute('aria-label', 'Photo de ' + (name || 'responsable') + ' à venir');
      var placeholder = document.createElement('img');
      placeholder.className = 'ph-logo';
      placeholder.src = window.SITE && window.SITE.MEDIA ? window.SITE.MEDIA.INTERACT_LOGO_WHITE : '';
      placeholder.alt = '';
      placeholder.width = 34;
      placeholder.height = 34;
      picture.appendChild(placeholder);
    }

    var info = document.createElement('div');
    info.className = 'member__info';
    var heading = document.createElement('h3');
    heading.className = 'member__name' + (name ? '' : ' is-ph');
    heading.textContent = name || 'Nom à renseigner';
    var position = document.createElement('p');
    position.className = 'member__role' + (role ? '' : ' is-ph');
    position.textContent = role;
    info.appendChild(heading);
    info.appendChild(position);
    item.appendChild(picture);
    item.appendChild(info);
    return item;
  }

  function emptyItem(text) {
    var item = document.createElement('p');
    item.className = 'team__empty';
    item.textContent = text;
    return item;
  }

  function makeCommissionGroup(commission, commissionIndex, cardIndex) {
    var leaders = Array.isArray(commission && commission.leaders)
      ? commission.leaders.filter(function (leader) { return leader && typeof leader === 'object'; })
      : [];
    if (!leaders.length) return null;

    var name = String(commission.name || 'Commission').trim() || 'Commission';
    var section = document.createElement('section');
    section.className = 'bureau-elargi__commission';
    section.setAttribute('aria-labelledby', 'bureau-elargi-commission-' + commissionIndex);

    var header = document.createElement('header');
    header.className = 'bureau-elargi__commission-head';
    var title = document.createElement('h3');
    title.className = 'bureau-elargi__commission-title';
    title.id = 'bureau-elargi-commission-' + commissionIndex;
    title.textContent = name;
    var count = document.createElement('span');
    count.className = 'bureau-elargi__commission-count';
    count.textContent = leaders.length === 1 ? '1 responsable' : leaders.length + ' responsables';
    header.appendChild(title);
    header.appendChild(count);

    var grid = document.createElement('ul');
    grid.className = 'team__grid bureau-elargi__commission-grid';
    leaders.forEach(function (leader) {
      grid.appendChild(makeCard(leader, cardIndex.value++));
    });
    section.appendChild(header);
    section.appendChild(grid);
    return section;
  }

  async function refresh() {
    if (inFlight || document.visibilityState === 'hidden') return;
    inFlight = true;
    try {
      var response = await fetch(ENDPOINT, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: 'Bearer ' + PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (!response.ok) return;
      var data = await response.json();
      if (!data || data.published !== true || !Array.isArray(data.commissions)) return;

      var fragment = document.createDocumentFragment();
      var cardIndex = { value: 0 };
      var renderedGroups = 0;
      data.commissions.forEach(function (commission, commissionIndex) {
        if (!commission || typeof commission !== 'object') return;
        var group = makeCommissionGroup(commission, commissionIndex + 1, cardIndex);
        if (!group) return;
        fragment.appendChild(group);
        renderedGroups++;
      });
      if (!renderedGroups) {
        fragment.appendChild(emptyItem('La composition du Bureau élargi sera publiée prochainement.'));
      }
      target.replaceChildren(fragment);
    } catch (_) {
      // Préserver le dernier rendu et ne jamais vider le contenu de secours sur une erreur réseau.
    } finally {
      inFlight = false;
    }
  }

  refresh();
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refresh();
  });
  window.setInterval(refresh, 15000);
})();
