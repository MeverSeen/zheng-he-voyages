// Separate authoring stages. No command implicitly regenerates or overwrites the master.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),[action,...args]=process.argv.slice(2);
const scripts={baseline:'build-baochuan.py','init-master':'init-baochuan-master.py',export:'export-baochuan.py',render:'render-baochuan-master.py',check:'check-baochuan-pipeline.py'};
if(!scripts[action])throw new Error('Use baseline, init-master, export, render or check');
function run(cmd,argv){const r=spawnSync(cmd,argv,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
if(action==='baseline')run(process.execPath,['tools/export-ship-base.mjs']);
const blender=process.env.BLENDER_BIN||(fs.existsSync('/Applications/Blender.app/Contents/MacOS/Blender')?'/Applications/Blender.app/Contents/MacOS/Blender':'blender');
run(blender,['--background','--factory-startup','--threads','4','--python-exit-code','1','--python',path.join(root,'tools/blender',scripts[action]),'--',...args]);
