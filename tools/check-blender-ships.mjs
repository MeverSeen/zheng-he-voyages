import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {checkShipAssets} from './check-ship-assets.mjs';
const root=path.resolve(import.meta.dirname,'..');
const typeId=process.argv[2]==='--ship'?process.argv[3]:'baochuan';
const customFolder=process.argv[2]==='--ship'?process.argv[4]:process.argv[2];
const assetFolder=customFolder?path.resolve(customFolder):path.join(root,'assets/ships');
const manifest=customFolder?JSON.parse(fs.readFileSync(path.join(assetFolder,typeId+'-report.json'),'utf8')):checkShipAssets(typeId);
const expected={baochuan:[61.2,13.8,9,3],machuan:[49,11.5,8,2],liangchuan:[43,11.8,7,1],zuochuan:[37,8.8,6,2],zhanchuan:[30,6.8,5,1]}[typeId];
assert.ok(expected,'known ship type');
const [expectedL,expectedB,mastCount,levels]=expected;
const bundle=await build({stdin:{contents:'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";export {Box3,Vector3,Raycaster,Texture,Triangle} from "three";export {prepareBlenderShips,buildBlenderShip,disposeBlenderShips,releaseBlenderShip,setBlenderSailState} from "./three/blender-ships.js";export {disposeObject,triangleCount} from "./three/ships.js";',resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,define:{__SHIP_ASSETS__:JSON.stringify({[typeId]:Object.fromEntries(['full','section'].map(k=>[k,'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(assetFolder,typeId+'-'+k+'.glb')).toString('base64')]))})},alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const {GLTFLoader,Box3,Vector3,Raycaster,Texture,Triangle,prepareBlenderShips,buildBlenderShip,disposeBlenderShips,releaseBlenderShip,setBlenderSailState,disposeObject,triangleCount}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
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
function frameHalfBeam(meta,x,y){
 const t=Math.max(0,Math.min(1,x/meta.L+.5));
 const w=meta.B*.5/1.0218*(.34*(1-t)+.10*t+.80*Math.sin(Math.PI*t)**.65);
 const sheer=meta.F+meta.L*(.045*(1-t)**5+.032*t**6);
 // Actual shell profile: this deliberately does not reuse the earlier
 // seven-point parameter-model approximation.
 const profile=[[-meta.D,0],[-meta.D*.88,.30*w],[-meta.D*.52,.64*w],[-meta.D*.25,.78*w],[sheer,w]];
 if(y<=profile[0][0])return 0;
 if(y>=profile.at(-1)[0])return profile.at(-1)[1];
 for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){
  const [y0,z0]=profile[i-1],[y1,z1]=profile[i];
  return z0+(z1-z0)*(y-y0)/(y1-y0);
 }
 return profile.at(-1)[1];
}
function assertFramesInsideHull(ship,meta){
 let endpoints=0,minInset=Infinity,worst,vertices=0,maxExterior=-Infinity,worstVertex;
 ship.traverse(o=>{
  if(!o.isMesh||!/^Hull[ _]frame/.test(o.name))return;
  const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   const exterior=Math.abs(v.z)-frameHalfBeam(meta,v.x,v.y);
   if(exterior>maxExterior){maxExterior=exterior;worstVertex={object:o.name,x:v.x,y:v.y,z:v.z};}
   vertices++;
  }
  // A rod exports as two equal vertex runs. Checking their centres separately
  // preserves a meaningful frame-seat inset in addition to the full solid rod.
  assert.equal(p.count%2,0,'frame rod must retain two endpoint vertex runs');
  for(const [start,end] of [[0,p.count/2],[p.count/2,p.count]]){
   const center=new Vector3();
   for(let i=start;i<end;i++)center.add(new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
   center.multiplyScalar(1/(end-start));
   if(center.y<-.99*meta.D||center.y>meta.F+.20)continue;
   const inset=frameHalfBeam(meta,center.x,center.y)-Math.abs(center.z);
   if(inset<minInset){minInset=inset;worst={object:o.name,x:center.x,y:center.y,z:center.z};}
   endpoints++;
  }
 });
 assert.ok(endpoints>100,'actual hull-frame endpoints must be present');
 assert.ok(vertices>400,'actual hull-frame vertices must be present');
 assert.ok(maxExterior<=0,`hull-frame protrudes through the shell by ${maxExterior.toFixed(3)} m at ${JSON.stringify(worstVertex)}`);
 // Forty millimetres of centreline inset gives a real guard against exposed
 // framing without asserting a historical scantling schedule.
 assert.ok(minInset>=.04,`hull-frame centreline reaches the shell (inset ${minInset.toFixed(3)} m) at ${JSON.stringify(worst)}`);
}
function assertMastFoundationsInsideHull(ship,meta){
 const pieces={step:{objects:0,vertices:0},beam:{objects:0,vertices:0}};
 ship.traverse(o=>{
  if(!o.isMesh)return;
  const kind=/^Mast[ _]step/i.test(o.name)?'step':/^Mast[ _]foundation[ _]beam/i.test(o.name)?'beam':null;
  if(!kind)return;
  pieces[kind].objects++;
  const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   // The shell profile starts at the keel. A mast step below it cannot be
   // concealed by an apparent transverse width and is always a real breach.
   assert.ok(v.y>=-meta.D,`mast foundation extends below the hull bottom at ${o.name}: y=${v.y.toFixed(3)}, bottom=${(-meta.D).toFixed(3)}`);
   const halfBeam=frameHalfBeam(meta,v.x,v.y);
   assert.ok(Math.abs(v.z)<=halfBeam,`mast foundation protrudes through hull at ${o.name}: |z|=${Math.abs(v.z).toFixed(3)}, shell=${halfBeam.toFixed(3)}`);
   pieces[kind].vertices++;
  }
 });
 for(const [kind,piece] of Object.entries(pieces)){
  assert.equal(piece.objects,mastCount,`every mast must retain one ${kind==='step'?'step':'foundation beam'}`);
  assert.ok(piece.vertices>=mastCount*8,`mast ${kind} geometry must retain actual vertices`);
 }
}
for(const mode of ['full','section']){
 const data=fs.readFileSync(path.join(assetFolder,`${typeId}-${mode}.glb`));
 const gltf=await nodeLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let ship;gltf.scene.traverse(o=>{if(o.userData.metadata)ship=o;});assert.ok(ship);
 const meta=JSON.parse(ship.userData.metadata),groups={};let tris=0;
 ship.traverse(o=>{if(o.userData.part)groups[o.userData.part]=o;if(o.isMesh){const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));tris+=(o.geometry.index?.count||p.count)/3;}});
 assert.equal(meta.typeId,typeId);assert.equal(meta.refinement.revision,typeId==='baochuan'?3:1);assert.equal(meta.refinement.houseLevels,levels);
 assert.equal(meta.refinement.rigs.length,mastCount);assert.equal(meta.refinement.doors.length,levels);
 for(const rig of meta.refinement.rigs){assert.ok(rig.panels>=5&&rig.panels<=9);assert.equal(rig.sheetBranches,rig.panels);}
 assert.ok(new Set(meta.refinement.rigs.map(r=>r.panels)).size>=3,'auxiliary sails must differ from primary sails');
 for(const r of meta.refinement.rigs.filter(r=>r.role==='main'))assert.equal(meta.layout.masts[r.index].z,0,'primary mast on centreline');
 assert.equal(meta.L,expectedL);assert.equal(meta.B,expectedB);assert.ok(tris<30000);
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
 });assert.equal(sails.size,mastCount);
 ship.traverse(o=>{if(o.userData.sail_state)o.visible=o.userData.sail_state==='set';});
 assert.equal(meta.refinement.ladderHatches.length,levels-1,'upper shelter roof is not a third walkable terrace');
 if(typeId!=='baochuan'){
  const purpose={machuan:['stalls','Stall_post'],liangchuan:['sacks','Grain_sack'],zuochuan:['quarters','Crew_berth'],zhanchuan:['weapons','Weapons_locker']}[typeId];
  assert.equal(meta.refinement.purpose.kind,purpose[0]);assert.equal(meta.refinement.purpose.placements,meta.layout.cargo.length);
  let arrangement;ship.traverse(o=>{if(o.userData.cargo_kind===purpose[0])arrangement=o;});assert.ok(arrangement,'purpose-specific hold group');
  let pieces=0;arrangement.traverse(o=>{if(o.isMesh&&o.name.startsWith(purpose[1]))pieces++;});
  assert.ok(pieces>=meta.layout.cargo.length,'actual hold geometry must match its purpose');
 }
 assert.ok(meta.refinement.structure.shellThickness>=.12);
 if(typeId!=='baochuan')assertFramesInsideHull(ship,meta);
 if(typeId!=='baochuan')assertMastFoundationsInsideHull(ship,meta);
 assert.ok(meta.refinement.windlass.hatchClearance>.75);
 const demoStates=[];ship.traverse(o=>{if(o.userData.sail_demo)demoStates.push(o);});
 assert.deepEqual(demoStates.map(o=>o.userData.sail_state).sort(),['half','set','stowed']);
 for(const state of demoStates){
  const points=JSON.parse(state.userData.batten_points),lift=JSON.parse(state.userData.halyard_lift);
  assert.equal(points.length,meta.refinement.rigs[meta.refinement.furlDemo.index].panels+1);assert.ok(lift.every(Number.isFinite));
  for(let i=1;i<points.length;i++)assert.ok(points[i][1]>points[i-1][1]+.03,'battens must not collapse into one another');
  const lines=[];state.traverse(o=>{if(o.isMesh&&o.name.startsWith('Sheet_branch'))lines.push(o);});
  assert.equal(lines.length,points.length-1,'every demo batten has a sheet branch');
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
 for(let level=0;level<levels-1;level++){
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
 console.log(`Blender ${typeId} ${mode}: ${tris} triangles; scale, parts, coordinates and layout passed`);
}

// Exercise the actual browser adapter, including batching and independent resource ownership.
globalThis.ProgressEvent??=class ProgressEvent {constructor(type,init){this.type=type;Object.assign(this,init);}};
const cachedLoader=nodeLoader(),originalLoad=cachedLoader.loadAsync.bind(cachedLoader);let loads=0;
cachedLoader.loadAsync=(...args)=>{loads++;return originalLoad(...args);};
await Promise.all([prepareBlenderShips({loader:cachedLoader,typeId}),prepareBlenderShips({loader:cachedLoader,typeId})]);
assert.equal(loads,2,'concurrent requests decode each full/section asset once');
await prepareBlenderShips({loader:cachedLoader,typeId});assert.equal(loads,2,'ready cache must not decode the same pair twice');
for(const cutaway of [false,true]){
 const ship=buildBlenderShip(cutaway,typeId);assert.ok(ship);let draws=0;
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
 const size=new Box3().setFromObject(ship.userData.groups.hull).getSize(new Vector3());assert.ok(Math.abs(size.x-expectedL)<.5);assert.equal(ship.userData.typeId,typeId);
 disposeObject(ship);
 const next=buildBlenderShip(cutaway,typeId);assert.equal(triangleCount(next),manifest[cutaway?'section':'full'].triangles,'disposing a clone preserves cached source');disposeObject(next);
 console.log(`Blender web adapter ${cutaway?'section':'full'}: ${draws} material batches`);
}
releaseBlenderShip(typeId);assert.equal(buildBlenderShip(false,typeId),null,'released cached source must not build a stale model');
// Releasing a ship while its GLBs are still decoding must prevent that older
// request from repopulating the cache after a newer selection has begun.
let unblock;const gate=new Promise(resolve=>{unblock=resolve;});
const delayedLoader={loadAsync:async url=>{await gate;return cachedLoader.loadAsync(url);}};
const stale=prepareBlenderShips({loader:delayedLoader,typeId});
await Promise.resolve();releaseBlenderShip(typeId);
const fresh=prepareBlenderShips({loader:cachedLoader,typeId});unblock();
assert.equal(await stale,false,'released in-flight load must not restore stale cache');
assert.equal(await fresh,true,'a fresh request after release must become cacheable');
assert.ok(buildBlenderShip(false,typeId),'fresh cache must remain available after the stale request settles');
releaseBlenderShip(typeId);
disposeBlenderShips();
