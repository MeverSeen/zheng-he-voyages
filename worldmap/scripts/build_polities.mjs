// 生成政局数据：worldmap/polities/<年份>.mjs（手绘范围）→ worldmap/polities/<年份>.js（裁剪、去重、配色后的 GeoJSON）
//
// 用法：node worldmap/scripts/build_polities.mjs 1415 [--center ming] [--ports js/data.js]
//   --center  固定使用配色 0 的中心政权（本项目为明朝；同 rel 的政权也用 0）
//   --ports   可选：一个定义 window.ZH.ports（at 为 [纬度, 经度]）的脚本，用于统计各政权境内的港口
// 需要：worldmap/data/raw/ne_50m_land.geojson（先运行 fetch_world.py）与 npm 包 polygon-clipping。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pc = require('polygon-clipping');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const WM = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const year = args.find((a) => /^\d+$/.test(a)) || '1415';
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const center = opt('--center');
const portsFile = opt('--ports');

const SRC = (await import(path.join(WM, 'polities', year + '.mjs'))).default;
const land = JSON.parse(fs.readFileSync(path.join(WM, 'data/raw/ne_50m_land.geojson'), 'utf8')).features
  .flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));

const bboxOf = (rings) => {
  const b = [180, 90, -180, -90];
  for (const r of rings) for (const [x, y] of r) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const hit = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const close = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : r.concat([r[0]]));
const landBoxes = land.map((p) => ({ p, b: bboxOf([p[0]]) }));
const area = (ring) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(s / 2); };
const r2 = (v) => Math.round(v * 100) / 100;

// Douglas-Peucker（度），减小文件体积；0.02° 约 2 公里。闭合环首尾重合，先在离起点最远处切成两段再简化
function dpRing(ring, tol) {
  if (ring.length < 5) return ring;
  let far = 1, fd = -1;
  for (let i = 1; i < ring.length - 1; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; far = i; } }
  return dp(ring.slice(0, far + 1), tol).concat(dp(ring.slice(far), tol).slice(1));
}
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(); if (j <= i + 1) continue;
    const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    let m = -1, k = -1;
    for (let t = i + 1; t < j; t++) { const d = Math.abs((pts[t][0] - ax) * dy - (pts[t][1] - ay) * dx) / L; if (d > m) { m = d; k = t; } }
    if (m > tol) { keep[k] = 1; stack.push([i, k], [k, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const done = [];
for (const s of SRC.polities) {
  const rings = Array.isArray(s.outline[0][0]) ? s.outline : [s.outline];
  const outline = rings.map((r) => [close(r)]);
  const ob = bboxOf(rings);
  const sub = landBoxes.filter((l) => hit(l.b, ob)).map((l) => l.p);
  let g = sub.length ? pc.intersection(sub, outline) : [];
  const prev = done.filter((d) => d.geom.length && hit(d.bbox, ob)).map((d) => d.geom);
  if (g.length && prev.length) g = pc.difference(g, ...prev);
  done.push({ s, geom: g, bbox: g.length ? bboxOf(g.map((p) => p[0])) : ob });
}

// 输出前简化并取两位小数（裁剪与去重用的是未简化的几何，邻国边界保持一致）
const out = done.map((d) => ({ ...d, geom: d.geom.map((poly) => poly.map((ring) => {
  const q = []; for (const [x, y] of dpRing(ring, 0.02)) { const p = [r2(x), r2(y)]; const l = q[q.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) q.push(p); }
  return q;
}).filter((ring) => ring.length >= 4)).filter((poly) => poly.length && area(poly[0]) > 0.003) }));
out.filter((d) => !d.geom.length).forEach((d) => console.warn('⚠ 空：', d.s.id));

// 相邻关系与配色（邻国不同色，用色尽量均匀）
const cells = done.map((d) => { const set = new Set(); for (const poly of d.geom) for (const ring of poly) for (const [x, y] of ring) set.add(Math.round(x * 10) + ',' + Math.round(y * 10)); return set; });
const adj = done.map(() => new Set());
for (let i = 0; i < done.length; i++) for (let j = i + 1; j < done.length; j++) {
  if (!hit(done[i].bbox, done[j].bbox)) continue;
  for (const c of cells[i]) if (cells[j].has(c)) { adj[i].add(j); adj[j].add(i); break; }
}
const centerRel = center ? (SRC.polities.find((p) => p.id === center)?.tags?.rel) : null;
const isCenter = (s) => center && (s.id === center || (centerRel && s.tags?.rel === centerRel));
const color = new Array(done.length).fill(-1), usage = new Array(9).fill(0);
const order = done.map((_, i) => i).sort((a, b) => adj[b].size - adj[a].size || a - b);
for (const i of order) {
  if (isCenter(done[i].s)) { color[i] = 0; continue; }
  const used = new Set([...adj[i]].map((j) => color[j]));
  let best = -1; for (let c = 1; c <= 8; c++) if (!used.has(c) && (best < 0 || usage[c] < usage[best])) best = c;
  color[i] = best; usage[best]++;
}

// 港口归属（可选）
const portsOf = {};
if (portsFile) {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.resolve(portsFile), 'utf8'), ctx);
  const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const inGeom = (x, y, g) => g.some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));
  for (const [id, p] of Object.entries(ctx.window.ZH.ports)) {
    const [lat, lng] = p.at, votes = {};
    for (const [dx, dy] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]])
      for (const d of done) if (d.geom.length && inGeom(lng + dx, lat + dy, d.geom)) votes[d.s.id] = (votes[d.s.id] || 0) + 1;
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (best) (portsOf[best[0]] = portsOf[best[0]] || []).push(id);
  }
}

const features = out.filter((d) => d.geom.length).map((d) => {
  const i = out.indexOf(d), { outline, ...props } = d.s;
  return { type: 'Feature', properties: { ...props, c: color[i], ports: portsOf[d.s.id] || [] }, geometry: { type: 'MultiPolygon', coordinates: d.geom } };
});
const fc = { type: 'FeatureCollection', year: SRC.year, title: SRC.title, note: SRC.note, features };
const js = `/* ${SRC.title}世界政局，由 worldmap/scripts/build_polities.mjs 从 polities/${year}.mjs 生成，勿手改 */\n` +
  `window.WM_POLITIES=window.WM_POLITIES||{};window.WM_POLITIES['${year}']=` + JSON.stringify(fc) + ';\n';
fs.writeFileSync(path.join(WM, 'polities', year + '.js'), js);
console.log(`政权 ${features.length} 个；各色用量 ${usage.slice(1).join('/')}；${(js.length / 1024).toFixed(0)} KB`);
