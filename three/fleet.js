import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildShip,disposeObject} from './ships.js';
export function fleetCounts(n,mode) {
  const v=globalThis.ZH_FLEET.voyages[n];
  // In recorded mode repeated hulls are counting tokens, not asserted ship types.
  return mode==='recorded' ? (v.recorded.n?{baochuan:v.recorded.n}:{}) : {...v.model};
}
export function buildFleet(n,{mode='recorded',variant='estimated',filter='all',spacing=1.35,lod=2}={}) {
  const counts=fleetCounts(n,mode),root=new THREE.Group(),entries=[];
  for(const [id,count] of Object.entries(counts))if(filter==='all'||id===filter)for(let i=0;i<count;i++)entries.push({id,index:i});
  const dims=globalThis.ZH_FLEET.types.baochuan.variants[variant],L=dims.L,B=dims.B;
  const cols=Math.ceil(Math.sqrt(entries.length||1)),rows=Math.ceil(entries.length/cols);
  entries.forEach((e,i)=>{e.position=[(Math.floor(i/cols)-(rows-1)/2)*L*spacing,0,(i%cols-(cols-1)/2)*Math.max(B*spacing,B+L*.16)];});
  for(const id of Object.keys(counts)) {
    const ships=entries.filter(e=>e.id===id);if(!ships.length)continue;
    const prototype=buildShip(id,{variant,lod}),batches=new Map();prototype.updateMatrixWorld(true);
    prototype.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid;if(!batches.has(key))batches.set(key,{mat:o.material.clone(),geos:[]});const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.deleteAttribute("uv");g.applyMatrix4(o.matrixWorld);batches.get(key).geos.push(g);});
    for(const {mat,geos} of batches.values()) {
      const geometry=mergeGeometries(geos);if(!geometry)throw new Error("Cannot merge ship geometry: "+id);geos.forEach(g=>g.dispose());
      const m=new THREE.InstancedMesh(geometry,mat,ships.length),matrix=new THREE.Matrix4();
      ships.forEach((e,i)=>m.setMatrixAt(i,matrix.makeTranslation(...e.position)));m.instanceMatrix.needsUpdate=true;
      m.userData={typeId:id,ships};root.add(m);
    }
    disposeObject(prototype);
  }
  root.userData={count:entries.length,counts,entries};return root;
}
