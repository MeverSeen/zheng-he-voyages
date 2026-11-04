import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// All coordinates are metres: bow +X, up +Y, starboard +Z; waterline y=0.
export function buildShip(typeId, {variant='estimated',lod=0,cutaway=false,merge=true}={}) {
  const spec=globalThis.ZH_FLEET.types[typeId];
  if(!spec) throw new Error('Unknown ship '+typeId);
  const dims=spec.variants[variant]||spec.variants.estimated;
  const {L,B}=dims, D=dims.draft??spec.model.draft, F=dims.freeboard??spec.model.freeboard, segments=lod===2?14:48;
  const layout={hatches:[],masts:[],cargo:[],decks:[]};
  const timber=Math.min(.22,L*.0035), storey=2.25;
  const holdFloor=-D*.42;
  const ship=new THREE.Group(); ship.name=typeId;
  const mats={wood:material('#6b4528'), plank:material('#aa7a49'), dark:material('#32291f'), red:material('#8e3327'),
    sail:material('#d5bd86',THREE.DoubleSide), rope:material('#44392b'), trim:material('#d6aa58'), sack:material('#a49a70')};
  const groups={};
  for(const id of ['hull','sails','bulkheads','rudder','anchor','cabins']) {
    groups[id]=new THREE.Group();groups[id].userData.part=id;ship.add(groups[id]);
  }
  let detail='baseline';
  const mesh=(geo,mat,group)=>{const m=new THREE.Mesh(geo,mat);m.userData.detail=detail;m.castShadow=lod===0;m.receiveShadow=true;group.add(m);return m;};
  const box=(x,y,z,w,h,d,mat,g)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),mat,g);m.position.set(x,y,z);return m;};
  const rod=(a,b,r,mat,g)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
    const m=mesh(new THREE.CylinderGeometry(r*.8,r,v.length(),lod===2?4:6),mat,g);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;};
  function shape(t) {
    const w=B*.5/1.0218*(.34*(1-t)+.10*t+.80*Math.pow(Math.sin(Math.PI*t),.65));
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
  // Hatch openings are real holes, shared by full and section geometry.
  const n=spec.model.compartments;
  for(const i of [...new Set([Math.floor(n*.34),Math.floor(n*.58),Math.floor(n*.78)])]) {
    const x=((i+.5)/n-.5)*L;
    layout.hatches.push({x,z:0,w:L/n*.52,d:B*.22,y:shape(x/L+.5).y});
  }
  const cuts=[0,1,...Array.from({length:segments-1},(_,i)=>(i+1)/segments),
    ...layout.hatches.flatMap(h=>[(h.x-h.w/2)/L+.5,(h.x+h.w/2)/L+.5])].sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++) {
    const a=cuts[i],b=cuts[i+1];if(b-a<1e-8)continue;
    const mid=shape((a+b)/2),hole=layout.hatches.find(h=>Math.abs(mid.x-h.x)<h.w/2);
    const ranges=hole?[[-mid.w,-hole.d/2],[hole.d/2,mid.w]]:[[-mid.w,mid.w]];
    for(let [z0,z1] of ranges) {
      if(cutaway)z1=Math.min(z1,0);if(z1<=z0)continue;
      box(mid.x,mid.y-.10,(z0+z1)/2,(b-a)*L,.20,z1-z0,mats.plank,groups.cabins);
    }
  }
  for(const h of layout.hatches) {
    for(const side of [-1,1]) {
      if(!(cutaway&&side===1))box(h.x,h.y+.18,side*h.d/2,h.w+.18,.5,.16,mats.dark,groups.cabins);
      box(h.x+side*h.w/2,h.y+.18,cutaway?-h.d/4:0,.16,.5,cutaway?h.d/2:h.d,mats.dark,groups.cabins);
    }
    if(lod===0) {
      // Lifted cover and a ladder descend within the same watertight compartment.
      box(h.x,h.y+.08,-h.d*.85,h.w,.16,h.d*.5,mats.wood,groups.cabins);
      const x=h.x-h.w*.25,z=-h.d*.25,steps=Math.ceil((h.y-holdFloor)/.3);
      for(const dz of [-.3,.3])rod([x,holdFloor,z+dz],[x+.65,h.y,z+dz],.06,mats.wood,groups.cabins);
      for(let j=0;j<=steps;j++)box(x+.65*j/steps,holdFloor+(h.y-holdFloor)*j/steps,z,.12,.08,.7,mats.plank,groups.cabins);
    }
  }
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
      mats.plank.side=THREE.DoubleSide;mesh(g,mats.plank,groups.bulkheads);
      if(cutaway)for(let j=0;j<3;j++)rod(r[j],r[j+1],L*.003,mats.dark,groups.bulkheads);
    }
  }
  // Frames, keelson, deck beams and a raised cargo sole remain in place in section.
  if(lod<2) {
    box(0,-D+.24,0,L*.90,.35,B*.045,mats.dark,groups.bulkheads);
    for(let i=1;i<24;i++) {
      const t=i/24,r=ring(t),w=shape(t).w;
      for(let j=0;j<(cutaway?3:6);j++)rod(r[j],r[j+1],timber*.5,mats.wood,groups.bulkheads);
      const hatch=layout.hatches.find(h=>Math.abs(r[0][0]-h.x)<h.w/2+timber);
      for(let [a,b] of (hatch?[[-w,-hatch.d/2],[hatch.d/2,w]]:[[-w,w]])) {
        if(cutaway)b=Math.min(b,0);if(b>a)box(r[0][0],shape(t).y-.3,(a+b)/2,timber,.3,b-a,mats.dark,groups.bulkheads);
      }
      // Floor width stays within the chine at this height.
      box(r[0][0],holdFloor-.12,cutaway?-w*.26:0,L/24,.2,cutaway?w*.52:w*1.04,mats.plank,groups.bulkheads);
      if(i%2===0)rod([r[0][0],holdFloor,-w*.38],[r[0][0],shape(t).y-.35,-w*.38],timber*.45,mats.wood,groups.bulkheads);
    }
  }
  detail='deckhouse';
  // Hollow deckhouse: separate floors, posts, window openings and forward doorway.
  const houseX=-L*.35,houseBase=shape(.15).y+.10;
  for(let level=0;level<spec.model.decks;level++) {
    const w=L*(.20-level*.025),d=B*(.58-level*.09),h=storey,x=houseX,y=houseBase+level*h;
    layout.decks.push({x,y,w,d,h});
    // External stairs serve each terrace; a separate door serves its room.
    const stairW=.9,stairZ=-d*.25,stairRun=2.7,front=x+w/2;
    for(const side of [-1,1]) {
      if(cutaway&&side===1)continue;
      const z=side*d/2;
      box(x,y+.35,z,w,.70,timber,mats.red,groups.cabins);
      box(x,y+h-.22,z,w,.44,timber,mats.red,groups.cabins);
      for(let k=0;k<=6;k++)box(x-w/2+k*w/6,y+h/2,z,timber,h,timber,mats.wood,groups.cabins);
      if(lod===0)for(let k=0;k<6;k++)for(let bar=1;bar<=2;bar++)box(x-w/2+(k+bar/3)*w/6,y+h*.52,z,.055,h*.48,.06,mats.trim,groups.cabins);
    }
    // A doorway divides the forward wall; rear wall follows the same section cut.
    const keptD=cutaway?d/2:d,zc=cutaway?-d/4:0;
    box(x-w/2,y+h/2,zc,timber,h,keptD,mats.red,groups.cabins);
    for(const [a,b] of [[-d/2,stairZ-stairW/2],[stairZ+stairW/2,cutaway?0:d/2]])if(b>a)
      box(front,y+h/2,(a+b)/2,timber,h,b-a,mats.red,groups.cabins);
    box(front,y+h-.15,stairZ,timber,.3,stairW,mats.dark,groups.cabins);
    box(x,y-.08,zc,w,.16,keptD,mats.plank,groups.cabins);
    box(x,y+h,zc,w+.35,.18,keptD,mats.dark,groups.cabins);
    if(lod===0) {
      // Ascend aft, ending at the terrace's forward edge, beside the doorway.
      const z=-d*.43,steps=12;
      for(let j=0;j<steps;j++)box(front+stairRun*(1-(j+.5)/steps),y+h*(j+1)/steps,z,stairRun/steps,.12,.85,mats.plank,groups.cabins);
      for(const dz of [-.46,.46])rod([front+stairRun,y+1,z+dz],[front,y+h+1,z+dz],.045,mats.wood,groups.cabins);
      // Bunks and a table are human-scaled, not proportional to a giant hull.
      box(x,y+.45,-d*.3,1.9,.18,.72,mats.wood,groups.cabins);
      box(x+w*.2,y+.75,-d*.22,1.2,.12,.7,mats.plank,groups.cabins);
      for(const dx of [-.5,.5])rod([x+w*.2+dx,y,-d*.22],[x+w*.2+dx,y+.7,-d*.22],.07,mats.wood,groups.cabins);
    }
  }
  detail='cargo';
  // Cargo always belongs in the hold; sectioning removes the shell, never moves cargo.
  if(lod===0)for(let i=2;i<n-1;i++) {
    const x=((i+.5)/n-.5)*L,z=-shape((i+.5)/n).w*.38,y=holdFloor;
    layout.cargo.push({x,y,z});
    if(spec.model.cargo==='sacks') {
      for(let k=0;k<3;k++){const m=mesh(new THREE.SphereGeometry(.38,6,4),mats.sack,groups.cabins);m.scale.set(1,.65,1.4);m.position.set(x+(k-1)*.65,y+.26,z);}
    } else if(spec.model.cargo==='stalls') {
      for(const dx of [-.9,.9])for(const dz of [-.5,.5])rod([x+dx,y,z+dz],[x+dx,y+1.45,z+dz],.065,mats.wood,groups.cabins);
      for(const dx of [-.9,.9])for(const h of [.55,1.15])rod([x+dx,y+h,z-.5],[x+dx,y+h,z+.5],.045,mats.wood,groups.cabins);
    } else {
      box(x,y+.4,z,spec.model.cargo==='quarters'?1.9:1.2,.8,.75,mats.wood,groups.cabins);
      if(spec.model.cargo==='weapons')for(let k=0;k<4;k++)rod([x+(k-1.5)*.22,y+.8,z],[x+(k-1.5)*.22,y+2,z],.035,mats.dark,groups.cabins);
      else for(const dx of [-.4,.4])box(x+dx,y+.4,z,.06,.83,.78,mats.dark,groups.cabins);
    }
  }
  detail='rig';
  // Explicit unequal stations: main sails amidships, smaller end sails.
  // This is a display hypothesis, not a historical rigging survey.
  const stations=spec.model.rig;
  for(const station of stations) {
    const [along,across,rise,breadth]=station,t=along+.5,x=along*L,z=across*B;
    const height=L*rise,base=shape(t).y,sw=L*breadth;
    const bottom=Math.max(base+height*.20,along<-.4?houseBase+spec.model.decks*storey+.45:0),sh=base+height*.92-bottom;
    const foot=across===0?-D+.45:-D*.20;
    layout.masts.push({x,z,base,height,sw,foot});
    rod([x,foot,z],[x+L*.008,base+height,z],L*.004,mats.wood,groups.sails);
    if(lod<2) {
      box(x,foot-.1,z,L*.035,.4,B*.06,mats.dark,groups.bulkheads);
      box(x,base+.18,z,L*.022,.36,B*.055,mats.wood,groups.sails);
    }
    const rows=lod===2?4:6,cols=lod===2?2:4,v=[],ix=[];
    for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++) {
      const u=c/cols,q=r/rows,width=sw*(1-.35*q);
      v.push(x+(u-.18)*width+q*L*.008,bottom+q*sh,z+Math.sin(u*Math.PI)*sw*.12+u*sw*.28);
    }
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*(cols+1)+c,b=a+cols+1;ix.push(a,b,a+1,b,b+1,a+1);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(v,3));sg.setIndex(ix);sg.computeVertexNormals();mesh(sg,mats.sail,groups.sails);
    if(lod<2)for(let r=0;r<=rows;r++){for(let c=0;c<cols;c++){const a=(r*(cols+1)+c)*3,b=a+3;const pa=v.slice(a,a+3),pb=v.slice(b,b+3);pa[2]+=.025;pb[2]+=.025;rod(pa,pb,L*.0022,mats.wood,groups.sails);}}
    if(lod===0) {
      // Halyard and a fan of sheets lead from the battens to a deck belaying point.
      rod([x,base+.4,z],[x+L*.008,base+height,z+L*.003],L*.0006,mats.rope,groups.sails);
      for(let r=0;r<rows;r+=2) {
        const j=(r*(cols+1)+cols)*3;
        rod(v.slice(j,j+3),[x-sw*.28,base+.4,z+sw*.22],L*.00055,mats.rope,groups.sails);
      }
    }
  }
  detail='baseline';
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
  if(merge)for(const group of Object.values(groups)) {
    group.updateMatrixWorld(true);const batches=new Map();
    for(const child of [...group.children])if(child.isMesh) {
      if(!batches.has(child.material))batches.set(child.material,[]);
      const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.deleteAttribute('uv');g.applyMatrix4(child.matrix);
      batches.get(child.material).push(g);group.remove(child);child.geometry.dispose();
    }
    for(const [mat,geos] of batches) {const merged=mergeGeometries(geos);if(!merged)throw new Error('Incompatible ship geometry');mesh(merged,mat,group);geos.forEach(g=>g.dispose());}
  }
  const waterline=[];
  for(const side of [-1,1])for(let j=0;j<=segments;j++) {
    const t=side===-1?j/segments:1-j/segments,s=shape(t);
    const q=(-.15+D*.25)/(s.y+D*.25);
    waterline.push([s.x,side*s.w*(.78+.22*q)]);
  }
  ship.userData={waterline,typeId,variant,lod,L,B,D,F,layout,groups,anchors:{hull:[0,0,B*.45],sails:[L*.05,L*.31,0],bulkheads:[0,-D*.3,0],rudder:[-L*.5,0,0],anchor:[L*.39,F*.5,B*.32],cabins:[-L*.29,F*2,0]}};
  return ship;
}
function material(color,side=THREE.FrontSide) {return new THREE.MeshStandardMaterial({color,roughness:.85,side});}
export function disposeObject(object) {
  const geometries=new Set(),materials=new Set();
  object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export function triangleCount(object) {let n=0;object.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});return n;}
