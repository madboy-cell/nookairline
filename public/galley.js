/**
 * Nook Airline — Sky Bistro: First-Class Galley Dash
 * Intuitive, Self-Guiding Co-op Cooking Engine with Smart Step Hints & Glowing Targets
 */

(function () {
  'use strict';

  // Sound Engine using Web Audio API (zero extra files, zero lag)
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playGalleyChop() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch (e) {}
  }

  function playGalleySizzle() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  }

  function playGalleyBell() {
    playTone(987.77, 'sine', 0.45, 0.35); // B5
    setTimeout(() => playTone(1318.51, 'sine', 0.6, 0.3), 80); // E6
  }

  function playGalleyToss() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  function playGalleyFanfare() {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'triangle', 0.4, 0.25), idx * 120);
    });
  }

  // Recipes & Menu Data with Step-by-Step Flow Diagrams
  const RECIPES = {
    wagyu_steak: {
      id: 'wagyu_steak',
      name: 'Wagyu Steak',
      points: 150,
      img: 'assets/dish_wagyu_steak.png',
      steps: ['🥩', '🔪', '🍳', '🍽️'],
      targetItem: 'dish_wagyu_steak'
    },
    mango_rice: {
      id: 'mango_rice',
      name: 'Mango Sticky Rice',
      points: 130,
      img: 'assets/dish_mango_rice.png',
      steps: ['🥭', '🔪', '🍚', '🍽️'],
      targetItem: 'dish_mango_rice'
    },
    gold_mocktail: {
      id: 'gold_mocktail',
      name: 'Skyline Mocktail',
      points: 110,
      img: 'assets/dish_gold_mocktail.png',
      steps: ['🍋', '🔪', '🍸'],
      targetItem: 'dish_gold_mocktail'
    }
  };

  const ITEMS = {
    raw_beef: { name: 'Raw Wagyu', emoji: '🥩', type: 'raw' },
    sliced_beef: { name: 'Sliced Steak', emoji: '🥩', type: 'chopped' },
    cooked_steak: { name: 'Seared Steak', emoji: '🥩🔥', type: 'cooked' },
    raw_mango: { name: 'Raw Mango', emoji: '🥭', type: 'raw' },
    diced_mango: { name: 'Diced Mango', emoji: '🥭', type: 'chopped' },
    raw_lime: { name: 'Raw Lime', emoji: '🍋', type: 'raw' },
    sliced_lime: { name: 'Sliced Lime', emoji: '🍋', type: 'chopped' },
    rice: { name: 'Coconut Rice', emoji: '🍚', type: 'ingredient' },
    plate: { name: 'Plate', emoji: '🍽️', type: 'plate' },
    plate_rice: { name: 'Plate with Rice', emoji: '🍽️🍚', type: 'prep_plate' },
    plate_mango: { name: 'Plate with Mango', emoji: '🍽️🥭', type: 'prep_plate' },
    dish_wagyu_steak: { name: 'Wagyu Steak', img: 'assets/dish_wagyu_steak.png', type: 'dish' },
    dish_mango_rice: { name: 'Mango Sticky Rice', img: 'assets/dish_mango_rice.png', type: 'dish' },
    dish_gold_mocktail: { name: 'Skyline Mocktail', img: 'assets/dish_gold_mocktail.png', type: 'dish' }
  };

  // Station Coordinates for 2D Cabin Floor
  const STATIONS = {
    fridge: { x: 18, y: 72 },
    board: { x: 32, y: 72 },
    pass: { x: 50, y: 72 },
    stove: { x: 68, y: 72 },
    shaker: { x: 58, y: 72 },
    plates: { x: 78, y: 72 },
    serve: { x: 86, y: 72 },
    trash: { x: 10, y: 72 }
  };

  // State
  let isGalleyActive = false;
  let gameTimer = null;
  let roundTimeLeft = 120;
  let score = 0;
  let dishesServed = 0;
  let combos = 0;
  let tickets = [];
  let myHeldItem = null;
  let partnerHeldItem = null;

  // Station States
  let boardItem = null;
  let stoveItem = null;
  let stoveState = 'empty'; // 'empty', 'cooking', 'cooked', 'burnt'
  let stoveTimer = null;
  let shakerItem = null;
  let shakerState = 'empty'; // 'empty', 'shaking', 'ready'
  let passSlots = [null, null];

  // DOM Elements Cache
  let galleyStage, skyLounge, galleyTickets, galleyScore, galleyTimer, coachHintText;
  let btnPantryBeef, btnPantryMango, btnPantryLime, btnPantryRice;
  let btnStationBoard, btnStationStove, btnStationShaker, btnStationPlates, btnStationServe, btnStationPass;
  let boardStatus, stoveStatus, shakerStatus, passStatus;
  let boardIcon, stoveIcon, shakerIcon, passIcon;
  let myGalleyAvatar, partnerGalleyAvatar;

  function initGalley() {
    injectGalleyCurtain();
    cacheElements();
    setupEventListeners();
  }

  function injectGalleyCurtain() {
    if (document.getElementById('galleyCurtain')) return;
    const curtain = document.createElement('div');
    curtain.id = 'galleyCurtain';
    curtain.className = 'galley-curtain';
    curtain.innerHTML = `
      <div class="curtain-crest">👨‍🍳 ✈️ ⭐</div>
      <div class="curtain-text">First-Class Galley Dash</div>
    `;
    const stage = document.getElementById('remoteWrapper') || document.body;
    stage.appendChild(curtain);
  }

  function cacheElements() {
    galleyStage = document.getElementById('galleyStage');
    skyLounge = document.getElementById('skyLounge');
    galleyTickets = document.getElementById('galleyTickets');
    galleyScore = document.getElementById('galleyScore');
    galleyTimer = document.getElementById('galleyTimer');
    coachHintText = document.getElementById('coachHintText');

    btnPantryBeef = document.getElementById('btnPantryBeef');
    btnPantryMango = document.getElementById('btnPantryMango');
    btnPantryLime = document.getElementById('btnPantryLime');
    btnPantryRice = document.getElementById('btnPantryRice');

    btnStationBoard = document.getElementById('btnStationBoard');
    btnStationStove = document.getElementById('btnStationStove');
    btnStationShaker = document.getElementById('btnStationShaker');
    btnStationPlates = document.getElementById('btnStationPlates');
    btnStationServe = document.getElementById('btnStationServe');
    btnStationPass = document.getElementById('btnStationPass');

    boardStatus = document.getElementById('boardStatus');
    stoveStatus = document.getElementById('stoveStatus');
    shakerStatus = document.getElementById('shakerStatus');
    passStatus = document.getElementById('passStatus');

    boardIcon = document.getElementById('boardIcon');
    stoveIcon = document.getElementById('stoveIcon');
    shakerIcon = document.getElementById('shakerIcon');
    passIcon = document.getElementById('passIcon');

    myGalleyAvatar = document.getElementById('myGalleyAvatar');
    partnerGalleyAvatar = document.getElementById('partnerGalleyAvatar');
  }

  function setupEventListeners() {
    // Open Galley button in emotion deck
    const openBtn = document.getElementById('openGalleyBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        requestStartGalley(true);
      });
    }

    // Exit Galley
    const exitBtn = document.getElementById('exitGalleyBtn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        closeGalley(true);
      });
    }

    // Play again / Back to lounge in modal
    const playAgainBtn = document.getElementById('galleyPlayAgainBtn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        document.getElementById('galleyResultModal').classList.add('hidden');
        startGalleyMatch();
      });
    }
    const backLoungeBtn = document.getElementById('galleyBackLoungeBtn');
    if (backLoungeBtn) {
      backLoungeBtn.addEventListener('click', () => {
        document.getElementById('galleyResultModal').classList.add('hidden');
        closeGalley(true);
      });
    }

    // Pantry Ingredient Buttons
    if (btnPantryBeef) btnPantryBeef.addEventListener('click', () => onPantryClick('raw_beef'));
    if (btnPantryMango) btnPantryMango.addEventListener('click', () => onPantryClick('raw_mango'));
    if (btnPantryLime) btnPantryLime.addEventListener('click', () => onPantryClick('raw_lime'));
    if (btnPantryRice) btnPantryRice.addEventListener('click', () => onPantryClick('rice'));

    // Action Stations
    if (btnStationBoard) btnStationBoard.addEventListener('click', onBoardClick);
    if (btnStationStove) btnStationStove.addEventListener('click', onStoveClick);
    if (btnStationShaker) btnStationShaker.addEventListener('click', onShakerClick);
    if (btnStationPlates) btnStationPlates.addEventListener('click', onPlatesClick);
    if (btnStationServe) btnStationServe.addEventListener('click', onServeClick);
    if (btnStationPass) btnStationPass.addEventListener('click', onPassClick);

    // Utility
    const btnToss = document.getElementById('btnToss');
    if (btnToss) btnToss.addEventListener('click', onTossClick);
    const btnTrash = document.getElementById('btnTrash');
    if (btnTrash) btnTrash.addEventListener('click', onTrashClick);

    // In-game Mic toggle (seamless calling without leaving game)
    const galleyMic = document.getElementById('galleyMicToggle');
    if (galleyMic) {
      galleyMic.addEventListener('click', () => {
        const mainMic = document.getElementById('micBtn');
        if (mainMic) mainMic.click();
        const isMuted = mainMic ? mainMic.classList.contains('active-off') : false;
        galleyMic.classList.toggle('muted', isMuted);
        const icon = document.getElementById('galleyMicIcon');
        if (icon) icon.textContent = isMuted ? '🔇' : '🎙️';
      });
    }
  }

  // Lifecycle
  function requestStartGalley(isLocal = true) {
    if (isLocal && typeof sendSignaling === 'function') {
      sendSignaling({ type: 'galley_open' });
    }
    triggerCurtainTransition(() => {
      openGalleyView();
      startGalleyMatch();
    });
  }

  function triggerCurtainTransition(onMidpoint) {
    const curtain = document.getElementById('galleyCurtain');
    if (typeof playCabinChime === 'function') playCabinChime('connect');
    if (curtain) {
      curtain.classList.add('closing');
      setTimeout(() => {
        if (onMidpoint) onMidpoint();
        setTimeout(() => {
          curtain.classList.remove('closing');
        }, 350);
      }, 500);
    } else {
      if (onMidpoint) onMidpoint();
    }
  }

  function openGalleyView() {
    isGalleyActive = true;
    const app = document.getElementById('app');
    if (app) app.classList.add('galley-mode-active');
    if (skyLounge) skyLounge.classList.add('hidden');
    if (galleyStage) galleyStage.classList.remove('hidden');

    // Sync mic button state
    const mainMic = document.getElementById('micBtn');
    const galleyMic = document.getElementById('galleyMicToggle');
    const icon = document.getElementById('galleyMicIcon');
    if (mainMic && galleyMic) {
      const isMuted = mainMic.classList.contains('active-off');
      galleyMic.classList.toggle('muted', isMuted);
      if (icon) icon.textContent = isMuted ? '🔇' : '🎙️';
    }

    // Default positioning: Left prep chef at 26%, Right cooking chef at 74%
    renderChefAvatar('myGalleyAvatar', true, 26, 68);
    renderChefAvatar('partnerGalleyAvatar', false, 74, 68);
  }

  function closeGalley(isLocal = true) {
    if (isLocal && typeof sendSignaling === 'function') {
      sendSignaling({ type: 'galley_close' });
    }
    triggerCurtainTransition(() => {
      isGalleyActive = false;
      const app = document.getElementById('app');
      if (app) app.classList.remove('galley-mode-active');
      clearInterval(gameTimer);
      clearInterval(stoveTimer);
      if (galleyStage) galleyStage.classList.add('hidden');
      if (skyLounge) skyLounge.classList.remove('hidden');
      const resModal = document.getElementById('galleyResultModal');
      if (resModal) resModal.classList.add('hidden');
    });
  }

  function startGalleyMatch() {
    score = 0;
    dishesServed = 0;
    combos = 0;
    roundTimeLeft = 120;
    tickets = [];
    myHeldItem = null;
    partnerHeldItem = null;
    boardItem = null;
    stoveItem = null;
    stoveState = 'empty';
    shakerItem = null;
    shakerState = 'empty';
    passSlots = [null, null];

    updateScoreDisplay();
    updateStationBadges();
    updateHeldItemDisplay('myGalleyAvatar', null);
    updateHeldItemDisplay('partnerGalleyAvatar', null);
    updateCoachHint();

    // Show Countdown 3... 2... 1... COOK!
    const overlay = document.getElementById('galleyCountdown');
    const numEl = document.getElementById('countdownNumber');
    if (overlay && numEl) {
      overlay.classList.remove('hidden');
      numEl.textContent = '3';
      playTone(523.25, 'sine', 0.2);

      setTimeout(() => {
        numEl.textContent = '2';
        playTone(587.33, 'sine', 0.2);
      }, 700);

      setTimeout(() => {
        numEl.textContent = '1';
        playTone(659.25, 'sine', 0.2);
      }, 1400);

      setTimeout(() => {
        numEl.textContent = 'COOK! 🍳';
        playTone(1046.50, 'sine', 0.4, 0.3);
        setTimeout(() => {
          overlay.classList.add('hidden');
          runGameLoop();
        }, 500);
      }, 2100);
    } else {
      runGameLoop();
    }
  }

  function runGameLoop() {
    spawnNewTicket();
    spawnNewTicket();
    spawnNewTicket();

    clearInterval(gameTimer);
    gameTimer = setInterval(() => {
      roundTimeLeft--;
      if (roundTimeLeft <= 0) {
        endGalleyMatch();
        return;
      }
      updateTimerDisplay();
      tickOrders();
    }, 1000);
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    if (!galleyTimer) return;
    const mins = Math.floor(roundTimeLeft / 60);
    const secs = roundTimeLeft % 60;
    galleyTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const timerChip = galleyTimer.closest('.timer-chip');
    if (timerChip) {
      timerChip.classList.toggle('urgent', roundTimeLeft <= 30);
    }
  }

  function endGalleyMatch() {
    clearInterval(gameTimer);
    clearInterval(stoveTimer);
    playGalleyFanfare();

    const resModal = document.getElementById('galleyResultModal');
    const resScore = document.getElementById('resultScore');
    const resDishes = document.getElementById('resDishes');
    const resCombos = document.getElementById('resCombos');
    const resRank = document.getElementById('resRank');
    const resStars = document.getElementById('resultStars');

    if (resScore) resScore.textContent = score;
    if (resDishes) resDishes.textContent = dishesServed;
    if (resCombos) resCombos.textContent = combos;

    let stars = '⭐';
    let rank = 'Flight Trainee';
    if (score >= 450) {
      stars = '⭐⭐⭐';
      rank = 'Michelin Executive Sky Chef';
    } else if (score >= 250) {
      stars = '⭐⭐';
      rank = 'First-Class Sous Chef';
    }

    if (resStars) resStars.textContent = stars;
    if (resRank) resRank.textContent = rank;
    if (resModal) resModal.classList.remove('hidden');
  }

  // Self-Guiding Visual Tickets
  function spawnNewTicket() {
    if (tickets.length >= 4) return;
    const keys = Object.keys(RECIPES);
    const randKey = keys[Math.floor(Math.random() * keys.length)];
    const rec = RECIPES[randKey];

    tickets.push({
      id: 't_' + Math.random().toString(36).substr(2, 6),
      recipeId: rec.id,
      name: rec.name,
      points: rec.points,
      img: rec.img,
      steps: rec.steps,
      targetItem: rec.targetItem,
      maxTime: 65,
      timeLeft: 65
    });
    renderTickets();
  }

  function tickOrders() {
    tickets.forEach((t) => t.timeLeft--);
    const beforeCount = tickets.length;
    tickets = tickets.filter((t) => t.timeLeft > 0);
    if (tickets.length < beforeCount) {
      playTone(180, 'sawtooth', 0.3);
    }
    while (tickets.length < 3) {
      spawnNewTicket();
    }
    renderTickets();
  }

  function renderTickets() {
    if (!galleyTickets) return;
    galleyTickets.innerHTML = '';

    tickets.forEach((t) => {
      const pct = Math.max(0, (t.timeLeft / t.maxTime) * 100);
      const isUrgent = t.timeLeft <= 20;

      const ticketEl = document.createElement('div');
      ticketEl.className = `order-ticket ${isUrgent ? 'rush' : ''}`;
      ticketEl.innerHTML = `
        <div class="ticket-header">
          <span class="ticket-title">${t.name}</span>
          <span class="ticket-points">+${t.points}</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-dish-preview">
            <img src="${t.img}" class="ticket-dish-img" alt="${t.name}" />
          </div>
          <div class="ticket-recipe-flow">
            <span class="recipe-step-label">Steps</span>
            <div class="recipe-steps-pills">
              ${t.steps.map((st, i) => `${i > 0 ? '<span class="step-arrow">➔</span>' : ''}<span>${st}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="ticket-timer-bar">
          <div class="ticket-timer-fill ${pct < 25 ? 'danger' : pct < 50 ? 'warn' : ''}" style="width: ${pct}%"></div>
        </div>
      `;
      galleyTickets.appendChild(ticketEl);
    });
  }

  // ==========================================================================
  // SMART COACH & GLOWING HIGHLIGHT TARGETS
  // ==========================================================================
  function updateCoachHint() {
    if (!coachHintText) return;

    // Clear all target highlights first
    clearAllHighlights();

    if (!myHeldItem) {
      // Hands empty: Check if stove or shaker has cooked item ready
      if (stoveState === 'cooked') {
        coachHintText.textContent = '🥩 Sizzled! Tap [🍽️ Plate], then tap [🍳 Stove]!';
        highlightButton(btnStationPlates);
        return;
      }
      if (shakerState === 'ready') {
        coachHintText.textContent = '🍹 Mocktail ready! Tap [🍸 Shaker] to grab!';
        highlightButton(btnStationShaker);
        return;
      }
      if (boardItem && ['sliced_beef', 'diced_mango', 'sliced_lime'].includes(boardItem)) {
        coachHintText.textContent = `✨ Chopped item ready! Tap [🔪 Chop Board] to grab!`;
        highlightButton(btnStationBoard);
        return;
      }

      coachHintText.textContent = '👉 Tap 🥩 Wagyu, 🥭 Mango, or 🍋 Lime to start an order!';
      highlightButton(btnPantryBeef);
      highlightButton(btnPantryMango);
      highlightButton(btnPantryLime);
      return;
    }

    // Holding raw ingredient
    if (['raw_beef', 'raw_mango', 'raw_lime'].includes(myHeldItem)) {
      const name = ITEMS[myHeldItem].name;
      coachHintText.textContent = `👉 Holding ${name}! Tap [🔪 Chop Board] to slice!`;
      highlightButton(btnStationBoard);
      return;
    }

    // Holding sliced steak
    if (myHeldItem === 'sliced_beef') {
      coachHintText.textContent = '👉 Sliced steak in hand! Tap [🍳 Stove] to cook!';
      highlightButton(btnStationStove);
      return;
    }

    // Holding diced mango
    if (myHeldItem === 'diced_mango') {
      coachHintText.textContent = '👉 Diced mango ready! Tap [🍽️ Plate] to assemble!';
      highlightButton(btnStationPlates);
      return;
    }

    // Holding sliced lime
    if (myHeldItem === 'sliced_lime') {
      coachHintText.textContent = '👉 Sliced lime in hand! Tap [🍸 Shaker] to mix!';
      highlightButton(btnStationShaker);
      return;
    }

    // Holding rice
    if (myHeldItem === 'rice') {
      coachHintText.textContent = '👉 Holding Coconut Rice! Tap [🍽️ Plate] to combine!';
      highlightButton(btnStationPlates);
      return;
    }

    // Holding plate
    if (myHeldItem === 'plate') {
      if (stoveState === 'cooked') {
        coachHintText.textContent = '👉 Holding plate! Tap [🍳 Stove] to pick up sizzling steak!';
        highlightButton(btnStationStove);
      } else {
        coachHintText.textContent = '👉 Holding plate! Tap [🍚 Rice] or [🥭 Mango] to assemble dessert!';
        highlightButton(btnPantryRice);
      }
      return;
    }

    // Holding plate with partial combo
    if (myHeldItem === 'plate_rice') {
      coachHintText.textContent = '👉 Rice on plate! Tap [🥭 Mango] or board to add diced mango!';
      highlightButton(btnPantryMango);
      return;
    }
    if (myHeldItem === 'plate_mango') {
      coachHintText.textContent = '👉 Mango on plate! Tap [🍚 Rice] to add coconut sticky rice!';
      highlightButton(btnPantryRice);
      return;
    }

    // Holding completed dish
    if (myHeldItem.startsWith('dish_')) {
      const dish = ITEMS[myHeldItem];
      coachHintText.textContent = `🌟 ${dish.name} Ready! Tap [🛎️ ORDER UP!] to serve!`;
      highlightButton(btnStationServe);
      return;
    }
  }

  function clearAllHighlights() {
    const allBtns = document.querySelectorAll('.console-btn');
    allBtns.forEach((btn) => btn.classList.remove('target-next'));
  }

  function highlightButton(btnEl) {
    if (btnEl) btnEl.classList.add('target-next');
  }

  // ==========================================================================
  // ACTION HANDLERS (ONE-TAP SMART ACTIONS)
  // ==========================================================================

  // 1. Pantry Tap
  function onPantryClick(itemKey) {
    if (myHeldItem) {
      // Special combo: holding plate and tapping rice
      if (myHeldItem === 'plate' && itemKey === 'rice') {
        myHeldItem = 'plate_rice';
        moveChefTo(STATIONS.fridge.x);
        playTone(660, 'sine', 0.15);
        updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
        spawnFloatingText(30, 60, '+ Coconut Rice on Plate! 🍚');
        updateCoachHint();
        broadcastState();
        return;
      }
      // Holding plate_mango and tapping rice -> complete Mango Sticky Rice!
      if (myHeldItem === 'plate_mango' && itemKey === 'rice') {
        myHeldItem = 'dish_mango_rice';
        moveChefTo(STATIONS.fridge.x);
        playTone(880, 'sine', 0.2);
        updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
        spawnFloatingText(30, 60, 'Mango Sticky Rice Complete! 🥭🍚✨');
        updateCoachHint();
        broadcastState();
        return;
      }

      spawnFloatingText(30, 60, 'Hands Full! Tap Station or 🗑️ ✋');
      return;
    }

    // Grab raw item
    myHeldItem = itemKey;
    moveChefTo(STATIONS.fridge.x);
    playTone(520, 'triangle', 0.1);
    updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
    spawnFloatingText(STATIONS.fridge.x, 60, `+ ${ITEMS[itemKey].name}`);
    updateCoachHint();
    broadcastState();
  }

  // 2. Cutting Board Tap (Chops automatically with progress!)
  function onBoardClick() {
    moveChefTo(STATIONS.board.x);

    // If holding unchopped item -> place and chop immediately!
    if (myHeldItem && ['raw_beef', 'raw_mango', 'raw_lime'].includes(myHeldItem)) {
      const itemToChop = myHeldItem;
      myHeldItem = null;
      updateHeldItemDisplay('myGalleyAvatar', null);

      if (boardStatus) {
        boardStatus.classList.remove('hidden');
        boardStatus.textContent = 'Chopping...';
      }
      if (boardIcon) boardIcon.textContent = '🔪';

      const myEl = document.getElementById('myGalleyAvatar');
      if (myEl) myEl.classList.add('chopping');

      // Rapid knife chops
      let chops = 0;
      const chopInterval = setInterval(() => {
        chops++;
        playGalleyChop();
        if (chops >= 4) {
          clearInterval(chopInterval);
          if (myEl) myEl.classList.remove('chopping');

          // Result item
          let resultKey = 'sliced_beef';
          if (itemToChop === 'raw_mango') resultKey = 'diced_mango';
          if (itemToChop === 'raw_lime') resultKey = 'sliced_lime';

          // Pick up directly into hands!
          myHeldItem = resultKey;
          updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
          playTone(880, 'sine', 0.15);
          spawnFloatingText(STATIONS.board.x, 60, `Sliced! ✨`);

          if (boardStatus) boardStatus.classList.add('hidden');
          if (boardIcon) boardIcon.textContent = '🔪';

          updateCoachHint();
          broadcastState();
        }
      }, 260);
      return;
    }

    // If board has item and hands empty -> pick up
    if (!myHeldItem && boardItem) {
      myHeldItem = boardItem;
      boardItem = null;
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      if (boardStatus) boardStatus.classList.add('hidden');
      if (boardIcon) boardIcon.textContent = '🔪';
      playTone(660, 'sine', 0.1);
      updateCoachHint();
      broadcastState();
      return;
    }

    spawnFloatingText(STATIONS.board.x, 60, 'Chop Board Empty! 🔪');
  }

  // 3. Stove Tap
  function onStoveClick() {
    moveChefTo(STATIONS.stove.x);

    // Place sliced beef onto pan
    if (myHeldItem === 'sliced_beef' && stoveState === 'empty') {
      stoveItem = 'sliced_beef';
      stoveState = 'cooking';
      myHeldItem = null;
      updateHeldItemDisplay('myGalleyAvatar', null);
      updateStationBadges();
      startStoveTimer();
      playGalleySizzle();
      spawnFloatingText(STATIONS.stove.x, 60, 'Sizzling on Stove! 🔥');
      updateCoachHint();
      broadcastState();
      return;
    }

    // Plate the cooked steak
    if (myHeldItem === 'plate' && stoveState === 'cooked') {
      stoveItem = null;
      stoveState = 'empty';
      myHeldItem = 'dish_wagyu_steak';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      updateStationBadges();
      playTone(880, 'sine', 0.2);
      spawnFloatingText(STATIONS.stove.x, 60, 'Plated Wagyu Steak! 🥩✨');
      updateCoachHint();
      broadcastState();
      return;
    }

    // Pick up cooked steak directly if hands empty
    if (!myHeldItem && stoveState === 'cooked') {
      myHeldItem = 'cooked_steak';
      stoveItem = null;
      stoveState = 'empty';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      updateStationBadges();
      playTone(660, 'sine', 0.1);
      updateCoachHint();
      broadcastState();
      return;
    }

    // Clear burnt pan
    if (stoveState === 'burnt') {
      stoveItem = null;
      stoveState = 'empty';
      updateStationBadges();
      playTone(300, 'triangle', 0.2);
      spawnFloatingText(STATIONS.stove.x, 60, 'Cleaned Burnt Pan! 🧽');
      updateCoachHint();
      broadcastState();
      return;
    }

    spawnFloatingText(STATIONS.stove.x, 60, 'Stove Ready! 🍳');
  }

  function startStoveTimer() {
    clearInterval(stoveTimer);
    let cookSecs = 0;
    stoveTimer = setInterval(() => {
      cookSecs++;
      playGalleySizzle();

      if (cookSecs === 3) {
        stoveState = 'cooked';
        stoveItem = 'cooked_steak';
        updateStationBadges();
        playTone(980, 'sine', 0.25);
        spawnFloatingText(STATIONS.stove.x, 50, 'Steak Ready! 🥩✨', '#22c55e');
        updateCoachHint();
        broadcastState();
      } else if (cookSecs >= 7) {
        // Burnt!
        clearInterval(stoveTimer);
        stoveState = 'burnt';
        updateStationBadges();
        playTone(160, 'sawtooth', 0.4);
        spawnFloatingText(STATIONS.stove.x, 50, 'BURNT! ⚠️🔥', '#ef4444');
        updateCoachHint();
        broadcastState();
      }
    }, 900);
  }

  // 4. Shaker Tap
  function onShakerClick() {
    moveChefTo(STATIONS.shaker.x);

    // Place sliced lime in shaker
    if (myHeldItem === 'sliced_lime' && shakerState === 'empty') {
      shakerItem = 'sliced_lime';
      shakerState = 'shaking';
      myHeldItem = null;
      updateHeldItemDisplay('myGalleyAvatar', null);
      updateStationBadges();
      playTone(520, 'sine', 0.1);

      // Shaker animation
      let shakes = 0;
      const shakeInterval = setInterval(() => {
        shakes++;
        playTone(340 + shakes * 40, 'triangle', 0.08);
        if (shakes >= 4) {
          clearInterval(shakeInterval);
          shakerState = 'ready';
          shakerItem = 'dish_gold_mocktail';
          updateStationBadges();
          playTone(1046, 'sine', 0.25);
          spawnFloatingText(STATIONS.shaker.x, 50, 'Chilled & Ready! 🍹✨', '#22c55e');
          updateCoachHint();
          broadcastState();
        }
      }, 350);
      return;
    }

    // Pick up ready mocktail
    if (shakerState === 'ready') {
      if (!myHeldItem) {
        myHeldItem = 'dish_gold_mocktail';
        shakerItem = null;
        shakerState = 'empty';
        updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
        updateStationBadges();
        playTone(880, 'sine', 0.2);
        spawnFloatingText(STATIONS.shaker.x, 60, 'Grabbed Mocktail! 🍹');
        updateCoachHint();
        broadcastState();
        return;
      }
    }

    spawnFloatingText(STATIONS.shaker.x, 60, 'Drop Sliced Lime to Shake! 🍸');
  }

  // 5. Clean Plate Tap
  function onPlatesClick() {
    moveChefTo(STATIONS.plates.x);

    // Assembly with held cooked steak
    if (myHeldItem === 'cooked_steak') {
      myHeldItem = 'dish_wagyu_steak';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      playTone(880, 'sine', 0.2);
      spawnFloatingText(STATIONS.plates.x, 60, 'Plated Wagyu Steak! 🥩✨');
      updateCoachHint();
      broadcastState();
      return;
    }

    // Assembly with diced mango
    if (myHeldItem === 'diced_mango') {
      myHeldItem = 'plate_mango';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      playTone(740, 'sine', 0.15);
      spawnFloatingText(STATIONS.plates.x, 60, 'Mango on Plate! Add Rice 🍚');
      updateCoachHint();
      broadcastState();
      return;
    }

    // Assembly with rice
    if (myHeldItem === 'rice') {
      myHeldItem = 'plate_rice';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      playTone(740, 'sine', 0.15);
      spawnFloatingText(STATIONS.plates.x, 60, 'Rice on Plate! Add Mango 🥭');
      updateCoachHint();
      broadcastState();
      return;
    }

    // If hands empty, take a clean plate
    if (!myHeldItem) {
      myHeldItem = 'plate';
      updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
      playTone(660, 'sine', 0.1);
      spawnFloatingText(STATIONS.plates.x, 60, '+ Clean Plate 🍽️');
      updateCoachHint();
      broadcastState();
      return;
    }

    spawnFloatingText(STATIONS.plates.x, 60, 'Hands Full! ✋');
  }

  // 6. Serve / Order Up! Tap
  function onServeClick() {
    moveChefTo(STATIONS.serve.x);
    playGalleyBell();

    if (!myHeldItem) {
      spawnFloatingText(STATIONS.serve.x, 60, 'No Dish in Hand! 🛎️');
      return;
    }

    // Match against active ticket
    const matchIdx = tickets.findIndex((t) => t.targetItem === myHeldItem);
    if (matchIdx !== -1) {
      const ticket = tickets[matchIdx];
      const tipBonus = ticket.timeLeft > 30 ? 40 : 15;
      const earned = ticket.points + tipBonus;
      score += earned;
      dishesServed++;
      combos++;

      tickets.splice(matchIdx, 1);
      myHeldItem = null;
      updateHeldItemDisplay('myGalleyAvatar', null);
      updateScoreDisplay();
      renderTickets();

      playTone(1174, 'sine', 0.35, 0.4);
      spawnFloatingText(STATIONS.serve.x, 45, `+${earned} DELICIOUS! 🌟`, '#f7d070');

      if (combos % 2 === 0) {
        spawnFloatingText(50, 40, `${combos}x COMBO RUSH! 🔥`, '#f97316');
      }

      spawnNewTicket();
      updateCoachHint();
      broadcastState();
      return;
    }

    // Wrong dish penalty
    playTone(160, 'sawtooth', 0.35);
    spawnFloatingText(STATIONS.serve.x, 60, 'Wrong Dish! ⚠️', '#ef4444');
  }

  // 7. Pass Table Tap
  function onPassClick() {
    moveChefTo(STATIONS.pass.x);

    // Place item if holding one
    if (myHeldItem) {
      const emptyIdx = passSlots.indexOf(null);
      if (emptyIdx !== -1) {
        passSlots[emptyIdx] = myHeldItem;
        myHeldItem = null;
        updateHeldItemDisplay('myGalleyAvatar', null);
        updateStationBadges();
        playTone(520, 'sine', 0.1);
        spawnFloatingText(STATIONS.pass.x, 60, 'Passed to Table! 🔄');
        updateCoachHint();
        broadcastState();
        return;
      }
      spawnFloatingText(STATIONS.pass.x, 60, 'Pass Table Full (2/2)! ⚠️');
      return;
    }

    // Pick up from table if hands empty
    for (let i = passSlots.length - 1; i >= 0; i--) {
      if (passSlots[i]) {
        myHeldItem = passSlots[i];
        passSlots[i] = null;
        updateHeldItemDisplay('myGalleyAvatar', myHeldItem);
        updateStationBadges();
        playTone(660, 'sine', 0.1);
        spawnFloatingText(STATIONS.pass.x, 60, `Picked up from Table!`);
        updateCoachHint();
        broadcastState();
        return;
      }
    }

    spawnFloatingText(STATIONS.pass.x, 60, 'Pass Table Empty! 🔄');
  }

  // 8. Toss to Partner
  function onTossClick() {
    if (!myHeldItem) {
      spawnFloatingText(50, 60, 'Hold an item to toss! ✋');
      return;
    }

    const itemToToss = myHeldItem;
    myHeldItem = null;
    updateHeldItemDisplay('myGalleyAvatar', null);

    const myEl = document.getElementById('myGalleyAvatar');
    const partnerEl = document.getElementById('partnerGalleyAvatar');
    const startX = myEl ? parseFloat(myEl.style.left) || 30 : 30;
    const endX = partnerEl ? parseFloat(partnerEl.style.left) || 70 : 70;

    playGalleyToss();
    spawnFlyingTossAnimation(startX, endX, itemToToss, () => {
      if (typeof sendSignaling === 'function') {
        sendSignaling({
          type: 'galley_action',
          action: 'toss_catch',
          item: itemToToss
        });
      }
      playTone(660, 'sine', 0.12);
      spawnFloatingText(endX, 60, 'CAUGHT! 🤾✨');
    });

    updateCoachHint();
    broadcastState();
  }

  function spawnFlyingTossAnimation(startX, endX, itemKey, onDone) {
    const item = ITEMS[itemKey];
    if (!item) return;

    const floor = document.getElementById('galleyFloor');
    if (!floor) return;

    const tossEl = document.createElement('div');
    tossEl.className = 'flying-toss-item';
    tossEl.innerHTML = item.img ? `<img src="${item.img}" style="height:28px;" />` : `<span>${item.emoji}</span>`;
    tossEl.style.left = `${startX}%`;
    tossEl.style.top = `68%`;
    floor.appendChild(tossEl);

    setTimeout(() => {
      tossEl.style.left = `${endX}%`;
      tossEl.style.top = `42%`;
      setTimeout(() => {
        tossEl.style.top = `70%`;
        setTimeout(() => {
          tossEl.remove();
          if (onDone) onDone();
        }, 220);
      }, 230);
    }, 20);
  }

  // 9. Trash Tap
  function onTrashClick() {
    if (myHeldItem) {
      const name = ITEMS[myHeldItem] ? ITEMS[myHeldItem].name : 'Item';
      myHeldItem = null;
      updateHeldItemDisplay('myGalleyAvatar', null);
      playTone(200, 'triangle', 0.15);
      spawnFloatingText(STATIONS.trash.x, 60, `Discarded ${name} 🗑️`);
      updateCoachHint();
      broadcastState();
    } else {
      spawnFloatingText(STATIONS.trash.x, 60, 'Hands already empty! ✋');
    }
  }

  // ==========================================================================
  // STATION BADGES & AVATARS
  // ==========================================================================
  function updateStationBadges() {
    // Stove
    if (stoveStatus && stoveIcon) {
      if (stoveState === 'empty') {
        stoveStatus.classList.add('hidden');
        stoveIcon.textContent = '🍳';
      } else if (stoveState === 'cooking') {
        stoveStatus.classList.remove('hidden');
        stoveStatus.className = 'console-btn-status';
        stoveStatus.textContent = 'Sizzling...';
        stoveIcon.textContent = '🔥';
      } else if (stoveState === 'cooked') {
        stoveStatus.classList.remove('hidden');
        stoveStatus.className = 'console-btn-status ready';
        stoveStatus.textContent = 'Ready! 🥩';
        stoveIcon.textContent = '🥩🔥';
      } else if (stoveState === 'burnt') {
        stoveStatus.classList.remove('hidden');
        stoveStatus.className = 'console-btn-status burnt';
        stoveStatus.textContent = 'BURNT! ⚠️';
        stoveIcon.textContent = '💨';
      }
    }

    // Shaker
    if (shakerStatus && shakerIcon) {
      if (shakerState === 'empty') {
        shakerStatus.classList.add('hidden');
        shakerIcon.textContent = '🍸';
      } else if (shakerState === 'shaking') {
        shakerStatus.classList.remove('hidden');
        shakerStatus.className = 'console-btn-status';
        shakerStatus.textContent = 'Mixing...';
        shakerIcon.textContent = '🧋';
      } else if (shakerState === 'ready') {
        shakerStatus.classList.remove('hidden');
        shakerStatus.className = 'console-btn-status ready';
        shakerStatus.textContent = 'Ready! 🍹';
        shakerIcon.textContent = '🍹';
      }
    }

    // Pass
    if (passStatus) {
      const occupied = passSlots.filter((s) => s !== null).length;
      if (occupied > 0) {
        passStatus.classList.remove('hidden');
        passStatus.textContent = `${occupied}/2`;
      } else {
        passStatus.classList.add('hidden');
      }
    }
  }

  function renderChefAvatar(elementId, isMe, x, y) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const baseAvatar = isMe ? (window.myAvatar || {}) : (window.partnerAvatar || {});
    const sprite = baseAvatar.sprite || 'assets/bkk_warrior_idle.png';

    el.className = 'avatar-entity idle in-galley';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;

    el.innerHTML = `
      <div class="avatar-shadow"></div>
      <div class="galley-chef-hat"></div>
      <div class="avatar-held-item hidden"></div>
      <div class="avatar-body-wrapper">
        <div class="maple-sprite-container">
          <img src="${sprite}" class="maple-sprite-img sprite-idle" alt="Chef" />
        </div>
      </div>
      <div class="avatar-tag ${isMe ? 'me' : ''}">${isMe ? 'Chef You 👨‍🍳' : 'Chef Partner 👩‍🍳'}</div>
    `;
  }

  function moveChefTo(targetX) {
    const el = document.getElementById('myGalleyAvatar');
    if (!el) return;

    const curX = parseFloat(el.style.left) || 30;
    const facing = targetX < curX ? 'left' : 'right';

    el.classList.remove('idle');
    el.classList.add('walking');
    if (facing === 'left') el.classList.add('facing-left');
    else el.classList.remove('facing-left');

    el.style.left = `${targetX}%`;

    setTimeout(() => {
      el.classList.remove('walking');
      el.classList.add('idle');
    }, 550);

    if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'galley_action',
        action: 'move',
        x: targetX,
        y: 72,
        facing
      });
    }
  }

  function updateHeldItemDisplay(avatarId, itemKey) {
    const el = document.getElementById(avatarId);
    if (!el) return;
    const heldBox = el.querySelector('.avatar-held-item');
    if (!heldBox) return;

    if (!itemKey || !ITEMS[itemKey]) {
      heldBox.classList.add('hidden');
      heldBox.innerHTML = '';
      return;
    }

    const item = ITEMS[itemKey];
    heldBox.classList.remove('hidden');
    if (item.img) {
      heldBox.innerHTML = `<img src="${item.img}" alt="${item.name}" />`;
    } else {
      heldBox.innerHTML = `<span>${item.emoji}</span>`;
    }
  }

  function updateScoreDisplay() {
    if (galleyScore) galleyScore.textContent = score;
  }

  function spawnFloatingText(x, y, text, color = '#fff') {
    const floor = document.getElementById('galleyFloor');
    if (!floor) return;

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: ${y}%;
      transform: translate(-50%, -50%);
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 13px;
      color: ${color};
      text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 10px ${color}88;
      pointer-events: none;
      z-index: 90;
      animation: floatUpFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    popup.textContent = text;
    floor.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
  }

  // Multiplayer Signaling
  function broadcastState() {
    if (typeof sendSignaling !== 'function') return;
    sendSignaling({
      type: 'galley_sync',
      score,
      dishesServed,
      combos,
      tickets,
      boardItem,
      stoveItem,
      stoveState,
      shakerItem,
      shakerState,
      passSlots,
      partnerHeld: myHeldItem
    });
  }

  function handleGalleyMessage(msg) {
    if (!msg) return;

    switch (msg.type) {
      case 'galley_open':
        requestStartGalley(false);
        break;

      case 'galley_close':
        closeGalley(false);
        break;

      case 'galley_action':
        if (msg.action === 'move') {
          const pEl = document.getElementById('partnerGalleyAvatar');
          if (pEl) {
            pEl.classList.remove('idle');
            pEl.classList.add('walking');
            if (msg.facing === 'left') pEl.classList.add('facing-left');
            else pEl.classList.remove('facing-left');
            pEl.style.left = `${msg.x}%`;
            setTimeout(() => {
              pEl.classList.remove('walking');
              pEl.classList.add('idle');
            }, 550);
          }
        } else if (msg.action === 'toss_catch') {
          partnerHeldItem = msg.item;
          updateHeldItemDisplay('partnerGalleyAvatar', partnerHeldItem);
          playTone(660, 'sine', 0.12);
        }
        break;

      case 'galley_sync':
        if (typeof msg.score === 'number') {
          score = msg.score;
          updateScoreDisplay();
        }
        if (typeof msg.dishesServed === 'number') dishesServed = msg.dishesServed;
        if (typeof msg.combos === 'number') combos = msg.combos;
        if (Array.isArray(msg.tickets)) {
          tickets = msg.tickets;
          renderTickets();
        }
        if (Array.isArray(msg.passSlots)) {
          passSlots = msg.passSlots;
          updateStationBadges();
        }
        if (msg.boardItem !== undefined) boardItem = msg.boardItem;
        if (msg.stoveItem !== undefined) {
          stoveItem = msg.stoveItem;
          stoveState = msg.stoveState;
          updateStationBadges();
        }
        if (msg.shakerItem !== undefined) {
          shakerItem = msg.shakerItem;
          shakerState = msg.shakerState;
          updateStationBadges();
        }
        if (msg.partnerHeld !== undefined) {
          partnerHeldItem = msg.partnerHeld;
          updateHeldItemDisplay('partnerGalleyAvatar', partnerHeldItem);
        }
        break;
    }
  }

  // Export to window
  window.handleGalleyMessage = handleGalleyMessage;
  window.requestStartGalley = requestStartGalley;
  window.closeGalley = closeGalley;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalley);
  } else {
    initGalley();
  }
})();
