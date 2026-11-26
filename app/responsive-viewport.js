/* Kanawa Soft ERP — adaptador de viewport responsivo.
 * Responsabilidade isolada: detectar dimensões/orientação e actualizar variáveis CSS.
 * Carregado antes de app.js porque o núcleo chama updateResponsiveLayout após autenticação.
 */
function updateResponsiveLayout() {
  const root = document.documentElement;
  const width = Math.max(320, window.innerWidth || root.clientWidth || 1024);
  const height = Math.max(320, window.innerHeight || root.clientHeight || 768);
  const tier = width <= 600 ? 'mobile' : width <= 900 ? 'tablet' : width <= 1200 ? 'laptop' : 'desktop';
  root.dataset.screenSize = tier;
  root.dataset.orientation = width > height ? 'landscape' : 'portrait';
  root.style.setProperty('--viewport-width', width + 'px');
  root.style.setProperty('--viewport-height', height + 'px');
  const topbar = document.querySelector('#app .topbar');
  if (topbar && topbar.offsetHeight > 0) root.style.setProperty('--kanawa-topbar-height', topbar.offsetHeight + 'px');
}
if (typeof window !== 'undefined') {
  updateResponsiveLayout();
  window.addEventListener('resize', updateResponsiveLayout, { passive: true });
  window.addEventListener('orientationchange', updateResponsiveLayout, { passive: true });
}
