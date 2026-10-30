/* ICRM — véritables notifications Web Push (aucune clé privée dans le navigateur). */
(function () {
  'use strict';
  var P = window.ICRMPortal;
  var selectors = {
    status: '[data-push-status]', enable: '[data-push-enable]', disable: '[data-push-disable]'
  };
  var busy = false;

  function publicKey() {
    var cfg = window.ICRM_PUSH_CONFIG || {};
    return typeof cfg.vapidPublicKey === 'string' ? cfg.vapidPublicKey.trim() : '';
  }
  function supported() {
    return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function status(root, message, kind) {
    var node = root && root.querySelector(selectors.status);
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind || 'info';
  }
  function buttons(root, enabling, disabling) {
    var a = root && root.querySelector(selectors.enable), b = root && root.querySelector(selectors.disable);
    if (a) { a.hidden = !enabling; a.disabled = busy || !enabling; }
    if (b) { b.hidden = !disabling; b.disabled = busy || !disabling; }
  }
  function toUint8Array(base64Url) {
    var padding = '='.repeat((4 - base64Url.length % 4) % 4);
    var base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function subscriptionPayload(subscription) {
    var j = subscription && subscription.toJSON ? subscription.toJSON() : null;
    if (!j || !j.endpoint || !j.keys || !j.keys.p256dh || !j.keys.auth) {
      throw new Error('Le navigateur n’a pas fourni une inscription de notification valide.');
    }
    return {
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      deviceName: (navigator.userAgent || 'Navigateur').slice(0, 180)
    };
  }
  function deviceRegistration() {
    return navigator.serviceWorker.ready.then(function (registration) {
      if (!registration.pushManager) throw new Error('Ce navigateur ne prend pas en charge les notifications Push.');
      return registration.pushManager.getSubscription().then(function (sub) {
        return { registration: registration, subscription: sub };
      });
    });
  }
  function errorText(error) {
    var message = String(error && (error.message || error.code) || '');
    if (/401|403|42501|permission|forbidden|not allowed/i.test(message)) return 'Supabase a refusé l’inscription. Vérifie que la migration des notifications est appliquée sur le projet lié.';
    if (/network|fetch|failed to fetch|offline/i.test(message)) return 'Connexion impossible. Vérifie Internet puis réessaie.';
    if (/VAPID|applicationServerKey/i.test(message)) return 'La clé publique VAPID ne correspond pas à la configuration du serveur. Vérifie supabase/functions/.env et members/js/push-config.js.';
    return message || 'Activation impossible. Vérifie la configuration Supabase et réessaie.';
  }

  function refresh(root) {
    var a = root && root.querySelector(selectors.enable);
    var b = root && root.querySelector(selectors.disable);
    if (!root || !root.querySelector(selectors.status)) return Promise.resolve();
    if (P.api.isMock()) {
      status(root, 'Mode maquette : aucun Push réel ne sera envoyé.', 'warning');
      buttons(root, false, false);
      return Promise.resolve();
    }
    if (!supported()) {
      status(root, 'Les notifications Push ne sont pas disponibles dans ce navigateur ou cette page. Utilise HTTPS et un navigateur compatible.', 'warning');
      buttons(root, false, false);
      return Promise.resolve();
    }
    if (!/^[-_A-Za-z0-9]{80,100}$/.test(publicKey())) {
      status(root, 'Configuration incomplète : la clé publique VAPID n’est pas installée. Applique le guide administrateur.', 'warning');
      buttons(root, false, false);
      return Promise.resolve();
    }
    if (Notification.permission === 'denied') {
      status(root, 'Les notifications sont bloquées par le navigateur. Autorise-les dans les paramètres du site, puis recharge cette page.', 'warning');
      buttons(root, false, false);
      return Promise.resolve();
    }
    if (Notification.permission !== 'granted') {
      status(root, 'Les notifications ne sont pas encore autorisées sur cet appareil.', 'info');
      buttons(root, true, false);
      return Promise.resolve();
    }
    return deviceRegistration().then(function (state) {
      if (!state.subscription) {
        status(root, 'Autorisation accordée, mais cet appareil n’est pas encore abonné aux alertes.', 'info');
        buttons(root, true, false);
        return;
      }
      return P.api.savePushSubscription(subscriptionPayload(state.subscription)).then(function () {
        status(root, 'Notifications Push actives sur cet appareil. Les catégories ci-dessus déterminent les alertes reçues.', 'success');
        buttons(root, false, true);
      });
    }).catch(function (error) {
      status(root, errorText(error), 'error');
      buttons(root, true, false);
    });
  }

  function mount(root) {
    if (!root) return;
    var enable = root.querySelector(selectors.enable), disable = root.querySelector(selectors.disable);
    if (!enable && !disable) return;
    refresh(root);
    if (enable && enable.dataset.pushBound !== 'true') {
      enable.dataset.pushBound = 'true';
      enable.addEventListener('click', function () {
        if (busy) return;
        if (P.api.isMock()) { status(root, 'Le mode maquette ne peut pas activer les alertes réelles.', 'warning'); return; }
        if (!supported()) { status(root, 'Ce navigateur ne prend pas en charge le Push ou la page n’est pas en HTTPS.', 'warning'); return; }
        if (!/^[-_A-Za-z0-9]{80,100}$/.test(publicKey())) { status(root, 'Configuration VAPID incomplète. Suis le guide administrateur avant d’activer les alertes.', 'error'); return; }
        /* La demande de permission est lancée immédiatement depuis le geste utilisateur. */
        var permissionPromise = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
        busy = true; enable.disabled = true; if (disable) disable.disabled = true;
        status(root, 'Activation des notifications sur cet appareil…', 'info');
        permissionPromise.then(function (permission) {
          if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Autorisation refusée. Active les notifications dans les paramètres du navigateur.' : 'Autorisation non accordée.');
          return deviceRegistration().then(function (state) {
            if (state.subscription) return state.subscription;
            return state.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(publicKey()) });
          });
        }).then(function (subscription) {
          return P.api.savePushSubscription(subscriptionPayload(subscription));
        }).then(function () {
          status(root, 'Notifications Push activées et appareil enregistré. Tu recevras les types d’alertes activés ci-dessus.', 'success');
          buttons(root, false, true);
          if (P.ui && P.ui.toast) P.ui.toast('Notifications activées sur cet appareil.');
        }).catch(function (error) {
          status(root, errorText(error), 'error');
          buttons(root, true, false);
        }).finally(function () { busy = false; if (enable) enable.disabled = false; if (disable && !disable.hidden) disable.disabled = false; });
      });
    }
    if (disable && disable.dataset.pushBound !== 'true') {
      disable.dataset.pushBound = 'true';
      disable.addEventListener('click', function () {
        if (busy) return;
        busy = true; disable.disabled = true; if (enable) enable.disabled = true;
        status(root, 'Désactivation des notifications sur cet appareil…', 'info');
        deviceRegistration().then(function (state) {
          if (!state.subscription) return { state: state, removed: true };
          return P.api.removePushSubscription(state.subscription.endpoint).then(function () {
            return state.subscription.unsubscribe().then(function (removed) {
              if (!removed) throw new Error('Le navigateur n’a pas confirmé la désactivation.');
              return { state: state, removed: true };
            });
          });
        }).then(function () {
          status(root, 'Notifications désactivées sur cet appareil. Les préférences de catégories sont conservées.', 'success');
          buttons(root, true, false);
        }).catch(function (error) {
          status(root, errorText(error), 'error'); buttons(root, false, true);
        }).finally(function () { busy = false; if (enable) enable.disabled = false; if (disable) disable.disabled = false; });
      });
    }
  }

  P.notifications = { mount: mount, refresh: refresh };
})();
