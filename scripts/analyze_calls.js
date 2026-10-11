#!/usr/bin/env node
/**
 * Summarize call telemetry from logs/telemetry-*.jsonl
 *
 * Usage:
 *   node scripts/analyze_calls.js            # today's log, last 3 hours
 *   node scripts/analyze_calls.js --hours 6  # widen the window
 *   node scripts/analyze_calls.js --file logs/telemetry-2026-10-06.jsonl
 *
 * Prints, per terminal: network path + codec, a per-minute quality table
 * (concealment / stretch / loss / jitter buffer / RTT), and every important
 * event (socket drops, ICE changes, OS mic mutes, AudioContexts, robot marks)
 * so the moment the voice turned robotic can be lined up with its cause.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const logDir = path.join(__dirname, '..', 'logs');
const file = argVal('--file', path.join(logDir, `telemetry-${new Date().toISOString().slice(0, 10)}.jsonl`));
const hours = Number(argVal('--hours', 3));
const since = Date.now() - hours * 3600 * 1000;

if (!fs.existsSync(file)) {
  console.log(`No log file at ${file}`);
  process.exit(0);
}

const events = fs.readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
  .filter((e) => e && (e.t || 0) >= since)
  .sort((a, b) => a.t - b.t);

const time = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok' });
const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : '-');
const max = (arr) => (arr.length ? Math.max(...arr) : '-');

const IMPORTANT = new Set([
  'session_start', 'call_start', 'call_end', 'ws_close', 'ws_open', 'ice_state', 'pc_state', 'ice_restart',
  'ice_candidate_error', 'mic_ready', 'mic_mute_by_os', 'mic_unmute_by_os', 'mic_ended', 'remote_track_mute',
  'remote_track_unmute', 'audioctx_created', 'audioctx_state', 'visibility', 'net_offline', 'net_online',
  'js_error', 'js_rejection', 'offer_received', 'offer_handle_error', 'answer_handle_error', 'user_mark',
  'ws_missed_pong', 'ws_slow_pong'
]);

for (const terminal of ['bkk', 'dxb']) {
  const mine = events.filter((e) => e.terminal === terminal);
  const stats = mine.filter((e) => e.kind === 'stats' && e.data && e.data.rx && e.data.rx.concealPct !== undefined);
  console.log('\n' + '='.repeat(78));
  console.log(` ${terminal.toUpperCase()}  ·  ${stats.length} stat samples  ·  ${mine.length} events`);
  console.log('='.repeat(78));

  const lastWithPath = [...stats].reverse().find((e) => e.data.path);
  if (lastWithPath) {
    const d = lastWithPath.data;
    console.log(` path:   ${d.path.localType}/${d.path.relayProtocol || d.path.localProtocol} -> remote ${d.path.remoteType}/${d.path.remoteProtocol}  ${d.path.relayUrl || ''}`);
    if (d.inCodec) console.log(` codec:  in  ${d.inCodec.mime} ${d.inCodec.fmtp || ''}`);
    if (d.outCodec) console.log(`         out ${d.outCodec.mime} ${d.outCodec.fmtp || ''}`);
    if (d.audioContexts) console.log(` audio contexts: [${d.audioContexts.join(', ')}]`);
  }

  // Per-minute quality table
  const buckets = new Map();
  stats.forEach((e) => {
    const key = Math.floor(e.t / 60000) * 60000;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e.data);
  });
  if (buckets.size) {
    console.log('\n minute     conceal% (max)  stretch%  loss%  jbuf ms  jitter ms  rtt ms  rx kbps  verdicts');
    for (const [key, list] of buckets) {
      const rx = list.map((d) => d.rx || {});
      const verdicts = list.map((d) => (d.verdict || '?')[0]).join('');
      console.log(
        ' ' + time(key).padEnd(10) +
        `${avg(rx.map((r) => r.concealPct || 0))} (${max(rx.map((r) => r.concealPct || 0))})`.padEnd(16) +
        String(avg(rx.map((r) => r.stretchPct || 0))).padEnd(10) +
        String(avg(rx.map((r) => r.lossPct || 0))).padEnd(7) +
        String(avg(rx.filter((r) => r.jitterBufferMs != null).map((r) => r.jitterBufferMs))).padEnd(9) +
        String(avg(rx.map((r) => r.jitterMs || 0))).padEnd(11) +
        String(avg(list.filter((d) => d.rttMs != null).map((d) => d.rttMs))).padEnd(8) +
        String(avg(rx.map((r) => r.kbps || 0))).padEnd(9) +
        verdicts
      );
    }
  }

  // Important events
  const notable = events.filter((e) =>
    (e.terminal === terminal && IMPORTANT.has(e.kind)) ||
    (e.src === 'server' && e.terminal === terminal && e.kind !== 'server_log')
  );
  if (notable.length) {
    console.log('\n events:');
    notable.forEach((e) => {
      const d = { ...(e.data || {}) };
      delete d.lastSample;
      delete d.userAgent;
      console.log(`  ${time(e.t)}  ${(e.src === 'server' ? 'srv:' : '') + e.kind}`.padEnd(40) + JSON.stringify(d).slice(0, 140));
    });
  }

  // Robot marks with the stats right before them
  const marks = mine.filter((e) => e.kind === 'user_mark');
  marks.forEach((m) => {
    const before = stats.filter((s) => s.t <= m.t && s.t > m.t - 30000);
    console.log(`\n 🤖 mark at ${time(m.t)} — previous 30s:`);
    before.forEach((s) => {
      const r = s.data.rx || {};
      console.log(`    ${time(s.t)} conceal ${r.concealPct}% stretch ${r.stretchPct}% loss ${r.lossPct}% jbuf ${r.jitterBufferMs}ms rtt ${s.data.rttMs}ms`);
    });
  });
}
console.log('');
