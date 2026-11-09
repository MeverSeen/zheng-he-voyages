// Separate authoring stages. No command implicitly regenerates or overwrites the master.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),[action,...args]=process.argv.slice(2);
const types=['baochuan','machuan','liangchuan','zuochuan','zhanchuan'];
const shipIndex=args.indexOf('--ship'),selection=shipIndex<0?'baochuan':args[shipIndex+1];
if(shipIndex>=0)args.splice(shipIndex,2);
if(selection!=='all'&&!types.includes(selection))throw new Error('Unknown ship '+selection);
const scripts={baseline:'build-baochuan.py','init-master':'init-baochuan-master.py',export:'export-baochuan.py',render:'render-baochuan-master.py',check:'check-baochuan-pipeline.py'};
if(!scripts[action]&&action!=='rebuild-all')throw new Error('Use baseline, init-master, export, render, check or rebuild-all');
function run(cmd,argv){const r=spawnSync(cmd,argv,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
const blender=process.env.BLENDER_BIN||(fs.existsSync('/Applications/Blender.app/Contents/MacOS/Blender')?'/Applications/Blender.app/Contents/MacOS/Blender':'blender');
function stage(step,id,extra=[]){
  if(step==='baseline')run(process.execPath,['tools/export-ship-base.mjs',id]);
  const script=step==='baseline'&&id!=='baochuan'?'build-fleet-ship.py':scripts[step];
  const shipArgs=step==='baseline'&&id==='baochuan'?[]:['--ship',id];
  run(blender,['--background','--factory-startup','--threads','4','--python-exit-code','1','--python',path.join(root,'tools/blender',script),'--',...shipArgs,...extra]);
}
for(const id of (action==='rebuild-all'||selection==='all'?types:[selection])){
  if(action==='rebuild-all'){
    if(args.length)throw new Error('rebuild-all does not accept output overrides');
    stage('baseline',id);
    if(!fs.existsSync(path.join(root,'models',id,id+'-master.blend')))stage('init-master',id);
    stage('export',id);stage('render',id);
  }else stage(action,id,args);
}
