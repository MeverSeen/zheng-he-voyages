"""Read the independent master, derive web meshes and bake detail normals in memory.
Never saves the master. Publishing occurs only after both model variants validate.
DETAIL_ modifiers -> master only; WEB_ modifiers -> web only; all other shape modifiers kept.
"""
import bpy, json, hashlib, argparse, sys, tempfile, os, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
DEFAULT_OUT=ROOT/'assets/ships'
p=argparse.ArgumentParser();p.add_argument('--master',type=Path,default=ROOT/'models/baochuan/baochuan-master.blend');p.add_argument('--out',type=Path,default=DEFAULT_OUT);p.add_argument('--no-bake',action='store_true',help='Geometry smoke tests only, requires a separate --out');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
master=args.master.resolve();out=args.out.resolve()
if args.no_bake and out==DEFAULT_OUT.resolve():raise RuntimeError('--no-bake is only allowed for isolated test output')
source_hash=hashlib.sha256(master.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(master))
scene=bpy.context.scene
if scene.get('artifact_role')!='authoring_master':raise RuntimeError('Export requires the independent authoring master, not a generated baseline')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
for c in bpy.data.collections:c.hide_viewport=False;c.hide_render=False
for o in bpy.data.objects:o.hide_set(False);o.hide_render=True
bpy.context.view_layer.update()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def triangles(objects):
    deps=bpy.context.evaluated_depsgraph_get();total=0
    for o in objects:
        if o.type!='MESH':continue
        ev=o.evaluated_get(deps);data=ev.to_mesh();data.calc_loop_triangles();total+=len(data.loop_triangles);ev.to_mesh_clear()
    return total

def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.hide_set(False);o.select_set(True)
    if objects:bpy.context.view_layer.objects.active=objects[0]

