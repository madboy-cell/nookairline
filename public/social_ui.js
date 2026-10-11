/**
 * Sky Party — Social & Passenger Passport UI Controller (Phase 5)
 * Coordinates the Passenger Passport Modal, Persona Base Switcher,
 * Couple Sanctuary, Friends Roster, and WebAudio FX.
 */

(function (window) {
  'use strict';

  const $ = (id) => (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null);

  // ---------------------------------------------------------------------------
  // Procedural WebAudio chimes matching daily.js
  // ---------------------------------------------------------------------------
  const Sound = (() => {
    let ctx = null;
    const ac = () => {
      if (typeof window === 'undefined') return null;
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function tone(f, t0, dur, type = 'sine', vol = 0.08) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      const t = c.currentTime + t0;
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      tap() { tone(760, 0, 0.06, 'triangle', 0.05); },
      switchBase() { [659, 880, 1109].forEach((f, i) => tone(f, i * 0.06, 0.22, 'triangle', 0.07)); },
      auth() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.35, 'sine', 0.07)); },
      claim() { [988, 1319, 1568].forEach((f, i) => tone(f, i * 0.06, 0.22, 'triangle', 0.08)); },
      gem() { tone(1800 + Math.random() * 400, 0, 0.08, 'sine', 0.04); }
    };
  })();

  function renderEmbers(containerId, count = 14) {
    const c = $(containerId);
    if (!c || c.children.length > 0) return;
    let h = '';
    for (let i = 0; i < count; i++) {
      const x = Math.round(Math.random() * 100);
      const d = (4 + Math.random() * 5).toFixed(2);
      const delay = (-Math.random() * 8).toFixed(2);
      const s = (0.5 + Math.random() * 0.9).toFixed(2);
      h += `<i style="--x:${x}%;--d:${d}s;--delay:${delay}s;--s:${s}"></i>`;
    }
    c.innerHTML = h;
  }

  class SkySocialUI {
    constructor() {
      this.isOpen = false;
      this.isProfileOpen = false;
      this.currentTab = 'couple';
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this._bindElements();
      this._bindEvents();
      this.render();

      console.log('[SkySocialUI] Initialized successfully with Passport & Sanctuary.');
    }

    _bindElements() {
      // Drawers and sheets
      this.drawer = $('socialDrawer');
      this.backdrop = $('socialDrawerBackdrop');
      this.triggerBtn = $('flightHeaderSocialBtn');
      this.closeBtn = $('closeSocialDrawerBtn');

      // Passenger Passport Sheet
      this.profileSheet = $('skyProfileSheet');
      this.profileBackdrop = $('skyProfileBackdrop');
      this.profileCloseBtn = $('skyProfileCloseBtn');
      this.profileHeaderBtn = $('flightHeaderProfileBtn');

      // Profile Card Elements
      this.passportAvatarImg = $('passportAvatarImg');
      this.passportUsername = $('passportUsername');
      this.passportEditNameBtn = $('passportEditNameBtn');
      this.passportIdBadge = $('passportIdBadge');
      this.passportDiamonds = $('passportDiamonds');
      this.passportPersonaTag = $('passportPersonaTag');
      this.passportCoupleTag = $('passportCoupleTag');

      // Persona Base Cards
      this.personaCardBkk = $('personaCardBkk');
      this.personaCardDxb = $('personaCardDxb');
      this.personaPillBkk = $('personaPillBkk');
      this.personaPillDxb = $('personaPillDxb');

      // Auth & Account
      this.accountGuestBox = $('accountGuestBox');
      this.accountLoggedInBox = $('accountLoggedInBox');
      this.googleAuthBtn = $('googleAuthBtn');
      this.emailAuthForm = $('emailAuthForm');
      this.authEmailInput = $('authEmailInput');
      this.loggedUserEmail = $('loggedUserEmail');
      this.profileSignOutBtn = $('profileSignOutBtn');
      this.profileOpenSanctuaryBtn = $('profileOpenSanctuaryBtn');

      // Social Drawer Legacy Elements
      this.userAvatarImg = $('socialUserAvatarImg');
      this.usernameEl = $('socialProfileUsername');
      this.baseBadgeEl = $('socialBaseBadge');
      this.diamondsEl = $('socialDiamondsCount');
      this.seatChipEl = $('socialSeatChip');
      this.baseBtnBkk = $('socialBaseBtnBkk');
      this.baseBtnDxb = $('socialBaseBtnDxb');
      this.wardrobeBaseBtnBkk = $('wardrobeBaseBtnBkk');
      this.wardrobeBaseBtnDxb = $('wardrobeBaseBtnDxb');

      // Tabs
      this.tabCoupleBtn = $('socialTabCoupleBtn');
      this.tabFriendsBtn = $('socialTabFriendsBtn');
      this.tabCoupleContent = $('socialTabCoupleContent');
      this.tabFriendsContent = $('socialTabFriendsContent');
      this.friendsCountEl = $('socialFriendsCount');

      // Couple Sanctuary Cards
      this.coupleCardLinked = $('coupleCardLinked');
      this.coupleCardUnlinked = $('coupleCardUnlinked');
      this.coupleMeImg = $('coupleMeImg');
      this.coupleMeName = $('coupleMeName');
      this.coupleMeBase = $('coupleMeBase');
      this.couplePartnerImg = $('couplePartnerImg');
      this.couplePartnerName = $('couplePartnerName');
      this.couplePartnerBase = $('couplePartnerBase');
      this.couplePartnerStatusText = $('couplePartnerStatusText');
      this.coupleAnniversaryText = $('coupleAnniversaryText');
      this.coupleStartCallBtn = $('coupleStartCallBtn');
      this.coupleDecoupleBtn = $('coupleDecoupleBtn');
      this.coupleInviteForm = $('coupleInviteForm');
      this.coupleInviteInput = $('coupleInviteInput');

      // Friends
      this.addFriendForm = $('addFriendForm');
      this.addFriendInput = $('addFriendInput');
      this.friendsListContainer = $('friendsListContainer');

      // Gating Modal
      this.gatingModal = $('coupleGatingModal');
      this.gatingOpenSanctuaryBtn = $('gatingOpenSanctuaryBtn');
      this.gatingCloseBtn = $('gatingCloseBtn');
    }

    _bindEvents() {
      // 1. Top Header Profile Chip -> Opens Passport Modal
      if (this.profileHeaderBtn) {
        this.profileHeaderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openProfileModal();
        });
      }
      if (this.profileCloseBtn) {
        this.profileCloseBtn.addEventListener('click', () => this.closeProfileModal());
      }
      if (this.profileBackdrop) {
        this.profileBackdrop.addEventListener('click', () => this.closeProfileModal());
      }

      // Persona Base Switcher Cards inside Passport Modal
      if (this.personaCardBkk) {
        this.personaCardBkk.addEventListener('click', () => {
          Sound.switchBase();
          this.switchBase('bkk');
        });
      }
      if (this.personaCardDxb) {
        this.personaCardDxb.addEventListener('click', () => {
          Sound.switchBase();
          this.switchBase('dxb');
        });
      }

      // Callsign Edit
      if (this.passportEditNameBtn) {
        this.passportEditNameBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          Sound.tap();
          const current = (window.SkySupabase && window.SkySupabase.getCurrentUser()?.username) || 'Passenger';
          const newName = window.prompt('Enter your passenger callsign / name:', current);
          if (newName && newName.trim() && newName.trim() !== current) {
            await window.SkySupabase.updateProfile({ username: newName.trim() });
            Sound.claim();
            this.render();
          }
        });
      }

      // Google Sign-In
      if (this.googleAuthBtn) {
        this.googleAuthBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          Sound.auth();
          try {
            await window.SkySupabase.signInWithOAuth('google');
            Sound.claim();
            this.render();
          } catch (err) {
            alert('Google Auth: ' + err.message);
          }
        });
      }

      // Email Auth Form
      if (this.emailAuthForm) {
        this.emailAuthForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const inp = this.authEmailInput;
          if (!inp || !inp.value.trim()) return;
          try {
            await window.SkySupabase.signInWithOtp(inp.value.trim());
            Sound.claim();
            inp.value = '';
            this.render();
          } catch (err) {
            alert(err.message);
          }
        });
      }

      // Sign Out
      if (this.profileSignOutBtn) {
        this.profileSignOutBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          Sound.tap();
          await window.SkySupabase.signOut();
          this.render();
        });
      }

      // Open Couple Sanctuary from Passport Modal
      if (this.profileOpenSanctuaryBtn) {
        this.profileOpenSanctuaryBtn.addEventListener('click', () => {
          this.closeProfileModal();
          this.openDrawer('couple');
        });
      }

      // 2. Open / Close Social Drawer
      if (this.triggerBtn) {
        this.triggerBtn.addEventListener('click', () => this.toggleDrawer());
      }
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.closeDrawer());
      }
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.closeDrawer());
      }

      // Bottom Action Deck Couple Button
      const coupleDeckBtn = $('openCoupleDeckBtn');
      if (coupleDeckBtn) {
        coupleDeckBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDrawer('couple');
        });
      }

      // Base Switcher Buttons inside Drawer & Wardrobe
      if (this.baseBtnBkk) {
        this.baseBtnBkk.addEventListener('click', () => this.switchBase('bkk'));
      }
      if (this.baseBtnDxb) {
        this.baseBtnDxb.addEventListener('click', () => this.switchBase('dxb'));
      }
      if (this.wardrobeBaseBtnBkk) {
        this.wardrobeBaseBtnBkk.addEventListener('click', () => this.switchBase('bkk'));
      }
      if (this.wardrobeBaseBtnDxb) {
        this.wardrobeBaseBtnDxb.addEventListener('click', () => this.switchBase('dxb'));
      }

      // Tabs
      if (this.tabCoupleBtn) {
        this.tabCoupleBtn.addEventListener('click', () => this.switchTab('couple'));
      }
      if (this.tabFriendsBtn) {
        this.tabFriendsBtn.addEventListener('click', () => this.switchTab('friends'));
      }

      // Couple Sanctuary Actions
      if (this.coupleInviteForm) {
        this.coupleInviteForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const target = this.coupleInviteInput ? this.coupleInviteInput.value.trim() : '';
          if (!target) return;
          try {
            await window.SkySupabase.linkCouple(target);
            if (this.coupleInviteInput) this.coupleInviteInput.value = '';
            this.render();
          } catch (err) {
            alert(err.message || 'Failed to send couple invite.');
          }
        });
      }

      if (this.coupleDecoupleBtn) {
        this.coupleDecoupleBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to decouple? (Your wardrobe items & diamonds will remain 100% safe and untouched)')) {
            return;
          }
          try {
            await window.SkySupabase.decouple();
            this.render();
          } catch (err) {
            alert(err.message || 'Decouple error.');
          }
        });
      }

      if (this.coupleStartCallBtn) {
        this.coupleStartCallBtn.addEventListener('click', () => {
          this.closeDrawer();
          const callBtn = $('callActionBtn');
          if (callBtn) callBtn.click();
        });
      }

      // Friends
      if (this.addFriendForm) {
        this.addFriendForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const target = this.addFriendInput ? this.addFriendInput.value.trim() : '';
          if (!target) return;
          try {
            await window.SkySupabase.addFriend(target);
            if (this.addFriendInput) this.addFriendInput.value = '';
            this.render();
          } catch (err) {
            alert(err.message || 'Failed to add friend.');
          }
        });
      }

      // Gating Modal Actions
      if (this.gatingOpenSanctuaryBtn) {
        this.gatingOpenSanctuaryBtn.addEventListener('click', () => {
          this.hideGatingModal();
          this.openDrawer('couple');
        });
      }
      if (this.gatingCloseBtn) {
        this.gatingCloseBtn.addEventListener('click', () => this.hideGatingModal());
      }

      // Listen for Global Supabase events
      window.addEventListener('sky:character_base_changed', () => this.render());
      window.addEventListener('sky:couple_updated', () => this.render());
      window.addEventListener('sky:auth_state_changed', () => this.render());
    }

    openProfileModal() {
      Sound.tap();
      this.isProfileOpen = true;
      if (this.profileSheet) {
        this.profileSheet.classList.add('open');
        this.profileSheet.setAttribute('aria-hidden', 'false');
      }
      renderEmbers('profileEmbers', 14);
      this.render();
    }

    closeProfileModal() {
      this.isProfileOpen = false;
      if (this.profileSheet) {
        this.profileSheet.classList.remove('open');
        this.profileSheet.setAttribute('aria-hidden', 'true');
      }
    }

    openDrawer(tab = null) {
      Sound.tap();
      this.isOpen = true;
      if (tab) this.switchTab(tab);
      if (this.drawer) this.drawer.classList.remove('hidden');
      if (this.backdrop) this.backdrop.classList.remove('hidden');
      this.render();
    }

    closeDrawer() {
      this.isOpen = false;
      if (this.drawer) this.drawer.classList.add('hidden');
      if (this.backdrop) this.backdrop.classList.add('hidden');
    }

    toggleDrawer() {
      if (this.isOpen) this.closeDrawer();
      else this.openDrawer();
    }

    switchTab(tab) {
      this.currentTab = tab;
      if (this.tabCoupleBtn) this.tabCoupleBtn.classList.toggle('active', tab === 'couple');
      if (this.tabFriendsBtn) this.tabFriendsBtn.classList.toggle('active', tab === 'friends');
      if (this.tabCoupleContent) this.tabCoupleContent.classList.toggle('hidden', tab !== 'couple');
      if (this.tabFriendsContent) this.tabFriendsContent.classList.toggle('hidden', tab !== 'friends');
    }

    async switchBase(base) {
      if (!window.SkySupabase) return;
      try {
        await window.SkySupabase.updateCharacterBase(base);
        this.render();
      } catch (err) {
        console.error('[SkySocialUI] Base switch error:', err);
      }
    }

    showCoupleGatingModal() {
      if (this.gatingModal) {
        this.gatingModal.classList.remove('hidden');
      }
    }

    hideGatingModal() {
      if (this.gatingModal) {
        this.gatingModal.classList.add('hidden');
      }
    }

    render() {
      if (!window.SkySupabase) return;

      const user = window.SkySupabase.getCurrentUser();
      const currentBase = window.SkySupabase.getCharacterBase();
      const couple = window.SkySupabase.coupleStatus;
      const friends = window.SkySupabase.friends || [];
      const isBoy = currentBase === 'bkk';
      const myAvatarSrc = isBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen.png';

      // 1. Top Header Profile Chip
      const headerAvatarImg = $('headerProfileAvatarImg');
      if (headerAvatarImg) headerAvatarImg.src = myAvatarSrc;
      const headerBadge = $('headerProfileBadge');
      if (headerBadge) headerBadge.textContent = isBoy ? '🐺' : '🐉';
      const headerName = $('headerProfileName');
      if (headerName) headerName.textContent = user ? (user.username || 'Passenger') : 'Passenger';
      const headerSub = $('headerProfileSub');
      if (headerSub) {
        if (couple && couple.isCouple && couple.partner) {
          headerSub.textContent = `💞 ${couple.partner.username || 'Coupled'}`;
        } else {
          headerSub.textContent = 'Sky Passport';
        }
      }

      // 2. Passenger Passport Sheet
      if (this.passportAvatarImg) this.passportAvatarImg.src = myAvatarSrc;
      if (this.passportUsername) this.passportUsername.textContent = user ? (user.username || 'Passenger') : 'Passenger';
      if (this.passportIdBadge) {
        const idShort = user && user.id ? user.id.slice(-4).toUpperCase() : '7789';
        this.passportIdBadge.textContent = `ID: #SKY-${idShort} · VIP TIER 1`;
      }
      if (this.passportDiamonds) this.passportDiamonds.textContent = (user?.diamonds || 5000).toLocaleString();
      if (this.passportPersonaTag) this.passportPersonaTag.textContent = isBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';
      if (this.passportCoupleTag) {
        this.passportCoupleTag.textContent = couple && couple.isCouple ? `💞 Linked (${couple.partner?.username || 'Partner'})` : 'Single Traveler';
      }

      // Persona Base Switcher Cards
      if (this.personaCardBkk) this.personaCardBkk.classList.toggle('active', isBoy);
      if (this.personaCardDxb) this.personaCardDxb.classList.toggle('active', !isBoy);
      if (this.personaPillBkk) this.personaPillBkk.textContent = isBoy ? '✓ ACTIVE' : 'SELECT';
      if (this.personaPillDxb) this.personaPillDxb.textContent = !isBoy ? '✓ ACTIVE' : 'SELECT';

      // Auth state
      const isGuest = !user || !!user.isGuest || !user.email;
      if (this.accountGuestBox) this.accountGuestBox.classList.toggle('hidden', !isGuest);
      if (this.accountLoggedInBox) this.accountLoggedInBox.classList.toggle('hidden', isGuest);
      if (this.loggedUserEmail && user && user.email) {
        this.loggedUserEmail.textContent = user.email;
      }

      // Passport Couple Card status
      const pCoupleDesc = $('profileCoupleDesc');
      if (pCoupleDesc) {
        if (couple && couple.isCouple) {
          pCoupleDesc.textContent = `Bound with ${couple.partner?.username || 'Partner'} 💞 in Couple Sanctuary. Enjoy private 1:1 calls and shared milestones.`;
        } else {
          pCoupleDesc.textContent = 'Pair with your flight partner to unlock private 1:1 WebRTC calls, intimacy reactions, and couple streak logs.';
        }
      }
      if (this.profileOpenSanctuaryBtn) {
        this.profileOpenSanctuaryBtn.textContent = couple && couple.isCouple ? 'Manage Couple Sanctuary 💞' : 'Open Couple Sanctuary 💞';
      }

      // 3. Social Drawer User Card
      if (this.usernameEl) this.usernameEl.textContent = user?.username || 'Passenger';
      if (this.diamondsEl) this.diamondsEl.textContent = (user?.diamonds || 5000).toLocaleString();
      if (this.seatChipEl) {
        this.seatChipEl.textContent = couple && couple.isCouple ? 'Flight Couple' : 'Solo Passenger';
      }
      if (this.userAvatarImg) this.userAvatarImg.src = myAvatarSrc;
      if (this.baseBadgeEl) {
        this.baseBadgeEl.textContent = isBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';
        this.baseBadgeEl.style.color = isBoy ? '#93c5fd' : '#f9a8d4';
      }

      if (this.baseBtnBkk) this.baseBtnBkk.classList.toggle('active', isBoy);
      if (this.baseBtnDxb) this.baseBtnDxb.classList.toggle('active', !isBoy);
      if (this.wardrobeBaseBtnBkk) this.wardrobeBaseBtnBkk.classList.toggle('active', isBoy);
      if (this.wardrobeBaseBtnDxb) this.wardrobeBaseBtnDxb.classList.toggle('active', !isBoy);

      // 4. Couple Sanctuary
      if (couple && couple.isCouple) {
        if (this.coupleCardLinked) this.coupleCardLinked.classList.remove('hidden');
        if (this.coupleCardUnlinked) this.coupleCardUnlinked.classList.add('hidden');

        if (this.coupleMeImg) this.coupleMeImg.src = myAvatarSrc;
        if (this.coupleMeName) this.coupleMeName.textContent = user ? user.username : 'You';
        if (this.coupleMeBase) this.coupleMeBase.textContent = isBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';

        const partner = couple.partner || {};
        const partnerIsBoy = partner.character_base === 'bkk';
        const partnerAvatarSrc = partnerIsBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen.png';
        if (this.couplePartnerImg) this.couplePartnerImg.src = partnerAvatarSrc;
        if (this.couplePartnerName) this.couplePartnerName.textContent = partner.username || 'Partner';
        if (this.couplePartnerBase) this.couplePartnerBase.textContent = partnerIsBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';

        if (this.couplePartnerStatusText) {
          this.couplePartnerStatusText.textContent = '🟢 Online · Ready for Call';
        }

        if (this.coupleAnniversaryText && couple.anniversaryDate) {
          try {
            const d = new Date(couple.anniversaryDate);
            this.coupleAnniversaryText.textContent = d.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          } catch (e) {
            this.coupleAnniversaryText.textContent = 'Active';
          }
        }
      } else {
        if (this.coupleCardLinked) this.coupleCardLinked.classList.add('hidden');
        if (this.coupleCardUnlinked) this.coupleCardUnlinked.classList.remove('hidden');
      }

      // 5. Friends List
      if (this.friendsCountEl) this.friendsCountEl.textContent = friends.length;
      if (this.friendsListContainer) {
        if (friends.length === 0) {
          this.friendsListContainer.innerHTML =
            '<div class="friends-empty-state">No flight companions added yet.<br>Add friends above to fly together! ✈️</div>';
        } else {
          this.friendsListContainer.innerHTML = friends
            .map((f) => {
              const friendBoy = f.character_base === 'bkk';
              const friendSprite = friendBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen.png';
              const statusDot = f.isOnline ? '🟢' : '⚪';
              const statusText = f.isOnline ? 'In Cabin Lounge' : 'Offline';
              return `
              <div class="friend-row" data-id="${f.friendshipId}">
                <div class="friend-main">
                  <div class="friend-avatar-wrap">
                    <img src="${friendSprite}" class="friend-avatar-img" alt="${f.username}">
                  </div>
                  <div class="friend-info">
                    <div class="friend-name-row">
                      <span class="friend-name">${f.username}</span>
                      <span style="font-size:10px;">${friendBoy ? '🐺' : '🐉'}</span>
                    </div>
                    <span class="friend-status">${statusDot} ${statusText}</span>
                  </div>
                </div>
                <div class="friend-actions">
                  <button class="friend-action-btn remove" data-action="remove-friend" data-id="${f.friendshipId}" title="Remove Friend">✕</button>
                </div>
              </div>`;
            })
            .join('');

          // Bind remove buttons
          this.friendsListContainer.querySelectorAll('[data-action="remove-friend"]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const fId = btn.dataset.id;
              if (confirm('Remove friend from your roster?')) {
                await window.SkySupabase.removeFriend(fId);
                this.render();
              }
            });
          });
        }
      }
    }
  }

  // Export Singleton
  window.SkySocialUI = new SkySocialUI();

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => window.SkySocialUI.init());
    } else {
      window.SkySocialUI.init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
