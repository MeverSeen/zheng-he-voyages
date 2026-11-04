// 生成 data/land.js：从 Natural Earth 1:50m 陆地数据（world-atlas 包）裁剪出郑和航线所涉海域
// 用法：npm i world-atlas@2 topojson-client@3 @turf/bbox-clip@7 && node tools/build-land.mjs <node_modules 目录>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const nm = path.resolve(process.argv[2] || 'node_modules');
const require = createRequire(path.join(nm, 'x.js'));
const topojson = require('topojson-client');
const bboxClip = require('@turf/bbox-clip').default;

const topo = JSON.parse(fs.readFileSync(path.join(nm, 'world-atlas/land-50m.json'), 'utf8'));
const land = topojson.feature(topo, topo.objects.land);
const BBOX = [18, -28, 145, 52]; // [west, south, east, north]
const round = (v) => Math.round(v * 100) / 100;

const polys = [];
for (const f of land.features) {
  const geom = f.geometry;
  const parts = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const p of parts) {
    const clipped = bboxClip({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: p } }, BBOX);
    const g = clipped.geometry;
    const cp = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of cp) {
      const rings = poly
        .map((ring) => {
          const out = [];
          for (const [x, y] of ring) {
            const pt = [round(x), round(y)];
            const last = out[out.length - 1];
            if (!last || last[0] !== pt[0] || last[1] !== pt[1]) out.push(pt);
          }
          return out;
        })
        .filter((r) => r.length >= 4);
      if (rings.length) polys.push(rings);
    }
  }
}
const geo = { type: 'Feature', properties: { source: 'Natural Earth 1:50m land (public domain)' }, geometry: { type: 'MultiPolygon', coordinates: polys } };
const out = '/* Natural Earth 1:50m 陆地（公有领域），由 tools/build-land.mjs 生成，勿手改 */\nwindow.ZH_LAND=' + JSON.stringify(geo) + ';\n';
fs.writeFileSync(new URL('../data/land.js', import.meta.url), out);
console.log('polygons:', polys.length, 'bytes:', out.length);
