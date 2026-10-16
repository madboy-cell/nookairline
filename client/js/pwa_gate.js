// client/js/pwa_gate.js — standalone detection + "Add to Home Screen" guide (Sections 13.A.1 / 17.B.3).
export const env = (() => {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const params = new URLSearchParams(location.search);
  const dev = params.has('dev') || ['localhost', '127.0.0.1'].includes(location.hostname);
  return { iOS, android, mobile: iOS || android, standalone, dev, params };
})();

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; showInstallButton(); });

function showInstallButton() {
  const b = document.getElementById('a2hs-install');
  if (b && deferredPrompt) b.hidden = false;
}

/**
 * Mobile browsers (not installed) get the install guide instead of the sign-in form —
 * the game is meant to run fullscreen from the home screen. Desktop is framed in a
 * 430px phone shell and signs in directly. `?dev=1` (or localhost) shows a testing bypass.
 * Returns true when the sign-in form may be shown.
 */
export function initGate({ onSkip } = {}) {
  const card = document.getElementById('a2hs-card');
  const steps = document.getElementById('a2hs-steps');
  const form = document.getElementById('login-form');
  if (!env.mobile || env.standalone) { card.hidden = true; return true; }

  card.hidden = false;
  form.hidden = true;
  steps.innerHTML = env.iOS
    ? `<div class="step"><b>1</b>Tap Safari Share [↑]</div><div class="step"><b>2</b>Tap Add to Home Screen [+]</div><div class="step"><b>3</b>Launch the app icon for fullscreen + 50 💎 gift!</div>`
    : `<div class="step"><b>1</b>Tap Install below (or ⋮ menu)</div><div class="step"><b>2</b>Choose Install app / Add to Home screen</div><div class="step"><b>3</b>Launch the app icon for fullscreen + 50 💎 gift!</div>`;
  showInstallButton();
  document.getElementById('a2hs-install').onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
  };
  const skip = document.getElementById('a2hs-skip');
  if (env.dev) {
    skip.hidden = false;
    skip.onclick = () => { form.hidden = false; card.hidden = true; onSkip?.(); };
  }
  return false;
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
