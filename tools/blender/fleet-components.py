"""Shared editable timbers, deckhouses and battened rigs for the four fleet masters.
Derived from the treasure-ship study; dimensions and arrangements remain hypotheses.
Each caller opens/creates its scene before importing this module.
"""
import bpy, bmesh, json, math
from mathutils import Vector

def set_dimensions(meta):
    global L,B,D,F
    L,B,D,F=(meta[k] for k in ('L','B','D','F'))

def deck_height(x):
    t=x/L+.5
    return F+L*(.045*(1-t)**5+.032*t**6)

def hull_width(x):
    t=max(0,min(1,x/L+.5))
    return B*.5/1.0218*(.34*(1-t)+.10*t+.80*math.sin(math.pi*t)**.65)

def shell_height(x, z):
    """Exterior hull height at an athwartship position, in model coordinates."""
    q=abs(z)/hull_width(x)
    knots=[(0,-D),(.30,-D*.88),(.64,-D*.52),(.78,-D*.25),(1,deck_height(x))]
    if q>1:raise RuntimeError('Mast foundation is wider than the hull')
    for (a,ya),(b,yb) in zip(knots,knots[1:]):
        if q<=b:return ya+(yb-ya)*(q-a)/(b-a)

def mast_foundation(x,z):
    # Offset masts cannot extend into the narrow V-bottom. Seat them on a
    # transverse timber above the shell; use the whole shoe footprint.
    length,depth=(1.7,.85) if z==0 else (1.2,.60)
    foot=max(-D+.45 if z==0 else -D*.20,
             max(shell_height(xx,abs(z)+depth/2+.08) for xx in [x-length/2,x,x+length/2])+.62)
    yy=foot-.56
    def width_at(xx):
        knots=[(-D,0),(-D*.88,.30),(-D*.52,.64),(-D*.25,.78),(deck_height(xx),1)]
        for (a,wa),(b,wb) in zip(knots,knots[1:]):
            if yy<=b:return hull_width(xx)*(wa+(wb-wa)*(yy-a)/(b-a))
    span=min(width_at(xx) for xx in [x-.22,x,x+.22])-.16
    return foot,span,length,depth

def frame_profile(x, side):
    # Seat the ribs inside the planking instead of placing their centre on its exterior.
    w=hull_width(x)
    return [(x,-D+.24,0),(x,-D*.88+.18,side*max(0,w*.30-.24)),
            (x,-D*.52+.16,side*max(0,w*.64-.24)),
            (x,-D*.25+.12,side*max(0,w*.78-.24)),
            (x,deck_height(x)-.24,side*max(0,w-.24))]

def xyz(p):
    return (p[0], -p[2], p[1])


