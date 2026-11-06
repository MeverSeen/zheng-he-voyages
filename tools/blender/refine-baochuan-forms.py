"""An explicit revision-2 -> revision-3 authoring edit, never part of normal export.

Opens the independent master, preserves unrelated geometry, and saves a study copy.
Evidence and dimensional assumptions: docs/BAOCHUAN-FORMS-2026-11-05.md.
Design coordinates are X forward, Y up, Z starboard; Blender uses (X, -Z, Y).
"""
import argparse
import bmesh
import bpy
import copy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT / 'models/baochuan/baochuan-master.blend')
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--scheme', choices=['sheltered', 'open-command'], default='sheltered')
parser.add_argument('--render', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.source.resolve() == args.out.resolve():
    raise RuntimeError('Author a separate study; inspect it before replacing the master.')
source_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
assert bpy.context.scene.get('artifact_role') == 'authoring_master'
assert json.loads(bpy.data.objects['Baochuan_full']['metadata'])['refinement']['revision'] == 2


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


def build_house(meta, groups, section):
    bottom = 5.716992732475
    # Footprints include forward landings; bodies retreat aft instead of sharing a centre.
    config = [(-27.5, -15.2, 7.8, 2.20, -17.15, 5, .62),
              (-27.1, -18.0, 6.5, 2.12, -20.05, 4, .82),
              (-26.6, -20.5, 5.0, 2.08, -22.15, 3, .95)]
    detail = meta['refinement']
    detail.update(houseLevels=3, doors=[], windows=[], ladderHatches=[], spaces=[])
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
        if level < 2:
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
            if args.scheme == 'open-command' and level == 2:
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
                if args.scheme != 'open-command' or level != 2:
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
            for x in [mid - 2, mid + 1]:
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
    meta['anchors']['cabins'] = [-22, 9, 0]


def deck_height(x):
    t = x / 61.2 + .5
    return 3.366 + 61.2 * (.045 * (1 - t) ** 5 + .032 * t ** 6)


def hull_width(x):
    t = max(0, min(1, x / 61.2 + .5))
    return 13.8 * .5 / 1.0218 * (.34 * (1 - t) + .10 * t + .80 * math.sin(math.pi * t) ** .65)


def build_rigs(meta, groups, section):
    # End and side auxiliaries use fewer/smaller panels; primary masts use the centreline.
    config = [(-28.75, 0, 15.4, 3.5, 5, 'mizzen'),
              (-13.6, -3.25, 13.0, 4.9, 6, 'auxiliary'),
              (-9.7, 3.1, 16.2, 5.8, 7, 'auxiliary'),
              (-3.0, 0, 22.4, 7.7, 9, 'main'),
              (6.4, 0, 23.2, 8.3, 9, 'main'),
              (10.6, -3.0, 17.2, 6.1, 7, 'auxiliary'),
              (15.0, 3.05, 14.0, 5.4, 6, 'auxiliary'),
              (21.7, -2.2, 12.7, 4.3, 6, 'fore'),
              (26.0, 1.3, 9.7, 3.2, 5, 'fore')]
    detail, masts = meta['refinement'], []
    detail['rigs'] = []
    detail['furlDemo'] = dict(index=7, states=['set', 'half', 'stowed'], kind='kinematic illustration; no load simulation')
    for index, (x, z, height, sw, rows, role) in enumerate(config):
        base, foot = deck_height(x), -2.30 if z == 0 else -.55
        top = base + height
        rake = .85 if role == 'fore' else .25
        bottom = max(base + 2.30, 13.5 if index == 0 else 8.6 if index == 1 else base + height * .19)
        if index == 0:
            # Set the mizzen above and across the aft shelter rather than through it.
            direction = 1
        else:
            direction = -1
        tilt = [.16, .22, .26, .34, .32, .27, .23, .28, .18][index]
        span = top - 1.2 - bottom - sw * tilt * .75
        balance = .23 if role == 'main' else .29
        boom_angle = .14 if role == 'main' else .22
        row_q = [(r / rows) ** .89 for r in range(rows + 1)]
        g = empty('Mast and sail %02d' % (index + 1), groups['sails'], 'rig')
        g['rig_index'], g['rig_role'] = index, role
        rod('Tapered mast', (x, foot, z), (x + rake, top, z), .245 if role == 'main' else .19, g, sides=10, end_radius=.115 if role == 'main' else .085)
        box('Mast step', x, foot - .10, z, 1.7, .40, .85, groups['bulkheads'], TIMBER, True)
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
            sx, sz, sy = -26.9, -3.4, meta['layout']['decks'][0]['y']
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

        states = ['set', 'half', 'stowed'] if index == 7 else ['set']
        for state in states:
            holder = empty('Fore auxiliary ' + state, g, 'sail_state') if index == 7 else g
            if index == 7:
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
            if index == 7:
                holder['batten_points'] = json.dumps([point(1, row, state) for row in range(rows + 1)])
                holder['halyard_lift'] = json.dumps(lift)
        masts.append(dict(x=x, z=z, base=base, height=height, sw=sw, foot=foot))
        detail['rigs'].append(dict(index=index, role=role, panels=rows, sheetBranches=rows, bottom=bottom, top=top, sailWidth=sw, sheetFoot=sheet_foot, balance=balance, yardRise=sw * tilt, rowFractions=row_q))
    meta['layout']['masts'] = masts


def refine_structure(meta, groups, section):
    # Broaden the existing flat transom; interpolate the nearby shell and attached fittings.
    def aft_edit(v):
        x, y, z = v.x, v.z, -v.y
        t = x / 61.2 + .5
        if t < .20:
            weight = max(0, 1 - max(t, 0) / .20) ** 3
            w = hull_width(x)
            z *= 1 + 1.03 * weight / max(w, .1)
            x += .65 * weight * max(0, (deck_height(x) - y) / (deck_height(x) + 2.754))
        return xyz((x, y, z))
    for part in ['hull', 'bulkheads', 'cabins']:
        for o in groups[part].children_recursive:
            if o.type != 'MESH':
                continue
            for v in o.data.vertices:
                v.co = aft_edit(v.co)
            o.data.update()
    for o in list(groups['hull'].children_recursive):
        if o.type != 'MESH':
            continue
        if o.name.startswith('Plank seam'):
            # Thin ribbons express seams without spending thousands of triangles on tubes.
            data = o.data
            verts = [tuple(v.co) for v in data.vertices]
            points = [sum((Vector(v) for v in verts[i:i+4]), Vector()) / 4 for i in range(0, len(verts), 4)]
            new = bpy.data.meshes.new('Seam ribbon')
            pv = [tuple(p + Vector((0, 0, delta))) for p in points for delta in [-.012, .012]]
            new.from_pydata(pv, [], [(i*2, (i+1)*2, (i+1)*2+1, i*2+1) for i in range(len(points)-1)])
            new.materials.append(DARK); o.data = new
        if 'planked shell' in o.name or o.name.startswith(('Stern transom', 'Bow closure')):
            bm = bmesh.new(); bm.from_mesh(o.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
            solid = o.modifiers.new('Hull plank thickness 160 mm', 'SOLIDIFY')
            solid.thickness, solid.offset = .16, -1
            o['shell_thickness'] = .16
    # Rebuild only the paper-thin partition sheets; ribs, beams and cargo soles remain.
    source = next(o for o in groups['bulkheads'].children if o.name.startswith('bulkheads baseline 6'))
    bm = bmesh.new(); bm.from_mesh(source.data)
    bm.normal_update()
    planar = [f for f in bm.faces if max(v.co.x for v in f.verts) - min(v.co.x for v in f.verts) < 1e-5
              and all(abs(neighbor.normal.x) > .999 for v in f.verts for neighbor in v.link_faces)]
    # Connected partition faces are distinct from horizontal cargo soles in this material batch.
    bmesh.ops.delete(bm, geom=planar, context='FACES')
    bm.to_mesh(source.data); bm.free()
    for i in range(1, 12):
        x = (i / 12 -.5) * meta['L']
        w, top = hull_width(x) * .96, deck_height(x) -.22
        profile = [(-w, top), (-w*.78, -meta['D']*.25), (-w*.64, -meta['D']*.52), (0, -meta['D'])]
        profile += [(0, top)] if section else [(w*.64, -meta['D']*.52), (w*.78, -meta['D']*.25), (w, top)]
        verts = [(x + dx, y, z) for dx in [-.06, .06] for z, y in profile]
        n = len(profile)
        faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))] + [(j, (j+1)%n, (j+1)%n+n, j+n) for j in range(n)]
        mesh('Structural bulkhead 120 mm', verts, faces, groups['bulkheads'], [PANEL])
    meta['refinement']['structure'] = dict(shellThickness=.16, bulkheadThickness=.12, transomBeam=2*(hull_width(-30.6)+1.03), exactDimensions='model assumptions')
    # Keep the sea cutout aligned to the altered hull at the water plane.
    for p in meta['waterline']:
        v = Vector(xyz((p[0], -.15, p[1])))
        xx, yy, zz = aft_edit(v)
        p[:] = [xx, -yy]


