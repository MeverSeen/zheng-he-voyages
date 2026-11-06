"""Read-only review renders for the current form revision and its three-position sail."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'models/baochuan/baochuan-master.blend'))
scene = bpy.context.scene
scene.cycles.samples = 24
out = ROOT/'models/baochuan/previews/forms-2026-11-05'
out.mkdir(parents=True, exist_ok=True)
full = bpy.data.objects['Baochuan_full']
section = bpy.data.objects['Baochuan_section']


def show(root, visible, figures=False):
    for c in root.users_collection:
        c.hide_render = False
        c.hide_viewport = False
    for obj in [root]+list(root.children_recursive):
        obj.hide_render = not visible
        obj.hide_set(False)
        if not figures and obj.get('export_web') is False:
            obj.hide_render = True
    if visible:
        for obj in root.children_recursive:
            if obj.get('sail_state') and obj['sail_state']!='set':
                for child in [obj]+list(obj.children_recursive):child.hide_render=True


def render(name, position, target, scale, width=1400, height=1000):
    cam = scene.camera
    cam.location = position
    cam.rotation_euler = (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale = scale
    scene.render.resolution_x,scene.render.resolution_y = width,height
    scene.render.filepath = str(out/name)
    bpy.ops.render.render(write_still=True)


show(section,False)
show(full,True)
render('selected-side.png',(0,-90,12),(0,0,11),72)
render('sheltered.png',(-48,-62,32),(-21,0,9),30)
show(full,True,figures=True)
render('access-forward.png',(12,-23,24),(20,0,5.8),22)
render('access-aft.png',(-43,-27,26),(-25,0,7),24)
show(full,False)
show(section,True)
render('section.png',(65,-100,45),(0,0,6),80)
show(section,False)

# Three independent copies of the same authored rig: no different model or image synthesis.
source=next(o for o in full.children_recursive if o.get('rig_index')==7)
collection=bpy.data.collections.new('Sail state comparison');scene.collection.children.link(collection)
for state,offset in [('set',-14),('half',0),('stowed',14)]:
    objects=[source]+list(source.children_recursive)
    copies={}
    for obj in objects:
        clone=obj.copy();collection.objects.link(clone);clone.hide_render=False;clone.hide_set(False);copies[obj]=clone
    for obj,clone in copies.items():
        clone.parent=copies.get(obj.parent)
        clone.matrix_world=obj.matrix_world.copy()
    copies[source].location.x+=offset
    for obj,clone in copies.items():
        if obj.get('sail_state') and obj['sail_state']!=state:
            for child in [clone]+list(clone.children_recursive):child.hide_render=True
render('furl-study.png',(21.7,-75,17),(21.7,0,8),42,1500,850)
print('Rendered form, access and sail-state studies without saving the master.')
