"""Hull geometry shared by authoring tools, driven by exported JS metadata.

Design coordinates: X forward, Y up, Z starboard. No historical dimensions
are inferred here; coefficients are the explicit form-study assumptions.
"""
import math


def set_dimensions(meta):
    global L, B, D, F, FORM
    L, B, D, F = (meta[k] for k in ('L', 'B', 'D', 'F'))
    FORM = meta['form']


def shape(t):
    t = max(0, min(1, t))
    end = FORM['sternTopWidthRatio'] * (1 - t) + FORM['bowTopWidthRatio'] * t
    power = FORM['widthCurve']['sinePower']
    width = B * .5 * (end + (1 - end) * math.sin(math.pi * t) ** power)
    sheer = F + L * (.045 * (1 - t) ** 5 + .032 * t ** 6)
    return ((t - .5) * L, width, sheer)


def station_x(t, y):
    x, _, top = shape(t)
    blend = FORM.get('endBlendRatio', .12)
    aft = max(0, 1 - t / blend) ** 2
    fore = max(0, 1 - (1 - t) / blend) ** 2
    rake = FORM['endRake']
    return x + L * (aft * rake['sternBottomForward'] - fore * rake['bowBottomAft']) * (top - y) / (top + D)


def surface(t, q, side):
    _, width, top = shape(t)
    knots = FORM['sectionKnots'][len(FORM['sectionKnots']) // 2:]
    scaled = max(0, min(1, q)) * (len(knots) - 1)
    i = min(len(knots) - 2, int(scaled))
    u = scaled - i
    a, b = knots[i:i + 2]
    ya, yb = (top if k.get('top') else -D * k['depth'] for k in (a, b))
    y = ya + (yb - ya) * u
    z = side * width * (a['width'] + (b['width'] - a['width']) * u)
    return (station_x(t, y), y, z)


def half_beam(x, y):
    # Invert the smoothly raked longitudinal stations at the requested height.
    lo, hi = 0.0, 1.0
    for _ in range(32):
        mid = (lo + hi) / 2
        if station_x(mid, y) < x:
            lo = mid
        else:
            hi = mid
    t = (lo + hi) / 2
    _, width, top = shape(t)
    if y < -D:
        return 0.0
    knots = FORM['sectionKnots'][len(FORM['sectionKnots']) // 2:]
    for a, b in zip(knots, knots[1:]):
        ya, yb = (top if k.get('top') else -D * k['depth'] for k in (a, b))
        if y <= yb:
            return width * (a['width'] + (b['width'] - a['width']) * (y - ya) / (yb - ya))
    return width


def clip_transom(profile, side, slot_half):
    """Clip an end polygon to one side of the real rudder slot."""
    result = []
    for a, b in zip(profile, profile[1:] + profile[:1]):
        da, db = side * a[2] - slot_half, side * b[2] - slot_half
        if da >= 0:
            result.append(a)
        if (da >= 0) != (db >= 0):
            u = da / (da - db)
            result.append(tuple(a[k] + u * (b[k] - a[k]) for k in range(3)))
    return result