def bake_normals(candidates,correspondence,collection,mode,stage):
    if not candidates:raise RuntimeError('No marked bake_normal objects found in the master')
    # Shared atlas UVs are assigned to export copies, never to the master control meshes.
    select(candidates);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.151917,island_margin=.015,correct_aspect=True,scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new('Baochuan '+mode+' detail normals',width=1024,height=1024,alpha=False)
    image.generated_color=(.5,.5,1,1);image.colorspace_settings.name='Non-Color'
    materials=set()
    for o in candidates:
        for m in o.data.materials:
            materials.add(m);nodes=m.node_tree.nodes
            texture=nodes.new('ShaderNodeTexImage');texture.name='Web normal bake target';texture.image=image;nodes.active=texture
    # Isolate component families so rays cannot capture adjacent walls or floor surfaces.
    # All groups use one pre-packed UV atlas; subsequent passes preserve earlier islands.
    families={}
    for o in candidates:
        source=correspondence[o];family=source.get('bake_group',source.name.split('.')[0])
        families.setdefault(family,[]).append(o)
    print(f'Baking {mode}: {len(candidates)} detail objects in {len(families)} isolated families',flush=True)
    for family,parts in families.items():
        targets=[]
        for o in parts:
            copy=o.copy();copy.data=o.data.copy();collection.objects.link(copy);copy.parent=None;copy.matrix_world=o.matrix_world.copy();copy.hide_render=False;targets.append(copy)
        select(targets)
        if len(targets)>1:bpy.ops.object.join()
        target=bpy.context.view_layer.objects.active
        highs=[correspondence[o] for o in parts]
        for o in highs:o.hide_render=False
        select([target]+highs);bpy.context.view_layer.objects.active=target
        bpy.ops.object.bake(type='NORMAL',use_selected_to_active=True,cage_extrusion=.025,max_ray_distance=.05,normal_space='TANGENT',margin=4,use_clear=False)
        for o in highs:o.hide_render=True
        mesh=target.data;bpy.data.objects.remove(target,do_unlink=True);bpy.data.meshes.remove(mesh)
    for m in materials:
        nodes=m.node_tree.nodes;normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1
        m.node_tree.links.new(nodes['Web normal bake target'].outputs['Color'],normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
    image.filepath_raw=str(stage/f'baochuan-{mode}-normal.png');image.file_format='PNG';image.save();image.pack()
    # A non-flat result is evidence that high-detail geometry was actually transferred.
    pixels=image.pixels[:];deviation=max(abs(pixels[i]-.5) for i in range(0,len(pixels),4))
    if deviation<.015:raise RuntimeError('Baked normal atlas is unexpectedly flat')
    return {'file':Path(image.filepath_raw).name,'width':1024,'height':1024,'objects':len(candidates),'sha256':digest(Path(image.filepath_raw)),'maxRedDeviation':round(deviation,4)}

out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='baochuan-export-',dir=out.parent) as tmp:
    stage=Path(tmp)
    report={'schemaVersion':1,'source':{'master':os.path.relpath(master,ROOT),'sha256':source_hash,'baselineSha256':scene.get('baseline_sha256'),'pipelineVersion':scene.get('pipeline_version')},'testOnly':args.no_bake}
    for mode in ['full','section']:
        original=bpy.data.objects.get('Baochuan_'+mode)
        if not original:raise RuntimeError(f'Missing source root {mode}')
        source=[original]+list(original.children_recursive);high_tris=triangles(source)
        collection=bpy.data.collections.new('WEB_'+mode);scene.collection.children.link(collection)
        copies={};materials={};correspondence={};candidates=[]
        for o in source:
            if o.get('export_web',True)==False:continue
            copy=o.copy();copy.name=o.name+'_WEB';copy.hide_render=True;collection.objects.link(copy)
            if o.type=='MESH':
                copy.data=o.data.copy()
                for mod in copy.modifiers:
                    if mod.name.startswith('DETAIL_'):mod.show_viewport=False;mod.show_render=False
                    elif mod.name.startswith('WEB_'):mod.show_viewport=True;mod.show_render=True
                # Per-source material sharing and explicit bake variants keep draw counts bounded.
                for index,mat in enumerate(o.data.materials):
                    key=(mat.name,bool(o.get('bake_normal')) and not args.no_bake)
                    if key not in materials:materials[key]=mat.copy()
                    copy.data.materials[index]=materials[key]
                if o.get('bake_normal') and not args.no_bake:candidates.append(copy);correspondence[copy]=o
            copies[o]=copy
        for original_object,copy in copies.items():
            copy.parent=copies.get(original_object.parent)
            copy.matrix_world=original_object.matrix_world.copy()
        root=copies[original];root['source_role']='web_derivative';root['source_master_sha256']=source_hash
        bpy.context.view_layer.update();web_tris=triangles(copies.values())
        if web_tris>=30000:raise RuntimeError(f'{mode} control mesh exceeds web budget ({web_tris}); simplify it with WEB_ modifiers. Master has not been changed.')
        normal=bake_normals(candidates,correspondence,collection,mode,stage) if not args.no_bake else None
        select(list(copies.values()))
        file=stage/f'baochuan-{mode}.glb'
        bpy.ops.export_scene.gltf(filepath=str(file),use_selection=True,export_format='GLB',export_extras=True,export_yup=True,export_apply=True,export_materials='EXPORT')
        meta=json.loads(root['metadata'])
        report[mode]={'triangles':web_tris,'masterTriangles':high_tris,'dimensions':{'L':meta['L'],'B':meta['B']},'file':file.name,'sha256':digest(file),'normalTexture':normal}
    if digest(master)!=source_hash:raise RuntimeError('Source master changed during export; web publication stopped')
    # GLB is self-contained. PNGs are retained as inspectable build artifacts.
    for mode in ['full','section']:
        data=(stage/report[mode]['file']).read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
        if any('uri' in b for b in gltf.get('buffers',[])+gltf.get('images',[])):raise RuntimeError('Export must not depend on external resources')
    (stage/'baochuan-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    out.mkdir(parents=True,exist_ok=True)
    for f in stage.iterdir():
        if f.name!='baochuan-report.json':os.replace(f,out/f.name)
    os.replace(stage/'baochuan-report.json',out/'baochuan-report.json')
print(json.dumps(report,ensure_ascii=False,indent=2))
