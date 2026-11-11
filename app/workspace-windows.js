/* Kanawa Soft ERP — Dockable Workspace / Floating Module Windows
 * Isolated progressive enhancement. Keeps the existing renderers and permissions.
 */
(function () {
  'use strict';

  if (window.__kanawaWorkspaceInstalled) return;
  window.__kanawaWorkspaceInstalled = true;

  const originalOpenModule = window.openModule;
  if (typeof originalOpenModule !== 'function') {
    console.warn('[Kanawa Workspace] openModule não encontrado; extensão não inicializada.');
    return;
  }

  const STORAGE_KEY = 'kanawa_workspace_layout_v1';
  const windows = new Map();
  const openingModules = new Set();
  let activeId = null;
  let zIndex = 20;
  let layer, grid, taskbar, parking, tabsBar;
  const nativeGetById = document.getElementById.bind(document);
  const nativeQuery = document.querySelector.bind(document);
  const nativeElementQuery = Element.prototype.querySelector;
  let resolvingScopedId = false;

  function activeRoot() {
    const state = activeId && windows.get(activeId);
    return state ? state.content : null;
  }

  // The ERP historically uses document.getElementById through its $() helper.
  // Resolve duplicate module IDs inside the focused window first.
  document.getElementById = function (id) {
    const root = activeRoot();
    if (!root) return nativeGetById(id);
    if (String(root.id) === String(id)) return root;
    // Some DOM shims/polyfills may resolve Element.querySelector through the document
    // lookup again. Fall back to the native document lookup on re-entry to avoid a
    // recursive selector loop and a browser "Maximum call stack size exceeded".
    if (resolvingScopedId) return nativeGetById(id);
    let found = null;
    resolvingScopedId = true;
    try {
      const escapedId = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\\"');
      found = nativeElementQuery.call(root, '[id="' + escapedId + '"]');
    } finally {
      resolvingScopedId = false;
    }
    if (found) return found;
    const globalFound = nativeGetById(id);
    // Never leak a missing element lookup into another inactive module window.
    if (globalFound && globalFound.closest && globalFound.closest('.kanawa-module-window')) return null;
    return globalFound;
  };

  // Scope simple #id selectors to the focused module; preserve global selectors.
  document.querySelector = function (selector) {
    const root = activeRoot();
    if (root && typeof selector === 'string' && /^#[A-Za-z_][\w-]*$/.test(selector)) {
      const found = document.getElementById(selector.slice(1));
      if (found) return found;
    }
    return nativeQuery(selector);
  };

  function layoutStorageKey() {
    const userId = window.KanawaCloud && window.KanawaCloud.context && window.KanawaCloud.context.user
      ? window.KanawaCloud.context.user.id : 'local';
    return STORAGE_KEY + ':' + String(userId || 'local');
  }
  function loadLayout() {
    const store = window.KanawaWorkspaceState;
    if (store && typeof store.getState === 'function') {
      const shared = store.getState();
      if (shared && shared.windows && Object.keys(shared.windows).length) return shared.windows;
    }
    try { return JSON.parse(localStorage.getItem(layoutStorageKey()) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function saveLayout() {
    const data = {};
    windows.forEach((state, id) => {
      data[id] = { x: state.x, y: state.y, width: state.width, height: state.height, docked: state.docked };
    });
    const store = window.KanawaWorkspaceState;
    if (store && typeof store.setWindowLayouts === 'function') {
      store.setWindowLayouts(data);
      return;
    }
    try { localStorage.setItem(layoutStorageKey(), JSON.stringify(data)); } catch (_) {}
  }
  let savedLayout = null;
  function getSavedLayout() {
    const store = window.KanawaWorkspaceState;
    if (store && typeof store.getState === 'function') {
      const shared = store.getState();
      if (shared && shared.windows) return shared.windows;
    }
    if (!savedLayout) savedLayout = loadLayout();
    return savedLayout;
  }

  function ensureLayer() {
    if (layer) return;
    const main = document.querySelector('#app .main-wrap') || document.querySelector('.main-wrap');
    const base = nativeGetById('content');
    if (!main || !base) return;
    base.classList.add('kanawa-base-content-hidden');

    layer = document.createElement('section');
    layer.id = 'kanawaWorkspaceLayer';
    layer.className = 'kanawa-workspace-layer';
    layer.setAttribute('aria-label', 'Área de trabalho modular');
    tabsBar = document.createElement('nav');
    tabsBar.className = 'kanawa-window-tabs';
    tabsBar.setAttribute('aria-label', 'Módulos abertos');
    grid = document.createElement('div');
    grid.className = 'kanawa-window-grid';
    taskbar = document.createElement('nav');
    taskbar.className = 'kanawa-window-taskbar';
    taskbar.setAttribute('aria-label', 'Janelas minimizadas');
    parking = document.createElement('div');
    parking.className = 'kanawa-window-parking';
    parking.setAttribute('aria-hidden', 'true');
    layer.append(tabsBar, grid, taskbar, parking);
    main.appendChild(layer);

    const sidebar = nativeGetById('sidebar');
    const updateOffset = () => {
      const height = sidebar && sidebar.offsetParent !== null ? sidebar.getBoundingClientRect().height : 0;
      layer.style.top = Math.max(0, Math.round(height)) + 'px';
    };
    updateOffset();
    if (window.ResizeObserver && sidebar) new ResizeObserver(updateOffset).observe(sidebar);
    window.addEventListener('resize', updateOffset, { passive: true });
  }

  function moduleMeta(id) {
    const menuItems = typeof MENU !== 'undefined' && Array.isArray(MENU) ? MENU : (Array.isArray(window.MENU) ? window.MENU : []);
    const item = menuItems.find(entry => entry.id === id) || null;
    return item || { id, label: String(id).replace(/[-_]/g, ' '), icon: 'fa-window-maximize' };
  }

  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  function setActive(id) {
    const state = windows.get(id);
    if (!state) return;
    activeId = id;
    currentModule = id;
    windows.forEach((item, key) => {
      item.frame.classList.toggle('is-active', key === id);
      if (item.docked) item.frame.hidden = key !== id || item.minimized;
      else item.frame.hidden = item.minimized;
      if (key === id) item.frame.style.zIndex = String(++zIndex);
    });
    renderTabs();
    if (typeof window.renderSidebar === 'function') {
      try { window.renderSidebar(); } catch (error) { console.debug('[Kanawa Workspace] sidebar focus:', error); }
    }
    renderTaskbar();
  }

  function renderTabs() {
    if (!tabsBar) return;
    tabsBar.replaceChildren();
    windows.forEach((state, id) => {
      if (state.minimized) return;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'kanawa-window-tab' + (id === activeId ? ' is-active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', id === activeId ? 'true' : 'false');
      tab.innerHTML = '<i class="fas ' + state.icon + '" aria-hidden="true"></i><span></span><small></small>';
      tab.querySelector('span').textContent = state.title;
      tab.querySelector('small').textContent = state.docked ? 'Fixado' : 'Flutuante';
      tab.title = 'Abrir ' + state.title;
      tab.addEventListener('click', () => focusWindow(id));
      tabsBar.appendChild(tab);
    });
    tabsBar.classList.toggle('is-empty', !tabsBar.children.length);
  }

  function renderTaskbar() {
    if (!taskbar) return;
    taskbar.replaceChildren();
    windows.forEach((state, id) => {
      if (!state.minimized) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kanawa-taskbar-item';
      button.innerHTML = '<i class="fas ' + state.icon + '" aria-hidden="true"></i><span></span>';
      button.querySelector('span').textContent = state.title;
      button.title = 'Restaurar ' + state.title;
      button.addEventListener('click', () => restoreWindow(id));
      taskbar.appendChild(button);
    });
    taskbar.classList.toggle('is-empty', !taskbar.children.length);
  }

  function updateFrameMode(state) {
    state.frame.classList.toggle('is-docked', state.docked);
    state.frame.classList.toggle('is-maximized', state.maximized);
    state.frame.classList.toggle('is-minimized', state.minimized);
    state.dockButton.setAttribute('aria-label', state.docked ? 'Transformar em janela flutuante' : 'Fixar como separador');
    state.dockButton.setAttribute('aria-pressed', state.docked ? 'true' : 'false');
    state.dockButton.title = state.docked ? 'Transformar em janela flutuante' : 'Fixar como separador';
    state.dockButton.innerHTML = '<i class="fas ' + (state.docked ? 'fa-up-right-and-down-left-from-center' : 'fa-thumbtack') + '"></i>';
    state.maxButton.title = state.maximized ? 'Restaurar tamanho' : 'Maximizar';
    state.maxButton.innerHTML = '<i class="fas ' + (state.maximized ? 'fa-compress' : 'fa-expand') + '"></i>';
    state.resizeHandle.hidden = state.docked || state.maximized;
    saveLayout();
  }

  function focusWindow(id) {
    const state = windows.get(id);
    if (!state) return;
    if (state.minimized) state.minimized = false;
    setActive(id);
    updateFrameMode(state);
    renderTaskbar();
  }

  function createWindow(id) {
    ensureLayer();
    if (!layer) throw new Error('Não foi possível iniciar a área de trabalho modular.');
    const meta = moduleMeta(id);
    const saved = getSavedLayout()[id] || {};
    const frame = document.createElement('section');
    frame.className = 'kanawa-module-window';
    frame.dataset.moduleId = id;
    frame.setAttribute('role', 'region');
    frame.setAttribute('aria-label', meta.label || id);

    const header = document.createElement('header');
    header.className = 'kanawa-window-header';
    const heading = document.createElement('div');
    heading.className = 'kanawa-window-heading';
    heading.innerHTML = '<i class="fas ' + (meta.icon || 'fa-window-maximize') + '" aria-hidden="true"></i><span></span>';
    heading.querySelector('span').textContent = meta.label || id;
    const controls = document.createElement('div');
    controls.className = 'kanawa-window-controls';

    const makeButton = (label, title, icon, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kanawa-window-control';
      button.setAttribute('aria-label', label);
      button.title = title;
      button.innerHTML = '<i class="fas ' + icon + '" aria-hidden="true"></i>';
      button.addEventListener('click', handler);
      controls.appendChild(button);
      return button;
    };

    const contentHost = document.createElement('main');
    contentHost.id = 'content';
    contentHost.className = 'content kanawa-window-content';
    contentHost.setAttribute('tabindex', '0');
    const resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'kanawa-window-resize';
    resizeHandle.setAttribute('aria-label', 'Redimensionar janela');
    resizeHandle.title = 'Arraste para redimensionar';

    const state = {
      id, title: meta.label || id, icon: meta.icon || 'fa-window-maximize',
      frame, header, content: contentHost, resizeHandle,
      x: Number.isFinite(saved.x) ? saved.x : 28 + (windows.size * 26),
      y: Number.isFinite(saved.y) ? saved.y : 24 + (windows.size * 22),
      width: Number.isFinite(saved.width) ? saved.width : Math.min(760, Math.max(420, Math.round(window.innerWidth * .62))),
      height: Number.isFinite(saved.height) ? saved.height : Math.min(620, Math.max(320, Math.round(window.innerHeight * .68))),
      docked: saved.docked !== false, maximized: false, minimized: false,
      previousRect: null, dockButton: null, maxButton: null
    };

    state.dockButton = makeButton('Fixar ou desafixar', 'Fixar no espaço de trabalho', 'fa-thumbtack', () => {
      state.docked = !state.docked;
      state.maximized = false;
      state.minimized = false;
      if (state.docked) {
        state.frame.style.left = '';
        state.frame.style.top = '';
        state.frame.style.width = '';
        state.frame.style.height = '';
      } else {
        state.x = clamp(state.x, 0, Math.max(0, grid.clientWidth - 340));
        state.y = clamp(state.y, 0, Math.max(0, grid.clientHeight - 240));
      }
      updateFrameMode(state);
      focusWindow(id);
    });
    makeButton('Minimizar', 'Minimizar para a barra de tarefas', 'fa-minus', () => minimizeWindow(id));
    state.maxButton = makeButton('Maximizar', 'Maximizar', 'fa-expand', () => {
      if (!state.maximized) {
        state.previousRect = { x: state.x, y: state.y, width: state.width, height: state.height };
        state.maximized = true;
        state.docked = false;
      } else {
        state.maximized = false;
        if (state.previousRect) Object.assign(state, state.previousRect);
      }
      updateFrameMode(state);
      applyGeometry(state);
      focusWindow(id);
    });
    makeButton('Fechar', 'Fechar módulo', 'fa-xmark', () => closeWindow(id));

    header.append(heading, controls);
    frame.append(header, contentHost, resizeHandle);
    grid.appendChild(frame);
    const emptyBase = nativeGetById('content');
    if (emptyBase && emptyBase !== contentHost) emptyBase.classList.add('kanawa-base-content-hidden');

    state.dockButton = controls.children[0];
    state.maxButton = controls.children[2];
    state.resizeHandle = resizeHandle;
    windows.set(id, state);
    renderTabs();
    bindDrag(state);
    bindResize(state);
    frame.addEventListener('pointerdown', () => focusWindow(id), { passive: true });
    updateFrameMode(state);
    applyGeometry(state);
    return state;
  }

  function applyGeometry(state) {
    if (state.docked || state.minimized) return;
    const maxW = Math.max(320, grid.clientWidth);
    const maxH = Math.max(240, grid.clientHeight);
    state.width = clamp(state.width, 320, maxW);
    state.height = clamp(state.height, 220, maxH);
    state.x = clamp(state.x, 0, Math.max(0, maxW - state.width));
    state.y = clamp(state.y, 0, Math.max(0, maxH - state.height));
    state.frame.style.left = state.x + 'px';
    state.frame.style.top = state.y + 'px';
    state.frame.style.width = state.width + 'px';
    state.frame.style.height = state.height + 'px';
  }

  function bindDrag(state) {
    state.header.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || state.docked || state.maximized || event.button !== 0) return;
      focusWindow(state.id);
      const startX = event.clientX, startY = event.clientY;
      const originX = state.x, originY = state.y;
      state.header.setPointerCapture(event.pointerId);
      const move = e => {
        state.x = clamp(originX + e.clientX - startX, 0, Math.max(0, grid.clientWidth - state.width));
        state.y = clamp(originY + e.clientY - startY, 0, Math.max(0, grid.clientHeight - state.height));
        applyGeometry(state);
      };
      const stop = () => {
        state.header.removeEventListener('pointermove', move);
        state.header.removeEventListener('pointerup', stop);
        state.header.removeEventListener('pointercancel', stop);
        saveLayout();
      };
      state.header.addEventListener('pointermove', move);
      state.header.addEventListener('pointerup', stop, { once: true });
      state.header.addEventListener('pointercancel', stop, { once: true });
    });
  }

  function bindResize(state) {
    state.resizeHandle.addEventListener('pointerdown', event => {
      if (state.docked || state.maximized || event.button !== 0) return;
      event.preventDefault();
      focusWindow(state.id);
      const startX = event.clientX, startY = event.clientY;
      const startW = state.width, startH = state.height;
      state.resizeHandle.setPointerCapture(event.pointerId);
      const move = e => {
        state.width = clamp(startW + e.clientX - startX, 320, Math.max(320, grid.clientWidth - state.x));
        state.height = clamp(startH + e.clientY - startY, 220, Math.max(220, grid.clientHeight - state.y));
        applyGeometry(state);
      };
      const stop = () => {
        state.resizeHandle.removeEventListener('pointermove', move);
        state.resizeHandle.removeEventListener('pointerup', stop);
        state.resizeHandle.removeEventListener('pointercancel', stop);
        saveLayout();
      };
      state.resizeHandle.addEventListener('pointermove', move);
      state.resizeHandle.addEventListener('pointerup', stop, { once: true });
      state.resizeHandle.addEventListener('pointercancel', stop, { once: true });
    });
  }

  function minimizeWindow(id) {
    const state = windows.get(id);
    if (!state) return;
    state.minimized = true;
    state.frame.hidden = true;
    renderTaskbar();
    renderTabs();
    const next = Array.from(windows.values()).reverse().find(item => item.id !== id && !item.minimized);
    if (next) focusWindow(next.id);
    else {
      activeId = null;
      currentModule = 'dashboard';
      layer.classList.add('has-no-active-window');
    }
    saveLayout();
  }

  function restoreWindow(id) {
    const state = windows.get(id);
    if (!state) return;
    state.minimized = false;
    state.frame.hidden = false;
    layer.classList.remove('has-no-active-window');
    renderTabs();
    focusWindow(id);
  }

  function closeWindow(id) {
    const state = windows.get(id);
    if (!state) return;
    state.frame.remove();
    windows.delete(id);
    renderTabs();
    if (activeId === id) {
      activeId = null;
      const next = Array.from(windows.values()).reverse().find(item => !item.minimized);
      if (next) focusWindow(next.id);
      else {
        currentModule = 'dashboard';
        layer.classList.add('has-no-active-window');
      }
    }
    renderTaskbar();
    saveLayout();
  }

  async function retryModule(id) {
    if (!id) return false;
    if (openingModules.has(id)) return false;
    const state = windows.get(id);
    if (!state) return window.openModule(id);
    openingModules.add(id);
    try {
      state.frame.hidden = false;
      state.minimized = false;
      layer.classList.remove('has-no-active-window');
      focusWindow(id);
      await originalOpenModule.call(window, id);
      const refreshed = windows.get(id);
      if (!refreshed) return false;
      refreshed.content.setAttribute('aria-label', 'Conteúdo do módulo ' + refreshed.title);
      refreshed.content.scrollTop = 0;
      focusWindow(id);
      return true;
    } finally {
      openingModules.delete(id);
    }
  }

  window.openModule = async function (id) {
    // Keep the ERP's existing role and subscription gates authoritative.
    const workspaceState = window.KanawaWorkspaceState;
    if (workspaceState && typeof workspaceState.canOpenModule === 'function' && !workspaceState.canOpenModule(id)) {
      return originalOpenModule.apply(this, arguments);
    }
    if (typeof podeAcessar === 'function' && !podeAcessar(id)) {
      return originalOpenModule.apply(this, arguments);
    }
    if (typeof planoPermiteModulo === 'function' && !planoPermiteModulo(id)) {
      return originalOpenModule.apply(this, arguments);
    }
    if (openingModules.has(id) || openingModules.size >= 8) {
      window.__kanawaNavigationReentry = {
        module: String(id),
        path: Array.from(openingModules),
        reason: openingModules.has(id) ? 'cycle' : 'depth-limit',
        occurredAt: new Date().toISOString()
      };
      if (typeof toast === 'function') toast('Abertura repetida detectada; o pedido foi bloqueado para evitar um ciclo de navegação.', 'warning');
      console.warn('[Kanawa Workspace] Navegação recursiva bloqueada:', window.__kanawaNavigationReentry);
      return false;
    }
    if (windows.has(id)) {
      const state = windows.get(id);
      state.frame.hidden = false;
      state.minimized = false;
      layer.classList.remove('has-no-active-window');
      focusWindow(id);
      // Legacy ERP actions call openModule(currentModule) after saving. Re-render
      // that existing window instead of only focusing it, so lists and retry screens
      // refresh. Tab clicks still use focusWindow() directly and do not re-render.
      openingModules.add(id);
      try {
        await originalOpenModule.apply(this, arguments);
        const refreshed = windows.get(id);
        if (!refreshed) return false;
        refreshed.content.setAttribute('aria-label', 'Conteúdo do módulo ' + refreshed.title);
        refreshed.content.scrollTop = 0;
        focusWindow(id);
        return true;
      } finally {
        openingModules.delete(id);
      }
    }
    openingModules.add(id);
    try {
      const state = createWindow(id);
      layer.classList.remove('has-no-active-window');
      setActive(id);
      await originalOpenModule.apply(this, arguments);
      if (!windows.has(id)) return false;
      state.content.setAttribute('aria-label', 'Conteúdo do módulo ' + state.title);
      state.content.scrollTop = 0;
      focusWindow(id);
      return true;
    } catch (error) {
      closeWindow(id);
      throw error;
    } finally {
      openingModules.delete(id);
    }
  };

  // Public controls are useful to integrations and keyboard shortcuts.
  window.kanawaWorkspace = {
    focus: focusWindow,
    retry: retryModule,
    minimize: minimizeWindow,
    restore: restoreWindow,
    close: closeWindow,
    list: () => Array.from(windows.keys()),
    setMode: (id, mode) => { const state = windows.get(id); if (!state || !['fixed','floating'].includes(mode)) return false; state.docked = mode === 'fixed'; updateFrameMode(state); focusWindow(id); return true; },
    getActive: () => activeId,
    applySavedLayout: () => {
      const store = window.KanawaWorkspaceState;
      const layouts = store && typeof store.getState === 'function' ? store.getState().windows : {};
      windows.forEach((state, id) => {
        const saved = layouts && layouts[id];
        if (!saved) return;
        state.x = Number.isFinite(saved.x) ? saved.x : state.x;
        state.y = Number.isFinite(saved.y) ? saved.y : state.y;
        state.width = Number.isFinite(saved.width) ? saved.width : state.width;
        state.height = Number.isFinite(saved.height) ? saved.height : state.height;
        state.docked = saved.docked === true;
        state.maximized = false;
        updateFrameMode(state);
        applyGeometry(state);
      });
    }
  };

  window.addEventListener('resize', () => {
    windows.forEach(state => applyGeometry(state));
  }, { passive: true });

  // Keep the original content hidden after app startup and support keyboard focus.
  ensureLayer();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeId) {
      const state = windows.get(activeId);
      if (state && state.maximized) {
        state.maximized = false;
        if (state.previousRect) Object.assign(state, state.previousRect);
        updateFrameMode(state);
        applyGeometry(state);
      }
    }
  });
})();
