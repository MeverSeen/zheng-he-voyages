// Export the existing dimensional baseline for Blender, before authoring refinement.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['js/voyages-detail.js','js/fleet-data.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
globalThis.ZH_FLEET=ctx.window.ZH_FLEET;
const bundle=await build({entryPoints:[path.join(root,'three/ships.js')],bundle:true,format:'esm',platform:'node',write:false,alias:{three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')}});
const {buildShip,disposeObject}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const output={};
for(const cutaway of [false,true]) {
 const ship=buildShip('baochuan',{variant:'estimated',cutaway,merge:false});
 const {groups,...metadata}=ship.userData;
 const batches=new Map();ship.updateMatrixWorld(true);
 for(const [part,group] of Object.entries(groups))group.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
  const color=o.material.color.toArray(),detail=o.userData.detail||'baseline',key=JSON.stringify([part,detail,color,o.material.side]);
  if(!batches.has(key))batches.set(key,{part,detail,color,positions:[],indices:null,doubleSided:o.material.side===2});
  const p=g.attributes.position,a=batches.get(key).positions;
  for(let j=0;j<(g.index?.count||p.count);j++){const i=g.index?g.index.getX(j):j;a.push(p.getX(i),p.getY(i),p.getZ(i));}g.dispose();
 });
 output[cutaway?'section':'full']={metadata,meshes:[...batches.values()]};disposeObject(ship);
}
fs.writeFileSync(path.join(root,'tools/blender/baochuan-base.json'),JSON.stringify(output));
console.log('Exported full and section baselines for Blender.');
