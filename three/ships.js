import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// All coordinates are metres: bow +X, up +Y, starboard +Z; waterline y=0.
export function buildShip(typeId, {variant='estimated',lod=0,cutaway=false}={}) {
  const spec=globalThis.ZH_FLEET.types[typeId];
  if(!spec) throw new Error('Unknown ship '+typeId);
  const dims=spec.variants[variant]||spec.variants.estimated;
  const {L,B}=dims, D=L*.045, F=L*.055, segments=lod===2?14:32;
  const ship=new THREE.Group(); ship.name=typeId;
  const mats={wood:material('#6b4528'), plank:material('#aa7a49'), dark:material('#32291f'), red:material('#8e3327'),
    sail:material('#d5bd86',THREE.DoubleSide), rope:material('#44392b'), trim:material('#d6aa58'), sack:material('#a49a70')};
  const groups={};
  for(const id of ['hull','sails','bulkheads','rudder','anchor','cabins']) {
    groups[id]=new THREE.Group();groups[id].userData.part=id;ship.add(groups[id]);
  }
  const mesh=(geo,mat,group)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=lod===0;m.receiveShadow=true;group.add(m);return m;};
  const box=(x,y,z,w,h,d,mat,g)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),mat,g);m.position.set(x,y,z);return m;};
  const rod=(a,b,r,mat,g)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
    const m=mesh(new THREE.CylinderGeometry(r*.8,r,v.length(),lod===2?4:6),mat,g);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;};
  function shape(t) {
    const w=B*.5*(.12+.88*Math.pow(Math.sin(Math.PI*t),.53))*(1-.18*Math.max(0,(t-.75)/.25));
    const sheer=F+L*(.045*Math.pow(1-t,5)+.032*Math.pow(t,6));
    return {x:(t-.5)*L,w,y:sheer};
  }
  function ring(t) {const s=shape(t);return [[s.x,s.y,-s.w],[s.x,-D*.25,-s.w*.78],[s.x,-D*.88,-s.w*.3],[s.x,-D,0],[s.x,-D*.88,s.w*.3],[s.x,-D*.25,s.w*.78],[s.x,s.y,s.w]];}
  const verts=[],idx=[];
  for(let i=0;i<=segments;i++)ring(i/segments).forEach(p=>verts.push(...p));
  for(let i=0;i<segments;i++)for(let j=0;j<6;j++) {if(cutaway&&j>=3)continue; const a=i*7+j,b=a+7;idx.push(a,b,a+1,b,b+1,a+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
  mats.wood.side=THREE.DoubleSide;mesh(geo,mats.wood,groups.hull);
  // Close the bow and transom with cross-section polygons.
  for(const t of [0,1]) {const r=ring(t),v=[];for(let j=1;j<r.length-1;j++){if(cutaway&&j>=3)continue;v.push(...r[0],...r[j],...r[j+1]);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();mesh(g,mats.wood,groups.hull);}
  rod([-L*.49,-D,0],[L*.49,-D,0],L*.006,mats.dark,groups.hull);
  if(lod===0)for(const side of [-1,1]) { if(cutaway&&side===1)continue;
    for(let k=1;k<=7;k++) {const points=[],q=k/8;
      for(let i=0;i<=segments;i++) {const a=shape(i/segments);points.push(new THREE.Vector3(a.x,-D*.25+(a.y+D*.25)*q,side*a.w*(.78+.22*q)+side*.015));}
      groups.hull.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x443020})));
    }
  }
  // Deck planks follow the hull contour. Starboard deck is removed in section mode.
  for(let i=0;i<segments;i++) {const t=(i+.5)/segments,s=shape(t);box(s.x,s.y-.07,cutaway?-s.w*.5:0,L/segments+.01,.14,cutaway?s.w:s.w*2,mats.plank,groups.cabins);}
  if(lod<2) {
    // Wale strakes, railings and timber frames.
    for(const side of [-1,1]) {
      if(cutaway&&side===1)continue;
      for(let j=0;j<segments;j++) {const a=shape(j/segments),b=shape((j+1)/segments);
        for(const level of [.18,.6,1])rod([a.x,a.y*level,a.w*side],[b.x,b.y*level,b.w*side],L*.0024,mats.trim,groups.hull);
        rod([a.x,a.y+F*.26,a.w*side],[b.x,b.y+F*.26,b.w*side],L*.0025,mats.red,groups.cabins);
        if(j%2===0)rod([a.x,a.y,a.w*side],[a.x,a.y+F*.26,a.w*side],L*.0025,mats.red,groups.cabins);
      }
    }
    for(let i=1;i<spec.model.compartments;i++) {
      const t=i/spec.model.compartments,r=ring(t),v=[];
      const end=cutaway?3:6;
      for(let j=1;j<end;j++)v.push(...r[0],...r[j],...r[j+1]);
      if(cutaway)v.push(...r[0],...r[3],r[3][0],shape(t).y,0);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();
      const mat=mats.plank.clone();mat.side=THREE.DoubleSide;mesh(g,mat,groups.bulkheads);
      if(cutaway)for(let j=0;j<3;j++)rod(r[j],r[j+1],L*.003,mats.dark,groups.bulkheads);
    }
  }
  // Aft deckhouse tiers, window bays, projecting eaves and bow working platform.
  for(let level=0;level<spec.model.decks;level++) {
    const w=L*(.24-level*.035),d=B*(.72-level*.12),h=F*.62,x=-L*.29,y=F+L*.012+level*h;
    const z=cutaway?-d*.25:0,depth=cutaway?d*.5:d;
    box(x,y+h/2,z,w,h,depth,mats.red,groups.cabins);
    box(x,y+h+.05,z,w+L*.025,.16,depth+B*.055,mats.dark,groups.cabins);
    if(lod<2)for(let k=0;k<5;k++)for(const side of [-1,1]) {
      if(cutaway&&side===1)continue;
      box(x-w*.4+k*w*.2,y+h*.56,side*d*.505,w*.10,h*.44,.04,mats.trim,groups.cabins);
      box(x-w*.4+k*w*.2,y+h*.56,side*d*.51,w*.065,h*.32,.05,mats.dark,groups.cabins);
    }
  }
  box(L*.37,F+L*.014,cutaway?-B*.1:0,L*.15,.3,cutaway?B*.2:B*.4,mats.plank,groups.cabins);
  if(lod===0) {
    // Access stair to the aft house; tread placement is an illustrative layout.
    for(let step=0;step<8;step++)box(-L*.14+step*L*.006,F+step*F*.075,-B*.27,L*.008,.12,B*.12,mats.plank,groups.cabins);
    if(typeId==='zhanchuan')for(const side of [-1,1])for(let i=0;i<5;i++) {
      const x=L*(.08+i*.035),z=side*B*.35;
      rod([x,F,z],[x-L*.008,F+L*.06,z],L*.0016,mats.wood,groups.cabins);
      const tip=mesh(new THREE.ConeGeometry(L*.003,L*.012,4),mats.dark,groups.cabins);tip.position.set(x-L*.008,F+L*.065,z);
    }
  }
  // Cargo visualises different roles; positions and object counts are assumptions.
  if(lod===0)for(let i=0;i<7;i++) {
    const x=-L*.14+i*L*.055,z=-B*.2,y=cutaway?-D*.25:F+.18;
    if(spec.model.cargo==='sacks') {const m=mesh(new THREE.SphereGeometry(L*.018,8,6),mats.sack,groups.cabins);m.scale.set(1,.7,.8);m.position.set(x,y+L*.012,z);}
    else if(spec.model.cargo==='stalls') {for(const dx of [-.012,.012])rod([x+L*dx,y,z-B*.1],[x+L*dx,y+L*.035,z-B*.1],L*.0025,mats.wood,groups.cabins);rod([x-L*.012,y+L*.025,z-B*.1],[x+L*.012,y+L*.025,z-B*.1],L*.0025,mats.wood,groups.cabins);}
    else box(x,y+L*.013,z,L*.035,L*.025,B*.13,mats.plank,groups.cabins);
  }
  // Masts stagger across the beam. Main masts carry battened, slightly cambered sails.
  const mastCount=spec.model.masts;
  for(let i=0;i<mastCount;i++) {
    const t=.14+.73*i/(mastCount-1),x=(t-.5)*L,z=(i%2===0?-1:1)*B*.13;
    const height=L*(.27+.14*Math.sin(Math.PI*t)),base=shape(t).y;
    rod([x,base,z],[x+L*.015,base+height,z],L*.005,mats.wood,groups.sails);
    const sw=L*(mastCount>7?.105:.125),sh=height*.72,bottom=base+height*.2;
    const rows=lod===2?4:8,cols=lod===2?2:5,v=[],ix=[];
    for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++) {
      const u=c/cols,q=r/rows,width=sw*(1-.35*q);
      v.push(x+(u-.18)*width+q*L*.012,bottom+q*sh,z+Math.sin(u*Math.PI)*sw*.12+u*sw*.28);
    }
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*(cols+1)+c,b=a+cols+1;ix.push(a,b,a+1,b,b+1,a+1);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(v,3));sg.setIndex(ix);sg.computeVertexNormals();mesh(sg,mats.sail,groups.sails);
    if(lod<2)for(let r=0;r<=rows;r++){for(let c=0;c<cols;c++){const a=(r*(cols+1)+c)*3,b=a+3;const pa=v.slice(a,a+3),pb=v.slice(b,b+3);pa[2]+=.025;pb[2]+=.025;rod(pa,pb,L*.0022,mats.wood,groups.sails);}}
    if(lod===0) {
      for(const side of [-1,1])rod([x+L*.015,base+height,z],[x-L*.045,base,side*shape(t).w*.92],L*.0007,mats.rope,groups.sails);
      rod([x,base,z],[x+L*.015,base+height,z+L*.003],L*.0008,mats.rope,groups.sails);
    }
  }
  // Stern rudder and head-stock.
  rod([-L*.50,F*1.3,0],[-L*.50,-D*1.25,0],L*.006,mats.dark,groups.rudder);
  box(-L*.505,-D*.45,0,L*.043,D*1.5,B*.025,mats.wood,groups.rudder);
  rod([-L*.50,F*1.3,0],[-L*.40,F*1.3,0],L*.004,mats.dark,groups.rudder);
  // Paired stocked anchors at the bow, including shank, arms and cable.
  if(lod<2)for(const side of [-1,1]) {
    const x=L*.39,z=side*B*.32,y=F*.3;
    rod([x,y,z],[x,y+F*.7,z],L*.004,mats.dark,groups.anchor);
    rod([x-L*.028,y+F*.5,z],[x+L*.028,y+F*.5,z],L*.004,mats.wood,groups.anchor);
    for(const sign of [-1,1])rod([x,y,z],[x+sign*L*.022,y+F*.22,z],L*.004,mats.dark,groups.anchor);
    rod([x,y+F*.7,z],[L*.32,F+L*.02,0],L*.001,mats.rope,groups.anchor);
  }
  box(L*.30,F+L*.018,0,L*.035,L*.025,B*.18,mats.wood,groups.anchor);
  const wheel=mesh(new THREE.CylinderGeometry(L*.012,L*.012,B*.2,10),mats.dark,groups.anchor);wheel.rotation.x=Math.PI/2;wheel.position.set(L*.3,F+L*.04,0);
  // Batch static meshes within each selectable component. Keep part selection
  // while reducing hundreds of timber/sail draw calls to a few material batches.
  for(const group of Object.values(groups)) {
    group.updateMatrixWorld(true);const batches=new Map();
    for(const child of [...group.children])if(child.isMesh) {
      if(!batches.has(child.material))batches.set(child.material,[]);
      const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.deleteAttribute('uv');g.applyMatrix4(child.matrix);
      batches.get(child.material).push(g);group.remove(child);child.geometry.dispose();
    }
    for(const [mat,geos] of batches) {const merged=mergeGeometries(geos);if(!merged)throw new Error('Incompatible ship geometry');mesh(merged,mat,group);geos.forEach(g=>g.dispose());}
  }
  ship.userData={typeId,variant,lod,L,B,groups,anchors:{hull:[0,0,B*.45],sails:[L*.05,L*.31,0],bulkheads:[0,-D*.3,0],rudder:[-L*.5,0,0],anchor:[L*.39,F*.5,B*.32],cabins:[-L*.29,F*2,0]}};
  return ship;
}
function material(color,side=THREE.FrontSide) {return new THREE.MeshStandardMaterial({color,roughness:.85,side});}
export function disposeObject(object) {
  const geometries=new Set(),materials=new Set();
  object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export function triangleCount(object) {let n=0;object.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});return n;}
