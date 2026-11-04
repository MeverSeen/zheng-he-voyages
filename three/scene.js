import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export function createScene(container,onPick,onQuality) {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,30000);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.5:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=innerWidth>800;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','船只三维视图；鼠标拖动或单指旋转，滚轮或双指缩放，也可使用上方视角按钮');
  renderer.domElement.tabIndex=0;
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=5;controls.maxDistance=15000;
  const ambient=new THREE.HemisphereLight(0xe8eddf,0x4b3930,2.1);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe3b1,3);sun.position.set(90,150,70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(24000,24000),new THREE.MeshStandardMaterial({color:0x9ebbb5,roughness:.75,transparent:true,opacity:.8}));
  water.rotation.x=-Math.PI/2;water.position.y=-.15;water.receiveShadow=true;scene.add(water);
  const grid=new THREE.GridHelper(2400,120,0x738f89,0xa6bbb4);grid.position.y=-.12;grid.material.transparent=true;grid.material.opacity=.2;scene.add(grid);
  function theme(){const dark=window.ZHNav.isDark();scene.background=new THREE.Color(dark?0x14252e:0xc9d8d0);scene.fog=new THREE.Fog(scene.background,4000,18000);water.material.color.set(dark?0x203d46:0xa6c0b8);grid.material.opacity=dark?.07:.16;ambient.intensity=dark?1.3:2.1;sun.intensity=dark?1.7:3;}
  theme();window.addEventListener('zh:theme',theme);
  let root=null,extent=100,center=new THREE.Vector3(),distance=150,raf=0,frames=0,slow=0,last=performance.now(),low=false,disposed=false;
  function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);controls.update();renderer.render(scene,camera);frames++;
    if(now-last>2200){const fps=frames*1000/(now-last);renderer.domElement.dataset.fps=fps.toFixed(1);renderer.domElement.dataset.drawCalls=renderer.info.render.calls;if(fps<40)slow++;else slow=0;if(slow>=3&&!low){low=true;renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;onQuality?.();}frames=0;last=now;}}
  function visibility(){cancelAnimationFrame(raf);if(!document.hidden&&!disposed){last=performance.now();frames=0;raf=requestAnimationFrame(frame);}}
  document.addEventListener('visibilitychange',visibility);
  const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(root)view();});resize.observe(container);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  function start(e){down=[e.clientX,e.clientY];}
  function pick(e){if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);if(root)onPick(ray.intersectObject(root,true));}
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',pick);
  renderer.domElement.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){camera.position.lerp(controls.target,.15);e.preventDefault();}if(e.key==='-'){camera.position.sub(controls.target).multiplyScalar(1.18).add(controls.target);e.preventDefault();}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);container.dispatchEvent(new CustomEvent('scene:error',{detail:'三维显示暂时中断，请刷新页面。下方船只资料仍可阅读。'}));});
  function view(kind='perspective') {
    distance=extent/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.max(1,1/camera.aspect)*1.02;
    const dirs={perspective:[1.1,.65,1.3],side:[0,.18,1.8],bow:[1.8,.22,0],stern:[-1.8,.22,0],top:[.001,1.8,0]};
    const d=new THREE.Vector3(...(dirs[kind]||dirs.perspective)).normalize().multiplyScalar(distance);
    camera.position.copy(center).add(d);controls.target.copy(center);controls.update();
  }
  function setObject(next,{section=false}={}) {
    if(root)scene.remove(root);root=next;scene.add(root);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty()){center.set(0,0,0);extent=100;}else {bounds.getCenter(center);extent=Math.max(size.x,size.y,size.z);}
    // Perspective vertical FOV and aspect both matter on narrow phones.
    distance=extent/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.max(1,1/camera.aspect)*1.02;
    camera.far=Math.max(30000,distance*3);camera.updateProjectionMatrix();controls.maxDistance=distance*4;
    water.visible=!section;grid.visible=!section&&!next.userData.waterline;
    // Open hatches must reveal the hold, not the infinite sea plane inside it.
    water.geometry.dispose();
    if(next.userData.waterline) {
      const outline=new THREE.Shape();outline.moveTo(-12000,-12000);outline.lineTo(12000,-12000);outline.lineTo(12000,12000);outline.lineTo(-12000,12000);outline.closePath();
      const hole=new THREE.Path(next.userData.waterline.map(([x,z])=>new THREE.Vector2(x,-z)));hole.closePath();outline.holes.push(hole);
      water.geometry=new THREE.ShapeGeometry(outline);
    } else water.geometry=new THREE.PlaneGeometry(24000,24000);
    const s=Math.max(100,extent);sun.shadow.camera.left=-s;sun.shadow.camera.right=s;sun.shadow.camera.top=s;sun.shadow.camera.bottom=-s;sun.shadow.camera.far=s*5;sun.shadow.camera.updateProjectionMatrix();sun.position.set(s,s*2,s);sun.target.position.copy(center);scene.add(sun.target);
    view();
  }
  raf=requestAnimationFrame(frame);
  return {scene,camera,renderer,controls,view,setObject,
    project(point){return point.clone().project(camera);},
    dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();controls.dispose();renderer.dispose();window.removeEventListener('zh:theme',theme);document.removeEventListener('visibilitychange',visibility);water.geometry.dispose();water.material.dispose();grid.geometry.dispose();grid.material.dispose();renderer.domElement.remove();}};
}