def material(name, color, roughness=.82, grain=False, cloth=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    if grain or cloth:
        uv = nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'GrainUV'
        scale = nodes.new('ShaderNodeVectorMath')
        scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = (18, 55, 1) if cloth else (.9, 38, 1)
        links.new(uv.outputs['UV'], scale.inputs[0])
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 3
        noise.inputs['Detail'].default_value = 2
        links.new(scale.outputs[0], noise.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        for elem, factor in zip(ramp.color_ramp.elements, [.72, 1.10] if grain else [.90, 1.07]):
            elem.color = (*(c * factor for c in color), 1)
        links.new(noise.outputs['Fac'], ramp.inputs[0])
        links.new(ramp.outputs[0], bs.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .22 if grain else .28
        bump.inputs['Distance'].default_value = .003 if grain else .0015
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], bs.inputs['Normal'])
    return mat


TIMBER = material('R3 structural timber', (.21, .105, .045), grain=True)
PANEL = material('R3 oiled wall planks', (.255, .139, .067), grain=True)
DECK = material('R3 scrubbed deck', (.36, .244, .135), grain=True)
RED = material('R3 muted painted framing', (.19, .043, .024), .74)
DARK = material('R3 end grain and caulking', (.075, .038, .019), .95)
ROPE = material('R3 hemp rope', (.14, .098, .052), .97)
IRON = material('R3 dark iron straps', (.055, .05, .044), .7)
CLOTH = [material('R3 woven sail ' + str(i), (.49 + i * .013, .37 + i * .012, .22 + i * .009), .94, cloth=True) for i in range(3)]
HUMAN = material('Study scale figure', (.35, .09, .055), .9)


def grain_uv(obj):
    """Use physical distances, with grain following each timber's longest axis."""
    mesh = obj.data
    uv = mesh.uv_layers.get('GrainUV') or mesh.uv_layers.new(name='GrainUV')
    low = [min(v.co[k] for v in mesh.vertices) for k in range(3)]
    high = [max(v.co[k] for v in mesh.vertices) for k in range(3)]
    axis = max(range(3), key=lambda k: high[k] - low[k])
    for poly in mesh.polygons:
        second = max((k for k in range(3) if k != axis), key=lambda k: (high[k] - low[k]) * (1 - abs(poly.normal[k])))
        for loop in poly.loop_indices:
            p = mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv = (p[axis] - low[axis], p[second] - low[second])


def mesh(name, vertices, faces, parent, materials, smooth=False, detail=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    parent.users_collection[0].objects.link(obj)
    obj.parent = parent
    for mat in materials:
        data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    grain_uv(obj)
    if detail:
        mod = obj.modifiers.new('DETAIL_Rounded timber edges', 'BEVEL')
        mod.width = .014
        mod.segments = 3
        obj['bake_normal'] = True
    return obj


def empty(name, parent, feature):
    obj = bpy.data.objects.new(name, None)
    parent.users_collection[0].objects.link(obj)
    obj.parent = parent
    obj['feature'] = feature
    return obj


def box(name, x, y, z, width, height, depth, parent, mat=TIMBER, detail=False):
    vertices = [(x + a * width / 2, y + b * height / 2, z + c * depth / 2)
                for a, b, c in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                                (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]]
    return mesh(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)], parent, [mat], detail=detail)


def rod(name, a, b, radius, parent, mat=TIMBER, sides=4, end_radius=None):
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    reference = Vector((0, 1, 0)) if abs(axis.y) < .9 else Vector((1, 0, 0))
    u, v = axis.cross(reference).normalized(), axis.cross(axis.cross(reference).normalized()).normalized()
    vertices = []
    for point, r in [(a, radius), (b, end_radius if end_radius is not None else radius)]:
        vertices.extend([point + r * (u * math.cos(j * math.tau / sides) + v * math.sin(j * math.tau / sides)) for j in range(sides)])
    faces = [(j, (j + 1) % sides, (j + 1) % sides + sides, j + sides) for j in range(sides)]
    if mat != ROPE and name not in ['Batten', 'Yard']:
        faces += [tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))]
    return mesh(name, vertices, faces, parent, [mat], smooth=sides > 4)


def delete_tree(obj):
    for child in list(obj.children_recursive):
        bpy.data.objects.remove(child, do_unlink=True)
    bpy.data.objects.remove(obj, do_unlink=True)


