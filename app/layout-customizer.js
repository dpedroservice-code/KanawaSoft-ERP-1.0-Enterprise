/* Kanawa Soft ERP — personalização de layout e densidade, isolada da lógica de negócio. */
(function () {
  'use strict';
  if (window.__kanawaLayoutCustomizerInstalled) return;
  window.__kanawaLayoutCustomizerInstalled = true;

  const STORAGE_PREFIX = 'kanawa_layout_preferences_v1';
  const VALID_LAYOUTS = ['mode-classic', 'mode-compact', 'mode-floating', 'mode-hidden'];
  const DEFAULTS = { layout: 'mode-classic', iconSize: 'normal' };
  let preferences = Object.assign({}, DEFAULTS);
  let modal;
  let menuToggle;
  let backdrop;

  function userStorageKey() {
    const user = window.KanawaCloud && window.KanawaCloud.context && window.KanawaCloud.context.user;
    return STORAGE_PREFIX + ':' + String(user && user.id || 'local');
  }

  function loadPreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(userStorageKey()) || '{}');
      return {
        layout: VALID_LAYOUTS.includes(stored.layout) ? stored.layout : DEFAULTS.layout,
        iconSize: stored.iconSize === 'large' ? 'large' : 'normal'
      };
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function persistPreferences() {
    try { localStorage.setItem(userStorageKey(), JSON.stringify(preferences)); }
    catch (error) { console.warn('[Kanawa Layout] Não foi possível guardar as preferências neste navegador.', error); }
  }

  function appRoot() { return document.getElementById('app'); }

  function applyPreferences() {
    const root = appRoot();
    document.documentElement.setAttribute('data-kanawa-layout', preferences.layout);
    document.documentElement.setAttribute('data-kanawa-icon-size', preferences.iconSize);
    if (root) {
      root.classList.toggle('kanawa-menu-open', preferences.layout === 'mode-hidden' && root.classList.contains('kanawa-menu-open'));
      root.classList.toggle('kanawa-layout-hidden-open', preferences.layout === 'mode-hidden' && root.classList.contains('kanawa-menu-open'));
    }
    if (menuToggle) {
      menuToggle.hidden = preferences.layout !== 'mode-hidden';
      menuToggle.setAttribute('aria-expanded', root && root.classList.contains('kanawa-menu-open') ? 'true' : 'false');
    }
    if (backdrop) backdrop.hidden = !(preferences.layout === 'mode-hidden' && root && root.classList.contains('kanawa-menu-open'));
    updateModalSelection();
  }

  function setLayout(layout) {
    if (!VALID_LAYOUTS.includes(layout)) return;
    preferences.layout = layout;
    persistPreferences();
    if (layout !== 'mode-hidden') closeHiddenMenu();
    applyPreferences();
  }

  function setIconSize(size) {
    preferences.iconSize = size === 'large' ? 'large' : 'normal';
    persistPreferences();
    applyPreferences();
  }

  function closeHiddenMenu() {
    const root = appRoot();
    if (root) {
      root.classList.remove('kanawa-menu-open', 'kanawa-layout-hidden-open');
    }
    applyPreferences();
  }

  function toggleHiddenMenu() {
    const root = appRoot();
    if (!root || preferences.layout !== 'mode-hidden') return;
    root.classList.toggle('kanawa-menu-open');
    root.classList.toggle('kanawa-layout-hidden-open', root.classList.contains('kanawa-menu-open'));
    applyPreferences();
  }

  const layoutOptions = [
    { id: 'mode-classic', icon: 'fa-table-columns', title: 'Clássico Fixo', description: 'Menu lateral de 240 px, com categorias e módulos sempre visíveis.' },
    { id: 'mode-compact', icon: 'fa-compress-alt', title: 'Ultra-Compacto', description: 'Barra lateral de 72 px, apenas ícones; módulos abrem num painel lateral.' },
    { id: 'mode-floating', icon: 'fa-window-restore', title: 'Janelas Livres', description: 'Menu superior e módulos em janelas móveis, redimensionáveis e sobrepostas.' },
    { id: 'mode-hidden', icon: 'fa-eye-slash', title: 'Foco Total / Minimal', description: 'Menu oculto; abra-o pelo botão Menu quando precisar.' }
  ];

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'kanawa-layout-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'kanawaLayoutTitle');
    modal.innerHTML =
      '<div class="kanawa-layout-dialog">' +
        '<header class="kanawa-layout-dialog-head"><div><span class="kanawa-layout-kicker">APARÊNCIA E PRODUTIVIDADE</span><h2 id="kanawaLayoutTitle">Personalizar Tema</h2><p>Escolha como pretende organizar a área de trabalho.</p></div><button type="button" class="kanawa-layout-close" aria-label="Fechar">×</button></header>' +
        '<section class="kanawa-layout-section"><h3>Modo de visualização</h3><div class="kanawa-layout-options">' +
          layoutOptions.map(option =>
            '<button type="button" class="kanawa-layout-option" data-layout="' + option.id + '" aria-pressed="false">' +
              '<span class="kanawa-layout-option-icon"><i class="fas ' + option.icon + '" aria-hidden="true"></i></span>' +
              '<span class="kanawa-layout-option-copy"><strong>' + option.title + '</strong><small>' + option.description + '</small></span>' +
              '<i class="fas fa-check-circle kanawa-layout-option-check" aria-hidden="true"></i>' +
            '</button>'
          ).join('') +
        '</div></section>' +
        '<section class="kanawa-layout-section"><h3>Tamanho dos ícones</h3><div class="kanawa-layout-size-options">' +
          '<button type="button" data-icon-size="normal" aria-pressed="false"><i class="fas fa-icons" aria-hidden="true"></i><span>Normal · 18 px</span></button>' +
          '<button type="button" data-icon-size="large" aria-pressed="false"><i class="fas fa-icons" aria-hidden="true"></i><span>Grande · 24 px</span></button>' +
        '</div></section>' +
        '<footer class="kanawa-layout-dialog-foot"><span>As preferências são guardadas neste utilizador e navegador.</span><button type="button" class="kanawa-layout-done">Concluir</button></footer>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.kanawa-layout-close') || event.target.closest('.kanawa-layout-done')) closeModal();
      const layoutButton = event.target.closest('[data-layout]');
      if (layoutButton) setLayout(layoutButton.getAttribute('data-layout'));
      const sizeButton = event.target.closest('[data-icon-size]');
      if (sizeButton) setIconSize(sizeButton.getAttribute('data-icon-size'));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });
    return modal;
  }

  function updateModalSelection() {
    if (!modal) return;
    modal.querySelectorAll('[data-layout]').forEach(button => {
      const selected = button.getAttribute('data-layout') === preferences.layout;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-icon-size]').forEach(button => {
      const selected = button.getAttribute('data-icon-size') === preferences.iconSize;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function openModal() {
    ensureModal().hidden = false;
    updateModalSelection();
    const close = modal.querySelector('.kanawa-layout-close');
    if (close) close.focus();
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  function addControls() {
    const right = document.querySelector('#app .topbar-right');
    if (!right) return;
    if (!document.getElementById('kanawaLayoutCustomizerButton')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'kanawaLayoutCustomizerButton';
      button.className = 'topbar-btn kanawa-layout-customizer-button';
      button.title = 'Personalizar o layout e os ícones';
      button.setAttribute('aria-label', 'Personalizar Tema');
      button.innerHTML = '<i class="fas fa-sliders-h" aria-hidden="true"></i><span>Personalizar Tema</span>';
      button.addEventListener('click', openModal);
      const themeButton = right.querySelector('.theme-picker-btn');
      if (themeButton && themeButton.nextSibling) right.insertBefore(button, themeButton.nextSibling);
      else right.appendChild(button);
    }

    if (!document.getElementById('kanawaMenuToggle')) {
      menuToggle = document.createElement('button');
      menuToggle.type = 'button';
      menuToggle.id = 'kanawaMenuToggle';
      menuToggle.className = 'topbar-btn kanawa-menu-toggle';
      menuToggle.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i><span>Menu</span>';
      menuToggle.addEventListener('click', toggleHiddenMenu);
      const search = right.querySelector('.topbar-user');
      if (search && search.nextSibling) right.insertBefore(menuToggle, search.nextSibling);
      else right.appendChild(menuToggle);
    } else menuToggle = document.getElementById('kanawaMenuToggle');

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.dataset.kanawaCompactPanelBound) {
      sidebar.dataset.kanawaCompactPanelBound = '1';
      sidebar.addEventListener('click', event => {
        if (preferences.layout !== 'mode-compact') return;
        if (event.target.closest('.mega-menu-tab')) sidebar.classList.add('kanawa-compact-panel-open');
        if (event.target.closest('.mega-menu-module')) sidebar.classList.remove('kanawa-compact-panel-open');
      });
      document.addEventListener('click', event => {
        if (!sidebar.contains(event.target)) sidebar.classList.remove('kanawa-compact-panel-open');
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') sidebar.classList.remove('kanawa-compact-panel-open');
      });
    }

    if (!document.getElementById('kanawaHiddenMenuBackdrop')) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'kanawaHiddenMenuBackdrop';
      backdrop.className = 'kanawa-hidden-menu-backdrop';
      backdrop.setAttribute('aria-label', 'Fechar menu');
      backdrop.addEventListener('click', closeHiddenMenu);
      const root = appRoot();
      if (root) root.appendChild(backdrop);
    } else backdrop = document.getElementById('kanawaHiddenMenuBackdrop');
  }

  function bindCloudContext() {
    const cloud = window.KanawaCloud;
    if (!cloud) return;
    ['init', 'signInWithPassword', 'verifyOtp', 'signUp', 'acceptInvitation', 'signOut'].forEach(method => {
      const original = cloud[method];
      if (typeof original !== 'function' || original.__kanawaLayoutWrapped) return;
      const wrapped = async function () {
        const result = await original.apply(this, arguments);
        preferences = loadPreferences();
        applyPreferences();
        return result;
      };
      wrapped.__kanawaLayoutWrapped = true;
      cloud[method] = wrapped;
    });
  }

  function init() {
    preferences = loadPreferences();
    addControls();
    bindCloudContext();
    window.addEventListener('load', () => {
      if (window.KanawaCloud && window.KanawaCloud.ready) {
        preferences = loadPreferences();
        applyPreferences();
      }
    }, { once: true });
    applyPreferences();
    window.addEventListener('storage', event => {
      if (event.key === userStorageKey()) {
        preferences = loadPreferences();
        applyPreferences();
      }
    });
    window.kanawaLayoutCustomizer = {
      getPreferences: () => Object.assign({}, preferences),
      setLayout,
      setIconSize,
      open: openModal
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();