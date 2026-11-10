"""One-time repair of new fleet study ribs; save a distinct copy for inspection."""
import argparse,bpy,hashlib,json,runpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
if args.source.resolve()==args.out.resolve() or args.out.exists():raise RuntimeError('Save a new, distinct study copy')
source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
assert bpy.context.scene.get('artifact_role')=='authoring_master'
timber=bpy.data.materials['R3 structural timber']
C=runpy.run_path(str(ROOT/'tools/blender/fleet-components.py'))
for root in [o for o in bpy.data.objects if o.get('metadata')]:
    meta=json.loads(root['metadata']);assert meta['typeId'] in ['machuan','liangchuan','zuochuan','zhanchuan']
    assert 'frameInset' not in meta['refinement']['structure'],'Repair already applied'
    C['set_dimensions'](meta)
    group=next(o for o in root.children if o.get('part')=='bulkheads')
    old=[o for o in group.children if o.name.startswith('Hull frame')]
    section=root.name.endswith('_section')
    assert len(old)==23*4*(1 if section else 2)
    for o in old:bpy.data.objects.remove(o,do_unlink=True)
    for i in range(1,24):
        x=(i/24-.5)*meta['L']
        for side in [-1] if section else [-1,1]:
            profile=C['frame_profile'](x,side)
            for a,b in zip(profile,profile[1:]):C['rod']('Hull frame',a,b,.075,group,timber)
    meta['refinement']['structure']['frameInset']=.24
    root['metadata']=json.dumps(meta,separators=(',',':'))
bpy.context.scene['frame_repair_source_sha256']=source_hash
args.out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()))
assert hashlib.sha256(args.source.read_bytes()).hexdigest()==source_hash
