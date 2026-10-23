// client/js/pwa_gate.js — environment detection & service worker registration (PWA gate removed so mobile browsers sign in directly).
export const env = (() => {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const params = new URLSearchParams(location.search);
  const dev = params.has('dev') || params.has('user') || ['localhost', '127.0.0.1'].includes(location.hostname);
  return { iOS, android, mobile: iOS || android, standalone, dev, params };
})();

/**
 * Always allow direct sign-in on all mobile & desktop browsers without an A2HS / PWA gate.
 */
export function initGate() {
  const card = document.getElementById('a2hs-card');
  const form = document.getElementById('login-form');
  if (card) card.hidden = true;
  if (form) form.hidden = false;
  return true;
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
