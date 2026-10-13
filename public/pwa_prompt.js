/**
 * Sky Party — First-Class Fullscreen & PWA Install Manager
 * Art Directed Mobile Prompt for iOS Safari "Add to Home Screen" & Android PWA Installation
 */

(function (window, document) {
  'use strict';

  const STORAGE_KEY = 'sky_pwa_prompt_dismissed_at';
  const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days snooze

  let deferredPrompt = null;
  let isPromptVisible = false;
  let hasCheckedInitial = false;

  const SkyPWA = {
    /**
     * Check if currently running in standalone / fullscreen mode
     */
    isStandalone() {
      // 1. iOS Safari Home Screen standalone mode
      if (typeof window !== 'undefined' && 'standalone' in window.navigator && window.navigator.standalone) {
        return true;
      }
      // 2. Standard CSS media query for PWA display modes
      if (typeof window !== 'undefined' && window.matchMedia) {
        if (
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches
        ) {
          return true;
        }
      }
      // 3. Document Fullscreen API
      if (typeof document !== 'undefined') {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          return true;
        }
      }
      return false;
    },

    /**
     * Check if the device is mobile or tablet
     */
    isMobile() {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
      const ua = navigator.userAgent || '';
      const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/i.test(ua);
      const isMobileUA = /Mobi|Mobile|Silk|Kindle/i.test(ua);
      const isSmallScreen = window.innerWidth <= 840;
      return isIOS || isAndroid || isMobileUA || isSmallScreen;
    },

    /**
     * Detect platform details: 'ios-safari' | 'ios-other' | 'android' | 'desktop'
     */
    getPlatform() {
      if (typeof navigator === 'undefined') return 'desktop';
      const ua = navigator.userAgent || '';
      const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isOtherIOS = /CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
      const isAndroid = /Android/i.test(ua);

      if (isIOS) {
        return isOtherIOS ? 'ios-other' : 'ios-safari';
      }
      if (isAndroid) {
        return 'android';
      }
      return 'desktop';
    },

    /**
     * Check if user has dismissed the prompt within snooze period
     */
    isSnoozed() {
      try {
        if (typeof localStorage === 'undefined') return false;
        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (!dismissedAt) return false;
        const diff = Date.now() - parseInt(dismissedAt, 10);
        return diff < SNOOZE_MS;
      } catch (e) {
        return false;
      }
    },

    /**
     * Save dismissal timestamp in localStorage
     */
    snooze() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        }
      } catch (e) {}
    },

    /**
     * Clear snooze flag
     */
    clearSnooze() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {}
    },

    /**
     * Trigger Android / Chromium native install prompt if available
     */
    async installApp() {
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            console.log('[SkyPWA] Player accepted PWA install prompt');
            this.snooze();
            this.hide();
          }
          deferredPrompt = null;
        } catch (err) {
          console.warn('[SkyPWA] Install prompt error:', err);
        }
      } else {
        // Fallback for non-promptable browsers
        this.hide();
      }
    },

    /**
     * Show the art-directed Fullscreen & PWA Prompt
     * @param {boolean} force - If true, ignores snooze and standalone state (e.g. from Settings)
     */
    show(force = false) {
      if (!force) {
        if (this.isStandalone()) {
          console.log('[SkyPWA] App is already running in standalone/fullscreen mode');
          return;
        }
        if (this.isSnoozed()) {
          console.log('[SkyPWA] Prompt is currently snoozed');
          return;
        }
        if (!this.isMobile()) {
          console.log('[SkyPWA] Desktop device detected; skipping auto-popup');
          return;
        }
      }

      this._ensureMarkup();
      const banner = document.getElementById('skyPwaInstallPrompt');
      const backdrop = document.getElementById('skyPwaPromptBackdrop');
      if (!banner) return;

      this._renderPlatformContent();

      if (backdrop) backdrop.classList.add('visible');
      banner.classList.add('visible');
      banner.setAttribute('aria-hidden', 'false');
      isPromptVisible = true;
    },

    /**
     * Hide prompt and optionally record snooze
     */
    hide(snoozeUser = true) {
      const banner = document.getElementById('skyPwaInstallPrompt');
      const backdrop = document.getElementById('skyPwaPromptBackdrop');
      if (banner) {
        banner.classList.remove('visible');
        banner.setAttribute('aria-hidden', 'true');
      }
      if (backdrop) {
        backdrop.classList.remove('visible');
      }
      isPromptVisible = false;
      if (snoozeUser) {
        this.snooze();
      }
    },

    /**
     * Ensure banner HTML markup is injected into document
     */
    _ensureMarkup() {
      if (document.getElementById('skyPwaInstallPrompt')) return;

      // Create Backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'skyPwaPromptBackdrop';
      backdrop.className = 'sky-pwa-banner-backdrop';
      backdrop.addEventListener('click', () => this.hide(true));
      document.body.appendChild(backdrop);

      // Create Banner Container
      const banner = document.createElement('div');
      banner.id = 'skyPwaInstallPrompt';
      banner.className = 'sky-pwa-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-modal', 'true');
      banner.setAttribute('aria-hidden', 'true');

      banner.innerHTML = `
        <button type="button" class="pwa-close-btn" id="pwaPromptCloseBtn" aria-label="Close Prompt">✕</button>
        
        <div class="pwa-header-row">
          <div class="pwa-mascot-pod">
            <img src="assets/ui/social_aviator_luggage_transparent.png" alt="Aviator Mascot" class="pwa-mascot-img" onerror="this.src='assets/ui/crest.png'">
          </div>
          <div class="pwa-header-meta">
            <span class="pwa-badge">✈️ FIRST CLASS IMMERSION</span>
            <h3 class="pwa-title">Play in <span class="pwa-title-accent">Full Screen</span> ✨</h3>
          </div>
        </div>

        <p class="pwa-desc" id="pwaDescText">
          Add Sky Party to your Home Screen for smooth, distraction-free flights with zero browser address bars!
        </p>

        <!-- Dynamic Platform Steps Container -->
        <div class="pwa-steps-card" id="pwaStepsCard"></div>

        <!-- Animated Safari indicator (iOS only) -->
        <div class="pwa-safari-arrow-indicator hidden" id="pwaSafariArrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
          <span>Tap Share at the bottom of your screen</span>
        </div>

        <!-- Action Buttons -->
        <div class="pwa-actions-row">
          <button type="button" class="pwa-btn-primary" id="pwaActionPrimaryBtn">Got it! ✈️</button>
          <button type="button" class="pwa-btn-secondary" id="pwaActionSecondaryBtn">Maybe Later 🍃</button>
        </div>
      `;

      document.body.appendChild(banner);

      // Bind interaction events
      const closeBtn = document.getElementById('pwaPromptCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.hide(true));

      const secBtn = document.getElementById('pwaActionSecondaryBtn');
      if (secBtn) secBtn.addEventListener('click', () => this.hide(true));

      const priBtn = document.getElementById('pwaActionPrimaryBtn');
      if (priBtn) {
        priBtn.addEventListener('click', () => {
          if (deferredPrompt) {
            this.installApp();
          } else {
            this.hide(true);
          }
        });
      }
    },

    /**
     * Render steps tailored to player's browser & platform
     */
    _renderPlatformContent() {
      const card = document.getElementById('pwaStepsCard');
      const arrow = document.getElementById('pwaSafariArrow');
      const priBtn = document.getElementById('pwaActionPrimaryBtn');
      if (!card) return;

      const platform = this.getPlatform();

      if (platform === 'ios-safari') {
        if (arrow) arrow.classList.remove('hidden');
        if (priBtn) priBtn.innerHTML = 'Got it! ✈️';

        card.innerHTML = `
          <div class="pwa-step-item">
            <span class="pwa-step-num">1</span>
            <div class="pwa-step-text">
              Tap the <span class="pwa-inline-badge"><svg class="pwa-share-svg" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Share</span> button below.
            </div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">2</span>
            <div class="pwa-step-text">
              Scroll down and tap <span class="pwa-inline-badge"><strong class="pwa-add-icon">⊞</strong> Add to Home Screen</span>.
            </div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">3</span>
            <div class="pwa-step-text">
              Launch from your Home Screen for genuine <strong>fullscreen gameplay</strong>!
            </div>
          </div>
        `;
      } else if (platform === 'android') {
        if (arrow) arrow.classList.add('hidden');
        if (deferredPrompt && priBtn) {
          priBtn.innerHTML = '📲 Install Sky Party';
        } else if (priBtn) {
          priBtn.innerHTML = 'Got it! ✈️';
        }

        card.innerHTML = `
          <div class="pwa-step-item">
            <span class="pwa-step-num">1</span>
            <div class="pwa-step-text">
              Tap <span class="pwa-inline-badge"><strong>⋮</strong> Menu</span> in Chrome toolbar.
            </div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">2</span>
            <div class="pwa-step-text">
              Choose <span class="pwa-inline-badge"><strong>📲</strong> Add to Home screen</span> or <strong>Install App</strong>.
            </div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">3</span>
            <div class="pwa-step-text">
              Enjoy lightning-fast, fullscreen flights straight from your home launcher!
            </div>
          </div>
        `;
      } else {
        // Desktop or other mobile browser
        if (arrow) arrow.classList.add('hidden');
        if (priBtn) priBtn.innerHTML = 'Got it! ✈️';

        card.innerHTML = `
          <div class="pwa-step-item">
            <span class="pwa-step-num">1</span>
            <div class="pwa-step-text">
              Press <span class="pwa-inline-badge"><strong>F11</strong></span> for instant Full Screen mode.
            </div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">2</span>
            <div class="pwa-step-text">
              Or click the <span class="pwa-inline-badge"><strong>⊞</strong> Install</span> icon in your browser URL bar.
            </div>
          </div>
        `;
      }
    },

    /**
     * Initialize Service Worker and automated prompt checking
     */
    init() {
      // 1. Register Service Worker if supported
      if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[SkyPWA] Service Worker registered with scope:', reg.scope);
        }).catch((err) => {
          console.log('[SkyPWA] Service Worker registration skipped/failed:', err);
        });
      }

      // 2. Intercept beforeinstallprompt for Android 1-tap install
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[SkyPWA] Captured beforeinstallprompt event for Android/Chromium');
        if (isPromptVisible) {
          this._renderPlatformContent();
        }
      });

      // 3. Listen for app installed event
      window.addEventListener('appinstalled', () => {
        console.log('[SkyPWA] App successfully installed to Home Screen');
        deferredPrompt = null;
        this.snooze();
        this.hide(false);
      });

      // 4. Delay initial prompt check to allow smooth onboarding & lobby load
      if (!hasCheckedInitial) {
        hasCheckedInitial = true;
        setTimeout(() => {
          // Check if onboarding modal is currently showing; if so, wait until dismissed
          const onbModal = document.getElementById('skyOnboardingModal');
          if (onbModal && !onbModal.classList.contains('hidden')) {
            const observer = new MutationObserver(() => {
              if (onbModal.classList.contains('hidden')) {
                observer.disconnect();
                setTimeout(() => this.show(false), 800);
              }
            });
            observer.observe(onbModal, { attributes: true, attributeFilter: ['class'] });
          } else {
            this.show(false);
          }
        }, 2200);
      }
    }
  };

  window.SkyPWA = SkyPWA;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SkyPWA.init());
  } else {
    SkyPWA.init();
  }
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
