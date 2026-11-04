import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
const bundle=await build({stdin:{contents:'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";export {Box3,Vector3,Raycaster} from "three";export {prepareBlenderShips,buildBlenderShip,disposeBlenderShips} from "./three/blender-ships.js";export {disposeObject,triangleCount} from "./three/ships.js";',resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,define:{__SHIP_ASSETS__:JSON.stringify(Object.fromEntries(['full','section'].map(k=>[k,'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(root,'assets/ships/baochuan-'+k+'.glb')).toString('base64')])) )},alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const {GLTFLoader,Box3,Vector3,Raycaster,prepareBlenderShips,buildBlenderShip,disposeBlenderShips,disposeObject,triangleCount}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let fullMetadata;
for(const mode of ['full','section']){
 const data=fs.readFileSync(path.join(root,`assets/ships/baochuan-${mode}.glb`));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let ship;gltf.scene.traverse(o=>{if(o.userData.metadata)ship=o;});assert.ok(ship);
 const meta=JSON.parse(ship.userData.metadata),groups={};let tris=0;
 ship.traverse(o=>{if(o.userData.part)groups[o.userData.part]=o;if(o.isMesh){const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));tris+=(o.geometry.index?.count||p.count)/3;}});
 assert.equal(meta.refinement.revision,2);assert.equal(meta.refinement.houseLevels,3);
 assert.equal(meta.refinement.rigs.length,9);assert.equal(meta.refinement.doors.length,3);
 for(const rig of meta.refinement.rigs){assert.equal(rig.panels,8);assert.equal(rig.sheetBranches,4);}
 assert.equal(meta.L,61.2);assert.equal(meta.B,13.8);assert.ok(tris<30000);
 assert.deepEqual(Object.keys(groups).sort(),['anchor','bulkheads','cabins','hull','rudder','sails']);
 ship.updateMatrixWorld(true);const bounds=new Box3().setFromObject(groups.hull),size=bounds.getSize(new Vector3());
 assert.ok(Math.abs(size.x-meta.L)<.5,'metre scale and longitudinal axis');
 assert.ok(bounds.min.y< -meta.D+.1&&bounds.max.y>meta.F,'Y-up and waterline');
 for(const hatch of meta.refinement.ladderHatches){
  const ray=new Raycaster(new Vector3(hatch.x+.30,hatch.y+.25,hatch.z),new Vector3(0,-1,0),0,.5);
  assert.equal(ray.intersectObject(groups.cabins,true).length,0,'roof ladder opening must remain clear');
 }
 for(const door of meta.refinement.doors){
  const ray=new Raycaster(new Vector3(door.x+.28,door.y+1,door.z),new Vector3(-1,0,0),0,.55);
  assert.equal(ray.intersectObject(groups.cabins,true).length,0,'deckhouse doorway must remain open');
 }
 const sails=new Set();
 ship.traverse(o=>{if(!o.isMesh||!o.name.startsWith('Battened_sail_panels'))return;sails.add(o.parent.uuid);
  const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   for(const d of meta.layout.decks)assert.ok(!(v.x>d.x-d.w/2&&v.x<d.x+d.w/2&&Math.abs(v.z)<d.d/2&&v.y>d.y&&v.y<d.y+d.h+.15),'sail must clear deckhouse');
  }
 });assert.equal(sails.size,9);
 if(mode==='full'){
  assert.ok(Math.abs(size.z-meta.B)<.5,'beam');fullMetadata=meta;
  for(const h of meta.layout.hatches){const ray=new Raycaster(new Vector3(h.x+h.w*.2,h.y+.3,h.d*.2),new Vector3(0,-1,0),0,.65);assert.equal(ray.intersectObject(groups.cabins,true).length,0,'open hatch');}
 }else assert.deepEqual(meta.layout,fullMetadata.layout,'section preserves internal layout');
 console.log(`Blender ${mode}: ${tris} triangles; scale, parts, coordinates and layout passed`);
}

// Exercise the actual browser adapter, including batching and independent resource ownership.
globalThis.ProgressEvent??=class ProgressEvent {constructor(type,init){this.type=type;Object.assign(this,init);}};
await prepareBlenderShips();
for(const cutaway of [false,true]){
 const ship=buildBlenderShip(cutaway);assert.ok(ship);let draws=0;
 ship.traverse(o=>{if(o.isMesh)draws++;});assert.ok(draws<45,`batched draw count ${draws}`);
 assert.ok(triangleCount(ship)<30000);assert.equal(Object.keys(ship.userData.groups).length,6);
 const size=new Box3().setFromObject(ship.userData.groups.hull).getSize(new Vector3());assert.ok(Math.abs(size.x-61.2)<.5);
 disposeObject(ship);
 const next=buildBlenderShip(cutaway);assert.ok(triangleCount(next)>20000,'disposing a clone preserves cached source');disposeObject(next);
 console.log(`Blender web adapter ${cutaway?'section':'full'}: ${draws} material batches`);
}
disposeBlenderShips();
