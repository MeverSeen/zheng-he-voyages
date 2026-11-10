"""R3 deckhouse and rig authoring wrapper for the Baochuan parameter baseline.

The deckhouse remains an explicitly hypothetical display arrangement. Rigs are
created by the shared fleet component helper so their three state demonstration
and mast foundations follow the same current form metadata as the other ships.
"""
from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[2]
components = runpy.run_path(str(ROOT / 'tools/blender/fleet-components.py'))


def _design_from_legacy_layout(meta):
    """Provide R3 defaults until every generated baseline carries design data."""
    house = [(-27.5, -15.2, 7.8, 2.20, -17.15, 5, .62),
             (-27.1, -18.0, 6.5, 2.12, -20.05, 4, .82),
             (-26.6, -20.5, 5.0, 2.08, -22.15, 3, .95)]
    return {'house': house, 'houseBase': 5.716992732475, 'rigs': components['rig_design'](meta)}


def refine(meta, groups, section, mesh, material):
    """Build the retained R3 house and shared current rig representation.

    ``mesh`` and ``material`` remain in the signature for the baseline builder
    protocol; the shared component author uses its own editable materials.
    """
    defaults = _design_from_legacy_layout(meta)
    meta.setdefault('design', defaults)
    meta['design'].setdefault('house', defaults['house'])
    meta['design'].setdefault('houseBase', defaults['houseBase'])
    meta['design'].setdefault('rigs', defaults['rigs'])
    meta['refinement'] = {
        'revision': 3,
        'evidence': 'comparative; exact layout hypothetical',
        'structure': {},
    }
    components['build_house'](meta, groups, section, scheme='sheltered')
    components['build_rigs'](meta, groups, section)
    return meta['refinement']
