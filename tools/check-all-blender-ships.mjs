import {spawnSync} from 'node:child_process';
import {shipTypes} from '../three/ship-assets.js';
for(const typeId of shipTypes){
  const result=spawnSync(process.execPath,['tools/check-blender-ships.mjs','--ship',typeId],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
