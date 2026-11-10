import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/voyages-detail.js', 'js/fleet-data.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
globalThis.ZH_FLEET = ctx.window.ZH_FLEET;
const result = await build({
  stdin: {
    contents:
      'export * from "./three/ships.js"; export * from "./three/fleet.js"; export {Box3,Vector3,Raycaster} from "three";',
    resolveDir: root,
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  alias: {
    three: path.join(root, 'vendor/three/three.module.min.js'),
    'three/addons': path.join(root, 'vendor/three/addons'),
  },
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
for (const [id, spec] of Object.entries(ZH_FLEET.types))
  for (const [variant, v] of Object.entries(spec.variants))
    for (const cutaway of [false, true]) {
      assert.ok(v.L > 0 && v.B > 0 && ZH_FLEET.sources[v.src]);
      const ship = mod.buildShip(id, { variant, cutaway });
      const tris = mod.triangleCount(ship);
      assert.ok(tris < 30000, `${id} ${tris}`);
      ship.traverse((o) => {
        if (o.geometry) {
          const p = o.geometry.attributes.position;
          for (const n of p.array) assert.ok(Number.isFinite(n));
        }
      });
      const size = new mod.Box3().setFromObject(ship.userData.groups.hull).getSize(new mod.Vector3());
      assert.ok(Math.abs(size.x - v.L) < v.L * 0.02);
      if (!cutaway) assert.ok(Math.abs(size.z - v.B) < v.B * 0.03);
      const { layout, L, B } = ship.userData;
      const { form, rudderStock, rudderBladeBottom } = ship.userData;
      assert.ok(layout.ends.stern.topWidth >= B * 0.55, 'stern transom top must be at least .55 B');
      assert.ok(
        layout.ends.bow.topWidth >= B * 0.28 && layout.ends.bow.topWidth <= B * 0.42,
        'bow board top must be .28–.42 B',
      );
      assert.ok(layout.ends.stern.topX < layout.ends.stern.bottomX, 'stern upper edge must rake aft');
      assert.ok(layout.ends.bow.topX > layout.ends.bow.bottomX, 'bow upper edge must rake forward');
      assert.equal(form.sectionPoints, 13, 'hull must expose the thirteen-point section');
      assert.equal(form.rubbingStrakes, 3, 'hull must expose three rubbing strakes');
      assert.ok(Number.isFinite(rudderStock) && rudderStock > 0, 'rudder stock must be finite and positive');
      assert.ok(rudderBladeBottom < -ship.userData.D, 'rudder blade must extend below the keel');
      assert.equal(layout.masts.length, spec.model.masts);
      const fourHighest = [...layout.masts].sort((a, b) => b.height - a.height).slice(0, 4);
      for (const m of fourHighest) assert.ok(Math.abs(m.z) < B * 0.01, 'four highest masts must be on centreline');
      for (const m of layout.masts) {
        assert.ok(Math.abs(m.z) <= B * 0.15, 'auxiliary mast offset must be within .15 B');
        assert.ok(
          m.mastFraction >= 0.2 && m.mastFraction <= 0.38,
          'mast must sit .2–.38 of sail width from its front edge',
        );
        assert.ok(m.foot < m.base && m.height > 0);
        for (const h of layout.hatches)
          assert.ok(
            Math.abs(m.x - h.x) >= h.w / 2 + 0.85 || Math.abs(m.z) >= h.d / 2 + 0.85,
            `mast shoe must clear hatch (${id}/${variant}: ${m.x.toFixed(2)}, ${m.z.toFixed(2)})`,
          );
        for (const d of layout.decks)
          assert.ok(
            Math.abs(m.x - d.x) > d.w / 2 + L * 0.004 || Math.abs(m.z) > d.d / 2 + L * 0.004,
            'mast must clear deckhouse',
          );
      }
      if (!cutaway) {
        ship.updateMatrixWorld(true);
        const slotRay = new mod.Raycaster(
          new mod.Vector3(-L * 0.65, ship.userData.F * 0.3, 0),
          new mod.Vector3(1, 0, 0),
          0,
          L * 0.3,
        );
        assert.equal(
          slotRay.intersectObject(ship.userData.groups.hull, true).length,
          0,
          'stern slot must be a true hull opening',
        );
        for (const h of layout.hatches) {
          const ray = new mod.Raycaster(
            new mod.Vector3(h.x + h.w * 0.2, h.y + 0.3, h.d * 0.2),
            new mod.Vector3(0, -1, 0),
            0,
            0.65,
          );
          assert.equal(
            ray.intersectObject(ship.userData.groups.cabins, true).length,
            0,
            'hatch must be an actual deck opening',
          );
        }
        const section = mod.buildShip(id, { variant, cutaway: true });
        assert.deepEqual(section.userData.layout, layout, 'cutaway must not relocate cargo, masts or decks');
        mod.disposeObject(section);
      }
      for (const p of ZH_FLEET.parts) assert.ok(ship.userData.groups[p.id].children.length);
      console.log(`${id}/${variant}/${cutaway ? 'section' : 'full'}: ${tris} triangles`);
      mod.disposeObject(ship);
    }
for (let n = 1; n <= 7; n++)
  for (const mode of ['recorded', 'estimated']) {
    const fleet = mod.buildFleet(n, { mode });
    const expected = mode === 'recorded' ? ZH_FLEET.voyages[n].recorded.n || 0 : 250;
    assert.equal(fleet.userData.count, expected);
    for (const mesh of fleet.children) {
      assert.equal(mesh.count, mesh.userData.ships.length);
      assert.ok(mesh.geometry.attributes.position.count > 0);
    }
    assert.equal(fleet.userData.entries.length, expected);
    mod.disposeObject(fleet);
  }
assert.equal(mod.buildFleet(1, { mode: 'estimated', filter: 'machuan' }).userData.count, 40);
console.log('Fleet data, geometry, both scales, section views and all seven voyage counts passed.');
