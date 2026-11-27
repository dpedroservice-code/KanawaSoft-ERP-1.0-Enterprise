/* Instalação PWA Kanawa Soft — Android/Chromium e instruções para iOS. */
(function () {
  'use strict';
  let deferredPrompt = null;
  let installButton = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent || '') && !window.MSStream;

  function notify(message, type) {
    if (typeof window.toast === 'function') window.toast(message, type || 'info');
    else window.alert(message);
  }

  function ensureButton() {
    if (installButton || isStandalone()) return installButton;
    installButton = document.createElement('button');
    installButton.id = 'kanawaInstallApp';
    installButton.type = 'button';
    installButton.hidden = true;
    installButton.setAttribute('aria-label', 'Instalar Kanawa Soft no telefone');
    installButton.innerHTML = '<span aria-hidden="true">⬇</span><span>Instalar aplicação</span>';
    installButton.addEventListener('click', async function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installButton.hidden = true;
        if (choice && choice.outcome === 'accepted') notify('O Kanawa Soft foi aceite para instalação no dispositivo.', 'success');
        return;
      }
      if (isIOS()) {
        notify('Para instalar no iPhone: toque em Partilhar no Safari e escolha “Adicionar ao ecrã principal”.', 'info');
        return;
      }
      notify('Abra o menu do navegador e escolha “Instalar aplicação” ou “Adicionar ao ecrã principal”, se essa opção estiver disponível.', 'info');
    });
    document.body.appendChild(installButton);
    return installButton;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    const button = ensureButton();
    if (button) button.hidden = false;
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (installButton) installButton.hidden = true;
    notify('Kanawa Soft instalado com sucesso no dispositivo.', 'success');
  });

  document.addEventListener('DOMContentLoaded', function () {
    const button = ensureButton();
    if (button && (deferredPrompt || isIOS())) button.hidden = false;
  });
})();
