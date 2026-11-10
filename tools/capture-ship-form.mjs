// Playwright repository-verification capture; uses fleet.html's own view controls.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (key, fallback) => {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : fallback;
};
const ship = opt('--ship', 'baochuan');
const scale = opt('--scale', 'estimated');
const prefix = opt('--prefix', 'after');
const views = opt('--views', 'side,stern,bow,top').split(',');
const out = path.resolve(root, opt('--out', 'docs/img/ship-form'));
const base = opt('--url', 'http://127.0.0.1:8765').replace(/\/$/, '');
const section = args.includes('--section');
const { chromium } = createRequire(import.meta.url)('playwright');

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHECK_PAGES_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
const page = await context.newPage();
await page.goto(`${base}/fleet.html#mode=single&ship=${ship}&v=1&scale=${scale}&counts=recorded`);
const expectedSource = ship === 'baochuan' && scale === 'recorded' ? '参数化示意模型' : '精修模型';
await page.waitForFunction(
  (expected) => document.querySelector('#model-source')?.textContent.includes(expected),
  expectedSource,
  {
    timeout: 30000,
  },
);
if ((await page.locator('#ship-type').inputValue()) !== ship) throw new Error('Wrong ship selected for screenshot');
if (await page.locator('#labels').isChecked()) await page.locator('#labels').uncheck();
if (section) await page.locator('#cutaway').check();
await page.waitForTimeout(500);
for (const view of views) {
  await page.locator(`[data-view="${view}"]`).click();
  await page.waitForTimeout(500);
  const file = path.join(out, `${prefix}-${ship}-${scale}-${section ? 'section-' : ''}${view}.jpg`);
  await page.locator('.viewport-wrap').screenshot({ path: file, type: 'jpeg', quality: 75 });
  if (fs.statSync(file).size > 300000) throw new Error(`JPEG exceeds 300 KB: ${file}`);
  console.log(path.relative(root, file));
}
await browser.close();
