// Provenance gate for builds: stale or partial derivatives must not silently ship.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function checkShipAssets(){
 const folder=path.join(root,'assets/ships'),report=JSON.parse(fs.readFileSync(path.join(folder,'baochuan-report.json'),'utf8'));
 assert.equal(report.schemaVersion,1);assert.equal(report.testOnly,false,'test-only exports cannot ship');
 assert.equal(sha(path.join(root,report.source.master)),report.source.sha256,'Master changed: run npm run model:export before building');
 for(const mode of ['full','section']){
  const r=report[mode];assert.ok(r.triangles<30000);assert.ok(r.masterTriangles>r.triangles);
  assert.equal(sha(path.join(folder,r.file)),r.sha256,`${mode} model differs from export manifest`);
  assert.ok(r.normalTexture?.objects>0);assert.equal(sha(path.join(folder,r.normalTexture.file)),r.normalTexture.sha256);
  const bytes=fs.readFileSync(path.join(folder,r.file));assert.equal(bytes.toString('ascii',0,4),'glTF');
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.ok(json.materials.some(m=>m.normalTexture),'GLB must carry baked detail normals');
  assert.ok(json.images?.length>0&&json.images.every(i=>i.bufferView!==undefined&&!i.uri),'textures must be embedded');
  assert.ok(json.buffers.every(b=>!b.uri));
  for(const m of json.meshes)for(const p of m.primitives)if(json.materials[p.material]?.normalTexture)assert.ok(p.attributes.TEXCOORD_0!==undefined,'textured geometry must retain UVs');
  assert.ok(json.nodes.some(n=>n.extras?.source_master_sha256===report.source.sha256));
 }
 return report;
}
