import * as THREE from 'three';
import { buildShip, disposeObject } from './ships.js';
import { buildFleet, fleetCounts } from './fleet.js';
import {
  prepareBlenderShips,
  buildBlenderShip,
  disposeBlenderShips,
  releaseBlenderShip,
  setBlenderSailState,
} from './blender-ships.js';
import { createScene } from './scene.js';
const $ = (id) => document.getElementById(id),
  F = window.ZH_FLEET,
  info = window.ZHFleetInfo;
const state = {
  mode: 'single',
  type: 'baochuan',
  variant: 'estimated',
  n: 1,
  countMode: 'recorded',
  filter: 'all',
  spacing: 1.4,
  part: 'hull',
};
const blenderStatus = new Map();
let disposed = false,
  activeBlenderType = null;
function refinedAvailable() {
  return state.type !== 'baochuan' || state.variant === 'estimated';
}
function ensureBlender() {
  if (
    !scene ||
    disposed ||
    state.mode !== 'single' ||
    !refinedAvailable() ||
    !$('refined').checked ||
    blenderStatus.has(state.type)
  )
    return;
  const typeId = state.type;
  blenderStatus.set(typeId, 'loading');
  if (activeBlenderType && activeBlenderType !== typeId) {
    releaseBlenderShip(activeBlenderType);
    blenderStatus.delete(activeBlenderType);
  }
  activeBlenderType = typeId;
  prepareBlenderShips({ typeId })
    .then((ready) => {
      if (disposed || !ready) return;
      if (activeBlenderType === typeId) blenderStatus.set(typeId, 'ready');
      if (state.mode === 'single' && state.type === typeId) rebuild();
    })
    .catch((error) => {
      if (disposed || activeBlenderType !== typeId) return;
      blenderStatus.set(typeId, 'failed');
      console.warn('Ship model load failed: ' + typeId, error);
      if (state.mode === 'single' && state.type === typeId) rebuild();
    });
}
let scene,
  object,
  ship,
  outline,
  selected = null,
  raf,
  low = false;
