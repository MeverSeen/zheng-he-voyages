import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {disposeObject} from './ships.js';
// Build embeds both GLBs so the standalone page never fetches model files.
const urls=typeof __SHIP_ASSETS__!=='undefined'?__SHIP_ASSETS__:{full:'assets/ships/baochuan-full.glb',section:'assets/ships/baochuan-section.glb'};
const cache=new Map();
export async function prepareBlenderShips({loader=new GLTFLoader()}={}){
  await Promise.all(Object.entries(urls).map(async([key,url])=>{
    const gltf=await loader.loadAsync(url);
    let root;gltf.scene.traverse(o=>{if(o.userData.metadata)root=o;});
    if(!root)throw new Error('Ship metadata missing');
    cache.set(key,root);
  }));
}
export function buildBlenderShip(cutaway=false){
  const source=cache.get(cutaway?'section':'full');if(!source)return null;
  const root=source.clone(true),metadata=JSON.parse(root.userData.metadata),groups={},materialCopies=new Map();
  // Instances own geometry/materials; cached textures are shared until the cache is disposed.
  const cloneMaterial=m=>{if(!materialCopies.has(m.uuid))materialCopies.set(m.uuid,m.clone());return materialCopies.get(m.uuid);};
  root.traverse(o=>{
    if(o.userData.part)groups[o.userData.part]=o;
    if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(cloneMaterial):cloneMaterial(o.material);o.castShadow=true;o.receiveShadow=true;}
  });
  // Keep editable pieces in Blender; batch by material inside each clickable web component.
  for(const group of Object.values(groups)){
    group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),old=[];
    group.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];
      // GLTFLoader emits one mesh per primitive for these single-material authoring objects.
      if(materials.length!==1)return;
      const mat=materials[0],key=mat.uuid+'|'+Object.keys(o.geometry.attributes).sort().join(',');
      if(!batches.has(key))batches.set(key,{mat,geos:[]});
      const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();// Preserve UVs and tangents: the web derivative carries baked normal maps.
      geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));batches.get(key).geos.push(geo);old.push(o);
    });
    for(const o of old){o.removeFromParent();o.geometry.dispose();}
    for(const {mat,geos} of batches.values()){
      const geo=mergeGeometries(geos);if(!geo)throw new Error('Incompatible Blender geometry');
      const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);geos.forEach(g=>g.dispose());
    }
    const used=new Set([...batches.values()].map(b=>b.mat));for(const o of old)if(!used.has(o.material))o.material.dispose();
  }
  root.userData={...metadata,groups,modelSource:'blender'};
  return root;
}
export function disposeBlenderShips(){
  const textures=new Set();
  for(const root of cache.values()){
    root.traverse(o=>{if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
    disposeObject(root);
  }
  for(const texture of textures){texture.dispose();texture.image?.close?.();}
  cache.clear();
}
