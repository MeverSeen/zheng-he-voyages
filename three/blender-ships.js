import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeObject} from './ships.js';
// Build embeds both GLBs so the standalone page never fetches model files.
const urls=typeof __SHIP_ASSETS__!=='undefined'?__SHIP_ASSETS__:{full:'assets/ships/baochuan-full.glb',section:'assets/ships/baochuan-section.glb'};
const cache=new Map();
export async function prepareBlenderShips(){
  const loader=new GLTFLoader();
  await Promise.all(Object.entries(urls).map(async([key,url])=>{
    const gltf=await loader.loadAsync(url);
    let root;gltf.scene.traverse(o=>{if(o.userData.metadata)root=o;});
    if(!root)throw new Error('Ship metadata missing');
    cache.set(key,root);
  }));
}
export function buildBlenderShip(cutaway=false){
  const source=cache.get(cutaway?'section':'full');if(!source)return null;
  const root=source.clone(true),metadata=JSON.parse(root.userData.metadata),groups={};
  root.traverse(o=>{
    if(o.userData.part)groups[o.userData.part]=o;
    if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;}
  });
  root.userData={...metadata,groups,modelSource:'blender'};
  return root;
}
export function disposeBlenderShips(){for(const root of cache.values())disposeObject(root);cache.clear();}
