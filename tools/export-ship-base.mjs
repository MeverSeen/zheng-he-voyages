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
 const ship=buildShip('baochuan',{variant:'estimated',cutaway});
 const {groups,...metadata}=ship.userData;
 const meshes=[];ship.updateMatrixWorld(true);
 for(const [part,group] of Object.entries(groups))group.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
  meshes.push({part,color:o.material.color.toArray(),positions:Array.from(g.attributes.position.array),indices:g.index?Array.from(g.index.array):null,doubleSided:o.material.side===2});g.dispose();
 });
 output[cutaway?'section':'full']={metadata,meshes};disposeObject(ship);
}
fs.writeFileSync(path.join(root,'tools/blender/baochuan-base.json'),JSON.stringify(output));
console.log('Exported full and section baselines for Blender.');
