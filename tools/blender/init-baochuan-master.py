"""One-time, non-overwriting initialization. The resulting .blend is an independent source."""
import bpy, bmesh, json, hashlib, sys, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--master',type=Path,default=ROOT/'models/baochuan/baochuan-master.blend');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
master=args.master.resolve();baseline=ROOT/'models/baochuan/generated/baochuan-baseline.blend'
if master.exists():raise RuntimeError(f'Master already exists and will not be overwritten: {master}')
bpy.ops.wm.open_mainfile(filepath=str(baseline))
scene=bpy.context.scene;scene['artifact_role']='authoring_master';scene['baseline_sha256']=hashlib.sha256(baseline.read_bytes()).hexdigest();scene['pipeline_version']=1
bevel_prefixes=('Exposed post','Door jamb','Front panel','Window sill wall','Window lintel','Level floor','Walkable roof','Ceiling beam','Deckhouse foundation post','Terrace post','End terrace post','Mast step','Partners')
for o in bpy.data.objects:
    if o.type!='MESH':continue
    # Detail modifiers remain editable and are intentionally omitted from the web control mesh.
    if o.name.startswith(bevel_prefixes):
        bevel=o.modifiers.new('DETAIL_Timber edge rounding','BEVEL');bevel.width=min(.018,min(o.dimensions)*.12);bevel.segments=3;bevel.limit_method='ANGLE'
        o['bake_normal']=True
    if o.name.startswith('Battened sail panels'):
        # Join coincident bay boundaries before subdivision, retaining the control shape.
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(o.data);bm.free()
        sub=o.modifiers.new('DETAIL_Sail surface smoothing','SUBSURF');sub.levels=2;sub.render_levels=2;sub.boundary_smooth='PRESERVE_CORNERS'
    if o.parent and o.parent.get('feature')=='rig':o['authoring_note']='Control mesh editable; DETAIL_ modifiers are master-only.'
for name in ['Baochuan_full','Baochuan_section']:
    bpy.data.objects[name]['source_role']='master'
scene['workflow']='Edit this master. Export reads it without saving. Regenerating the baseline never changes it. DETAIL_ modifiers are master-only; WEB_ modifiers are web-only; other shape modifiers are kept.'
bpy.context.preferences.filepaths.save_version=1
master.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(master))
print(f'Created independent authoring master: {master}')
