/* CipherShield — PWA install prompt + service worker registration */
(function () {
  'use strict';

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  // Install prompt
  var deferredPrompt = null;
  var banner  = document.getElementById('pwa-banner');
  var installBtn = document.getElementById('pwa-install-btn');
  var dismissBtn = document.getElementById('pwa-dismiss-btn');

  if (!banner || !installBtn || !dismissBtn) return;

  // Don't show if already dismissed
  if (localStorage.getItem('pwa-dismissed')) return;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.add('visible');
  });

  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      banner.classList.remove('visible');
    });
  });

  dismissBtn.addEventListener('click', function () {
    banner.classList.remove('visible');
    localStorage.setItem('pwa-dismissed', '1');
  });

  // Hide banner once installed
  window.addEventListener('appinstalled', function () {
    banner.classList.remove('visible');
  });
})();
