#!/usr/bin/env node
// scripts/smoke_voice_call.mjs — Two-browser live voice call smoke test (nook ↔ neen).
// Verifies: call connects (ICE connected), a tab-switch style auth_resume does NOT rebuild the
// RTCPeerConnection, a forced mic recovery keeps the same connection and sends a live track, and hangup cleans up.
// Uses an isolated temp data dir (never touches server/data/local_db.json).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { startServer } from '../server/server.js';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PORT) || 4011;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-voice-'));
const srv = await startServer({ port: PORT, dataDir, quiet: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

const errors = [];
async function login(user) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', (e) => errors.push(`${user}: ${e.message}`));
  await page.goto(`http://localhost:${PORT}/?dev=1&user=${user}&pass=1234`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__neora?.voiceClient && window.__neora?.net?.connected, { timeout: 20000 });
  return page;
}

const iceState = (page) => page.evaluate(() => window.__neora.voiceClient.pc?.iceConnectionState || 'none');
let ok = true;
const check = (cond, label) => { console.log(`${cond ? '✅' : '❌'} ${label}`); if (!cond) ok = false; };

try {
  const nook = await login('nook');
  const neen = await login('neen');
  console.log('🔑 nook + neen logged in');

  await nook.evaluate(() => window.__neora.voiceClient.call('neen'));
  await neen.waitForFunction(() => window.__neora.voiceClient.state === 'incoming', { timeout: 10000 });
  await neen.evaluate(() => window.__neora.voiceClient.accept());

  const connected = async () => ['connected', 'completed'].includes(await iceState(nook))
    && ['connected', 'completed'].includes(await iceState(neen));
  let t = 0;
  while (!(await connected()) && t < 40) { await sleep(500); t++; }
  check(await connected(), `call connected (nook=${await iceState(nook)}, neen=${await iceState(neen)})`);

  // Tab switch simulation: auth_resume on a live socket must NOT recreate the RTCPeerConnection.
  await nook.evaluate(() => { window.__pcBefore = window.__neora.voiceClient.pc; });
  await neen.evaluate(() => { window.__pcBefore = window.__neora.voiceClient.pc; });
  await neen.evaluate(() => window.__neora.net.send({ type: 'auth_resume' }));
  await nook.evaluate(() => window.__neora.net.send({ type: 'auth_resume' }));
  await sleep(2500);
  check(await nook.evaluate(() => window.__neora.voiceClient.pc === window.__pcBefore), 'nook pc untouched after auth_resume');
  check(await neen.evaluate(() => window.__neora.voiceClient.pc === window.__pcBefore), 'neen pc untouched after auth_resume');

  // Mic recovery (what runs when iOS leaves the mic muted after an app switch): same pc, new live track on the sender.
  const rec = await neen.evaluate(async () => {
    const vc = window.__neora.voiceClient;
    const oldTrack = vc.localStream.getAudioTracks()[0];
    await vc._recoverLocalMic();
    await new Promise((r) => setTimeout(r, 500));
    const sender = vc.pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
    return {
      samePc: vc.pc === window.__pcBefore,
      newTrack: vc.localStream.getAudioTracks()[0] !== oldTrack,
      oldStopped: oldTrack.readyState === 'ended',
      senderLive: !!sender && sender.track === vc.localStream.getAudioTracks()[0] && sender.track.readyState === 'live',
      live: vc._isLocalMicLive(),
    };
  });
  check(rec.samePc && rec.newTrack && rec.oldStopped && rec.senderLive && rec.live, `mic recovery ${JSON.stringify(rec)}`);
  await sleep(1500);
  check(await connected(), 'still connected after mic recovery');

  // Remote audio actually flowing to nook after recovery.
  const bytes1 = await nook.evaluate(async () => {
    const st = await window.__neora.voiceClient.pc.getStats();
    let b = 0; st.forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') b = r.bytesReceived; }); return b;
  });
  await sleep(2000);
  const bytes2 = await nook.evaluate(async () => {
    const st = await window.__neora.voiceClient.pc.getStats();
    let b = 0; st.forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') b = r.bytesReceived; }); return b;
  });
  check(bytes2 > bytes1, `nook receiving neen's audio after recovery (${bytes1} → ${bytes2} bytes)`);

  await nook.evaluate(() => window.__neora.voiceClient.hangup());
  await sleep(1500);
  check(await neen.evaluate(() => window.__neora.voiceClient.state === 'idle'), 'hangup cleans up both sides');

  // Can call again after hangup.
  await neen.evaluate(() => window.__neora.voiceClient.call('nook'));
  await nook.waitForFunction(() => window.__neora.voiceClient.state === 'incoming', { timeout: 10000 });
  await nook.evaluate(() => window.__neora.voiceClient.accept());
  t = 0;
  while (!(await connected()) && t < 40) { await sleep(500); t++; }
  check(await connected(), 'second call connects');
  await neen.evaluate(() => window.__neora.voiceClient.hangup());
} catch (e) {
  ok = false;
  console.error('❌ smoke error', e);
} finally {
  if (errors.length) { console.log('page errors:', errors); }
  await browser.close();
  await srv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
console.log(ok ? '\n🎉 VOICE CALL SMOKE PASSED' : '\n💥 VOICE CALL SMOKE FAILED');
process.exit(ok ? 0 : 1);