def build_house(meta, groups, section, scheme="sheltered"):
    set_dimensions(meta)
    bottom = meta['design']['houseBase']
    config = meta['design']['house']
    detail = meta['refinement']
    detail.update(houseLevels=len(config), doors=[], windows=[], ladderHatches=[], spaces=[])
    decks = []
    for level, (aft, front, width, height, wall_front, bays, win_h) in enumerate(config):
        g = empty('Deckhouse level %02d' % (level + 1), groups['cabins'], 'deckhouse')
        y = bottom + sum(c[3] for c in config[:level])
        body_aft, body_w = aft + .20, width - .48
        length, mid = wall_front - body_aft, (wall_front + body_aft) / 2
        zmin, zmax = -width / 2, 0 if section else width / 2
        decks.append(dict(x=(aft + front) / 2, y=y, w=front - aft, d=width, h=height, bodyFront=wall_front))
        if level == 0:
            box('Level floor', (aft + front) / 2, y - .10, (zmin + zmax) / 2, front - aft, .20, zmax - zmin, g, DECK, True)
            for x in [aft + .45, mid, front - .45]:
                for z in [-width * .33] if section else [-width * .33, width * .33]:
                    deck_y = deck_height(x)
                    box('Deckhouse foundation post', x, (deck_y + y - .2) / 2, z, .23, y - .2 - deck_y, .23, g, TIMBER, True)
                    rod('Foundation knee', (x, y - .65, z), (x + .50, y - .20, z), .09, g)
            for z in [-width * .33] if section else [-width * .33, width * .33]:
                box('House longitudinal sill', mid, y - .23, z, length, .27, .24, g, TIMBER, True)

        # Two true ladder hatches; the uppermost shelter is not a walkable balcony roof.
        ladder_z, hx = -width * .36, front - .72
        if level < len(config)-1:
            hw, hd = 1.25, 1.05
            detail['ladderHatches'].append(dict(x=hx, y=y + height, z=ladder_z, w=hw, d=hd))
            rectangles = [(aft, hx - hw / 2, zmin, zmax), (hx + hw / 2, front, zmin, zmax),
                          (hx - hw / 2, hx + hw / 2, zmin, ladder_z - hd / 2),
                          (hx - hw / 2, hx + hw / 2, ladder_z + hd / 2, zmax)]
            for xa, xb, za, zb in rectangles:
                if xb > xa and zb > za:
                    box('Walkable roof', (xa + xb) / 2, y + height, (za + zb) / 2, xb - xa, .18, zb - za, g, DECK, True)
            lower, upper = front - .18, front - 1.15
            for step in range(10):
                box('Ladder tread', lower + (upper - lower) * (step + .5) / 10, y + height * (step + 1) / 10, ladder_z, .17, .075, .76, g, DECK)
            for dz in [-.43, .43]:
                rod('Ladder stringer', (lower, y, ladder_z + dz), (upper, y + height + .08, ladder_z + dz), .055, g)
                rod('Ladder handhold', (lower, y + .9, ladder_z + dz), (upper, y + height + .95, ladder_z + dz), .035, g)
            # Solid low boards with a higher handrail replace repeated open balconies.
            next_front = config[level + 1][4]
            for side in [-1] if section else [-1, 1]:
                z = side * width / 2
                box('Terrace solid bulwark', (next_front + front) / 2, y + height + .33, z, front - next_front, .66, .09, g, PANEL, True)
                rod('Terrace handrail', (next_front, y + height + .96, z), (front, y + height + .96, z), .055, g, RED)
                for x in [next_front, (next_front + front) / 2, front]:
                    box('Terrace post', x, y + height + .48, z, .10, .96, .10, g, TIMBER, True)
            box('Front terrace bulwark', front, y + height + .33, (zmin + zmax) / 2, .10, .66, zmax - zmin, g, PANEL, True)
            rod('Front terrace cap', (front, y + height + .96, zmin), (front, y + height + .96, zmax), .055, g, RED)
        else:
            # Very shallow cambered shelter. No ornamental roof type is asserted.
            verts = []
            for x in [body_aft - .25, wall_front + .35]:
                for z in [-width / 2 - .12, 0, width / 2 + .12]:
                    verts.append((x, y + height + (.22 if z == 0 else -.02), z))
            roof = mesh('Cambered upper shelter roof', verts, [(0, 3, 4, 1), (1, 4, 5, 2)] if not section else [(0, 3, 4, 1)], g, [PANEL])
            thick = roof.modifiers.new('Shelter roof thickness', 'SOLIDIFY'); thick.thickness = .14
            roof['bake_normal'] = True
            for x in [body_aft - .25, wall_front + .35]:
                rod('Shelter roof edge', (x, y + height -.02, -width / 2 - .12), (x, y + height + .22, 0), .07, g, RED)
                if not section:
                    rod('Shelter roof edge', (x, y + height + .22, 0), (x, y + height -.02, width / 2 + .12), .07, g, RED)

        door_z, door_w, door_h = -.64, 1.0, 1.95
        detail['doors'].append(dict(x=wall_front, y=y, z=door_z, w=door_w, h=door_h, level=level))
        for a, b in [(-body_w / 2, door_z - door_w / 2), (door_z + door_w / 2, 0 if section else body_w / 2)]:
            if b > a:
                box('Front panel', wall_front, y + height / 2, (a + b) / 2, .16, height, b - a, g, PANEL, True)
        box('Door header', wall_front, y + (door_h + height) / 2, door_z, .20, height - door_h, door_w, g, TIMBER, True)
        for z in [door_z - door_w / 2, door_z + door_w / 2]:
            box('Door jamb', wall_front, y + door_h / 2, z, .20, door_h, .10, g, RED, True)
        box('Aft wall', body_aft, y + height / 2, -body_w / 4 if section else 0, .18, height, body_w / 2 if section else body_w, g, PANEL, True)
        for side in [-1] if section else [-1, 1]:
            z = side * body_w / 2
            sill = 1.03 if level == 0 else .88
            if scheme == 'open-command' and level == 2:
                win_h, sill = 1.20, .65
            box('Window sill wall', mid, y + sill / 2, z, length, sill, .14, g, PANEL, True)
            header = height - sill - win_h
            box('Window lintel', mid, y + height - header / 2, z, length, header, .16, g, PANEL, True)
            bay_w = length / bays
            for j in range(bays + 1):
                x = body_aft + bay_w * j
                box('Exposed post', x, y + height / 2, z, .18, height, .19, g, TIMBER, True)
                box('Post foot block', x, y + .10, z, .25, .20, .26, g, TIMBER, True)
                if j == bays:
                    continue
                center, opening = x + bay_w / 2, min(bay_w - .45, [1.1, 1.2, 1.05][level])
                for a, b in [(x + .09, center - opening / 2), (center + opening / 2, x + bay_w - .09)]:
                    if b > a:
                        box('Window solid infill', (a + b) / 2, y + sill + win_h / 2, z, b - a, win_h, .13, g, PANEL, True)
                if scheme != 'open-command' or level != 2:
                    for dx in [-opening / 6, opening / 6]:
                        box('Window lattice', center + dx, y + sill + win_h / 2, z, .035, win_h, .06, g)
                    box('Window lattice crossbar', center, y + sill + win_h * .6, z, opening, .035, .06, g)
                if j == 1 and level < 2:
                    # Side-hinged shutter, angled away from the passage instead of an awning shelf.
                    hinge = center - opening / 2
                    verts = [(hinge + u * opening * .68, y + sill + v * win_h, z + side * u * opening * .48)
                             for u, v in [(0, 0), (1, 0), (1, 1), (0, 1)]]
                    shutter = mesh('Side-hinged shutter', verts, [(0, 1, 2, 3)], g, [PANEL])
                    thick = shutter.modifiers.new('Shutter thickness', 'SOLIDIFY'); thick.thickness = .045
                    shutter['bake_normal'] = True
                detail['windows'].append(dict(x=center, y=y + sill + win_h / 2, z=z, w=opening, h=win_h, level=level))
        for i in range(1, 4):
            x = body_aft + length * i / 4
            box('Ceiling beam', x, y + height - .18, -body_w / 4 if section else 0, .20, .24, body_w / 2 if section else body_w, g, TIMBER, True)
            for z in [-body_w / 2] if section else [-body_w / 2, body_w / 2]:
                rod('Beam knee', (x, y + height -.60, z), (x, y + height -.18, z + (.42 if z < 0 else -.42)), .08, g)
        if level == 0:
            for x in ([mid] if length < 5.5 else [mid - 1.4, mid + 1.4]):
                box('Crew berth', x, y + .43, -body_w * .30, 1.9, .17, .72, g, DECK)
        else:
            box('Chart table' if level == 1 else 'Lookout bench', mid, y + .72, -.9, 1.35, .12, .75, g, DECK, True)
            for x in [mid - .5, mid + .5]:
                box('Table leg', x, y + .34, -.9, .10, .68, .6, g)
        detail['spaces'].append(dict(level=level, use=['berths and enclosed stores', 'working room and forward terrace', 'sheltered lookout'][level], headroom=height - .30))
        if level == 0:
            start = front + 2.6
            y0 = deck_height(start) + .08
            for j in range(11):
                box('Main access step', start - 2.6 * (j + .5) / 11, y0 + (y - y0) * (j + 1) / 11, door_z, .25, .08, .94, g, DECK)
            for dz in [-.53, .53]:
                rod('Main stair stringer', (start, y0, door_z + dz), (front, y, door_z + dz), .065, g)
                rod('Main stair handrail', (start, y0 + .95, door_z + dz), (front, y + .95, door_z + dz), .04, g)
    meta['layout']['decks'] = decks
    meta['anchors']['cabins'] = [decks[0]['x'], bottom + 1.5, 0]


