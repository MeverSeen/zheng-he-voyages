"""Repair mast shoes in a distinct study copy without regenerating a saved master."""
import argparse,bpy,hashlib,json,runpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
if args.source.resolve()==args.out.resolve() or args.out.exists():raise RuntimeError('Save a new, distinct study copy')
source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
assert bpy.context.scene.get('artifact_role')=='authoring_master'
C=runpy.run_path(str(ROOT/'tools/blender/fleet-components.py'))
timber=bpy.data.materials['R3 structural timber'];iron=bpy.data.materials['R3 dark iron straps']
def center(o):
    return [(min(v.co[k] for v in o.data.vertices)+max(v.co[k] for v in o.data.vertices))/2 for k in range(3)]
for root in [o for o in bpy.data.objects if o.get('metadata')]:
    meta=json.loads(root['metadata']);assert meta['typeId'] in ['machuan','liangchuan','zuochuan','zhanchuan']
    assert 'mastFoundation' not in meta['refinement']['structure'],'Repair already applied'
    C['set_dimensions'](meta)
    bulk=next(o for o in root.children if o.get('part')=='bulkheads')
    rigs={o['rig_index']:o for o in root.children_recursive if 'rig_index' in o}
    for i,(x,z,height,sw,rows,role) in enumerate(meta['design']['rigs']):
        g=rigs[i];oldfoot=meta['layout']['masts'][i]['foot']
        steps=[o for o in bulk.children if o.name.startswith('Mast step') and abs(center(o)[0]-x)<1e-5 and abs(center(o)[1]+z)<1e-5]
        assert len(steps)==1
        if meta['L']<40 and x>meta['L']*.15 and abs(z)>meta['B']*.30:
            new_z=meta['B']*.29*(1 if z>0 else -1);shift=new_z-z
            for obj in g.children_recursive:
                if obj.type=='MESH':
                    for vertex in obj.data.vertices:vertex.co.y-=shift
                for prop in ['batten_points','halyard_lift']:
                    if prop in obj:
                        points=json.loads(obj[prop])
                        if prop=='batten_points':
                            for point in points:point[2]+=shift
                        else:points[2]+=shift
                        obj[prop]=json.dumps(points)
            meta['refinement']['rigs'][i]['sheetFoot'][2]+=shift
            z=new_z;meta['design']['rigs'][i][1]=z;meta['layout']['masts'][i]['z']=z
        foot,span,length,depth=C['mast_foundation'](x,z);top=C['deck_height'](x)+height;rake=.85 if role=='fore' else .25
        mast=next(o for o in g.children if o.name.startswith('Tapered mast'))
        mast_name=mast.name;bpy.data.objects.remove(mast,do_unlink=True)
        mast=C['rod'](mast_name,(x,foot,z),(x+rake,top,z),.245 if role=='main' else .19,g,timber,10,.115 if role=='main' else .085)
        name=steps[0].name;bpy.data.objects.remove(steps[0],do_unlink=True)
        C['box'](name,x,foot-.10,z,length,.40,depth,bulk,timber,True)
        C['box']('Mast foundation beam',x,foot-.43,0,.44,.26,span*2,bulk,timber,True)
        bindings=sorted([o for o in g.children if o.name.startswith('Mast binding')],key=lambda o:center(o)[2])
        assert len(bindings)==3
        for q,old in zip([.25,.55,.80],bindings):
            name=old.name;bpy.data.objects.remove(old,do_unlink=True);yy=foot+(top-foot)*q
            C['rod'](name,(x+rake*q,yy-.04,z),(x+rake*q,yy+.04,z),.24*(1-.5*q),g,iron,8)
        meta['layout']['masts'][i]['foot']=foot
    meta['refinement']['structure']['mastFoundation']='transverse timber above the shell; model hypothesis'
    root['metadata']=json.dumps(meta,separators=(',',':'))
bpy.context.scene['foundation_repair_source_sha256']=source_hash
args.out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()))
assert hashlib.sha256(args.source.read_bytes()).hexdigest()==source_hash
