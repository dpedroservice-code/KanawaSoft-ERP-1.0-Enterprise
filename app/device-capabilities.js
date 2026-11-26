/* Kanawa Soft — permissões explícitas de dispositivo.
 * A localização só é solicitada quando uma função GPS a invoca.
 * Notificações locais/push exigem consentimento do utilizador.
 */
(function () {
  'use strict';
  const api = {
    notificationSupported: function () {
      return 'Notification' in window && 'serviceWorker' in navigator;
    },
    async requestNotifications: async function () {
      if (!api.notificationSupported()) throw new Error('Este navegador não suporta notificações. Actualize o navegador ou instale a aplicação.');
      if (!window.isSecureContext) throw new Error('As notificações exigem uma ligação segura HTTPS.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('A permissão para notificações não foi concedida. Pode activá-la nas definições do dispositivo.');
      return permission;
    },
    async notify: async function (title, options) {
      const permission = Notification.permission;
      if (permission !== 'granted') throw new Error('Active primeiro as notificações nas permissões do Kanawa Soft.');
      const registration = await navigator.serviceWorker.ready;
      return registration.showNotification(String(title || 'Kanawa Soft'), Object.assign({
        body: 'Tem uma nova notificação.',
        icon: './logo.png',
        badge: './logo.png',
        tag: 'kanawa-soft-alert',
        renotify: false
      }, options || {}));
    },
    requestLocation: function (options) {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) return reject(new Error('Este dispositivo não disponibiliza GPS.'));
        navigator.geolocation.getCurrentPosition(resolve, function (error) {
          const messages = {
            1: 'Permita a localização nas definições do dispositivo para utilizar o GPS.',
            2: 'Não foi possível determinar a localização. Verifique o GPS e a internet.',
            3: 'A localização demorou demasiado tempo. Tente novamente.'
          };
          reject(new Error(messages[error.code] || 'Não foi possível obter a localização.'));
        }, Object.assign({ enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }, options || {}));
      });
    },
    watchLocation: function (onPosition, onError, options) {
      if (!navigator.geolocation) throw new Error('Este dispositivo não disponibiliza GPS.');
      return navigator.geolocation.watchPosition(onPosition, onError, Object.assign({
        enableHighAccuracy: true, maximumAge: 3000, timeout: 20000
      }, options || {}));
    },
    stopWatchingLocation: function (watchId) {
      if (navigator.geolocation && Number.isInteger(watchId)) navigator.geolocation.clearWatch(watchId);
    }
  };
  window.KanawaDeviceCapabilities = Object.freeze(api);
  window.addEventListener('kanawa:request-notifications', function () {
    api.requestNotifications().then(function () {
      if (typeof window.toast === 'function') window.toast('Notificações autorizadas neste dispositivo.', 'success');
    }).catch(function (error) {
      if (typeof window.toast === 'function') window.toast(error.message, 'warning');
    });
  });
  window.addEventListener('kanawa:request-location', function () {
    api.requestLocation().then(function (position) {
      window.dispatchEvent(new CustomEvent('kanawa:location-updated', { detail: position }));
    }).catch(function (error) {
      if (typeof window.toast === 'function') window.toast(error.message, 'warning');
    });
  });
})();