def access_study(meta, groups, section):
    # Separate connected pieces in the existing material batches without rebuilding the deck.
    def components(data):
        neighbors = {v.index: set() for v in data.vertices}
        for edge in data.edges:
            a, b = edge.vertices
            neighbors[a].add(b); neighbors[b].add(a)
        remaining = set(neighbors)
        while remaining:
            component, stack = set(), [next(iter(remaining))]
            while stack:
                i = stack.pop()
                if i in component:
                    continue
                component.add(i); remaining.discard(i)
                stack.extend(neighbors[i] - component)
            yield component

    # The earlier windlass occupied the forward hatch. Move its separate wooden and iron pieces.
    for obj in list(groups['anchor'].children):
        if obj.name.startswith('anchor baseline 14'):
            delete_tree(obj)
            continue
        if obj.type != 'MESH':
            continue
        for ids in components(obj.data):
            center = sum((obj.data.vertices[i].co for i in ids), Vector()) / len(ids)
            if center.x < 20.0:
                for i in ids:
                    obj.data.vertices[i].co += Vector((4.04, 0, .48))
    for side in [-1, 1]:
        fairlead = (24.0, deck_height(24.0) + .30, side * (hull_width(24.0) -.10))
        rod('Anchor cable to fairlead', (23.868, 3.366, side * 4.416), fairlead, .045, groups['anchor'], ROPE, 6)
        rod('Anchor cable to windlass', fairlead, (22.4, 5.25, side * 1.1), .045, groups['anchor'], ROPE, 6)
        box('Hawse bolster', *fairlead, .45, .25, .32, groups['anchor'], TIMBER, True)

    # The large lifted covers blocked the port walkway. Replace each with three narrow leaves
    # stacked outboard; their dimensions and positions are recorded for clearance checks.
    covers = []
    for obj in groups['cabins'].children:
        if obj.type != 'MESH' or not obj.name.startswith('cabins baseline 17'):
            continue
        remove = set()
        for ids in components(obj.data):
            points = [obj.data.vertices[i].co for i in ids]
            size = [max(v[k] for v in points) - min(v[k] for v in points) for k in range(3)]
            if size[0] > 2 and size[2] < .20 and size[1] > 1:
                remove.update(ids)
        bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in remove], context='VERTS')
        bm.to_mesh(obj.data); bm.free()
    for h in meta['layout']['hatches']:
        cz = -min(hull_width(h['x']) - .60, 4.30)
        for leaf in range(3):
            box('Removable hatch cover leaf', h['x'], h['y'] + .10 + leaf * .12, cz, h['w'], .10, h['d'] / 3 -.035, groups['cabins'], DECK, True)
        covers.append(dict(x=h['x'], z=cz, y=h['y'], length=h['w'], leafWidth=h['d']/3-.035, leaves=3))

    # Put the tiller above the aft deck, with an actual opening and standing platform.
    for obj in list(groups['rudder'].children):
        delete_tree(obj)
    stern_y = deck_height(-30.6)
    rod('Rudder stock', (-30.85, -3.40, 0), (-30.85, stern_y+1.05, 0), .29, groups['rudder'], TIMBER, 10)
    box('Rudder blade', -31.30, -1.20, 0, 2.30, 4.20, .30, groups['rudder'], PANEL, True)
    rod('Tiller', (-30.85, stern_y+.95, 0), (-28.95, stern_y+.85, 0), .13, groups['rudder'], TIMBER, 6, .09)
    for z in [-.54, .54]:
        box('Rudder bearing cheek', -30.45, stern_y+.40, z, .45, .8, .22, groups['rudder'], TIMBER, True)
    zmax = 0 if section else 1.5
    box('Steering standing platform', -29.48, stern_y-.06, (-1.5+zmax)/2, 1.60, .16, zmax+1.5, groups['rudder'], DECK, True)
    for z in [-1.40] if section else [-1.40, 1.40]:
        rod('Steering platform knee', (-30.4, stern_y-.80, z), (-29.0, stern_y-.12, z), .10, groups['rudder'])
    detail = meta['refinement']
    detail['hatchCovers'] = covers
    detail['windlass'] = dict(x=22.4, z=0, hatchClearance=22.4-1.071-(meta['layout']['hatches'][-1]['x']+meta['layout']['hatches'][-1]['w']/2))
    detail['rudder'] = dict(stockLength=stern_y+1.05+3.40, operation='short tiller over aft platform; mechanical advantage unverified')
    points = [dict(id='main-passway', label='主甲板通道', x=0, z=-2.35, y=deck_height(0), width=.82, headroom=1.85),
              dict(id='windlass', label='绞盘操作位', x=20.8, z=-1.1, y=deck_height(20.8), width=.80, headroom=1.85),
              dict(id='house-entry', label='登楼入口', x=-16.25, z=-.64, y=meta['layout']['decks'][0]['y']+.10, width=.80, headroom=1.85),
              dict(id='steering', label='艉舵操作位', x=-29.45, z=-1.0, y=stern_y+.05, width=.65, headroom=1.85)]
    detail['accessChecks'] = points
    path = [(x, -2.05) for x in range(-12, 20)] + [(20.0, -1.45), (20.8, -1.1)]
    detail['accessPath'] = dict(width=.70, height=1.70, points=[dict(x=x, y=deck_height(x), z=z) for x,z in path], scope='main deck to windlass working position; not the whole vessel')
    detail['humanScale'] = dict(height=1.70, shoulderWidth=.48, clearanceTarget=.80, note='sampled spatial checks, not a safety certification')
    study = empty('Access study figures', groups['cabins'], 'access_study')
    study['export_web'] = False
    for p in points:
        g = empty('Scale person ' + p['id'], study, 'scale_figure')
        x, y, z = p['x'], p['y'], p['z']
        for dz in [-.12, .12]:
            box('Scale foot', x+.04, y+.035, z+dz, .25, .07, .14, g, HUMAN)
            rod('Scale leg', (x, y+.07, z+dz), (x, y+.78, z+dz), .075, g, HUMAN, 6)
        box('Scale torso', x, y+1.10, z, .24, .62, .48, g, HUMAN)
        rod('Scale head', (x, y+1.44, z), (x, y+1.70, z), .13, g, HUMAN, 8)
    for o in [study] + list(study.children_recursive):
        o['export_web'] = False
        o.hide_render = True
        o.hide_set(True)


