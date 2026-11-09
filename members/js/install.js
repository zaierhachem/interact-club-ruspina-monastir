/* ICRM MEMBERS · Installation PWA multiplateforme.
   Android/Chrome : ouvre directement le prompt natif si le navigateur le fournit.
   iOS et autres navigateurs sans prompt : affiche une aide courte, car le site ne
   peut pas imposer l'ajout à l'écran d'accueil ni télécharger une app native. */
(function () {
  'use strict';

  var deferredPrompt = null;
  var installed = false;
  var lastInstallButton = null;
  var sectionsSelector = '[data-install-section]';
  var buttonSelector = '[data-install-app]';
  var helpSelector = '[data-install-help]';

  function isIOS() {
    var ua = navigator.userAgent || '';
    var classicIOS = /iPad|iPhone|iPod/.test(ua);
    var ipadOS = navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
    return classicIOS || ipadOS;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isStandalone() {
    var displayMode = false;
    try { displayMode = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
    catch (_) { displayMode = false; }
    return displayMode || navigator.standalone === true || installed;
  }

  function buttonLabel() {
    if (isIOS() && !deferredPrompt) return 'Ajouter à l’écran d’accueil';
    return 'Installer l’application';
  }

  function update(root) {
    var scope = root || document;
    var sections = scope.querySelectorAll ? scope.querySelectorAll(sectionsSelector) : [];
    var unavailable = isStandalone();
    Array.prototype.forEach.call(sections, function (section) {
      var button = section.querySelector(buttonSelector);
      section.hidden = unavailable;
      if (button) {
        button.hidden = unavailable;
        button.disabled = unavailable;
        button.textContent = buttonLabel();
        button.setAttribute('aria-label', buttonLabel());
      }
    });
  }

  function setHelpContent(config) {
    var dialog = document.querySelector(helpSelector);
    if (!dialog) return false;
    var title = dialog.querySelector('[data-install-help-title]');
    var intro = dialog.querySelector('[data-install-help-intro]');
    var note = dialog.querySelector('[data-install-help-note]');
    var steps = dialog.querySelectorAll('[data-install-help-step]');
    if (title) title.textContent = config.title;
    if (intro) intro.textContent = config.intro;
    Array.prototype.forEach.call(steps, function (step, index) {
      step.textContent = config.steps[index] || '';
      step.hidden = !config.steps[index];
    });
    if (note) {
      note.textContent = config.note || '';
      note.hidden = !config.note;
    }
    return true;
  }

  function helpForCurrentPlatform() {
    if (isIOS()) {
      return {
        title: 'Ajouter ICRM à votre écran d’accueil',
        intro: 'iOS ne permet pas à un site de lancer automatiquement cette action. Utilisez le menu natif du navigateur :',
        steps: [
          'Ouvrez le menu Partager de votre navigateur.',
          'Choisissez « Sur l’écran d’accueil » ou « Ajouter à l’écran d’accueil ».',
          'Confirmez en touchant « Ajouter ».'
        ],
        note: 'Si cette option n’apparaît pas, ouvrez cette page dans Safari puis réessayez.'
      };
    }
    if (isAndroid()) {
      return {
        title: 'Installation directe indisponible',
        intro: 'Ce navigateur ne fournit pas encore le dialogue d’installation. Vous pouvez utiliser le menu du navigateur :',
        steps: [
          'Dans Chrome, ouvrez le menu ⋮ en haut à droite.',
          'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
          'Confirmez l’installation.'
        ],
        note: 'Pour le dialogue direct, ouvrez le portail dans Chrome à jour et vérifiez que la page est chargée en HTTPS.'
      };
    }
    return {
      title: 'Installer ICRM sur votre téléphone',
      intro: 'Ce navigateur ne propose pas l’installation directe ici. Ouvrez le portail sur votre téléphone pour l’ajouter à l’écran d’accueil.',
      steps: [
        'Sur Android, utilisez le menu du navigateur puis « Installer l’application ».',
        'Sur iPhone ou iPad, ouvrez le menu Partager puis « Ajouter à l’écran d’accueil ».',
        'Confirmez l’ajout proposé par votre appareil.'
      ],
      note: 'Le site doit être accessible en HTTPS.'
    };
  }

  function openHelp(button) {
    var dialog = document.querySelector(helpSelector);
    if (!dialog || !setHelpContent(helpForCurrentPlatform())) return;
    lastInstallButton = button || lastInstallButton;
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      var closeButton = dialog.querySelector('[data-install-help-close]');
      if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
    } catch (_) {
      /* Repli accessible si le navigateur ne prend pas en charge showModal(). */
      dialog.setAttribute('open', '');
    }
  }

  function closeHelp() {
    var dialog = document.querySelector(helpSelector);
    if (dialog) {
      try {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      } catch (_) { dialog.removeAttribute('open'); }
    }
    if (lastInstallButton && typeof lastInstallButton.focus === 'function') lastInstallButton.focus();
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).toString(), {
      scope: new URL('.', document.baseURI).pathname
    }).catch(function () {
      /* L'application reste utilisable en ligne même si l'enregistrement échoue. */
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    if (isStandalone()) return;
    event.preventDefault();
    deferredPrompt = event;
    update();
  });

  window.addEventListener('appinstalled', function () {
    installed = true;
    deferredPrompt = null;
    update();
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    var closeButton = target && target.closest ? target.closest('[data-install-help-close]') : null;
    if (closeButton) {
      closeHelp();
      return;
    }

    var button = target && target.closest ? target.closest(buttonSelector) : null;
    if (!button || button.disabled || isStandalone()) return;

    lastInstallButton = button;
    if (!deferredPrompt) {
      openHelp(button);
      return;
    }

    /* IMPORTANT : appeler prompt() tout de suite pendant le clic utilisateur. */
    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    button.disabled = true;
    button.textContent = 'Ouverture de l’installation…';
    var promptResult;
    try {
      promptResult = promptEvent.prompt();
    } catch (_) {
      button.disabled = false;
      update();
      openHelp(button);
      return;
    }

    Promise.resolve(promptEvent.userChoice || promptResult).then(function (choice) {
      if (choice && choice.outcome === 'accepted') installed = true;
      update();
    }).catch(function () {
      update();
    });
  });

  window.ICRMInstall = {
    refresh: update,
    isInstalled: isStandalone,
    isPromptAvailable: function () { return !!deferredPrompt && !isStandalone(); },
    isIOS: isIOS
  };

  registerWorker();
  update();
})();
