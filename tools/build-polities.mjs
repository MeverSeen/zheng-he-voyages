// 生成 data/polities.js：把 tools/polities-src.mjs 中手绘的政权范围与海岸线求交、按优先级去重，并自动配色。
// 用法：npm i polygon-clipping@0.15 && node tools/build-polities.mjs <node_modules 目录>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import SRC from './polities-src.mjs';

const nm = path.resolve(process.argv[2] || 'node_modules');
const pc = createRequire(path.join(nm, 'x.js'))('polygon-clipping');
const root = new URL('..', import.meta.url).pathname;

const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ['data/land.js', 'js/data.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const land = ctx.window.ZH_LAND.geometry.coordinates; // MultiPolygon
const PORTS = ctx.window.ZH.ports;

const bboxOf = (rings) => {
  let b = [180, 90, -180, -90];
  for (const r of rings) for (const [x, y] of r) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const hit = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const close = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : r.concat([r[0]]));
const landBoxes = land.map((p) => ({ p, b: bboxOf([p[0]]) }));

function area(ring) { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(s / 2); }
const r2 = (v) => Math.round(v * 100) / 100;

const done = [];
for (const s of SRC) {
  const rings = Array.isArray(s.outline[0][0]) ? s.outline : [s.outline];
  const outline = rings.map((r) => [close(r)]);
  const ob = bboxOf(rings);
  const sub = landBoxes.filter((l) => hit(l.b, ob)).map((l) => l.p);
  let g = sub.length ? pc.intersection(sub, outline) : [];
  const prev = done.filter((d) => d.geom.length && hit(d.bbox, ob)).map((d) => d.geom);
  if (g.length && prev.length) g = pc.difference(g, ...prev);
  // 取两位小数并去掉碎片
  g = g.map((poly) => poly.map((ring) => {
    const out = [];
    for (const [x, y] of ring) { const p = [r2(x), r2(y)]; const l = out[out.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push(p); }
    return out;
  }).filter((ring) => ring.length >= 4)).filter((poly) => poly.length && area(poly[0]) > 0.003);
  if (!g.length) console.warn('⚠ 空：', s.id);
  done.push({ s, geom: g, bbox: g.length ? bboxOf(g.map((p) => p[0])) : ob });
}

// 点是否在多边形内
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const inGeom = (x, y, g) => g.some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));

// 港口归属：港口点及周围一圈取样，落在哪个政权里最多就归谁
const portsOf = {};
for (const [id, p] of Object.entries(PORTS)) {
  const [lat, lng] = p.at; const votes = {};
  for (const [dx, dy] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) {
    for (const d of done) if (d.geom.length && inGeom(lng + dx, lat + dy, d.geom)) votes[d.s.id] = (votes[d.s.id] || 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (best) (portsOf[best[0]] = portsOf[best[0]] || []).push(id);
  else console.warn('· 港口未归属：', id);
}

// 相邻关系：边界顶点落在同一 0.1° 网格即视为相邻
const cells = done.map((d) => { const set = new Set(); for (const poly of d.geom) for (const ring of poly) for (const [x, y] of ring) set.add(Math.round(x * 10) + ',' + Math.round(y * 10)); return set; });
const adj = done.map(() => new Set());
for (let i = 0; i < done.length; i++) for (let j = i + 1; j < done.length; j++) {
  if (!hit(done[i].bbox, done[j].bbox)) continue;
  for (const c of cells[i]) if (cells[j].has(c)) { adj[i].add(j); adj[j].add(i); break; }
}
// 着色：明朝（含交趾）固定用色 0；其余在 1—8 中选邻国未用、且目前用得最少的颜色，让色彩分布均匀
const PALETTE = 8;
const color = new Array(done.length).fill(-1);
const usage = new Array(PALETTE + 1).fill(0);
const order = done.map((_, i) => i).sort((a, b) => adj[b].size - adj[a].size || a - b);
for (const i of order) {
  if (done[i].s.rel === 'ming') { color[i] = 0; continue; }
  const used = new Set([...adj[i]].map((j) => color[j]));
  let best = -1;
  for (let c = 1; c <= PALETTE; c++) if (!used.has(c) && (best < 0 || usage[c] < usage[best])) best = c;
  color[i] = best; usage[best]++;
}
console.log('相邻关系数：', done.map((d, i) => d.s.id + ':' + adj[i].size).join(' '));
// 交趾与明朝同色但另加斜线（由样式处理）

const features = done.filter((d) => d.geom.length).map((d) => {
  const i = done.indexOf(d), s = d.s;
  return {
    type: 'Feature',
    properties: { id: s.id, name: s.name, alt: s.alt, rel: s.rel, label: s.label, rank: s.rank || 2, lp: s.lp || null, desc: s.desc, c: color[i], ports: portsOf[s.id] || [] },
    geometry: { type: 'MultiPolygon', coordinates: d.geom }
  };
});
const out = '/* 约 1415 年政治势力示意，由 tools/build-polities.mjs 生成，勿手改 */\nwindow.ZH_POLITIES=' + JSON.stringify({ type: 'FeatureCollection', features }) + ';\n';
fs.writeFileSync(path.join(root, 'data/polities.js'), out);
console.log('政权', features.length, '个；各色用量', usage.slice(1).join('/'), '；文件', (out.length / 1024).toFixed(0) + ' KB');
for (const f of features) if (f.properties.ports.length) console.log('  ', f.properties.name, '←', f.properties.ports.join(' '));