for mode in ['full', 'section']:
    root = bpy.data.objects['Baochuan_' + mode]
    section = mode == 'section'
    meta = json.loads(root['metadata'])
    groups = {o['part']: o for o in root.children if 'part' in o}
    for part in ['cabins', 'sails']:
        for o in list(groups[part].children):
            if o.get('feature') in ['deckhouse', 'rig']:
                delete_tree(o)
    for o in list(groups['bulkheads'].children):
        if o.name.startswith('Mast step'):
            delete_tree(o)
    meta['refinement'] = dict(revision=3, evidence='comparative; exact arrangement hypothetical', scheme=args.scheme, authoredFromSha256=source_hash)
    refine_structure(meta, groups, section)
    build_house(meta, groups, section)
    build_rigs(meta, groups, section)
    access_study(meta, groups, section)
    root['metadata'] = json.dumps(meta, separators=(',', ':'))

scene = bpy.context.scene
scene['form_revision'] = 3
scene['form_scheme'] = args.scheme
scene['form_source_sha256'] = source_hash
scene['workflow'] = 'Independent authoring master. Normal export never reruns revision edits. See models/baochuan/README.md.'
bpy.context.preferences.filepaths.save_version = 1
args.out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()))
if args.render:
    scene.cycles.samples = 16
    scene.render.resolution_percentage = 80
    cam = scene.camera
    cam.location = (-48, -62, 32)
    target = Vector((-21, 0, 9))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = 30
    scene.render.filepath = str(args.render.resolve())
    bpy.ops.render.render(write_still=True)
print('Authored study:', args.out)
