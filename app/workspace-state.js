/* Kanawa Soft ERP — estado global dos espaços de trabalho.
 * Preferências visuais e geometria são locais; permissões continuam a ser decididas
 * pelo backend e pelos controlos existentes em app.js.
 */
(function (window, document) {
  'use strict';
  if (window.KanawaWorkspaceState) return;

  const VERSION = 1;
  const PREFIX = 'kanawa_workspace_state_v1';
  const LEGACY_LAYOUT_PREFIX = 'kanawa_layout_preferences_v1:';
  const LEGACY_WINDOWS_PREFIX = 'kanawa_workspace_layout_v1:';
  const listeners = new Set();
  let state = createDefaultState();
  let currentKey = '';

  function context() {
    return window.KanawaCloud && window.KanawaCloud.context || null;
  }

  function scopeInfo() {
    const ctx = context();
    const userId = ctx && ctx.user && ctx.user.id ? String(ctx.user.id) : 'local';
    const companyId = ctx && ctx.company && ctx.company.id ? String(ctx.company.id) : 'local';
    return { userId, companyId, scope: userId + ':' + companyId };
  }

  function storageKey() {
    return PREFIX + ':' + encodeURIComponent(scopeInfo().scope);
  }

  function createDefaultState() {
    return {
      version: VERSION,
      preferences: {
        layout: 'mode-classic',
        iconSize: 'normal',
        enterpriseWorkspace: 'custom',
        dock: { state: 'docked-right', width: 320, x: 0, y: 80 }
      },
      workspace: { active: 'custom', savedAt: null },
      windows: {}
    };
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(raw) {
    try {
      const parsed = JSON.parse(raw || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
  }

  function normalize(input) {
    const next = createDefaultState();
    if (!input || typeof input !== 'object') return next;
    const prefs = input.preferences && typeof input.preferences === 'object' ? input.preferences : {};
    const layouts = ['mode-classic', 'mode-compact', 'mode-floating', 'mode-hidden', 'mode-enterprise'];
    next.preferences.layout = layouts.includes(prefs.layout) ? prefs.layout : next.preferences.layout;
    next.preferences.iconSize = prefs.iconSize === 'large' ? 'large' : 'normal';
    next.preferences.enterpriseWorkspace = ['operator', 'director', 'custom'].includes(prefs.enterpriseWorkspace)
      ? prefs.enterpriseWorkspace : 'custom';
    if (prefs.dock && typeof prefs.dock === 'object') {
      const width = Number(prefs.dock.width);
      next.preferences.dock = {
        state: ['floating', 'docked-left', 'docked-right'].includes(prefs.dock.state) ? prefs.dock.state : 'docked-right',
        width: Number.isFinite(width) ? Math.max(260, Math.min(520, width)) : 320,
        x: Number.isFinite(Number(prefs.dock.x)) ? Number(prefs.dock.x) : 0,
        y: Number.isFinite(Number(prefs.dock.y)) ? Number(prefs.dock.y) : 80
      };
    }
    const workspace = input.workspace && typeof input.workspace === 'object' ? input.workspace : {};
    next.workspace = {
      active: ['operator', 'director', 'custom'].includes(workspace.active) ? workspace.active : 'custom',
      savedAt: typeof workspace.savedAt === 'string' ? workspace.savedAt : null
    };
    if (input.windows && typeof input.windows === 'object' && !Array.isArray(input.windows)) {
      Object.keys(input.windows).forEach(function (id) {
        const item = input.windows[id];
        if (!item || typeof item !== 'object' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return;
        const number = function (value, fallback, min, max) {
          const n = Number(value);
          return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
        };
        next.windows[id] = {
          x: number(item.x, 24, 0, 100000),
          y: number(item.y, 24, 0, 100000),
          width: number(item.width, 760, 320, 10000),
          height: number(item.height, 560, 220, 10000),
          docked: item.docked === true
        };
      });
    }
    return next;
  }

  function readLegacy() {
    const scope = scopeInfo();
    const defaults = createDefaultState();
    try {
      const legacyLayout = safeParse(localStorage.getItem(LEGACY_LAYOUT_PREFIX + scope.userId));
      const legacyWindows = safeParse(localStorage.getItem(LEGACY_WINDOWS_PREFIX + scope.userId));
      if (legacyLayout) defaults.preferences = Object.assign(defaults.preferences, legacyLayout);
      if (legacyWindows) defaults.windows = legacyWindows;
    } catch (_) {}
    return normalize(defaults);
  }

  function emit(reason) {
    const snapshot = getState();
    listeners.forEach(function (listener) {
      try { listener(snapshot, reason); } catch (error) { console.error('[Kanawa Workspace State] subscriber:', error); }
    });
    try {
      window.dispatchEvent(new CustomEvent('kanawa:workspace-state-change', { detail: { state: snapshot, reason } }));
    } catch (_) {}
  }

  function persist(reason) {
    try { localStorage.setItem(currentKey || storageKey(), JSON.stringify(state)); }
    catch (error) { console.warn('[Kanawa Workspace State] armazenamento local indisponível:', error); }
    emit(reason || 'update');
    return getState();
  }

  function load() {
    currentKey = storageKey();
    let stored = null;
    try { stored = safeParse(localStorage.getItem(currentKey)); } catch (_) {}
    state = stored ? normalize(stored) : readLegacy();
    if (!stored) {
      try { localStorage.setItem(currentKey, JSON.stringify(state)); } catch (_) {}
    }
    emit('load');
    return getState();
  }

  function update(mutator, reason) {
    const draft = getState();
    mutator(draft);
    state = normalize(draft);
    return persist(reason);
  }

  function setPreferences(preferences) {
    return update(function (draft) {
      draft.preferences = Object.assign({}, draft.preferences, preferences || {});
    }, 'preferences');
  }

  function setLayout(layout) {
    return setPreferences({ layout });
  }

  function setIconSize(iconSize) {
    return setPreferences({ iconSize });
  }

  function setWorkspace(name, preferences) {
    return update(function (draft) {
      draft.workspace.active = name;
      if (preferences) draft.preferences = Object.assign({}, draft.preferences, preferences);
      draft.workspace.savedAt = new Date().toISOString();
    }, 'workspace');
  }

  function setWindowLayouts(layouts) {
    return update(function (draft) { draft.windows = layouts || {}; }, 'windows');
  }

  function setWindowLayout(id, geometry) {
    if (!id || !geometry) return getState();
    return update(function (draft) { draft.windows[id] = geometry; }, 'window');
  }

  function getState() { return clone(state); }

  function canOpenModule(moduleId) {
    // This is a read-only guard. It never grants access or changes ERP permissions.
    if (typeof window.podeAcessar === 'function' && !window.podeAcessar(moduleId)) return false;
    if (typeof window.planoPermiteModulo === 'function' && !window.planoPermiteModulo(moduleId)) return false;
    return true;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function reloadForCurrentIdentity() {
    const nextKey = storageKey();
    if (nextKey !== currentKey) load();
  }

  window.addEventListener('storage', function (event) {
    if (event.key === currentKey) {
      state = normalize(safeParse(event.newValue));
      emit('storage');
    }
  });

  window.addEventListener('kanawa:cloud-context-ready', reloadForCurrentIdentity);
  window.addEventListener('kanawa:cloud-context-changed', reloadForCurrentIdentity);

  window.KanawaWorkspaceState = Object.freeze({
    version: VERSION,
    getState,
    subscribe,
    setPreferences,
    setLayout,
    setIconSize,
    setWorkspace,
    setWindowLayouts,
    setWindowLayout,
    canOpenModule,
    reload: load,
    getScope: scopeInfo
  });

  load();
})(window, document);
