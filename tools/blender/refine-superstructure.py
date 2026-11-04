"""Evidence-bounded deckhouse and rig authoring helpers (Y-up design coordinates).
Comparative sources and limits: docs/FLEET-PLAN.md, 2026-11-04 form review.
All exact dimensions, window layout, nine masts and panel counts are hypotheses.
"""
import bpy, math
from mathutils import Vector

def refine(meta, groups, section, mesh, material):
    L,B,D,F=[meta[k] for k in ('L','B','D','F')]
    timber=material('Refined exposed timber',(.19,.085,.035))
    panel=material('Deckhouse ochre panels',(.28,.13,.055))
    red=material('Restrained red-brown framing',(.23,.045,.025))
    deck=material('Terrace planking',(.40,.25,.12))
    rope=material('Hemp rigging',(.11,.075,.04))
    iron=material('Mast hoop iron',(.055,.052,.046))
    canvas=[material('Woven sail panel '+str(i),(.52+i*.016,.40+i*.014,.23+i*.012)) for i in range(4)]
    def empty(name,parent,role):
        o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o['feature']=role;return o
    def box(name,x,y,z,w,h,d,parent,mat):
        vs=[(x+a*w/2,y+b*h/2,z+c*d/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],parent,[mat])
    def rod(name,a,b,r,parent,mat,sides=6,r2=None):
        a,b=Vector(a),Vector(b);axis=(b-a).normalized();ref=Vector((0,1,0))
        if abs(axis.dot(ref))>.9:ref=Vector((1,0,0))
        u=axis.cross(ref).normalized();v=axis.cross(u).normalized();vs=[]
        for point,radius in [(a,r),(b,r if r2 is None else r2)]:
            vs.extend([tuple(point+radius*(u*math.cos(j*2*math.pi/sides)+v*math.sin(j*2*math.pi/sides))) for j in range(sides)])
        faces=[(j,(j+1)%sides,(j+1)%sides+sides,j+sides) for j in range(sides)]
        if name in ['Tapered mast','Masthead block']:faces += [tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
        return mesh(name,vs,faces,parent,[mat],True)
    # Three stepped levels remain an explicit design hypothesis, not a four-floor palace.
    meta['refinement']={'revision':2,'evidence':'comparative; exact layout hypothetical','houseLevels':3,'rigs':[],'doors':[],'windows':[]}
    detail=meta['refinement']
    decks=meta['layout']['decks']
    aft=decks[0]['x']-decks[0]['w']/2;t=aft/L+.5
    deckheight=lambda xx:F+L*(.045*(1-(xx/L+.5))**5+.032*(xx/L+.5)**6)
    rise=deckheight(aft)+.22-decks[0]['y']
    for d in decks:d['y']+=rise
    detail['ladderHatches']=[]
    meta['anchors']['cabins']=[decks[0]['x'],decks[0]['y']+3,0]
    for k,d in enumerate(decks):
        x,y,w,depth,h=[d[n] for n in ('x','y','w','d','h')]
        g=empty('Deckhouse level %02d'%(k+1),groups['cabins'],'deckhouse')
        # Inset walls leave a real forward gallery; floor extents match the baseline.
        aft=x-w/2;front=x+w/2;wallfront=front-1.35;walldepth=depth-.55
        length=wallfront-aft;mid=(wallfront+aft)/2
        kept=depth/2 if section else depth;zc=-depth/4 if section else 0
        if k==0:
            box('Level floor',x,y-.08,zc,w,.16,kept,g,deck)
            for xx in [aft+.3,mid,front-.3]:
                for zz in [-depth*.35] if section else [-depth*.35,depth*.35]:
                    bottom=deckheight(xx)
                    if y-.16>bottom:box('Deckhouse foundation post',xx,(bottom+y-.16)/2,zz,.20,y-.16-bottom,.20,g,timber)
        # Each roof is also the next level's floor. A real opening serves its steep ladder.
        ladderz=-depth*.36;hx=front-.85;hw=.92;hd=.96
        detail['ladderHatches'].append({'x':hx,'y':y+h,'z':ladderz,'w':hw,'d':hd})
        zmin=-depth/2;zmax=0 if section else depth/2
        for xa,xb,za,zb in [(aft-.11,hx-hw/2,zmin,zmax),(hx+hw/2,front+.11,zmin,zmax),(hx-hw/2,hx+hw/2,zmin,ladderz-hd/2),(hx-hw/2,hx+hw/2,ladderz+hd/2,zmax)]:
            if xb>xa and zb>za:box('Walkable roof', (xa+xb)/2,y+h,(za+zb)/2,xb-xa,.15,zb-za,g,deck)
        # Roof plank joints stop at the section edge and remain traversable.
        for i in range(1,10):
            xx=aft+i*w/10
            if abs(xx-hx)>hw/2:box('Roof board joint',xx,y+h+.077,zc,.012,.005,kept,g,timber)
        for side in [-1] if section else [-1,1]:
            z=side*walldepth/2
            box('Window sill wall',mid,y+.42,z,length,.84,.12,g,panel)
            box('Window lintel',mid,y+h-.18,z,length,.36,.16,g,red)
            bay=length/6
            for j in range(7):
                xx=aft+j*bay
                box('Exposed post',xx,y+h/2,z,.15,h,.18,g,timber)
                if j==6:continue
                center=xx+bay/2;winw=bay-.28;winh=h-1.2;wy=y+.84+winh/2
                detail['windows'].append({'x':center,'y':wy,'z':z,'w':winw,'h':winh,'level':k})
                # Thin horizontal and vertical mullions, with selected hinged solid shutters.
                box('Window mullion',center,wy,z,.045,winh,.055,g,timber)
                box('Window crossbar',center,wy,z,winw,.045,.055,g,timber)
                if j%2==0:
                    shutter=box('Open timber shutter',center,wy+.12,z+side*.30,winw,.055,winh*.75,g,panel)
                    # Geometry authored as a small awning; its position is a display choice.
                    rod('Shutter support',(xx+.15,wy-.2,z),(xx+.15,wy+.12,z+side*.52),.025,g,timber,4)
            # Low gallery rail beside the exposed forward landing.
            box('Landing side rail',front-.25,y+1.0,side*depth/2,.5,.11,.10,g,red)
        # Forward wall: a genuine doorway opens onto the gallery and exterior stair.
        doorz=-depth*.15;doorw=.92;doorh=1.92
        end=0 if section else walldepth/2
        for a,b in [(-walldepth/2,doorz-doorw/2),(doorz+doorw/2,end)]:
            if b>a:box('Front panel',wallfront,y+h/2,(a+b)/2,.14,h,b-a,g,panel)
        box('Door header',wallfront,y+(doorh+h)/2,doorz,.16,h-doorh,doorw,g,timber)
        for dz in [-doorw/2,doorw/2]:box('Door jamb',wallfront,y+doorh/2,doorz+dz,.20,doorh,.10,g,red)
        detail['doors'].append({'x':wallfront,'y':y,'z':doorz,'w':doorw,'h':doorh,'level':k})
        box('Aft wall',aft,y+h/2,-walldepth/4 if section else 0,.15,h,walldepth/2 if section else walldepth,g,panel)
        # Interior crossbeams and furniture are visible from the right-hand section.
        for i in range(1,4):box('Ceiling beam',aft+length*i/4,y+h-.17,-walldepth/4 if section else 0,.16,.22,walldepth/2 if section else walldepth,g,timber)
        box('Bunk',mid-.9,y+.46,-depth*.28,1.9,.16,.72,g,timber)
        box('Table',mid+1.4,y+.72,-depth*.20,1.1,.12,.7,g,deck)
        for dx in [-.45,.45]:box('Table leg',mid+1.4+dx,y+.34,-depth*.20,.09,.68,.55,g,timber)
        # Steep ship ladder rises from the gallery through the roof hatch.
        sz=ladderz;run=.95;steps=10;lower=front-.12;upper=lower-run
        for j in range(steps):box('Ladder tread',lower-run*(j+.5)/steps,y+h*(j+1)/steps,sz,run/steps+.06,.07,.72,g,deck)
        for dz in [-.40,.40]:
            rod('Ladder stringer',(lower,y+.03,sz+dz),(upper,y+h+.12,sz+dz),.055,g,timber,4)
            rod('Ladder handhold',(lower,y+.85,sz+dz),(upper,y+h+.95,sz+dz),.035,g,timber,4)
        if k==0:
            # First landing starts on the actual sloping main deck.
            start=front+2.4;starty=deckheight(start)+.05
            for j in range(10):box('Main access step',start-2.4*(j+.5)/10,starty+(y-starty)*(j+1)/10,0,.24,.09,.9,g,deck)
            for dz in [-.5,.5]:
                rod('Main stair stringer',(start,starty,dz),(front,y,dz),.065,g,timber,4)
                rod('Main stair handrail',(start,starty+.9,dz),(front,y+.9,dz),.045,g,timber,4)
        # Roof perimeter guardrails: omit section-side rail, keep stair opening.
        for side in [-1] if section else [-1,1]:
            z=side*depth/2
            rod('Terrace rail',(aft,y+h+.95,z),(front,y+h+.95,z),.055,g,red)
            for j in range(9):box('Terrace post',aft+w*j/8,y+h+.47,z,.07,.94,.07,g,timber)
        for xx in [aft,front]:
            ranges=[(-depth/2,0 if section else depth/2)]
            # Ladder arrives through a hatch, so the perimeter railing stays continuous.
            for a,b in ranges:
                if b<=a:continue
                rod('End terrace rail',(xx,y+h+.95,a),(xx,y+h+.95,b),.055,g,red)
                for z in [a,b]:box('End terrace post',xx,y+h+.47,z,.07,.94,.07,g,timber)
    # Battened panels: the raised upper yard and individual cloth/mat bays replace one flat trapezoid.
    top_house=max(d['y']+d['h'] for d in meta['layout']['decks'])
    for i,m in enumerate(meta['layout']['masts']):
        x,z,base,height,sw,foot=[m[k] for k in ('x','z','base','height','sw','foot')]
        g=empty('Mast and sail %02d'%(i+1),groups['sails'],'rig')
        rake=L*.008;top=base+height
        rod('Tapered mast',(x,foot,z),(x+rake,top,z),L*.004,g,timber,10,L*.002)
        box('Mast step',x,foot-.1,z,L*.035,.4,B*.06,groups['bulkheads'],timber)
        box('Partners',x,base+.18,z,L*.022,.36,B*.055,g,timber)
        for q in [.22,.5,.75]:
            yy=foot+(top-foot)*q;xx=x+rake*q
            rod('Mast binding',(xx,yy-.045,z),(xx,yy+.045,z),L*.004*(1-.5*q)+.015,g,iron,10)
        bottom=max(base+height*.20,top_house+1.15 if x<-.4*L else 0)
        sailheight=top-1.8-bottom
        rows=8;cols=4
        # Six lower nearly parallel battens; the top two rise toward the yard.
        def sailpoint(u,q):
            width=sw*(1-.22*q)
            xx=x+(u-.20)*width+rake*q
            yy=bottom+q*sailheight+max(0,(q-.65)/.35)*sw*.15*(1-u)
            zz=z+.12+u*sw*.20+math.sin(math.pi*u)*sw*.065
            return (xx,yy,zz)
        verts=[];faces=[]
        # Each bay has a gentle belly between its two supporting battens.
        for row in range(rows):
            start=len(verts)
            for half in range(3):
                q=(row+half/2)/rows
                for c in range(cols+1):
                    u=c/cols;xx,yy,zz=sailpoint(u,q)
                    zz+=math.sin(math.pi*half/2)*math.sin(math.pi*u)*sw*.018
                    verts.append((xx,yy,zz))
            for r in range(2):
                for c in range(cols):
                    a=start+r*(cols+1)+c;faces.append((a,a+1,a+cols+2,a+cols+1))
        fabric=mesh('Battened sail panels',verts,faces,g,canvas,True)
        for p in fabric.data.polygons:p.material_index=(p.index//(cols*2)+i)%4
        for row in range(rows+1):
            q=row/rows
            for c in range(cols):rod('Yard' if row==rows else 'Batten',sailpoint(c/cols,q),sailpoint((c+1)/cols,q),.065 if row in [0,rows] else .035,g,timber,4)
            # A short parrel encircles the mast near each batten, leaving it free to slide.
            yy=sailpoint(.2,q)[1]
            for a,b in [((x-.28,yy,z-.25),(x+.28,yy,z-.25)),((x+.28,yy,z-.25),sailpoint(.2,q))]:rod('Batten parrel',a,b,.018,g,rope,4)
        # Leech and luff ropes follow actual panel edges, without invented western shrouds.
        for u in [0,1]:
            for row in range(rows):rod('Sail edge rope',sailpoint(u,row/rows),sailpoint(u,(row+1)/rows),.022,g,rope,4)
        # The halyard runs over a masthead block to the yard's lifting point.
        block=(x+rake,top-.12,z+.32)
        rod('Masthead block',(block[0],block[1],block[2]-.10),(block[0],block[1],block[2]+.10),.15,g,timber,8)
        lift=sailpoint(.28,1);belay=(x+.55,base+.55,z+.45)
        rod('Halyard to yard',lift,block,.025,g,rope,5)
        rod('Halyard fall',block,belay,.025,g,rope,5)
        box('Halyard cleat',*belay,.32,.10,.12,g,timber)
        # Fan sheets converge aft of the sail; every branch terminates at a batten end.
        sx=x+sw*.91;sz=z+sw*.28
        t=min(1,max(0,sx/L+.5))
        sy=F+L*(.045*(1-t)**5+.032*t**6)
        width=B*.5/1.0218*(.34*(1-t)+.10*t+.80*math.sin(math.pi*t)**.65)
        sz=max(-width+.35,min(width-.35,sz))
        for hatch in meta['layout']['hatches']:
            if abs(sx-hatch['x'])<hatch['w']/2+.2 and abs(sz)<hatch['d']/2+.25:sz=(-1 if sz<0 else 1)*(hatch['d']/2+.3)
        if i==0:sy=top_house;sz=-meta['layout']['decks'][-1]['d']/2+.4
        sheetfoot=(sx,sy+.45,sz)
        junction=(x+sw*.84,max(bottom-.35,sy+.85),sz)
        for row in [1,3,5,7]:rod('Sheet branch',sailpoint(1,row/rows),junction,.020,g,rope,4)
        rod('Sheet fall',junction,sheetfoot,.027,g,rope,5)
        box('Sheet bollard',sheetfoot[0],sy+.25,sheetfoot[2],.18,.50,.18,g,timber)
        # Record intended geometry for export validation, not as historical measurements.
        detail['rigs'].append({'index':i,'panels':rows,'sheetBranches':4,'bottom':bottom,'top':top,'sailWidth':sw,'sheetFoot':sheetfoot})
    return detail
