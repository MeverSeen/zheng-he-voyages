import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
const bundle=await build({stdin:{contents:'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";export {Box3,Vector3,Raycaster} from "three";',resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const {GLTFLoader,Box3,Vector3,Raycaster}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let fullMetadata;
for(const mode of ['full','section']){
 const data=fs.readFileSync(path.join(root,`assets/ships/baochuan-${mode}.glb`));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let ship;gltf.scene.traverse(o=>{if(o.userData.metadata)ship=o;});assert.ok(ship);
 const meta=JSON.parse(ship.userData.metadata),groups={};let tris=0;
 ship.traverse(o=>{if(o.userData.part)groups[o.userData.part]=o;if(o.isMesh){const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));tris+=(o.geometry.index?.count||p.count)/3;}});
 assert.equal(meta.L,61.2);assert.equal(meta.B,13.8);assert.ok(tris<30000);
 assert.deepEqual(Object.keys(groups).sort(),['anchor','bulkheads','cabins','hull','rudder','sails']);
 ship.updateMatrixWorld(true);const bounds=new Box3().setFromObject(groups.hull),size=bounds.getSize(new Vector3());
 assert.ok(Math.abs(size.x-meta.L)<.5,'metre scale and longitudinal axis');
 assert.ok(bounds.min.y< -meta.D+.1&&bounds.max.y>meta.F,'Y-up and waterline');
 if(mode==='full'){
  assert.ok(Math.abs(size.z-meta.B)<.5,'beam');fullMetadata=meta;
  for(const h of meta.layout.hatches){const ray=new Raycaster(new Vector3(h.x+h.w*.2,h.y+.3,h.d*.2),new Vector3(0,-1,0),0,.65);assert.equal(ray.intersectObject(groups.cabins,true).length,0,'open hatch');}
 }else assert.deepEqual(meta.layout,fullMetadata.layout,'section preserves internal layout');
 console.log(`Blender ${mode}: ${tris} triangles; scale, parts, coordinates and layout passed`);
}
