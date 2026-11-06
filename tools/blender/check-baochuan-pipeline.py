"""Integration checks: source isolation, overwrite guard, editable master -> derivative propagation."""
import bpy, hashlib, json, struct, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
master=ROOT/'models/baochuan/baochuan-master.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def blender(script,*args):
    return subprocess.run([bpy.app.binary_path,'--background','--factory-startup','--threads','2','--python-exit-code','1','--python',str(ROOT/'tools/blender'/script),'--',*map(str,args)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
protected=[master,ROOT/'models/baochuan/generated/baochuan-baseline.blend']+list((ROOT/'assets/ships').glob('baochuan-*.glb'))+list((ROOT/'assets/ships').glob('baochuan-*-normal.png'))+list((ROOT/'assets/ships').glob('baochuan-*-color.png'))+[ROOT/'assets/ships/baochuan-report.json']
before={p:sha(p) for p in protected}
# A baseline rebuild must not update any protected asset, even when the master already exists.
with tempfile.TemporaryDirectory(prefix='baochuan-baseline-check-') as generated:
    r=subprocess.run(['node','tools/ship-pipeline.mjs','baseline','--out',generated],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    assert r.returncode==0,r.stdout[-3000:]
    assert (Path(generated)/'baochuan-baseline.blend').exists()
assert all(sha(p)==value for p,value in before.items()),'Baseline generation modified master or web assets'
r=blender('init-baochuan-master.py')
assert r.returncode!=0 and 'will not be overwritten' in r.stdout,'Existing master must refuse initialization'
assert sha(master)==before[master]
bpy.ops.wm.open_mainfile(filepath=str(master));assert bpy.context.scene['artifact_role']=='authoring_master'
assert any(o.get('bake_normal') for o in bpy.data.objects)
assert any(m.name.startswith('DETAIL_') for o in bpy.data.objects for m in o.modifiers)
# Modify a disposable master copy and export it. The actual object transform must propagate.
with tempfile.TemporaryDirectory(prefix='baochuan-pipeline-check-') as tmp:
    temp=Path(tmp);edited=temp/'edited-master.blend'
    root=bpy.data.objects['Baochuan_full'];post=next(o for o in root.children_recursive if o.name.startswith('Exposed post'))
    post.location.x+=.03125;post['pipeline_probe']='authored-transform';expected=post.location.x
    bpy.ops.wm.save_as_mainfile(filepath=str(edited));edited_hash=sha(edited)
    r=blender('export-baochuan.py','--master',edited,'--out',temp/'web','--no-bake')
    assert r.returncode==0,r.stdout[-3000:];assert sha(edited)==edited_hash,'Export rewrote source file'
    data=(temp/'web/baochuan-full.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
    exported=next(n for n in gltf['nodes'] if n.get('extras',{}).get('pipeline_probe')=='authored-transform')
    assert abs(exported.get('translation',[0,0,0])[0]-expected)<1e-6,'Master edit was lost in derivative'
    report=json.loads((temp/'web/baochuan-report.json').read_text());assert report['source']['sha256']==edited_hash and report['testOnly']
assert all(sha(p)==value for p,value in before.items()),'Integration checks modified protected production files'
# Decode the actual embedded images in Blender, including sail atlas coverage.
# Node only validates PNG headers; this catches failed projection patches inside cloth UVs.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/ships/baochuan-full.glb'))
image_pixels={};samples=0
for obj in bpy.data.objects:
    if obj.type!='MESH' or not obj.data.uv_layers:continue
    uv=obj.data.uv_layers.active.data
    for face in obj.data.polygons:
        mat=obj.data.materials[face.material_index]
        if not mat.name.startswith('R3 woven sail'):continue
        image=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
        if image.name not in image_pixels:image_pixels[image.name]=image.pixels[:]
        u=sum(uv[i].uv.x for i in face.loop_indices)/len(face.loop_indices)
        v=sum(uv[i].uv.y for i in face.loop_indices)/len(face.loop_indices)
        x=min(image.size[0]-1,max(0,int(u*image.size[0])))
        y=min(image.size[1]-1,max(0,int(v*image.size[1])))
        red=image_pixels[image.name][(y*image.size[0]+x)*4]
        assert red>.30,f'Uncovered or dark sail-color patch: {obj.name}, polygon {face.index}, red={red}'
        samples+=1
assert samples>500,'Actual embedded sail textures were not sampled'
print(f'PASS: baseline isolation; master overwrite refusal; authored edit propagation; read-only export; production assets unchanged; {samples} decoded sail-color samples.')
