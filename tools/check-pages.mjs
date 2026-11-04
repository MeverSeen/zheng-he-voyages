// 页面检查（ROADMAP E4）：每个页面在桌面 1440×900、手机 390×844 与昼夜两种配色下打开，
// 再执行几步典型操作；记录控制台报错、请求失败和横向滚动，并保存截图供人工查看。
//
//   node tools/check-pages.mjs              检查源码页面（脚本自带静态服务器）
//   node tools/check-pages.mjs --dist       检查 dist/ 下的离线单文件（file://，先运行 npm run build）
//   --out <目录>   截图目录，默认 .screens/（已加入 .gitignore）
//   --pages a,b    只检查部分页面，如 --pages world,fleet
//
// 需要 Playwright 与 Chromium，它们不在 devDependencies 中：npm i -D playwright && npx playwright install chromium。
// Google Fonts 请求一律拦截，按"字体无法访问"的情况检查（中国大陆访问时常见）。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dist = args.includes('--dist');
const out = path.resolve(root, opt('--out', '.screens'));
let chromium;
try { ({chromium} = createRequire(import.meta.url)('playwright')); }
catch { console.error('未找到 Playwright。安装：npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const known = ['index', 'world', 'voyages', 'fleet', 'people'];
const pages = (opt('--pages') ? opt('--pages').split(',') : known).filter(p => fs.existsSync(path.join(root, dist ? 'dist' : '', p + '.html')));

// 每页几步典型操作；选择器与页面结构对应，页面改版时同步修改
const STEPS = {
  index: [
    ['第七次', p => p.locator('button', {hasText: '第七次'}).first().click()],
    ['回放航程', p => p.locator('#btn-play').click()],
    ['回放 3 秒', p => p.waitForTimeout(3000)],
    ['结束回放', p => p.locator('#p-close').click()],
    ['专题·宝船', p => p.locator('button, a', {hasText: /^宝船$/}).first().click()],
  ],
  world: [
    ['与明关系', p => p.locator('[data-pol="rel"]').click()],
    ['欧洲视图', p => p.locator('[data-view="europe"]').click()],
    ['点选政权', async p => { await p.waitForTimeout(800); const b = await p.locator('#worldmap').boundingBox(); await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.45); }],
    ['美洲视图', p => p.locator('[data-view="americas"]').click()],
    ['无疆域', p => p.locator('[data-pol="off"]').click()],
    ['滚轮放大', async p => { await p.locator('#worldmap').hover(); await p.mouse.wheel(0, -600); }],
  ],
  voyages: [
    ['第七次', p => p.locator('#vpick button[data-n="7"]').click()],
    ...['people', 'fleet', 'route', 'results', 'sources'].map(t => ['标签 ' + t, p => p.locator('.dtab[data-tab="' + t + '"]').click()]),
    ['对比表第三行', p => p.locator('#cmp-table tbody tr').nth(2).click()],
  ],
  fleet: [
    ['历次舰队', p => p.locator('#fleet-mode').click()],
    ['等待舰队', p => p.waitForTimeout(2500)],
    ['单船复原', p => p.locator('#single-mode').click()],
    ['剖开右舷', p => p.locator('#cutaway').check()],
    ['侧视', p => p.locator('[data-view="side"]').click()],
  ],
  people: [],
};
const VIEWPORTS = {
  desk: {viewport: {width: 1440, height: 900}},
  mobile: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true},
};

// 源码模式用的静态服务器
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary'};
let server, base;
if (dist) base = 'file://' + path.join(root, 'dist') + '/';
else {
  server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
}

fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch();
let failed = 0;
async function visit(page, vp, theme, steps) {
  const ctx = await browser.newContext({...VIEWPORTS[vp], deviceScaleFactor: 1, colorScheme: theme});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(t => { try { localStorage.setItem('zh:theme', t); } catch {} }, theme);
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push('脚本错误：' + e.message));
  pg.on('console', m => {
    if (/fonts\.(googleapis|gstatic)/.test(m.location().url || '') || /GL Driver Message/.test(m.text())) return;   // 拦截的字体、无头浏览器的 GPU 提示
    if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + '：' + m.text().slice(0, 200));
  });
  pg.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + '：' + r.url()); });
  await pg.goto(base + page + '.html');
  await pg.waitForTimeout(page === 'fleet' ? 3500 : 1200);
  let done = 0;
  for (const [name, fn] of steps) {
    try { await fn(pg); await pg.waitForTimeout(400); done++; } catch (e) { errs.push('操作"' + name + '"失败：' + e.message.split('\n')[0]); }
  }
  const wide = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (wide) errs.push('出现横向滚动');
  const name = `${page}-${vp}-${steps.length ? 'after' : theme}.png`;
  await pg.screenshot({path: path.join(out, name), timeout: 90000});
  await ctx.close();
  if (errs.length) failed++;
  console.log((errs.length ? '✗ ' : '✓ ') + name.padEnd(26) + (steps.length ? `操作 ${done}/${steps.length}` : '') + errs.map(e => '\n    ' + e).join(''));
}
for (const page of pages) for (const vp of Object.keys(VIEWPORTS)) {
  for (const theme of ['light', 'dark']) await visit(page, vp, theme, []);
  if (STEPS[page]?.length) await visit(page, vp, 'light', STEPS[page]);
}
await browser.close();
server?.close();
console.log(`\n${dist ? 'dist/ 离线单文件' : '源码页面'}：${pages.join('、')}；截图在 ${path.relative(root, out) || '.'}/`);
console.log(failed ? `${failed} 项有问题` : '全部通过：无报错、无横向滚动');
process.exit(failed ? 1 : 0);
