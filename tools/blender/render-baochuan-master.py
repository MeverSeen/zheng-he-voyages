"""Render the saved master without changing its file or rebuilding its geometry."""
import bpy, sys, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--master',type=Path,default=ROOT/'models/baochuan/baochuan-master.blend');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=str(args.master.resolve()))
out=ROOT/'models/baochuan/previews';out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.filepath=str(out/'baochuan-master.png');bpy.ops.render.render(write_still=True)
from mathutils import Vector
cam=scene.camera;cam.location=(-48,-62,32);target=Vector((-20,0,9));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=29
scene.render.filepath=str(out/'baochuan-master-deckhouse.png');bpy.ops.render.render(write_still=True)

# Verify the actual exported, embedded-texture web asset under identical lighting.
for name in ['Baochuan_full','Baochuan_section']:
    root=bpy.data.objects[name]
    for obj in [root]+list(root.children_recursive):obj.hide_render=True
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/ships/baochuan-full.glb'))
for obj in list(bpy.data.objects):
    if obj.get('sail_state') and obj['sail_state']!='set':
        for child in [obj]+list(obj.children_recursive):child.hide_render=True
webout=ROOT/'assets/ships'
for filename,position,look,scale in [('baochuan-preview.png',(85,-105,65),(0,0,10),85),('baochuan-deckhouse.png',(-48,-62,32),(-20,0,9),29),('baochuan-rig.png',(23,-54,29),(3,0,15),38)]:
    cam.location=position;target=Vector(look);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
    scene.render.filepath=str(webout/filename);bpy.ops.render.render(write_still=True)
