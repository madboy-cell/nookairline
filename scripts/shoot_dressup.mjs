// scratch/shoot_dressup.mjs — render the dev dress-up page with query params and save a screenshot.
// usage (from project root): node <this> out.png "lineage=girl&hair=hair_girl_waves&item=hat_dragon_horns" [nudges JSON]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = '/Users/thanapat/Documents/neora-world-v3/neora-world-v2';
const { startServer } = await import(path.join(ROOT, 'server/server.js'));
const { default: puppeteer } = await import(path.join(ROOT, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'));
const [arg1 = '', arg2 = '', extra = ''] = process.argv.slice(2);
const [out, query] = arg1.endsWith('.png') || arg1.endsWith('.jpg') ? [arg1, arg2] : [arg2, arg1];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-du-'));
const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 760, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${srv.port}/?dev=1&dressup=1&${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__dressup?.rigs?.length === 3, { timeout: 15000 });
  if (extra) await page.evaluate(extra);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: out });
  console.log('saved', out, errs.length ? `errors: ${errs.join(' | ')}` : 'no errors');
} finally { await browser.close(); await srv.close?.(); process.exit(0); }
