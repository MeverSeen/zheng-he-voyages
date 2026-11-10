"""Explicit form-study edit of an existing master; never runs during export.

Preserves the authored deckhouse, purpose-specific hold fittings and anchors.
Rebuilds only the shared hull, deck openings, framing, rig and steering parts.
Always saves to a separate study path; adoption is a separate reviewed action.
"""
import argparse
import bpy
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--ship', required=True)
parser.add_argument('--source', type=Path)
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = args.source or ROOT / 'models' / args.ship / f'{args.ship}-master.blend'
if source.resolve() == args.out.resolve():
    raise RuntimeError('Use a separate study path; the authoring master is protected.')
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
assert bpy.context.scene.get('artifact_role') == 'authoring_master'

spec = importlib.util.spec_from_file_location('fleet_form_builder', ROOT / 'tools/blender/build-fleet-ship.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.configure(argparse.Namespace(ship=args.ship, out=args.out.parent))
C = builder.C


def clear_bao_front_mast(meta, groups):
    """Keep the R3 house; shift its main stair 0.20 m to port beside the mast."""
    if args.ship != 'baochuan' or meta.get('formRevision') == 4:
        return
    for level in groups['cabins'].children:
        if level.get('feature') != 'deckhouse' or not level.name.startswith('Deckhouse level 01'):
            continue
        for obj in level.children_recursive:
            if obj.type == 'MESH' and obj.name.startswith(('Main access step', 'Main stair stringer', 'Main stair handrail')):
                for vertex in obj.data.vertices:
                    vertex.co.y += .20
    meta['refinement']['mastClearanceEdit'] = dict(mainStairPortShift=.20, roomsAndUpperLevels='retained from R3')


for mode in ['full', 'section']:
    section = mode == 'section'
    root = bpy.data.objects[args.ship.title() + '_' + mode]
    meta = json.loads(root['metadata'])
    incoming = builder.base[mode]['metadata']
    groups = {obj['part']: obj for obj in root.children if 'part' in obj}
    clear_bao_front_mast(meta, groups)
    C['set_dimensions'](incoming)
    for key in ['form', 'waterline', 'rudder', 'rudderStock', 'rudderBladeBottom']:
        meta[key] = incoming[key]
    meta['formRevision'] = 4
    meta['layout']['hatches'] = incoming['layout']['hatches']
    meta['layout']['masts'] = incoming['layout']['masts']
    meta['layout']['rudder'] = incoming['layout']['rudder']
    meta['anchors'].update({key: incoming['anchors'][key] for key in ['hull', 'bulkheads', 'sails', 'rudder']})
    old_house = meta['layout']['decks']
    if 'design' not in meta:
        meta['design'] = dict(house=[(d['x'] - d['w'] / 2, d['x'] + d['w'] / 2, d['d'], d['h'],
                                     d.get('bodyFront', d['x'] + d['w'] / 2 - .5), 3, .7) for d in old_house],
                              houseBase=old_house[0]['y'])
    meta['design']['rigs'] = builder.rig_design(meta)
    for part in ['hull', 'sails', 'rudder', 'bulkheads']:
        for child in list(groups[part].children):
            C['delete_tree'](child)
    for child in list(groups['cabins'].children):
        preserve = child.get('feature') in ['deckhouse', 'cargo', 'access_study']
        # The earlier treasure-ship base grouped cargo by material, before feature tags existed.
        preserve = preserve or child.name.startswith(('cabins baseline 24', 'cabins baseline 25'))
        if not preserve:
            C['delete_tree'](child)
    builder.shell(meta, groups, section)
    builder.deck_and_frames(meta, groups, section)
    C['build_rigs'](meta, groups, section)
    C['build_rudder'](meta, groups, section)
    last = meta['layout']['hatches'][-1]
    windlass = meta['refinement']['windlass']
    radius = 1.071 if args.ship == 'baochuan' else .50
    windlass['hatchClearance'] = windlass['x'] - radius - last['x'] - last['w'] / 2
    meta['formSourceSha256'] = source_hash
    root['metadata'] = json.dumps(meta, separators=(',', ':'))

scene = bpy.context.scene
scene['form_revision'] = 4
scene['form_source_sha256'] = source_hash
scene['form_scope'] = 'hull, framing, deck openings, rigs, suspended rudder; authored houses and purpose fittings preserved'
bpy.context.preferences.filepaths.save_version = 0
args.out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()))
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, 'Source changed during study authoring'
print('Saved isolated form study:', args.out)
