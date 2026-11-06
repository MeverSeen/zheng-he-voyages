import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {checkShipAssets} from './check-ship-assets.mjs';
const root=path.resolve(import.meta.dirname,'..');
const assetFolder=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'assets/ships');
const manifest=process.argv[2]?JSON.parse(fs.readFileSync(path.join(assetFolder,'baochuan-report.json'),'utf8')):checkShipAssets();
const bundle=await build({stdin:{contents:'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";export {Box3,Vector3,Raycaster,Texture,Triangle} from "three";export {prepareBlenderShips,buildBlenderShip,disposeBlenderShips,setBlenderSailState} from "./three/blender-ships.js";export {disposeObject,triangleCount} from "./three/ships.js";',resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,define:{__SHIP_ASSETS__:JSON.stringify(Object.fromEntries(['full','section'].map(k=>[k,'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(assetFolder,'baochuan-'+k+'.glb')).toString('base64')])) )},alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const {GLTFLoader,Box3,Vector3,Raycaster,Texture,Triangle,prepareBlenderShips,buildBlenderShip,disposeBlenderShips,setBlenderSailState,disposeObject,triangleCount}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
// Node checks embedded PNG structure and geometry; real texture decoding is verified in-browser.
function nodeLoader(){return new GLTFLoader().register(parser=>({name:'NODE_TEXTURE_STRUCTURE_CHECK',loadTexture:async index=>{
 const def=parser.json.textures[index],image=parser.json.images[def.source];assert.equal(image.mimeType,'image/png');
 const bytes=new Uint8Array(await parser.getDependency('bufferView',image.bufferView));assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);assert.equal(width,1024);assert.equal(height,1024);
 return new Texture({width,height});
}}));}
let fullMetadata;
function assertSpace(ship,position,width,height,label,depth=width){
 const center=new Vector3(position.x,position.y+.15+height/2,position.z);
 const volume=new Box3().setFromCenterAndSize(center,new Vector3(depth,height,width));
 const triangle=new Triangle(),p1=new Vector3(),p2=new Vector3(),p3=new Vector3();
 const collisions=new Set();
 ship.traverseVisible(o=>{
  if(!o.isMesh)return;
  if(!new Box3().setFromObject(o).intersectsBox(volume))return;
  const p=o.geometry.attributes.position,index=o.geometry.index;
  for(let i=0;i<(index?.count||p.count);i+=3){
   p1.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);
   p2.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);
   p3.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
   triangle.set(p1,p2,p3);
   if(volume.intersectsTriangle(triangle)){collisions.add(o.name);break;}
  }
 });
 assert.equal(collisions.size,0,`${label} intersects ${[...collisions].join(', ')}`);
}
for(const mode of ['full','section']){
 const data=fs.readFileSync(path.join(assetFolder,`baochuan-${mode}.glb`));
 const gltf=await nodeLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let ship;gltf.scene.traverse(o=>{if(o.userData.metadata)ship=o;});assert.ok(ship);
 const meta=JSON.parse(ship.userData.metadata),groups={};let tris=0;
 ship.traverse(o=>{if(o.userData.part)groups[o.userData.part]=o;if(o.isMesh){const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));tris+=(o.geometry.index?.count||p.count)/3;}});
 assert.equal(meta.refinement.revision,3);assert.equal(meta.refinement.houseLevels,3);
 assert.equal(meta.refinement.rigs.length,9);assert.equal(meta.refinement.doors.length,3);
 for(const rig of meta.refinement.rigs){assert.ok(rig.panels>=5&&rig.panels<=9);assert.equal(rig.sheetBranches,rig.panels);}
 assert.ok(new Set(meta.refinement.rigs.map(r=>r.panels)).size>=3,'auxiliary sails must differ from primary sails');
 for(const r of meta.refinement.rigs.filter(r=>r.role==='main'))assert.equal(meta.layout.masts[r.index].z,0,'primary mast on centreline');
 assert.equal(meta.L,61.2);assert.equal(meta.B,13.8);assert.ok(tris<30000);
 assert.equal(tris,manifest[mode].triangles,'actual GLB triangle count must match export report');
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
 ship.traverse(o=>{if(!o.isMesh||!o.name.startsWith('Battened_sail_panels'))return;let rig=o;while(rig&&rig.userData.rig_index===undefined)rig=rig.parent;assert.ok(rig);sails.add(rig.userData.rig_index);
  const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   for(const d of meta.layout.decks)assert.ok(!(v.x>d.x-d.w/2&&v.x<d.x+d.w/2&&Math.abs(v.z)<d.d/2&&v.y>d.y&&v.y<d.y+d.h+.15),'sail must clear deckhouse');
  }
 });assert.equal(sails.size,9);
 ship.traverse(o=>{if(o.userData.sail_state)o.visible=o.userData.sail_state==='set';});
 assert.equal(meta.refinement.ladderHatches.length,2,'upper shelter roof is not a third walkable terrace');
 assert.ok(meta.refinement.structure.shellThickness>=.12);
 assert.ok(meta.refinement.windlass.hatchClearance>1);
 const demoStates=[];ship.traverse(o=>{if(o.userData.sail_demo)demoStates.push(o);});
 assert.deepEqual(demoStates.map(o=>o.userData.sail_state).sort(),['half','set','stowed']);
 for(const state of demoStates){
  const points=JSON.parse(state.userData.batten_points),lift=JSON.parse(state.userData.halyard_lift);
  assert.equal(points.length,7);assert.ok(lift.every(Number.isFinite));
  for(let i=1;i<points.length;i++)assert.ok(points[i][1]>points[i-1][1]+.03,'battens must not collapse into one another');
  const lines=[];state.traverse(o=>{if(o.isMesh&&o.name.startsWith('Sheet_branch'))lines.push(o);});
  assert.equal(lines.length,6,'every demo batten has a sheet branch');
  const endsAt=(line,expected)=>{
   const near=[],target=new Vector3(...expected),p=line.geometry.attributes.position;
   for(let j=0;j<p.count;j++){const v=new Vector3().fromBufferAttribute(p,j).applyMatrix4(line.matrixWorld);if(v.distanceTo(target)<.08)near.push(v);}
   if(near.length<4)return false;
   return near.reduce((sum,v)=>sum.add(v),new Vector3()).divideScalar(near.length).distanceTo(target)<.001;
  };
  for(const endpoint of points.slice(1))assert.ok(lines.some(line=>endsAt(line,endpoint)),'sheet must remain connected to its actual batten in every pose');
  let halyard;state.traverse(o=>{if(o.isMesh&&o.name.startsWith('Halyard_to_yard'))halyard=o;});
  assert.ok(halyard&&endsAt(halyard,lift),'halyard must follow the lowered yard');
 }
 const blocked=[];for(const p of meta.refinement.accessChecks){try{assertSpace(ship,p,p.width,p.headroom,p.label);}catch(error){blocked.push(error.message);}}
 for(const p of meta.refinement.accessPath.points){try{assertSpace(ship,p,meta.refinement.accessPath.width,meta.refinement.accessPath.height,'main deck path x='+p.x);}catch(error){blocked.push(error.message);}}
 for(let level=0;level<2;level++){
  const d=meta.layout.decks[level],front=d.x+d.w/2;
  for(let step=0;step<10;step++){
   // Climbing torso: 0.48 m shoulders, 0.30 m depth, 0.80–1.70 m above each tread.
   // Legs intentionally contact ladder rungs; a standing full-body box is inappropriate here.
   const p={x:front-.18-.97*(step+.5)/10+.05,y:d.y+d.h*(step+1)/10+.04+.65,z:-d.d*.36};
   try{assertSpace(ship,p,.48,.90,'ladder '+level+' step '+step,.30);}catch(error){blocked.push(error.message);}
  }
 }
 assert.deepEqual(blocked,[],'standing spaces and sampled passages must remain clear');
 if(mode==='full'){
  assert.ok(Math.abs(size.z-meta.B)<.5,'beam');fullMetadata=meta;
  for(const h of meta.layout.hatches){const ray=new Raycaster(new Vector3(h.x+h.w*.2,h.y+.3,h.d*.2),new Vector3(0,-1,0),0,.65);assert.equal(ray.intersectObject(ship,true).length,0,'open hatch must clear all components, including windlass');}
 }else assert.deepEqual(meta.layout,fullMetadata.layout,'section preserves internal layout');
 console.log(`Blender ${mode}: ${tris} triangles; scale, parts, coordinates and layout passed`);
}

// Exercise the actual browser adapter, including batching and independent resource ownership.
globalThis.ProgressEvent??=class ProgressEvent {constructor(type,init){this.type=type;Object.assign(this,init);}};
await prepareBlenderShips({loader:nodeLoader()});
for(const cutaway of [false,true]){
 const ship=buildBlenderShip(cutaway);assert.ok(ship);let draws=0;
 ship.traverse(o=>{if(o.isMesh)draws++;});assert.ok(draws<65,`batched draw count ${draws}`);
 let textured=0;ship.traverse(o=>{if(o.isMesh&&o.material.normalMap){textured++;assert.ok(o.geometry.attributes.uv,'batching must retain texture coordinates');}});if(!manifest.testOnly)assert.ok(textured>0);
 const heights=[];
 for(const state of ['set','half','stowed']){
  setBlenderSailState(ship,state);
  const shown=[];ship.traverseVisible(o=>{if(o.userData.sail_demo)shown.push(o);});
  assert.equal(shown.length,1);assert.equal(shown[0].userData.sail_state,state,'batching must preserve independent sail state visibility');
  // The cloth occupies less vertical space as battens gather; the mast and halyard stay high.
  const bounds=new Box3();shown[0].traverseVisible(o=>{if(o.isMesh&&/^R3[ _]woven[ _]sail/.test(o.material.name))bounds.union(new Box3().setFromObject(o));});
  assert.ok(!bounds.isEmpty(),'demo fabric must survive material batching');heights.push(bounds.getSize(new Vector3()).y);
 }
 assert.ok(heights[0]>heights[1]*1.4&&heights[1]>heights[2]*2,'sail must genuinely gather in half and stowed states');
 assert.ok(triangleCount(ship)<30000);assert.equal(Object.keys(ship.userData.groups).length,6);
 const size=new Box3().setFromObject(ship.userData.groups.hull).getSize(new Vector3());assert.ok(Math.abs(size.x-61.2)<.5);
 disposeObject(ship);
 const next=buildBlenderShip(cutaway);assert.ok(triangleCount(next)>20000,'disposing a clone preserves cached source');disposeObject(next);
 console.log(`Blender web adapter ${cutaway?'section':'full'}: ${draws} material batches`);
}
disposeBlenderShips();
