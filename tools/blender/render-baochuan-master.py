"""Render the saved master without changing its file or rebuilding its geometry."""
import bpy, sys, argparse, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--ship',default='baochuan',choices=['baochuan','machuan','liangchuan','zuochuan','zhanchuan']);p.add_argument('--master',type=Path);args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ship_id=args.ship
bpy.ops.wm.open_mainfile(filepath=str((args.master or ROOT/'models'/ship_id/f'{ship_id}-master.blend').resolve()))
out=ROOT/'models'/ship_id/'previews';out.mkdir(parents=True,exist_ok=True)
meta=json.loads(bpy.data.objects[ship_id.title()+'_full']['metadata']);L=meta['L'];scale=L/61.2
scene=bpy.context.scene;scene.render.filepath=str(out/f'{ship_id}-master.png');bpy.ops.render.render(write_still=True)
from mathutils import Vector
cam=scene.camera;cam.location=Vector((-48,-62,32))*scale;target=Vector((-20*scale,0,meta['layout']['decks'][0]['y']+2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=29*scale
scene.render.filepath=str(out/f'{ship_id}-master-deckhouse.png');bpy.ops.render.render(write_still=True)

# Verify the actual exported, embedded-texture web asset under identical lighting.
for name in [ship_id.title()+'_full',ship_id.title()+'_section']:
    root=bpy.data.objects[name]
    for obj in [root]+list(root.children_recursive):obj.hide_render=True
before_import=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/ships'/f'{ship_id}-full.glb'))
full_web=set(bpy.data.objects)-before_import
for obj in list(bpy.data.objects):
    if obj.get('sail_state') and obj['sail_state']!='set':
        for child in [obj]+list(obj.children_recursive):child.hide_render=True
webout=ROOT/'assets/ships'
for suffix,position,look,zoom in [('preview',(85,-105,65),(0,0,10),85),('deckhouse',(-48,-62,32),(-20,0,9),29),('rig',(23,-54,29),(3,0,15),38)]:
    filename=f'{ship_id}-{suffix}.png'
    cam.location=Vector(position)*scale;target=Vector(look)*scale;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=zoom*scale
    scene.render.filepath=str(webout/filename);bpy.ops.render.render(write_still=True)

# The actual section derivative exposes the purpose-specific hold arrangement.
for obj in full_web:obj.hide_render=True
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/ships'/f'{ship_id}-section.glb'))
for obj in bpy.data.objects:
    if obj.get('sail_state') and obj['sail_state']!='set':
        for child in [obj]+list(obj.children_recursive):child.hide_render=True
cam.location=Vector((75,-100,70))*scale;target=Vector((0,0,7))*scale
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=78*scale
scene.render.filepath=str(webout/f'{ship_id}-section.png');bpy.ops.render.render(write_still=True)
