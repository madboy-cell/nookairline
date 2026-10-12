const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function testFullFlow() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Simulate logged-in user
  await page.evaluate(() => {
    const profile = {
      id: 'f1ce659f-b220-4d94-827e-e49d0d298089',
      username: 'Thanapat siripon',
      character_base: 'bkk',
      diamonds: 15000,
      stardust: 0,
      equipped_costume: 'pilot',
      inventory: [],
      pity: {},
      isGuest: false
    };
    localStorage.setItem('sky_profile_v2', JSON.stringify(profile));
    localStorage.setItem('sky_onboarding_completed', 'true');
    localStorage.setItem('sky_active_persona', 'bkk');

    if (window.SkySupabase) {
      window.SkySupabase.currentUser = profile;
    }
    if (window.SkySocialUI) {
      window.SkySocialUI.closeOnboarding(true);
      window.SkySocialUI.render();
    }
  });

  await new Promise(r => setTimeout(r, 600));

  // Step 1: Cabin view
  const cabinPath = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd/proof_step1_cabin.png';
  await page.screenshot({ path: cabinPath });
  console.log('Step 1 saved to:', cabinPath);

  // Step 2: Click Monopoly button
  console.log('Clicking Monopoly button...');
  await page.evaluate(() => {
    const btn = document.getElementById('openMonopolyBtn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const lobbyPath = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd/proof_step2_departure_lobby.png';
  await page.screenshot({ path: lobbyPath });
  console.log('Step 2 saved to:', lobbyPath);

  // Step 3: Click "+ Create Room" to open room creator
  console.log('Opening Create Room view...');
  await page.evaluate(() => {
    const createBtn = document.getElementById('btnOpenCreateModal') || 
                      document.querySelector('.neora-btn-primary') ||
                      document.querySelector('button[title*="Create"]');
    if (createBtn) createBtn.click();
    else if (typeof switchNeoraView === 'function') switchNeoraView('create');
  });
  await new Promise(r => setTimeout(r, 600));

  const createRoomPath = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd/proof_step3_create_room.png';
  await page.screenshot({ path: createRoomPath });
  console.log('Step 3 saved to:', createRoomPath);

  // Step 4: Submit Create Room
  console.log('Submitting Create Room...');
  await page.evaluate(() => {
    if (typeof submitNeoraCreateRoom === 'function') {
      submitNeoraCreateRoom();
    } else {
      const subBtn = document.getElementById('btnSubmitCreateRoom');
      if (subBtn) subBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const waitingRoomPath = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd/proof_step4_waiting_room.png';
  await page.screenshot({ path: waitingRoomPath });
  console.log('Step 4 saved to:', waitingRoomPath);

  // Step 5: Start Match to enter the active game board!
  console.log('Clicking Start Match (#neoraStartGameBtn)...');
  const startResult = await page.evaluate(() => {
    const startBtn = document.getElementById('neoraStartGameBtn');
    if (startBtn) {
      startBtn.click();
      return { clicked: true };
    }
    if (typeof startNeoraRoomGame === 'function') {
      startNeoraRoomGame();
      return { calledFn: true };
    }
    return { notFound: true };
  });
  console.log('Start result:', startResult);
  await new Promise(r => setTimeout(r, 1500));

  const boardPath = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd/proof_step5_active_board.png';
  await page.screenshot({ path: boardPath });
  console.log('Step 5 saved to:', boardPath);

  await browser.close();
}

testFullFlow().catch(console.error);
