/**
 * Sky Party — Social Drawer & Couple Sanctuary UI Controller (Phase 5)
 * Coordinates the slide-out drawer, couple state, friends list, and WebRTC call gating.
 */

(function (window) {
  'use strict';

  const $ = (id) => document.getElementById(id);

  class SkySocialUI {
    constructor() {
      this.isOpen = false;
      this.currentTab = 'couple';
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.mountHudElements();
      this._bindElements();
      this._bindEvents();
      this.render();

      console.log('[SkySocialUI] Initialized successfully.');
    }

    mountHudElements() {
      const header = $('flightHeader');
      if (!header) return;
      let group = (typeof header.querySelector === 'function') ? header.querySelector('.hdr-right') : $('flightHeaderRight');
      if (!group) {
        if (typeof document.createElement === 'function') {
          group = document.createElement('div');
          group.className = 'hdr-right';
          group.id = 'flightHeaderRight';
          if (header.appendChild) header.appendChild(group);
        } else {
          return;
        }
      }

      if (!$('hudBaseSwitchBtn')) {
        const btn = document.createElement('button');
        btn.id = 'hudBaseSwitchBtn';
        btn.className = 'hud-base-btn';
        btn.type = 'button';
        btn.title = 'Switch Character Base: Wolf Boy / Dragon Girl';
        btn.innerHTML = '<span id="hudBaseIcon">🐺</span> <b id="hudBaseText">Boy</b>';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const cur = window.SkySupabase ? window.SkySupabase.getCharacterBase() : 'bkk';
          this.switchBase(cur === 'bkk' ? 'dxb' : 'bkk');
        });
        group.insertBefore(btn, group.firstChild);
      }

      if (!$('hudCoupleBtn')) {
        const btn = document.createElement('button');
        btn.id = 'hudCoupleBtn';
        btn.className = 'hud-couple-btn';
        btn.type = 'button';
        btn.title = 'Couple Sanctuary & Flight Social';
        btn.innerHTML = '<span>💞</span> <b id="hudCoupleText">Couple</b><span class="hud-badge-dot"></span>';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDrawer();
        });
        const baseBtn = $('hudBaseSwitchBtn');
        if (baseBtn && baseBtn.nextSibling) {
          group.insertBefore(btn, baseBtn.nextSibling);
        } else {
          group.appendChild(btn);
        }
      }
    }

    _bindElements() {
      this.drawer = $('socialDrawer');
      this.backdrop = $('socialDrawerBackdrop');
      this.triggerBtn = $('flightHeaderSocialBtn');
      this.closeBtn = $('closeSocialDrawerBtn');

      // Profile & Base Switcher
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

      // Couple Sanctuary
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
      // Open / Close Drawer
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

      // Base Switcher Buttons
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

      // Tab Switching
      if (this.tabCoupleBtn) {
        this.tabCoupleBtn.addEventListener('click', () => this.switchTab('couple'));
      }
      if (this.tabFriendsBtn) {
        this.tabFriendsBtn.addEventListener('click', () => this.switchTab('friends'));
      }

      // Couple Actions
      if (this.coupleInviteForm) {
        this.coupleInviteForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const target = this.coupleInviteInput.value.trim();
          if (!target) return;
          try {
            await window.SkySupabase.createCoupleInvite(target);
            this.coupleInviteInput.value = '';
            this.render();
          } catch (err) {
            alert(err.message || 'Failed to send couple invite');
          }
        });
      }

      if (this.coupleDecoupleBtn) {
        this.coupleDecoupleBtn.addEventListener('click', async () => {
          const confirmMsg =
            'Are you sure you want to decouple from your partner?\n\n' +
            '🛡️ 100% Zero-Loss Guarantee: Your diamonds, wardrobe items, and stardust will remain completely untouched.';
          if (confirm(confirmMsg)) {
            await window.SkySupabase.decouple();
            this.render();
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

      // Friends Actions
      if (this.addFriendForm) {
        this.addFriendForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const target = this.addFriendInput.value.trim();
          if (!target) return;
          try {
            await window.SkySupabase.sendFriendRequest(target);
            this.addFriendInput.value = '';
            this.render();
          } catch (err) {
            alert(err.message || 'Failed to add friend');
          }
        });
      }

      // Gating Modal Events
      if (this.gatingOpenSanctuaryBtn) {
        this.gatingOpenSanctuaryBtn.addEventListener('click', () => {
          this.hideGatingModal();
          this.openDrawer('couple');
        });
      }
      if (this.gatingCloseBtn) {
        this.gatingCloseBtn.addEventListener('click', () => this.hideGatingModal());
      }

      // Listen for Supabase & System Events
      window.addEventListener('sky:character_base_changed', () => this.render());
      window.addEventListener('sky:couple_status_changed', () => this.render());
      window.addEventListener('sky:friends_changed', () => this.render());

      if (window.SkySupabase && typeof window.SkySupabase.onPresenceChange === 'function') {
        window.SkySupabase.onPresenceChange(() => this.render());
      }
    }

    openDrawer(tab = null) {
      if (tab) this.switchTab(tab);
      this.isOpen = true;
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

      // 1. Profile section
      if (user) {
        if (this.usernameEl) this.usernameEl.textContent = user.username || 'Captain';
        if (this.diamondsEl) this.diamondsEl.textContent = (user.diamonds || 5000).toLocaleString();
        const role = window.myTerminal ? window.myTerminal.toUpperCase() : 'BKK';
        if (this.seatChipEl) this.seatChipEl.textContent = `Seat ${role}`;
      }

      const isBoy = currentBase === 'bkk';
      const myAvatarSrc = isBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen_idle.png';
      if (this.userAvatarImg) this.userAvatarImg.src = myAvatarSrc;
      if (this.baseBadgeEl) {
        this.baseBadgeEl.textContent = isBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';
        this.baseBadgeEl.style.background = isBoy ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)';
        this.baseBadgeEl.style.borderColor = isBoy ? 'rgba(59, 130, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)';
        this.baseBadgeEl.style.color = isBoy ? '#93c5fd' : '#f9a8d4';
      }

      if (this.baseBtnBkk) this.baseBtnBkk.classList.toggle('active', isBoy);
      if (this.baseBtnDxb) this.baseBtnDxb.classList.toggle('active', !isBoy);
      if (this.wardrobeBaseBtnBkk) this.wardrobeBaseBtnBkk.classList.toggle('active', isBoy);
      if (this.wardrobeBaseBtnDxb) this.wardrobeBaseBtnDxb.classList.toggle('active', !isBoy);

      this.mountHudElements();
      const hudBaseIcon = $('hudBaseIcon');
      const hudBaseText = $('hudBaseText');
      const hudBaseBtn = $('hudBaseSwitchBtn');
      if (hudBaseIcon) hudBaseIcon.textContent = isBoy ? '🐺' : '🐉';
      if (hudBaseText) hudBaseText.textContent = isBoy ? 'Boy' : 'Girl';
      if (hudBaseBtn) {
        hudBaseBtn.classList.toggle('dxb', !isBoy);
        hudBaseBtn.title = `Active Base: ${isBoy ? 'Wolf Boy' : 'Dragon Girl'} (Tap to switch)`;
      }

      const hudCoupleText = $('hudCoupleText');
      if (hudCoupleText) {
        if (couple && couple.isCouple && couple.partner) {
          hudCoupleText.textContent = couple.partner.username || 'Partner 💞';
        } else {
          hudCoupleText.textContent = 'Couple 💞';
        }
      }

      // 2. Couple Sanctuary
      if (couple && couple.isCouple) {
        if (this.coupleCardLinked) this.coupleCardLinked.classList.remove('hidden');
        if (this.coupleCardUnlinked) this.coupleCardUnlinked.classList.add('hidden');

        if (this.coupleMeImg) this.coupleMeImg.src = myAvatarSrc;
        if (this.coupleMeName) this.coupleMeName.textContent = user ? user.username : 'You';
        if (this.coupleMeBase) this.coupleMeBase.textContent = isBoy ? '🐺 Wolf Boy' : '🐉 Dragon Girl';

        const partner = couple.partner || {};
        const partnerIsBoy = partner.character_base === 'bkk';
        const partnerAvatarSrc = partnerIsBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen_idle.png';
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

      // 3. Friends List
      if (this.friendsCountEl) this.friendsCountEl.textContent = friends.length;
      if (this.friendsListContainer) {
        if (friends.length === 0) {
          this.friendsListContainer.innerHTML =
            '<div class="friends-empty-state">No flight companions added yet.<br>Add friends above to fly together! ✈️</div>';
        } else {
          this.friendsListContainer.innerHTML = friends
            .map((f) => {
              const friendBoy = f.character_base === 'bkk';
              const friendSprite = friendBoy ? 'assets/bkk_warrior_idle.png' : 'assets/got_queen_idle.png';
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