function message(s) {
  $('scene-message').textContent = s;
  $('scene-message').hidden = !s;
}
function parse() {
  const p = new URLSearchParams(location.hash.slice(1));
  state.mode = p.get('mode') === 'fleet' ? 'fleet' : 'single';
  state.type = Object.hasOwn(F.types, p.get('ship')) ? p.get('ship') : 'baochuan';
  state.n = /^[1-7]$/.test(p.get('v')) ? +p.get('v') : 1;
  state.variant = p.get('scale') === 'recorded' ? 'recorded' : 'estimated';
  state.countMode = p.get('counts') === 'estimated' ? 'estimated' : 'recorded';
}
function save() {
  try {
    history.replaceState(
      null,
      '',
      '#' +
        new URLSearchParams({
          mode: state.mode,
          ship: state.type,
          v: state.n,
          scale: state.variant,
          counts: state.countMode,
        }),
    );
  } catch {}
}
function sync() {
  const single = state.mode === 'single';
  $('single-mode').setAttribute('aria-pressed', single);
  $('fleet-mode').setAttribute('aria-pressed', !single);
  document.querySelectorAll('.single-control').forEach((e) => (e.hidden = !single));
  document.querySelectorAll('.fleet-control').forEach((e) => (e.hidden = single));
  $('ship-type').parentElement.hidden = !single;
  $('ship-facts').hidden = !single;
  $('fleet-facts').hidden = single;
  $('ship-type').value = state.type;
  $('voyage').value = state.n;
  $('count-mode').value = state.countMode;
  $('ship-filter').value = state.filter;
  const v = state.mode === 'single' && state.type !== 'baochuan';
  $('variant').disabled = v;
  $('variant').options[0].textContent = v ? '用途比例示意' : '二千料尺度解释';
  $('variant').value = v ? 'estimated' : state.variant;
  $('refined').disabled = !(single && refinedAvailable());
  $('ship-filter').disabled = state.countMode === 'recorded';
  $('open-selected').hidden = true;
}
function highlight(part) {
  state.part = part;
  info.part(part);
  if (outline) {
    outline.removeFromParent();
    outline.geometry.dispose();
    outline.material.dispose();
    outline = null;
  }
  if (ship) {
    outline = new THREE.BoxHelper(ship.userData.groups[part], 0xd1a94b);
    object.add(outline);
  }
}
function reference(root, L, B) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa84532, roughness: 0.9 });
  const human = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 1.1, 8), mat);
  body.position.y = 0.9;
  human.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat);
  head.position.y = 1.55;
  human.add(head);
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), mat);
    leg.position.set(x, 0.225, 0);
    human.add(leg);
  }
  human.position.set(0, 0, B * 0.5 + 3);
  g.add(human);
  const pts = [
    [-52.5, 0, 0],
    [52.5, 0, 0],
    [52.5, 0, 68],
    [-52.5, 0, 68],
    [-52.5, 0, 0],
  ].map((p) => new THREE.Vector3(p[0], 0.04, p[2] + B * 0.5 + 8));
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  g.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x847b51 })));
  root.add(g);
}
function rebuild() {
  sync();
  if (!scene) {
    if (state.mode === 'single') info.ship(state.type, state.variant);
    else {
      const counts = fleetCounts(state.n, state.countMode);
      const count = Object.entries(counts).reduce(
        (sum, [id, n]) =>
          sum + (state.countMode === 'recorded' || state.filter === 'all' || id === state.filter ? n : 0),
        0,
      );
      info.fleet(state.n, state.countMode, count);
    }
    save();
    return;
  }
  selected = null;
  ship = null;
  outline = null;
  if (object) disposeObject(object);
  object = new THREE.Group();
  ensureBlender();
  if (state.mode === 'single') {
    const refined = refinedAvailable() && $('refined').checked,
      blenderReady = blenderStatus.get(state.type) === 'ready',
      blenderFailed = blenderStatus.get(state.type) === 'failed';
    ship =
      (refined && blenderReady ? buildBlenderShip($('cutaway').checked, state.type) : null) ||
      buildShip(state.type, { variant: state.variant, lod: low ? 1 : 0, cutaway: $('cutaway').checked });
    object.add(ship);
    object.userData.waterline = ship.userData.waterline;
    if ($('reference').checked) reference(object, ship.userData.L, ship.userData.B);
    info.ship(state.type, state.variant, { refined: ship.userData.modelSource === 'blender' });
    $('model-source').textContent =
      ship.userData.modelSource === 'blender'
        ? F.types[state.type].name + '精修模型 · 帆装与楼舱仍为假设'
        : '参数化示意模型';
    message(
      refined && !blenderReady
        ? blenderFailed
          ? '精修模型未能载入，当前显示参数化模型。'
          : '正在载入' + F.types[state.type].name + '精修模型…'
        : '',
    );
  } else {
    $('model-source').textContent = '舰队采用低细节示意模型';
    const fleet = buildFleet(state.n, {
      mode: state.countMode,
      variant: state.variant,
      filter: state.countMode === 'recorded' ? 'all' : state.filter,
      spacing: state.spacing,
    });
    object.add(fleet);
    info.fleet(state.n, state.countMode, fleet.userData.count);
    message(fleet.userData.count ? '' : '该次船数史料未载。可切换“假设编成”观察船型分工。');
  }
  scene.setObject(object, { section: state.mode === 'single' && $('cutaway').checked });
  $('sail-demo-controls').hidden = !(ship?.userData.modelSource === 'blender' && ship.userData.refinement?.furlDemo);
  if (ship?.userData.modelSource === 'blender') setBlenderSailState(ship, $('sail-state').value);
  $('hotspots').replaceChildren();
  if (ship)
    F.parts.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'hotspot';
      b.textContent = p.name;
      b.dataset.anchor = p.id;
      b.addEventListener('click', () => highlight(p.id));
      $('hotspots').appendChild(b);
    });
  save();
}
function pick(hits) {
  for (const hit of hits) {
    if (hit.object === outline) continue;
    if (state.mode === 'fleet' && hit.object.isInstancedMesh) {
      selected = hit.object.userData.typeId;
      const serial = hit.instanceId + 1;
      $('open-selected').hidden = false;
      $('open-selected').textContent = '查看 ' + F.types[selected].name + ' · 第 ' + serial + ' 艘示意船';
      info.part('hull');
      return;
    }
    let o = hit.object;
    while (o && o !== object) {
      if (o.userData.part) {
        highlight(o.userData.part);
        return;
      }
      o = o.parent;
    }
  }
}
function labels() {
  raf = requestAnimationFrame(labels);
  if (document.hidden || !scene) return;
  const w = $('viewport').clientWidth,
    h = $('viewport').clientHeight;
  const show = state.mode === 'single' && $('labels').checked;
  for (const b of $('hotspots').children) {
    b.hidden = !show;
    if (!show) continue;
    const p = new THREE.Vector3(...ship.userData.anchors[b.dataset.anchor]);
    ship.localToWorld(p);
    const v = scene.project(p);
    b.hidden = v.z > 1 || Math.abs(v.x) > 0.88 || Math.abs(v.y) > 0.85;
    b.style.left = ((v.x + 1) * w) / 2 + 'px';
    b.style.top = ((1 - v.y) * h) / 2 + 'px';
  }
  // A screen-aligned physical length at the controls target plane.
  const distance = scene.camera.position.distanceTo(scene.controls.target),
    metresPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2))) / h;
  const ideal = 90 * metresPerPixel,
    power = 10 ** Math.floor(Math.log10(ideal)),
    length = [1, 2, 5, 10].map((x) => x * power).find((x) => x >= ideal) || power * 10;
  $('scale-bar').firstElementChild.style.width = length / metresPerPixel + 'px';
  $('scale-bar').lastElementChild.textContent = length >= 1000 ? length / 1000 + ' km' : length + ' m';
}
try {
  try {
    scene = createScene($('viewport'), pick, () => {
      low = true;
      rebuild();
    });
  } catch (e) {
    message('三维显示无法启动，船型与航次资料仍可切换查看。请检查浏览器图形加速设置。');
  }
  window.ZHFleetReady = true;
  parse();
  rebuild();
  if (scene) labels();
  $('single-mode').onclick = () => {
    state.mode = 'single';
    rebuild();
  };
  $('fleet-mode').onclick = () => {
    state.mode = 'fleet';
    rebuild();
  };
  $('ship-type').onchange = () => {
    state.type = $('ship-type').value;
    rebuild();
  };
  $('variant').onchange = () => {
    state.variant = $('variant').value;
    rebuild();
  };
  $('voyage').onchange = () => {
    state.n = +$('voyage').value;
    rebuild();
  };
  $('count-mode').onchange = () => {
    state.countMode = $('count-mode').value;
    rebuild();
  };
  $('ship-filter').onchange = () => {
    state.filter = $('ship-filter').value;
    rebuild();
  };
  $('spacing').onchange = () => {
    state.spacing = +$('spacing').value;
    rebuild();
  };
  for (const id of ['cutaway', 'reference', 'refined']) $(id).onchange = rebuild;
  $('sail-state').onchange = () => {
    if (ship?.userData.modelSource === 'blender') setBlenderSailState(ship, $('sail-state').value);
  };
  document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => scene?.view(b.dataset.view)));
  $('open-selected').onclick = () => {
    if (selected) {
      state.type = selected;
      state.mode = 'single';
      rebuild();
    }
  };
  window.addEventListener('fleet:part', (e) => highlight(e.detail));
  window.addEventListener('hashchange', () => {
    parse();
    rebuild();
  });
  $('viewport').addEventListener('scene:error', (e) => message(e.detail));
  window.addEventListener(
    'pagehide',
    () => {
      disposed = true;
      activeBlenderType = null;
      cancelAnimationFrame(raf);
      if (object) disposeObject(object);
      scene?.dispose();
      disposeBlenderShips();
    },
    { once: true },
  );
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
} catch (e) {
  message('三维显示无法启动；仍可切换船型查看资料。请检查浏览器的图形加速设置，或使用离线版。');
  console.error(e);
}
