"""Create a reproducible fleet baseline. Never open or overwrite an authoring master."""
import argparse, bpy, bmesh, hashlib, json, math, runpy, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser()
p.add_argument('--ship',required=True,choices=['machuan','liangchuan','zuochuan','zhanchuan'])
p.add_argument('--out',type=Path)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
out=args.out or ROOT/'models'/args.ship/'generated'
out.mkdir(parents=True,exist_ok=True)
base_path=ROOT/'tools/blender'/f'{args.ship}-base.json'
base=json.loads(base_path.read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
C=runpy.run_path(str(ROOT/'tools/blender/fleet-components.py'))
mesh,box,rod,empty=(C[k] for k in ['mesh','box','rod','empty'])
TIMBER,PANEL,DECK,DARK,ROPE,IRON,RED=(C[k] for k in ['TIMBER','PANEL','DECK','DARK','ROPE','IRON','RED'])
SACK=C['material']('Woven grain sacks',(.32,.26,.14),.98)
spec=base['full']['spec']
L,B,D,F=(base['full']['metadata'][k] for k in ('L','B','D','F'))
C['set_dimensions'](base['full']['metadata'])
deck_y,width=C['deck_height'],C['hull_width']

def weld(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()

def design(meta):
    # Human-scale room heights stay independent of hull length. No scaled treasure-ship copy.
    entries={
      'machuan':[(-.445,-.25,.54,2.20,1.40,4,.65),(-.43,-.31,.43,2.10,1.30,3,.80)],
      'liangchuan':[(-.445,-.29,.53,2.15,1.10,4,.60)],
      'zuochuan':[(-.445,-.29,.56,2.20,1.25,3,.80),(-.43,-.34,.44,2.10,1.10,2,.85)],
      'zhanchuan':[(-.445,-.34,.54,2.10,1.00,2,.70)]
    }[args.ship]
    house=[(a*L,f*L,w*B,h,f*L-landing,bays,win) for a,f,w,h,landing,bays,win in entries]
    main_count=2 if spec['model']['masts']>=7 else 1
    stations=spec['model']['rig']
    mains=sorted(range(len(stations)),key=lambda i:stations[i][2],reverse=True)[:main_count]
    rigs=[]
    for i,(along,across,rise,breadth) in enumerate(stations):
        x,z,height,sw=along*L,across*B,rise*L,breadth*L*.92
        role='mizzen' if i==0 else 'main' if i in mains else 'fore' if i>=len(stations)-2 else 'auxiliary'
        if L<40 and abs(across)>=.20:z=math.copysign(B*(.29 if along>.15 else .34),across)
        if role=='main':
            z=0
            for h in meta['layout']['hatches']:
                clearance=h['w']/2+.60
                if abs(x-h['x'])<clearance:x=h['x']+clearance
        panels=8 if role=='main' else 5 if role in ['fore','mizzen'] else 6
        rigs.append((x,z,height,sw,panels,role))
    return dict(house=house,houseBase=deck_y(house[0][0])+.30,rigs=rigs,
                role=spec['model']['cargo'],basis='Comparative display hypothesis; not an original ship plan')

def shell(meta,groups,section):
    def surface(t,q,side):
        x=(t-.5)*L;w=width(x);top=deck_y(x)
        knots=[(0,0,-D),(.18,.30,-D*.88),(.40,.64,-D*.52),(.60,.78,-D*.25),(1,1,top)]
        for a,b in zip(knots,knots[1:]):
            if q<=b[0]+1e-9:
                u=(q-a[0])/(b[0]-a[0]);return (x,a[2]+(b[2]-a[2])*u,side*w*(a[1]+(b[1]-a[1])*u))
    N,bands=32,12
    thickness=.14 if L>40 else .12
    for side in [-1] if section else [-1,1]:
        verts=[surface(j/N,k/bands,side) for k in range(bands+1) for j in range(N+1)]
        faces=[]
        for k in range(bands):
            for j in range(N):
                a=k*(N+1)+j;f=(a,a+1,a+N+2,a+N+1);faces.append(f if side<0 else tuple(reversed(f)))
        o=mesh('Port planked shell' if side<0 else 'Starboard planked shell',verts,faces,groups['hull'],[TIMBER,PANEL],True)
        for f in o.data.polygons:f.material_index=(f.index//N)%3==0
        weld(o);mod=o.modifiers.new('Hull plank thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=-1
        o['shell_thickness']=thickness
        for q in [.50,.58,.66,.74,.82,.90,.98]:
            pts=[surface(j/N,q,side) for j in range(N+1)]
            verts=[(x,y+dy,z+side*.018) for x,y,z in pts for dy in [-.012,.012]]
            mesh('Caulk seam',verts,[(j*2,j*2+2,j*2+3,j*2+1) for j in range(N)],groups['hull'],[DARK])
        for q in [.75,.94,1]:
            for j in range(N):
                a,b=surface(j/N,q,side),surface((j+1)/N,q,side)
                rod('Rubbing strake' if q<1 else 'Sheer cap',a,b,.075,groups['hull'],TIMBER)
    for t in [0,1]:
        pts=[surface(t,j/bands,-1) for j in range(bands+1)]
        pts+= [(pts[-1][0],pts[-1][1],0)] if section else [surface(t,j/bands,1) for j in range(bands,-1,-1)]
        o=mesh('Stern transom' if t==0 else 'Bow closure',pts,[tuple(range(len(pts)))],groups['hull'],[PANEL]);weld(o)
        mod=o.modifiers.new('End planking thickness','SOLIDIFY');mod.thickness=thickness
    rod('Keel',(-L*.49,-D,0),(L*.49,-D,0),.20,groups['hull'],DARK,6)
    meta['refinement']['structure']=dict(shellThickness=thickness,bulkheadThickness=.12,frameInset=.24,exactDimensions='model assumptions')

def deck_and_frames(meta,groups,section):
    hatches=meta['layout']['hatches'];floor=-D*.42
    cuts=sorted(set([i/32 for i in range(33)]+[(h['x']+sign*h['w']/2)/L+.5 for h in hatches for sign in [-1,1]]))
    for a,b in zip(cuts,cuts[1:]):
        x=((a+b)/2-.5)*L;w=width(x);h=next((h for h in hatches if abs(x-h['x'])<h['w']/2),None)
        ranges=[(-w,-h['d']/2),(h['d']/2,w)] if h else [(-w,w)]
        for za,zb in ranges:
            if section:zb=min(zb,0)
            if zb>za:box('Main deck plank',x,deck_y(x)-.10,(za+zb)/2,(b-a)*L,.20,zb-za,groups['cabins'],DECK)
    n=spec['model']['compartments']
    for i in range(1,n):
        x=(i/n-.5)*L;w=width(x)*.96;top=deck_y(x)-.22
        profile=[(-w,top),(-w*.78,-D*.25),(-w*.64,-D*.52),(0,-D)]
        profile+= [(0,top)] if section else [(w*.64,-D*.52),(w*.78,-D*.25),(w,top)]
        count=len(profile);verts=[(x+dx,y,z) for dx in [-.06,.06] for z,y in profile]
        faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]+[(j,(j+1)%count,(j+1)%count+count,j+count) for j in range(count)]
        mesh('Structural bulkhead',verts,faces,groups['bulkheads'],[PANEL])
    box('Keelson',0,-D+.26,0,L*.9,.32,.40,groups['bulkheads'],DARK)
    for i in range(1,24):
        x=(i/24-.5)*L;w=width(x);y=deck_y(x)
        for side in [-1] if section else [-1,1]:
            profile=C['frame_profile'](x,side)
            for a,b in zip(profile,profile[1:]):rod('Hull frame',a,b,.075,groups['bulkheads'],TIMBER)
        h=next((h for h in hatches if abs(x-h['x'])<h['w']/2+.18),None)
        for za,zb in ([(-w,-h['d']/2),(h['d']/2,w)] if h else [(-w,w)]):
            if section:zb=min(0,zb)
            if zb>za:box('Deck beam',x,y-.31,(za+zb)/2,.18,.28,zb-za,groups['bulkheads'],TIMBER)
        box('Cargo sole',x,floor-.12,-w*.26 if section else 0,L/24,.20,w*.52 if section else w*1.04,groups['bulkheads'],DECK)
        if i%2==0:rod('Deck support', (x,floor,-w*.42),(x,y-.35,-w*.42),.075,groups['bulkheads'])
    covers=[]
    for h in hatches:
        x,y,w,d=h['x'],h['y'],h['w'],h['d']
        for side in [-1] if section else [-1,1]:box('Hatch coaming',x,y+.18,side*d/2,w+.16,.50,.14,groups['cabins'],TIMBER)
        for dx in [-w/2,w/2]:box('Hatch end coaming',x+dx,y+.18,-d/4 if section else 0,.14,.50,d/2 if section else d,groups['cabins'],TIMBER)
        cz=-width(x)+.55;cx=x;leaf_w=d/3-.035
        if args.ship=='zhanchuan':
            # The narrow forward shoulder cannot carry cover leaves beside a walkway.
            # Turn the leaves athwartships and stack them on deck aft of each opening.
            cx=x-w/2-.55;cz=0
            for leaf in range(3):box('Stowed hatch leaf',cx,y+.10+leaf*.11,-w/4 if section else 0,leaf_w,.09,w/2 if section else w,groups['cabins'],DECK,True)
        else:
            for leaf in range(3):box('Stowed hatch leaf',cx,y+.10+leaf*.11,cz,w,.09,leaf_w,groups['cabins'],DECK,True)
        covers.append(dict(x=cx,z=cz,y=y,length=w,leafWidth=leaf_w,leaves=3,turned=args.ship=='zhanchuan'))
        steps=math.ceil((y-floor)/.30);lx=x-w*.25;lz=-d*.25
        for dz in [-.30,.30]:rod('Hold ladder stringer',(lx,floor,lz+dz),(lx+.65,y,lz+dz),.05,groups['cabins'])
        for j in range(steps+1):box('Hold ladder tread',lx+.65*j/steps,floor+(y-floor)*j/steps,lz,.12,.07,.65,groups['cabins'],DECK)
    for side in [-1] if section else [-1,1]:
        for i in range(32):
            xa,xb=(i/32-.5)*L,((i+1)/32-.5)*L
            a,b=(xa,deck_y(xa)+.92,side*width(xa)),(xb,deck_y(xb)+.92,side*width(xb))
            rod('Bulwark cap',a,b,.06,groups['cabins'],RED)
            if i%2==0:rod('Bulwark stanchion',(xa,deck_y(xa),side*width(xa)),a,.055,groups['cabins'])
    meta['refinement']['hatchCovers']=covers

def sack(x,y,z,g):
    verts=[]
    for yy,r in [(0,.25),(.22,.38),(.48,.28),(.55,.10)]:
        for i in range(8):
            a=i*math.tau/8;verts.append((x+math.cos(a)*r,y+yy,z+math.sin(a)*r*.80))
    faces=[tuple(reversed(range(8))),tuple(range(24,32))]+[(r*8+i,r*8+(i+1)%8,(r+1)*8+(i+1)%8,(r+1)*8+i) for r in range(3) for i in range(8)]
    mesh('Grain sack',verts,faces,g,[SACK],True)

def cargo(meta,groups,section):
    kind=spec['model']['cargo'];floor=-D*.42;meta['layout']['cargo']=[]
    g=empty('Purpose arrangement',groups['cabins'],'cargo');g['cargo_kind']=kind
    for i in range(2,spec['model']['compartments']-1):
        x=((i+.5)/spec['model']['compartments']-.5)*L;z=-width(x)*.35
        meta['layout']['cargo'].append(dict(x=x,y=floor,z=z,kind=kind))
        if kind=='stalls':
            # Empty stalls illustrate the allocation; animal welfare/capacity is not certified.
            for dx in [-1.10,1.10]:
                for dz in [-.57,.57]:rod('Stall post',(x+dx,floor,z+dz),(x+dx,floor+1.6,z+dz),.06,g)
                for h in [.55,1.15]:rod('Stall end rail',(x+dx,floor+h,z-.57),(x+dx,floor+h,z+.57),.045,g)
            for h in [.65,1.20]:rod('Stall outboard rail',(x-1.1,floor+h,z-.57),(x+1.1,floor+h,z-.57),.045,g)
            box('Feeding trough',x+1.0,floor+.60,z,.25,.22,1.05,g,DECK,True)
        elif kind=='sacks':
            box('Ventilated dunnage pallet',x,floor+.05,z,2.0,.10,1.18,g,TIMBER)
            for dx in [-.62,0,.62]:
                for dz in [-.30,.30]:sack(x+dx,floor+.1,z+dz,g)
            for dx in [-.30,.30]:sack(x+dx,floor+.60,z,g)
        elif kind=='quarters':
            box('Crew berth',x,floor+.48,z,1.95,.16,.76,g,DECK,True)
            for dx in [-.78,.78]:box('Berth foot',x+dx,floor+.20,z,.13,.4,.66,g)
            box('Personal chest',x,floor+.18,z+.70,.80,.36,.38,g,PANEL,True)
        else:
            box('Weapons locker',x,floor+.35,z,1.3,.7,.62,g,PANEL,True)
            for dx in [-.42,0,.42]:rod('Stored spear',(x+dx,floor+.75,z),(x+dx,floor+1.85,z),.025,g,DARK)
    if kind=='weapons':
        # Modest shield boards mark the side station, not later broadside gunports.
        for side in [-1] if section else [-1,1]:
            for x in [L*.08,L*.16]:
                box('Side station shield',x,deck_y(x)+.48,side*(width(x)-.15),1.25,.90,.08,g,PANEL,True)
    meta['refinement']['purpose']=dict(kind=kind,placements=len(meta['layout']['cargo']),capacityVerified=False)

def steering_and_anchors(meta,groups,section):
    stern=deck_y(-L/2);stock=-L/2-.20
    rod('Rudder stock',(stock,-D*1.2,0),(stock,stern+1.05,0),.19,groups['rudder'],TIMBER,8)
    box('Rudder blade',stock-.35,-D*.4,0,L*.035,D*1.4,.22,groups['rudder'],PANEL,True)
    rod('Tiller',(stock,stern+.95,0),(-L*.45,stern+.85,0),.10,groups['rudder'],TIMBER,6)
    for z in [-.4,.4]:box('Rudder bearing',-L/2,stern+.35,z,.35,.70,.16,groups['rudder'],TIMBER,True)
    # Leave the aft centreline for the tiller; the helmsman stands to port.
    box('Steering platform',-L*.475,stern-.05,-.65 if section else 0,L*.04,.14,1.30 if section else 2.60,groups['rudder'],DECK)
    h=meta['layout']['hatches'][-1];wx=max(L*.37,h['x']+h['w']/2+1.4);wy=deck_y(wx)
    for z in [-.66,.66]:box('Windlass cheek',wx,wy+.48,z,.30,.96,.24,groups['anchor'],TIMBER,True)
    rod('Windlass barrel',(wx,wy+.83,-.95),(wx,wy+.83,.95),.22,groups['anchor'],DARK,10)
    for z in [-.35,.35]:rod('Windlass handle',(wx-.50,wy+.83,z),(wx+.50,wy+.83,z),.045,groups['anchor'])
    for side in [-1,1]:
        ax=L*.42;az=side*width(ax)*.85;ay=F*.30
        rod('Anchor shank',(ax,ay,az),(ax,ay+1.7,az),.095,groups['anchor'],IRON,6)
        rod('Anchor stock',(ax-.65,ay+1.25,az),(ax+.65,ay+1.25,az),.085,groups['anchor'])
        for sign in [-1,1]:rod('Anchor arm',(ax,ay,az),(ax+sign*.5,ay+.55,az),.09,groups['anchor'],IRON,6)
        lead=(ax,deck_y(ax)+.25,side*(width(ax)-.10))
        rod('Anchor cable',(ax,ay+1.7,az),lead,.03,groups['anchor'],ROPE)
        rod('Cable to windlass',lead,(wx,wy+.83,side*.82),.03,groups['anchor'],ROPE)
        box('Hawse bolster',*lead,.35,.20,.25,groups['anchor'],TIMBER,True)
    meta['refinement']['windlass']=dict(x=wx,z=0,hatchClearance=wx-.50-(h['x']+h['w']/2))
    meta['refinement']['rudder']=dict(stockLength=stern+1.05+D*1.2,operation='short tiller; mechanical advantage unverified')
    lane=-(B*.11+.58)
    start=meta['design']['house'][0][1]+3.1;end=wx-1.1
    points=[dict(x=x,y=deck_y(x),z=lane) for x in [start+(end-start)*i/24 for i in range(25)]]
    meta['refinement']['accessPath']=dict(width=.65,height=1.70,points=points)
    meta['refinement']['accessChecks']=[dict(id='main',label='主甲板通路',x=0,y=deck_y(0),z=lane,width=.65,headroom=1.70),
      dict(id='windlass',label='绞盘操作位',x=wx-.90,y=deck_y(wx-.90),z=-1.0,width=.65,headroom=1.70)]

for mode in ['full','section']:
    section=mode=='section';meta=base[mode]['metadata'];meta['design']=design(meta)
    meta['refinement']=dict(revision=1,houseLevels=spec['model']['decks'],evidence='type comparison; exact dimensions and arrangement hypothetical')
    root=bpy.data.objects.new(args.ship.title()+'_'+mode,None);bpy.context.scene.collection.objects.link(root)
    groups={part:empty(part,root,'component') for part in ['hull','sails','bulkheads','rudder','anchor','cabins']}
    for part,g in groups.items():g['part']=part
    shell(meta,groups,section);deck_and_frames(meta,groups,section)
    C['build_house'](meta,groups,section);C['build_rigs'](meta,groups,section)
    cargo(meta,groups,section);steering_and_anchors(meta,groups,section)
    root['metadata']=json.dumps(meta,separators=(',',':'))
    root['source_role']='parameter_baseline'
    coll=bpy.data.collections.new(root.name);bpy.context.scene.collection.children.link(coll)
    for o in [root]+list(root.children_recursive):
        for old in list(o.users_collection):old.objects.unlink(o)
        coll.objects.link(o)
    if section:coll.hide_render=True;coll.hide_viewport=True

scene=bpy.context.scene;scene['artifact_role']='parameter_baseline';scene['ship_type']=args.ship;scene['baseline_input_sha256']=hashlib.sha256(base_path.read_bytes()).hexdigest()
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.device='CPU';scene.world=bpy.data.worlds.new('Studio world');scene.world.color=(.28,.28,.28)
cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'));scene.collection.objects.link(cam);scene.camera=cam
cam.location=(L*1.3,-L*1.6,L);target=Vector((0,0,L*.14));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=L*1.35
for name,position,energy,size in [('Key',(L*.4,-L*.6,L),L*L*18,L*.7),('Fill',(-L*.5,L*.4,L*.6),L*L*12,L*.6)]:
    light=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,F))-o.location).to_track_quat('-Z','Y').to_euler();light.energy=energy;light.size=size
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=L*1.5;area.spaces.active.region_3d.view_location=target;area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{args.ship}-baseline.blend'))
print('Saved fleet baseline:',args.ship)