def build_rigs(meta, groups, section):
    set_dimensions(meta)
    config = meta['design']['rigs']
    detail, masts = meta['refinement'], []
    detail['rigs'] = []
    detail['structure']['mastFoundation']='transverse timber above the shell; model hypothesis'
    demo_index = len(config)-2
    detail['furlDemo'] = dict(index=demo_index, states=['set', 'half', 'stowed'], kind='kinematic illustration; no load simulation')
    for index, (x, z, height, sw, rows, role) in enumerate(config):
        base = deck_height(x)
        foot, foundation_span, shoe_length, shoe_depth = mast_foundation(x,z)
        top = base + height
        rake = .85 if role == 'fore' else .25
        bottom = max(base + 2.30, base + height*.20)
        house_top = meta['design']['houseBase'] + sum(c[3] for c in meta['design']['house'])
        if index == 0 or x-sw*.8 < meta['design']['house'][0][1]:
            bottom = max(bottom, house_top+.55)
        if index == 0:
            # Set the mizzen above and across the aft shelter rather than through it.
            direction = 1
        else:
            direction = -1
        tilt = .28 if role == 'main' else .16 if role == 'mizzen' else .22
        span = top - .7 - bottom - sw * tilt * .75
        if span < .65: raise RuntimeError('Insufficient sail height for '+meta['typeId'])
        balance = .23 if role == 'main' else .29
        boom_angle = .14 if role == 'main' else .22
        row_q = [(r / rows) ** .89 for r in range(rows + 1)]
        g = empty('Mast and sail %02d' % (index + 1), groups['sails'], 'rig')
        g['rig_index'], g['rig_role'] = index, role
        rod('Tapered mast', (x, foot, z), (x + rake, top, z), .245 if role == 'main' else .19, g, sides=10, end_radius=.115 if role == 'main' else .085)
        box('Mast step', x, foot - .10, z, shoe_length, .40, shoe_depth, groups['bulkheads'], TIMBER, True)
        box('Mast foundation beam', x, foot-.43, 0, .44, .26, foundation_span*2, groups['bulkheads'], TIMBER, True)
        box('Partners', x, base + .12, z, 1.25, .30, .80, g, TIMBER, True)
        for dx in [-.40, .40]:
            box('Mast partner wedge', x + dx, base + .32, z, .24, .16, .60, g, TIMBER, True)
        for q in [.25, .55, .80]:
            yy = foot + (top - foot) * q
            rod('Mast binding', (x + rake * q, yy - .04, z), (x + rake * q, yy + .04, z), .24 * (1 - .5 * q), g, IRON, 8)
        block = (x + rake, top -.15, z + .26)
        rod('Masthead block', (block[0], block[1], block[2] -.09), (block[0], block[1], block[2] +.09), .14, g, TIMBER, 6)
        side = -1 if z <= 0 else 1
        sx = x + direction * sw * .75
        sz = side * min(hull_width(sx) -.65, max(abs(z) + .8, 3.25))
        sy = deck_height(sx)
        if index == 0:
            sx, sz, sy = -L*.44, -B*.25, meta['layout']['decks'][0]['y']
        sheet_foot = (sx, sy + .50, sz)
        box('Sheet bollard', sx, sy + .25, sz, .19, .50, .19, g, TIMBER, True)
        belay = (x + .6, base + .6, z - .50)
        box('Halyard cleat', *belay, .32, .09, .12, g)

        def point(u, row, state='set', belly=0):
            q = row_q[row] if isinstance(row, int) else row
            width = sw * (.95 + .13 * math.sin(math.pi * q) - .20 * q)
            along = direction * (u - balance) * width
            # The yard slopes; the upper panels fan progressively without identical trapezoids.
            py = bottom + q * span + sw * tilt * q ** 2.5 * u
            xx = x + along * math.cos(boom_angle) + rake * q
            zz = z + .18 + along * math.sin(boom_angle) + math.sin(math.pi * u) * sw * .075 + belly
            if state != 'set':
                folded = rows if state == 'stowed' else rows // 2
                q0 = row_q[folded]
                rank = q / q0 * folded
                closed_height = folded * .14
                if q <= q0:
                    py = bottom + rank * .14 + sw * .012 * u
                    zz += .20 * math.sin(math.pi * rank)
                else:
                    py -= q0 * span - closed_height
                    py -= sw * tilt * q0 ** 2.5 * u
            return (xx, py, zz)

        states = ['set', 'half', 'stowed'] if index == demo_index else ['set']
        for state in states:
            holder = empty('Fore auxiliary ' + state, g, 'sail_state') if index == demo_index else g
            if index == demo_index:
                holder['sail_state'], holder['sail_demo'] = state, True
                holder.hide_render = state != 'set'
            verts, faces, uvs = [], [], []
            cols = 4
            for row in range(rows):
                start = len(verts)
                for half in range(3):
                    q = (row_q[row] + row_q[row + 1]) / 2 if half == 1 else row_q[row + (half // 2)]
                    for c in range(cols + 1):
                        u = c / cols
                        fold = (state == 'stowed' or state == 'half' and row < rows // 2)
                        belly = math.sin(math.pi * half / 2) * math.sin(math.pi * u) * (.22 if fold else sw * .025)
                        p = point(u, float(q), state, belly)
                        verts.append((p[0], p[1], p[2]-.045))
                        uvs.append((u * sw, q * span))
                for r in range(2):
                    for c in range(cols):
                        a = start + r * (cols + 1) + c
                        faces.append((a, a + 1, a + cols + 2, a + cols + 1))
            fabric = mesh('Battened sail panels', verts, faces, holder, CLOTH, True)
            # Explicit weave coordinates remain separate from the temporary bake atlas.
            uv = fabric.data.uv_layers['GrainUV']
            for poly in fabric.data.polygons:
                poly.material_index = (poly.index // (cols * 2) + index) % len(CLOTH)
                for loop in poly.loop_indices:
                    uv.data[loop].uv = uvs[fabric.data.loops[loop].vertex_index]
            bm = bmesh.new(); bm.from_mesh(fabric.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
            bm.to_mesh(fabric.data); bm.free()
            fabric['bake_normal'] = True
            fabric['bake_group'] = 'sail-%d-%s' % (index, state)
            sub = fabric.modifiers.new('DETAIL_Sail surface smoothing', 'SUBSURF')
            sub.levels = sub.render_levels = 1
            sub.boundary_smooth = 'PRESERVE_CORNERS'
            for row in range(rows + 1):
                for c in range(4):
                    rod('Yard' if row == rows else 'Batten', point(c / 4, row, state), point((c + 1) / 4, row, state), .06 if row in [0, rows] else .035, holder)
                py = point(balance, row, state)[1]
                rod('Batten parrel', (x -.23, py, z -.22), point(balance, row, state), .018, holder, ROPE)
            for u in [0, 1]:
                for row in range(rows):
                    rod('Sail edge rope', point(u, row, state), point(u, row + 1, state), .02, holder, ROPE)
            lift = point(balance, rows, state)
            rod('Halyard to yard', lift, block, .023, holder, ROPE)
            rod('Halyard fall', block, belay, .023, holder, ROPE)
            junction = (sx, max(point(1, 0, state)[1] -.65, sy + 2.0), sz)
            for row in range(1, rows + 1):
                rod('Sheet branch', point(1, row, state), junction, .018, holder, ROPE)
            rod('Sheet fall', junction, sheet_foot, .026, holder, ROPE)
            if state != 'set':
                for obj in holder.children_recursive:
                    obj.hide_render = True
                    obj.hide_set(True)
            if index == demo_index:
                holder['batten_points'] = json.dumps([point(1, row, state) for row in range(rows + 1)])
                holder['halyard_lift'] = json.dumps(lift)
        masts.append(dict(x=x, z=z, base=base, height=height, sw=sw, foot=foot))
        detail['rigs'].append(dict(index=index, role=role, panels=rows, sheetBranches=rows, bottom=bottom, top=top, sailWidth=sw, sheetFoot=sheet_foot, balance=balance, yardRise=sw * tilt, rowFractions=row_q))
    meta['layout']['masts'] = masts
