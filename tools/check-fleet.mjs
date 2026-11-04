import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['js/voyages-detail.js','js/fleet-data.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
globalThis.ZH_FLEET=ctx.window.ZH_FLEET;
const result=await build({stdin:{contents:'export * from "./three/ships.js"; export * from "./three/fleet.js"; export {Box3,Vector3,Raycaster} from "three";',resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const mod=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
for(const [id,spec] of Object.entries(ZH_FLEET.types))for(const [variant,v] of Object.entries(spec.variants))for(const cutaway of [false,true]) {
  assert.ok(v.L>0&&v.B>0&&ZH_FLEET.sources[v.src]);
  const ship=mod.buildShip(id,{variant,cutaway});const tris=mod.triangleCount(ship);assert.ok(tris<30000,`${id} ${tris}`);
  ship.traverse(o=>{if(o.geometry){const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));}});
  const size=new mod.Box3().setFromObject(ship.userData.groups.hull).getSize(new mod.Vector3());assert.ok(Math.abs(size.x-v.L)<v.L*.02);if(!cutaway)assert.ok(Math.abs(size.z-v.B)<v.B*.03);
  const {layout,L,B}=ship.userData;
  assert.equal(layout.masts.length,spec.model.masts);
  for(const m of layout.masts) {
    assert.ok(m.foot<m.base && m.height>0);
    for(const h of layout.hatches)assert.ok(Math.abs(m.x-h.x)>h.w/2+L*.004||Math.abs(m.z)>h.d/2+L*.004,'mast must clear hatch');
    for(const d of layout.decks)assert.ok(Math.abs(m.x-d.x)>d.w/2+L*.004||Math.abs(m.z)>d.d/2+L*.004,'mast must clear deckhouse');
  }
  if(!cutaway) {
    ship.updateMatrixWorld(true);
    for(const h of layout.hatches) {
      const ray=new mod.Raycaster(new mod.Vector3(h.x+h.w*.2,h.y+.3,h.d*.2),new mod.Vector3(0,-1,0),0,.65);
      assert.equal(ray.intersectObject(ship.userData.groups.cabins,true).length,0,'hatch must be an actual deck opening');
    }
    const section=mod.buildShip(id,{variant,cutaway:true});
    assert.deepEqual(section.userData.layout,layout,'cutaway must not relocate cargo, masts or decks');
    mod.disposeObject(section);
  }
  for(const p of ZH_FLEET.parts)assert.ok(ship.userData.groups[p.id].children.length);
  console.log(`${id}/${variant}/${cutaway?'section':'full'}: ${tris} triangles`);mod.disposeObject(ship);
}
for(let n=1;n<=7;n++)for(const mode of ['recorded','estimated']) {
  const fleet=mod.buildFleet(n,{mode});const expected=mode==='recorded'?(ZH_FLEET.voyages[n].recorded.n||0):250;assert.equal(fleet.userData.count,expected);
  for(const mesh of fleet.children){assert.equal(mesh.count,mesh.userData.ships.length);assert.ok(mesh.geometry.attributes.position.count>0);}
  assert.equal(fleet.userData.entries.length,expected);mod.disposeObject(fleet);
}
assert.equal(mod.buildFleet(1,{mode:'estimated',filter:'machuan'}).userData.count,40);
console.log('Fleet data, geometry, both scales, section views and all seven voyage counts passed.');
