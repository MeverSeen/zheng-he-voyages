import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeObject } from './ships.js';
import { shipTypes, shipModes } from './ship-assets.js';
// The offline build embeds every ship, but only the selected pair is decoded.
const urls =
  typeof __SHIP_ASSETS__ !== 'undefined'
    ? __SHIP_ASSETS__
    : Object.fromEntries(
        shipTypes.map((id) => [
          id,
          Object.fromEntries(shipModes.map((mode) => [mode, `assets/ships/${id}-${mode}.glb`])),
        ]),
      );
const cache = new Map(),
  pending = new Map(),
  typeEpoch = new Map();
let generation = 0;
export async function prepareBlenderShips({ loader = new GLTFLoader(), typeId = 'baochuan' } = {}) {
  if (!shipTypes.includes(typeId)) throw new Error('Unknown ship ' + typeId);
  const keys = shipModes.map((mode) => typeId + ':' + mode);
  if (keys.every((key) => cache.has(key))) return true;
  if (pending.has(typeId)) return pending.get(typeId);
  if (!urls[typeId] || !shipModes.every((mode) => typeof urls[typeId][mode] === 'string'))
    throw new Error('Ship assets missing for ' + typeId);
  const epoch = generation,
    localEpoch = typeEpoch.get(typeId) || 0;
  const load = (async () => {
    const roots = await Promise.allSettled(
      shipModes.map(async (mode) => {
        const gltf = await loader.loadAsync(urls[typeId][mode]);
        let root;
        gltf.scene.traverse((o) => {
          if (o.userData.metadata) root = o;
        });
        if (!root || JSON.parse(root.userData.metadata).typeId !== typeId) {
          disposeObject(gltf.scene);
          throw new Error('Ship metadata mismatch');
        }
        return [typeId + ':' + mode, root];
      }),
    );
    const error = roots.find((r) => r.status === 'rejected');
    if (error || epoch !== generation || localEpoch !== (typeEpoch.get(typeId) || 0)) {
      for (const r of roots) if (r.status === 'fulfilled') disposeCachedRoot(r.value[1]);
      if (error) throw error.reason;
      return false;
    }
    for (const r of roots) cache.set(...r.value);
    return true;
  })();
  pending.set(typeId, load);
  try {
    return await load;
  } finally {
    if (pending.get(typeId) === load) pending.delete(typeId);
  }
}
export function buildBlenderShip(cutaway = false, typeId = 'baochuan') {
  const source = cache.get(typeId + ':' + (cutaway ? 'section' : 'full'));
  if (!source) return null;
  const root = source.clone(true),
    metadata = JSON.parse(root.userData.metadata),
    groups = {},
    materialCopies = new Map();
  // Instances own geometry/materials; cached textures are shared until the cache is disposed.
  const cloneMaterial = (m) => {
    if (!materialCopies.has(m.uuid)) materialCopies.set(m.uuid, m.clone());
    return materialCopies.get(m.uuid);
  };
  root.traverse((o) => {
    if (o.userData.part) groups[o.userData.part] = o;
    if (o.isMesh) {
      o.geometry = o.geometry.clone();
      o.material = Array.isArray(o.material) ? o.material.map(cloneMaterial) : cloneMaterial(o.material);
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // Keep editable pieces in Blender; batch by material inside each clickable web component.
  for (const group of Object.values(groups)) {
    group.updateWorldMatrix(true, true);
    const batches = new Map(),
      old = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      // GLTFLoader emits one mesh per primitive for these single-material authoring objects.
      if (materials.length !== 1) return;
      let owner = o.parent;
      while (owner && owner !== group && !owner.userData.sail_state) owner = owner.parent;
      owner = owner || group;
      const mat = materials[0],
        key = owner.uuid + '|' + mat.uuid + '|' + Object.keys(o.geometry.attributes).sort().join(',');
      if (!batches.has(key)) batches.set(key, { mat, geos: [], owner });
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); // Preserve UVs and tangents: the web derivative carries baked normal maps.
      geo.applyMatrix4(owner.matrixWorld.clone().invert().multiply(o.matrixWorld));
      batches.get(key).geos.push(geo);
      old.push(o);
    });
    for (const o of old) {
      o.removeFromParent();
      o.geometry.dispose();
    }
    for (const { mat, geos, owner } of batches.values()) {
      const geo = mergeGeometries(geos);
      if (!geo) throw new Error('Incompatible Blender geometry');
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      owner.add(m);
      geos.forEach((g) => g.dispose());
    }
    const used = new Set([...batches.values()].map((b) => b.mat));
    for (const o of old) if (!used.has(o.material)) o.material.dispose();
  }
  root.userData = { ...metadata, groups, modelSource: 'blender' };
  setBlenderSailState(root, 'set');
  return root;
}
export function setBlenderSailState(root, state = 'set') {
  if (!['set', 'half', 'stowed'].includes(state)) throw new Error('Unknown sail state');
  root.traverse((o) => {
    if (o.userData.sail_demo && o.userData.sail_state) o.visible = o.userData.sail_state === state;
  });
  root.userData.sailState = state;
}
function disposeCachedRoot(root) {
  const textures = new Set();
  root.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
  });
  disposeObject(root);
  for (const texture of textures) {
    texture.dispose();
    texture.image?.close?.();
  }
}
export function releaseBlenderShip(typeId) {
  typeEpoch.set(typeId, (typeEpoch.get(typeId) || 0) + 1);
  pending.delete(typeId);
  for (const mode of shipModes) {
    const key = typeId + ':' + mode,
      root = cache.get(key);
    if (root) {
      disposeCachedRoot(root);
      cache.delete(key);
    }
  }
}
export function disposeBlenderShips() {
  generation++;
  for (const typeId of shipTypes) releaseBlenderShip(typeId);
  cache.clear();
  pending.clear();
}
