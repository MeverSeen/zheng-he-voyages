/*
 * 3D 人物 buildFigure（docs/SPEC.md §6；要求见 docs/PEOPLE-PLAN.md §4.2）。草稿，可整体替换，接口保持不变。
 * 由 ZH_PEOPLE 角色的 figure 部件与 palette 拼出低多边形人物，与 2D 立绘同一套参数。
 *   buildFigure(roleId, { lod: 0 | 1 | 2 }) → THREE.Group
 * 1 单位 = 1 米；脚底 y = 0，身高约 1.7 米（不含冠帽）；面向 +Z，+X 为人物左手一侧。
 * 每个网格的 userData.part 是部件名（hat robe badge belt boots item weapon body），可用于点击查看说明。
 * lod 0 全细节；1 减少分段、去掉小饰件；2 远景（放在船上时用），只保留轮廓与主色。
 */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function findRole(id) {
  const roles = (window.ZH_PEOPLE && window.ZH_PEOPLE.roles) || [];
  const r = roles.find((x) => x.id === id);
  if (!r) throw new Error('未知角色：' + id);
  return r;
}

export function buildFigure(roleId, { lod = 0 } = {}) {
  const role = typeof roleId === 'string' ? findRole(roleId) : roleId;
  const f = role.figure, p = role.palette;
  const seg = [24, 12, 7][lod], fine = lod === 0, mid = lod < 2;
  const group = new THREE.Group();
  group.name = 'figure:' + role.id;
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: lod > 0 }));
    return mats.get(color);
  };
  const add = (geo, color, part, pos, opts = {}) => {
    const m = new THREE.Mesh(geo, mat(color));
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    m.castShadow = true; m.receiveShadow = lod === 0;
    m.userData.part = part;
    (opts.parent || group).add(m);
    return m;
  };
  // 两点之间的圆台（四肢、长枪、带子）
  const limb = (a, b, r1, r2, color, part, s = seg) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const m = add(new THREE.CylinderGeometry(r2, r1, len, Math.max(5, s >> 1), 1), color, part);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
    return m;
  };
  const sphere = (r, color, part, pos, scale, s = seg) => add(new THREE.SphereGeometry(r, s, Math.max(4, s >> 1)), color, part, pos, { scale });
  const lathe = (pts, color, part, depth = 0.66) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    return add(g, color, part, null, { scale: [1, 1, depth] });
  };
  const shade = window.ZHFigure ? window.ZHFigure.shade : (c) => c;

  // ---------- 袍服 ----------
  const long = f.robe === 'round' || f.robe === 'cross';
  const hem = { round: 0.08, cross: 0.08, pangao: 0.56, jacket: 0.8 }[f.robe];
  const hemR = { round: 0.235, cross: 0.23, pangao: 0.215, jacket: 0.172 }[f.robe];
  const torso = [[0.001, hem], [hemR, hem]];
  if (long) torso.push([0.2, 0.5], [0.168, 0.88]);
  else if (f.robe === 'pangao') torso.push([0.19, 0.8]);
  torso.push([0.158, 1.02], [0.166, 1.2], [0.176, 1.33], [0.158, 1.405], [0.1, 1.45], [0.046, 1.47], [0.001, 1.47]);
  lathe(torso, p.robe, 'robe', f.robe === 'pangao' ? 0.72 : 0.66);
  if (f.robe === 'pangao') add(new THREE.CylinderGeometry(hemR + 0.004, hemR + 0.006, 0.03, seg, 1, true), p.trim, 'robe', [0, hem + 0.015, 0], { scale: [1, 1, 0.72] });

  // 领口
  if (f.robe === 'round') {
    add(new THREE.TorusGeometry(0.062, 0.014, 6, seg), p.robe, 'robe', [0, 1.455, 0.012], { rot: [Math.PI / 2 - 0.25, 0, 0], scale: [1, 1.05, 1] });
    if (mid) add(new THREE.TorusGeometry(0.052, 0.006, 4, seg), '#efe8da', 'robe', [0, 1.462, 0.014], { rot: [Math.PI / 2 - 0.25, 0, 0] });
  } else {
    const band = f.robe === 'jacket' ? shade(p.trim || p.robe, -0.1) : p.trim;
    // 交领右衽：外襟从人物左肩颈处斜向右腋下
    limb([0.035, 1.47, 0.065], [-0.05, 1.3, 0.112], 0.014, 0.014, band, 'robe');
    limb([-0.05, 1.3, 0.112], [-0.12, 1.06, 0.1], 0.014, 0.014, band, 'robe');
    limb([-0.04, 1.47, 0.06], [0.0, 1.38, 0.1], 0.012, 0.012, band, 'robe');
  }

  // ---------- 腿与鞋 ----------
  const pants = f.robe === 'pangao' && p.trim ? shade(p.trim, -0.1) : shade(p.robe, -0.32);
  for (const sx of [-1, 1]) {
    const x = sx * 0.075;
    if (!long) {
      if (f.legs === 'rolled') {
        limb([x, 0.36, 0], [x, hem + 0.05, 0], 0.07, 0.078, pants, 'robe');
        add(new THREE.CylinderGeometry(0.074, 0.074, 0.035, seg), shade(pants, 0.18), 'robe', [x, 0.37, 0]);
        limb([x, 0.03, 0], [x, 0.37, 0], 0.042, 0.05, p.skin, 'body');
      } else if (f.legs === 'wraps') {
        limb([x, 0.42, 0], [x, hem + 0.05, 0], 0.072, 0.078, pants, 'robe');
        limb([x, 0.05, 0], [x, 0.44, 0], 0.052, 0.062, shade(p.trim || p.robe, 0.55), 'boots');
      } else limb([x, 0.05, 0], [x, hem + 0.05, 0], 0.06, 0.078, pants, 'robe');
    }
    // 足部
    const footCol = f.feet === 'bare' ? p.skin : f.feet === 'straw' ? '#b89a5e' : (p.bootFace || p.boots);
    const foot = add(new THREE.BoxGeometry(0.09, 0.06, 0.24, 1, 1, 1), footCol, f.feet === 'bare' ? 'body' : 'boots', [sx * 0.085, 0.03, 0.045]);
    foot.rotation.y = sx * 0.12;
    if (f.feet === 'boots') limb([sx * 0.082, 0.04, 0.0], [sx * 0.08, 0.2, 0.0], 0.05, 0.05, p.boots, 'boots');
    if (f.feet !== 'bare' && mid) add(new THREE.BoxGeometry(0.094, 0.012, 0.244), '#efe8da', 'boots', [sx * 0.085, 0.006, 0.045], { rot: [0, sx * 0.12, 0] });
  }

  // ---------- 头 ----------
  limb([0, 1.44, 0], [0, 1.53, 0.005], 0.045, 0.043, shade(p.skin, -0.08), 'body');
  const headY = 1.597;
  sphere(0.085, p.skin, 'body', [0, headY, 0.008], [1, 1.2, 1.1]);
  if (mid) for (const sx of [-1, 1]) sphere(0.022, p.skin, 'body', [sx * 0.084, headY, -0.004], [0.6, 1.2, 1], 8);
  const hair = '#1d1a17';
  if (f.hat !== 'wangjin') add(new THREE.SphereGeometry(0.089, seg, seg >> 1, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 'body', [0, headY + 0.008, -0.004], { scale: [1, 1.15, 1.08], rot: [-0.45, 0, 0] });
  if (f.beard) {
    add(new THREE.ConeGeometry(0.022, 0.07, 8), hair, 'body', [0, 1.47, 0.07], { rot: [Math.PI - 0.25, 0, 0] });
    if (fine) limb([-0.03, 1.535, 0.088], [0.03, 1.535, 0.088], 0.006, 0.006, hair, 'body', 6);
  }
  if (fine) {
    // 眉眼只作极简示意
    for (const sx of [-1, 1]) {
      limb([sx * 0.018, 1.622, 0.092], [sx * 0.048, 1.624, 0.084], 0.0045, 0.0045, hair, 'body', 6);
      limb([sx * 0.02, 1.606, 0.093], [sx * 0.044, 1.606, 0.087], 0.004, 0.004, '#3a2c22', 'body', 6);
    }
  }

  // ---------- 冠帽 ----------
  const H = p.hat;
  switch (f.hat) {
    case 'quji': {
      add(new THREE.SphereGeometry(0.098, seg, seg >> 1, 0, Math.PI * 2, 0, Math.PI / 2), H, 'hat', [0, 1.625, -0.002], { scale: [1, 0.85, 1.08] });
      add(new THREE.CylinderGeometry(0.099, 0.099, 0.03, seg), p.trim, 'hat', [0, 1.635, -0.002], { scale: [1, 1, 1.08] });
      for (const sx of [-1, 1]) add(new THREE.TorusGeometry(0.03, 0.008, 6, 10, Math.PI * 1.25), H, 'hat', [sx * 0.04, 1.73, -0.07], { rot: [0, Math.PI / 2, -sx * 0.4] });
      break;
    }
    case 'wusha': {
      add(new THREE.CylinderGeometry(0.098, 0.1, 0.075, seg), H, 'hat', [0, 1.665, 0.004], { scale: [1, 1, 1.1] });
      add(new THREE.CylinderGeometry(0.07, 0.078, 0.11, seg), H, 'hat', [0, 1.72, -0.035], { scale: [1, 1, 0.9] });
      add(new THREE.SphereGeometry(0.07, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2), H, 'hat', [0, 1.775, -0.035], { scale: [1, 0.3, 0.9] });
      for (const sx of [-1, 1]) {
        const wing = add(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 12), H, 'hat', null, { scale: [1, 1, 1] });
        wing.geometry.dispose();
        wing.geometry = new THREE.BoxGeometry(0.18, 0.04, 0.006);
        wing.position.set(sx * 0.16, 1.7, -0.07);
        wing.rotation.z = sx * 0.06;
        sphere(0.022, H, 'hat', [sx * 0.25, 1.705, -0.07], [1, 1, 0.15], 10);
      }
      break;
    }
    case 'sifang':
      add(new THREE.CylinderGeometry(0.112, 0.094, 0.19, 4, 1), H, 'hat', [0, 1.73, -0.005], { rot: [0, Math.PI / 4, 0], scale: [1, 1, 1] });
      break;
    case 'wangjin':
      add(new THREE.SphereGeometry(0.091, seg, seg >> 1, 0, Math.PI * 2, 0, Math.PI * 0.45), '#2a2622', 'hat', [0, headY + 0.006, -0.004], { scale: [1, 1.15, 1.08], rot: [-0.4, 0, 0] });
      sphere(0.035, hair, 'hat', [0, 1.725, -0.01], [1, 0.8, 1]);
      if (mid) limb([-0.05, 1.735, -0.01], [0.06, 1.745, -0.01], 0.004, 0.004, '#b9a36a', 'hat', 6);
      break;
    case 'helmet': {
      add(new THREE.SphereGeometry(0.106, seg, seg >> 1, 0, Math.PI * 2, 0, Math.PI / 2), H, 'hat', [0, 1.63, 0], { scale: [1, 1.05, 1.06] });
      add(new THREE.CylinderGeometry(0.112, 0.114, 0.022, seg), shade(H, -0.2), 'hat', [0, 1.63, 0], { scale: [1, 1, 1.06] });
      limb([0, 1.73, 0], [0, 1.8, 0], 0.008, 0.006, '#2a2622', 'hat', 6);
      add(new THREE.ConeGeometry(0.012, 0.04, 6), '#9aa0a6', 'hat', [0, 1.83, 0]);
      sphere(0.022, '#b8322a', 'hat', [0, 1.79, 0], [1, 0.8, 1], 10);
      const flap = shade(p.trim || H, -0.05);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.15, 0.14), flap, 'hat', [sx * 0.1, 1.55, -0.01], { rot: [0, 0, sx * 0.08] });
      add(new THREE.BoxGeometry(0.17, 0.13, 0.02), flap, 'hat', [0, 1.56, -0.1], { rot: [-0.12, 0, 0] });
      break;
    }
    case 'douli':
      add(new THREE.ConeGeometry(0.3, 0.17, seg, 1), H, 'hat', [0, 1.745, 0]);
      if (mid) add(new THREE.ConeGeometry(0.3, 0.17, seg, 1, true), shade(H, -0.25), 'hat', [0, 1.744, 0], { scale: [1.002, 1, 1.002] }).material.wireframe = false;
      break;
  }

  // ---------- 补子、腰带 ----------
  if (f.badge && mid) {
    if (f.badge === 'lion') add(new THREE.BoxGeometry(0.17, 0.17, 0.006), shade(p.trim, 0.2), 'badge', [0, 1.22, 0.114]);
    else add(new THREE.CylinderGeometry(0.085, 0.085, 0.004, seg), p.trim, 'badge', [0, 1.22, 0.114], { rot: [Math.PI / 2, 0, 0] });
  }
  if (f.belt === 'horn' || f.belt === 'rhino') {
    // 革带：比腰宽，前低后高
    const ring = add(new THREE.CylinderGeometry(0.2, 0.2, 0.038, seg, 1, true), p.belt, 'belt', [0, 1.005, 0], { rot: [-0.14, 0, 0], scale: [1, 1, 0.68] });
    ring.material.side = THREE.DoubleSide;
    if (fine) {
      const plaque = f.belt === 'rhino' ? shade(p.belt, 0.45) : '#3b3631';
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.32;
        add(new THREE.BoxGeometry(0.032, 0.026, 0.006), plaque, 'belt', [Math.sin(a) * 0.2, 0.988 - Math.cos(a) * 0.004, Math.cos(a) * 0.137], { rot: [-0.14, a, 0] });
      }
    }
  } else if (f.belt === 'sash') {
    add(new THREE.CylinderGeometry(0.163, 0.163, 0.055, seg), p.belt, 'belt', [0, 1.01, 0], { scale: [1, 1, f.robe === 'pangao' ? 0.74 : 0.68] });
    if (mid) {
      sphere(0.026, shade(p.belt, 0.12), 'belt', [-0.04, 1.0, 0.115], [1, 0.9, 0.7], 8);
      add(new THREE.BoxGeometry(0.03, 0.14, 0.008), p.belt, 'belt', [-0.055, 0.92, 0.118], { rot: [0.05, 0, 0.12] });
      add(new THREE.BoxGeometry(0.03, 0.16, 0.008), p.belt, 'belt', [-0.025, 0.91, 0.118], { rot: [0.05, 0, -0.08] });
    }
  } else if (f.belt === 'cord') {
    add(new THREE.TorusGeometry(0.162, 0.006, 4, seg), p.belt, 'belt', [0, 1.01, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.68, 1] });
    if (mid) for (const sx of [-1, 1]) limb([sx * 0.008, 1.0, 0.11], [sx * 0.03, 0.65, 0.13], 0.005, 0.005, p.belt, 'belt', 6);
  }

  // ---------- 手臂 ----------
  const front = f.items.find((i) => i === 'edict' || i === 'compass' || i === 'book');
  const wide = f.sleeve === 'wide', hands = [];
  const cuff = f.robe === 'pangao' ? p.trim : wide ? shade(p.robe, -0.25) : null;
  for (const sx of [-1, 1]) {
    const S = [sx * 0.19, 1.39, 0];
    if (!front) {
      if (wide) {
        limb(S, [sx * 0.235, 0.62, 0.02], 0.062, 0.13, p.robe, 'robe');
        if (cuff && mid) add(new THREE.CylinderGeometry(0.132, 0.132, 0.02, seg, 1, true), cuff, 'robe', [sx * 0.235, 0.63, 0.02], { rot: [0, 0, sx * 0.06] });
        hands.push([sx * 0.215, 0.58, 0.05]);
      } else {
        limb(S, [sx * 0.25, 0.8, 0], 0.056, 0.046, p.robe, 'robe');
        if (cuff && mid) add(new THREE.CylinderGeometry(0.049, 0.049, 0.025, seg >> 1), cuff, 'robe', [sx * 0.249, 0.815, 0], { rot: [0, 0, sx * 0.1] });
        hands.push([sx * 0.252, 0.75, 0.005]);
      }
    } else {
      const E = [sx * 0.225, 1.02, 0.0];
      sphere(wide ? 0.066 : 0.05, p.robe, 'robe', E, null, seg >> 1);
      if (wide) {
        limb(S, E, 0.062, 0.066, p.robe, 'robe');
        limb(E, [sx * 0.1, 0.96, 0.22], 0.066, 0.085, p.robe, 'robe');
        sphere(0.08, p.robe, 'robe', [sx * 0.17, 0.83, 0.11], [0.8, 1.7, 1.15], seg >> 1);   // 垂下的袖袋
        hands.push([sx * 0.085, 0.955, 0.265]);
      } else {
        limb(S, E, 0.056, 0.05, p.robe, 'robe');
        limb(E, [sx * 0.1, 0.96, 0.2], 0.05, 0.044, p.robe, 'robe');
        hands.push([sx * 0.085, 0.955, 0.24]);
      }
      if (cuff && mid) limb([sx * 0.11, 0.962, 0.19], [sx * 0.095, 0.958, 0.225], wide ? 0.088 : 0.047, wide ? 0.088 : 0.047, cuff, 'robe');
    }
  }
  for (const h of hands) sphere(0.038, p.skin, 'body', h, [0.85, 1.3, 0.75], 10);

  // ---------- 器物 ----------
  const it = p.item;
  if (front === 'edict') {
    add(new THREE.BoxGeometry(0.27, 0.085, 0.09), it, 'item', [0, 0.955, 0.27]);
    if (mid) for (const x of [-0.045, 0.045]) add(new THREE.BoxGeometry(0.012, 0.089, 0.094), '#a8322a', 'item', [x, 0.955, 0.27]);
  } else if (front === 'compass') {
    add(new THREE.CylinderGeometry(0.105, 0.095, 0.04, seg), it, 'item', [0, 0.94, 0.27]);
    if (mid) add(new THREE.CylinderGeometry(0.08, 0.08, 0.004, seg), '#8fb3b4', 'item', [0, 0.962, 0.27]);
    if (fine) add(new THREE.BoxGeometry(0.09, 0.004, 0.008), '#a8322a', 'item', [0, 0.966, 0.27], { rot: [0, 0.3, 0] });
  } else if (front === 'book') {
    add(new THREE.BoxGeometry(0.2, 0.15, 0.025), '#3b4d63', 'item', [0, 0.99, 0.27], { rot: [-0.7, 0, 0] });
    if (mid) add(new THREE.BoxGeometry(0.04, 0.08, 0.004), it, 'item', [0.045, 0.996, 0.284], { rot: [-0.7, 0, 0] });
  }
  if (f.items.includes('book') && front !== 'book') add(new THREE.BoxGeometry(0.075, 0.11, 0.015), '#3b4d63', 'item', [0.11, 1.03, 0.115], { rot: [0, 0.3, -0.2] });
  if (f.items.includes('spear')) {
    limb([-0.252, 0.02, 0.01], [-0.252, 1.86, 0.01], 0.012, 0.012, '#8a6a44', 'weapon', 8);
    add(new THREE.ConeGeometry(0.022, 0.16, 6), '#9aa0a6', 'weapon', [-0.252, 1.94, 0.01], { scale: [1, 1, 0.4] });
    sphere(0.032, '#b8322a', 'weapon', [-0.252, 1.84, 0.01], [1, 1.3, 1], 8);
  }
  if (f.items.includes('gun')) limb([0.07, 1.06, 0.11], [0.15, 0.94, 0.12], 0.016, 0.02, '#8a6a3a', 'weapon', 8);
  if (f.items.includes('sword')) {
    limb([0.03, 1.12, 0.13], [0.05, 1.03, 0.135], 0.012, 0.012, '#5b3b26', 'weapon', 8);
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 10), '#c9a54a', 'weapon', [0.052, 1.025, 0.136], { rot: [0.2, 0, 0.15] });
    limb([0.055, 1.02, 0.14], [0.13, 0.26, 0.2], 0.016, 0.014, '#3a2a1f', 'weapon', 8);
  }
  if (f.items.includes('medbox')) {
    limb([-0.12, 1.41, 0.08], [0.15, 0.86, 0.15], 0.012, 0.012, '#7a5a3a', 'item', 6);
    add(new THREE.BoxGeometry(0.16, 0.15, 0.09), it, 'item', [0.17, 0.79, 0.15]);
  }
  if (f.items.includes('rope')) {
    for (let i = 0; i < (mid ? 4 : 1); i++)
      add(new THREE.TorusGeometry(0.095 - i * 0.004, 0.012, 5, seg), it, 'item', [-0.262 - i * 0.008, 0.64 + i * 0.008, 0.04], { rot: [0, Math.PI / 2, 0], scale: [1, 1.4, 1] });
  }

  group.userData = { role: role.id, name: role.name, height: 1.7, lod, materials: [...mats.values()] };
  return group;
}

// 释放 buildFigure 生成的几何体与材质
export function disposeFigure(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of group.userData.materials || []) m.dispose();
}
