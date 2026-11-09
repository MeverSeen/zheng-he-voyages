// Reproducible offline pages and multi-file static bundle. npm ci && npm run build
import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {checkAllShipAssets} from './check-ship-assets.mjs';
import {shipTypes,shipModes} from '../three/ship-assets.js';
checkAllShipAssets();
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const safeJs=s=>s.replace(/<\/script/gi,'<\\/script');
const aliases={three:path.join(root,'vendor/three/three.module.min.js'),'three/addons':path.join(root,'vendor/three/addons')};
fs.mkdirSync(dist,{recursive:true});
const artifactOut=process.argv[2]==='--artifact'?process.argv[3]:null;
for(const page of ['index','voyages','fleet','world']) {
  if(artifactOut&&page!=='index')continue;
  let html=read(page+'.html');
  // 天下全图的地形底图由脚本加载，离线版改为内嵌（worldmap.js 优先读取 WM_RASTER_DATA）
  if(page==='world')html=html.replace('<script src="worldmap/worldmap.js"></script>',()=>'<script>window.WM_RASTER_DATA='+JSON.stringify(Object.fromEntries(['world','io'].map(k=>['assets/terrain_'+k+'.jpg','data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'worldmap/assets/terrain_'+k+'.jpg')).toString('base64')])))+';</script>\n<script src="worldmap/worldmap.js"></script>');
  html=html.replace(/<link rel="stylesheet" href="((?:vendor|css|worldmap)\/[^"]+)">/g,(_,href)=>'<style>\n'+read(href)+'\n</style>');
  html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>\n'+safeJs(read(src))+'\n</script>');
  for(const match of [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)]) {
    const result=await build({entryPoints:[path.join(root,match[1])],bundle:true,format:'iife',minify:true,write:false,alias:aliases,legalComments:'inline',define:{__SHIP_ASSETS__:JSON.stringify(Object.fromEntries(shipTypes.map(id=>[id,Object.fromEntries(shipModes.map(mode=>[mode,'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(root,`assets/ships/${id}-${mode}.glb`)).toString('base64')]))])))}});
    html=html.replace(match[0],()=>'<script>\n'+safeJs(result.outputFiles[0].text)+'\n</script>');
  }
  html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/g,'');
  // Font fallback is local; no network is required to render the offline pages.
  html=html.replace(/<link[^>]+href="https:\/\/fonts\.[^"]+"[^>]*>/g,'');
  if(artifactOut)html=html.replace(/<!doctype html>/i,'').replace(/<\/?(?:html|head|body)\b[^>]*>/gi,'');
  const out=artifactOut||path.join(dist,page+'.html');fs.writeFileSync(out,html);
  console.log(path.relative(root,out),(Buffer.byteLength(html)/1024).toFixed(0)+' KB');
  if(page==='index'&&!artifactOut)fs.writeFileSync(path.join(dist,'zheng-he-voyages-standalone.html'),html);
}
if(!artifactOut) {
  const target=path.join(dist,'artifact');fs.mkdirSync(target,{recursive:true});
  for(const name of ['index.html','voyages.html','fleet.html','world.html','css','js','three','vendor','data','assets','worldmap'])fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true,filter:src=>!src.endsWith('.blend')&&!src.endsWith('.blend1')&&!(/(baochuan|machuan|liangchuan|zuochuan|zhanchuan)-(preview|deckhouse|rig|section)\.png$/.test(src))&&!/worldmap[\\/](data|scripts)/.test(src)&&!src.endsWith('.mjs')});
  console.log('dist/artifact: multi-file static site');
}
