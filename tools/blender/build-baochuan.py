"""Blender authoring source. Run export-ship-base.mjs first, then Blender -b -t 2 -P this file.
Y-up baseline is mapped to Blender Z-up, and glTF converts it back on export.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/ships'
BASE=json.loads((ROOT/'tools/blender/baochuan-base.json').read_text())
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection': bpy.data.collections.remove(c)

def xyz(p): return (p[0],-p[2],p[1])
def material(name,color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=.82
    return m
mats={}
def mat(color):
    key=tuple(round(v,5) for v in color)
    if key not in mats: mats[key]=material('Timber / canvas '+str(len(mats)),color)
    return mats[key]
wood=[material('Hull plank %02d'%i,(.19+i*.006,.087+i*.003,.033+i*.0015)) for i in range(7)]
seam=material('Caulk / plank seams',(.055,.025,.012))

def mesh(name,verts,faces,parent,materials,smooth=False):
    data=bpy.data.meshes.new(name); data.from_pydata([xyz(v) for v in verts],[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.parent=parent
    for m in materials:data.materials.append(m)
    for p in data.polygons:p.use_smooth=smooth
    return o

def strip(name,points,radius,parent,material):
    # Four-sided timber moulding; intentionally modest web geometry.
    verts=[]
    for x,y,z in points:
        verts.extend([(x,y-radius,z-radius),(x,y+radius,z-radius),(x,y+radius,z+radius),(x,y-radius,z+radius)])
    faces=[(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(len(points)-1) for j in range(4)]
    return mesh(name,verts,faces,parent,[material])

roots=[];report={}
for mode,base in BASE.items():
    section=mode=='section'; meta=base['metadata']; L,B,D,F=[meta[k] for k in ('L','B','D','F')]
    root=bpy.data.objects.new('Baochuan_'+mode,None); bpy.context.collection.objects.link(root); roots.append(root)
    root['metadata']=json.dumps(meta,separators=(',',':')); root['authoring']='Blender prototype; research interpretation, not an archaeological reconstruction'
    groups={}
    for part in ['hull','sails','bulkheads','rudder','anchor','cabins']:
        g=bpy.data.objects.new(part,None); bpy.context.collection.objects.link(g);g.parent=root;g['part']=part;groups[part]=g
    for i,item in enumerate(base['meshes']):
        # Replace the shell and old floating decorative wales; keep the keel.
        if item['part']=='hull' and max(item['color'])-min(item['color'])>.06:continue
        p=item['positions'];verts=[p[j:j+3] for j in range(0,len(p),3)]
        if item['part']=='bulkheads':verts=[(x,y,z*.96) for x,y,z in verts]
        idx=item['indices'] or list(range(len(verts)));faces=[idx[j:j+3] for j in range(0,len(idx),3)]
        o=mesh(item['part']+' baseline '+str(i),verts,faces,groups[item['part']],[mat(item['color'])])
        # Weld duplicated triangle vertices so the .blend remains editable.
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
        if item['part']=='sails' and item['doubleSided']:
            for poly in o.data.polygons:poly.use_smooth=True
    def shape(t):
        w=B*.5/1.0218*(.34*(1-t)+.10*t+.80*math.sin(math.pi*t)**.65)
        h=F+L*(.045*(1-t)**5+.032*t**6)
        return ((t-.5)*L,w,h)
    # Preserve deck footprint, keel and waterline baseline; soften the bilge between stations.
    def surface(t,q,side):
        x,w,h=shape(t)
        knots=[(0,0,-D),(.18,.30,-D*.88),(.40,.64,-D*.52),(.60,.78,-D*.25),(1,1,h)]
        for a,b in zip(knots,knots[1:]):
            if q<=b[0]+1e-9:
                u=(q-a[0])/(b[0]-a[0]);return (x,a[2]+(b[2]-a[2])*u,side*w*(a[1]+(b[1]-a[1])*u))
    N=32;bands=14
    for side in [-1] if section else [-1,1]:
        verts=[];faces=[]
        for band in range(bands):
            q0=band/bands;q1=(band+1)/bands
            for j in range(N+1):verts.extend([surface(j/N,q0,side),surface(j/N,q1,side)])
            start=band*(N+1)*2
            for j in range(N):
                a=start+j*2; face=(a,a+2,a+3,a+1);faces.append(face if side<0 else tuple(reversed(face)))
        o=mesh('Port planked shell' if side<0 else 'Starboard planked shell',verts,faces,groups['hull'],wood,True)
        for p in o.data.polygons:p.material_index=(p.index//N*3)%7
        # Visible plank seams and two structurally placed rubbing strakes follow the shell.
        for band in range(1,bands):
            q=band/bands
            if q<.45:continue
            strip('Plank seam',[(x,y,z+side*.018) for x,y,z in [surface(j/N,q,side) for j in range(N+1)]],.012,groups['hull'],seam)
        for q in [.72,.94]:
            strip('Timber rubbing strake',[(x,y,z+side*.055) for x,y,z in [surface(j/N,q,side) for j in range(N+1)]],.075,groups['hull'],wood[1])
    # Separate closed transom and stem surfaces, with a center cut edge for the section.
    for t in [0,1]:
        profile=[surface(t,j/bands,-1) for j in range(bands+1)]
        profile+=([(profile[-1][0],profile[-1][1],0)] if section else [surface(t,j/bands,1) for j in range(bands,-1,-1)])
        mesh('Stern transom' if t==0 else 'Bow closure',profile,[tuple(range(len(profile)))],groups['hull'],[wood[2]])
    # Explicit shell thickness at the sheer, independent of the railing.
    for side in [-1] if section else [-1,1]:
        strip('Sheer cap timber',[surface(j/N,1,side) for j in range(N+1)],.09,groups['hull'],wood[4])
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(OUT/('baochuan-'+mode+'.glb')),use_selection=True,export_format='GLB',export_extras=True,export_yup=True,export_materials='EXPORT')
    tris=0
    for o in root.children_recursive:
        if o.type=='MESH':o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    report[mode]={'triangles':tris,'dimensions':{'L':L,'B':B},'file':'baochuan-'+mode+'.glb'}
# Collections make full / section independently editable in the saved source.
for root in roots:
    c=bpy.data.collections.new(root.name);bpy.context.scene.collection.children.link(c)
    for o in [root]+list(root.children_recursive):
        for old in list(o.users_collection):old.objects.unlink(o)
        c.objects.link(o)
    if root.name.endswith('section'):c.hide_render=True;c.hide_viewport=True
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.device='CPU'
scene.world.color=(.32,.32,.32)
cam_data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',cam_data);scene.collection.objects.link(cam)
cam.location=(85,-105,65);target=Vector((0,0,10));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=85;scene.camera=cam
for name,pos,energy,size in [('Key',(20,-35,65),70000,45),('Fill',(-30,20,35),45000,35)]:
    data=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,4))-o.location).to_track_quat('-Z','Y').to_euler();data.energy=energy;data.shape='DISK';data.size=size
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'baochuan-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'baochuan.blend'))
(OUT/'baochuan-report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.render.render(write_still=True)
print(json.dumps(report))
