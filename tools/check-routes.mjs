// 检查：所有航线（平滑后）是否穿越陆地。用法：node tools/check-routes.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} }; ctx.globalThis = ctx.window; vm.createContext(ctx);
for (const f of ['data/land.js', 'js/data.js', 'js/route.js']) vm.runInContext(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
const { ZH, ZH_LAND, ZHRoute } = ctx.window;
const polys = ZH_LAND.geometry.coordinates.map((p) => {
  let [x0, y0, x1, y1] = [180, 90, -180, -90];
  for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { p, b: [x0, y0, x1, y1] };
});
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function onLand(lat, lng) { for (const { p, b } of polys) { if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue; if (inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h))) return true; } return false; }
const net = ZHRoute.build(ZH);
// 内河、陆路航段本就在陆上，检查时跳过其附近的点
const inland = ZH.edges.filter((e) => e[2]).map((e) => [net.nodes[e[0]], net.nodes[e[1]]]);
function nearInland(lat, lng) {
  return inland.some(([a, b]) => {
    const dx = b[1] - a[1], dy = b[0] - a[0], L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((lng - a[1]) * dx + (lat - a[0]) * dy) / L2));
    return ZHRoute.km([lat, lng], [a[0] + dy * t, a[1] + dx * t]) < 12;
  });
}
const PORT_SLACK_KM = 25; // 港口本身在岸边，两端各留余量
let bad = 0; const seen = new Set();
function check(a, b, label) {
  const key = a + '>' + b; if (seen.has(key)) return; seen.add(key);
  const L = net.leg(a, b); if (L.overland) return;
  const pts = L.latlngs; const total = net.pathKm(pts); let acc = 0; const hits = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], d = ZHRoute.km(p, q), n = Math.max(1, Math.ceil(d / 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n, s = acc + d * t; if (s < PORT_SLACK_KM || s > total - PORT_SLACK_KM) continue;
      const lat = p[0] + (q[0] - p[0]) * t, lng = p[1] + (q[1] - p[1]) * t;
      if (onLand(lat, lng) && !nearInland(lat, lng)) hits.push([+lat.toFixed(2), +lng.toFixed(2)]);
    }
    acc += d;
  }
  if (hits.length) { bad++; console.log(`✗ ${label} ${a}→${b} 经 ${L.ids.join(' ')}：${hits.length} 点在陆上，如 ${JSON.stringify(hits.slice(0, 4))}`); }
}
for (const v of ZH.voyages) {
  for (let i = 1; i < v.stops.length; i++) check(v.stops[i - 1].p, v.stops[i].p, '第' + v.n + '次');
  for (const br of v.branches) for (let i = 1; i < br.stops.length; i++) check(br.stops[i - 1], br.stops[i], '第' + v.n + '次' + br.name);
}
console.log(bad ? `${bad} 段需调整` : '全部航段均在海上 ✓');
