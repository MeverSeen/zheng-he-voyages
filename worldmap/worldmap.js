/*
 * WorldMap：可复用的世界底图引擎（docs/SPEC.md §2）
 * 依赖：geo/world.geo.js（WM_GEO）；政局数据可选（WM_POLITIES）。不依赖 Leaflet 或本项目其他文件。
 *
 *   var wm = WorldMap.mount(container, { base: 'worldmap/', view: [lonW, latS, lonE, latN] });
 *   wm.project(lon, lat) → [x, y]；wm.fit(bbox)；wm.layer('routes')；wm.symbol(el, lon, lat)
 *   wm.label(text, lon, lat, { cls, rank })；wm.line(lonlats, { cls, layer })；wm.setPolities(fc, { mode })
 *   wm.on('zoom' | 'move' | 'click' | 'polity', fn)
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var K = 10, C = Math.cos(Math.PI / 6);
  var LAYERS = ['terrain', 'water', 'polities', 'coast', 'lines', 'routes', 'marks', 'labels'];
  var uid = 0;

  function project(lon, lat) { return [(lon + 180) * K * C, (90 - lat) * K]; }
  function unproject(x, y) { return [x / (K * C) - 180, 90 - y / K]; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pathOf(lonlats, closed) {
    var d = '';
    for (var i = 0; i < lonlats.length; i++) {
      var p = project(lonlats[i][0], lonlats[i][1]);
      d += (i ? 'L' : 'M') + r1(p[0]) + ',' + r1(p[1]);
    }
    return closed ? d + 'Z' : d;
  }
  function multiPolygonPath(coords) {
    var d = '';
    coords.forEach(function (poly) { poly.forEach(function (ring) { d += pathOf(ring, true); }); });
    return d;
  }

  function mount(container, opts) {
    opts = opts || {};
    var G = opts.geo || root.WM_GEO;
    if (!G) throw new Error('WorldMap：缺少 WM_GEO（geo/world.geo.js）');
    var base = opts.base || '';
    var reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var id = 'wm' + (++uid);
    var listeners = {};
    function emit(name, a, b) { (listeners[name] || []).forEach(function (fn) { fn(a, b); }); }

    container.classList.add('wm');
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '0');
    var svg = el('svg', { class: 'wm-svg', role: 'img', 'aria-label': opts.label || '世界地图' }, container);
    var defs = el('defs', null, svg);
    el('path', { d: G.land }, el('clipPath', { id: id + '-land' }, defs));
    defs.insertAdjacentHTML('beforeend',
      '<pattern id="' + id + '-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="wm-hatch-line"/></pattern>' +
      '<pattern id="' + id + '-dots" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="3" cy="3" r="0.9" class="wm-dot"/></pattern>');
    var L = {};
    LAYERS.forEach(function (n) { L[n] = el('g', { class: 'wm-' + n }, svg); });
    L.polities.setAttribute('clip-path', 'url(#' + id + '-land)');

    // 栅格底图：全球图常驻，细图在放大后叠加
    var rasters = G.rasters.map(function (r) {
      var inline = root.WM_RASTER_DATA && root.WM_RASTER_DATA[r.src];   // 离线单文件版由构建脚本内嵌
      var img = el('image', { href: inline || base + r.src, x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3], preserveAspectRatio: 'none' }, L.terrain);
      return { r: r, img: img };
    });
    // 水系
    if (G.lakes) el('path', { d: G.lakes, class: 'wm-lake' }, L.water);
    var riverText = [];
    G.rivers.forEach(function (rv, i) {
      el('path', { d: rv.d, class: 'wm-river w' + rv.w }, L.water);
      el('path', { d: rv.ld, id: id + '-rv' + i, fill: 'none', stroke: 'none' }, defs);
      var t = el('text', { class: 'wm-river-label w' + rv.w, dy: -3 }, L.labels);
      var tp = el('textPath', { href: '#' + id + '-rv' + i, startOffset: '50%', 'text-anchor': 'middle' }, t);
      tp.textContent = rv.n;
      riverText.push({ t: t, w: rv.w, len: rv.len });
    });
    el('path', { d: G.land, class: 'wm-coast' }, L.coast);

    /* ---------- 相机 ---------- */
    var W = 1, H = 1;
    var bounds = opts.bounds || [-180, -62, 180, 84];          // 可视范围（经纬度），默认略去两极
    var bx0 = project(bounds[0], bounds[3]), bx1 = project(bounds[2], bounds[1]);
    var cam = { x: (bx0[0] + bx1[0]) / 2, y: (bx0[1] + bx1[1]) / 2, s: 1 };
    var fitS = 1, minZoom = opts.minZoom || 1, maxZoom = opts.maxZoom || 48;
    var symbols = [];
    var anim = 0;

    function measure() {
      W = container.clientWidth || 800; H = container.clientHeight || 500;
      fitS = Math.min(W / (bx1[0] - bx0[0]), H / (bx1[1] - bx0[1]));
    }
    function clamp() {
      cam.s = Math.max(fitS * minZoom, Math.min(fitS * maxZoom, cam.s));
      var hw = W / 2 / cam.s, hh = H / 2 / cam.s;
      var cx0 = bx0[0] + hw, cx1 = bx1[0] - hw, cy0 = bx0[1] + hh, cy1 = bx1[1] - hh;
      cam.x = cx0 > cx1 ? (bx0[0] + bx1[0]) / 2 : Math.max(cx0, Math.min(cx1, cam.x));
      cam.y = cy0 > cy1 ? (bx0[1] + bx1[1]) / 2 : Math.max(cy0, Math.min(cy1, cam.y));
    }
    var lastBucket = '';
    function render() {
      clamp();
      var vw = W / cam.s, vh = H / cam.s;
      svg.setAttribute('viewBox', r1(cam.x - vw / 2) + ' ' + r1(cam.y - vh / 2) + ' ' + r1(vw) + ' ' + r1(vh));
      var z = cam.s / fitS, inv = 1 / cam.s;
      for (var i = 0; i < symbols.length; i++) {
        var s = symbols[i];
        s.el.setAttribute('transform', 'translate(' + r1(s.x) + ',' + r1(s.y) + ') scale(' + inv.toFixed(5) + ')' + (s.rot ? ' rotate(' + s.rot + ')' : ''));
      }
      riverText.forEach(function (r) { r.t.setAttribute('font-size', ((r.w === 2 ? 12 : 10.5) * inv).toFixed(3)); });
      // 细图与注记分级都按绝对比例尺（屏幕像素/世界单位）判断，手机与桌面在同一比例尺下显示相同的内容
      rasters.forEach(function (r) { r.img.style.display = cam.s >= (r.r.minScale || 0) ? '' : 'none'; });
      var b = cam.s < 0.6 ? 1 : cam.s < 1.6 ? 2 : cam.s < 3.5 ? 3 : 4;
      if (b !== lastBucket) {
        for (var k = 1; k <= 4; k++) container.classList.toggle('wm-z' + k, k === b);
        lastBucket = b;
      }
      emit('zoom', z);
    }

    function zoomAt(px, py, factor) {
      var wx = cam.x + (px - W / 2) / cam.s, wy = cam.y + (py - H / 2) / cam.s;
      cam.s *= factor; clamp();
      cam.x = wx - (px - W / 2) / cam.s; cam.y = wy - (py - H / 2) / cam.s;
      render();
    }
    function fly(target, ms) {
      cancelAnimationFrame(anim);
      if (reduce || !ms) { cam.x = target.x; cam.y = target.y; cam.s = target.s; render(); return; }
      var from = { x: cam.x, y: cam.y, s: cam.s }, t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        var ls = Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e;
        cam.s = Math.exp(ls); cam.x = from.x + (target.x - from.x) * e; cam.y = from.y + (target.y - from.y) * e;
        render();
        if (t < 1) anim = requestAnimationFrame(step); else emit('move');
      })(t0);
    }
    function fit(bbox, o) {
      o = o || {};
      var pad = o.pad == null ? 40 : o.pad;
      var a = project(bbox[0], bbox[3]), b = project(bbox[2], bbox[1]);
      var s = Math.min((W - 2 * pad) / Math.max(1, b[0] - a[0]), (H - 2 * pad) / Math.max(1, b[1] - a[1]));
      var t = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, s: Math.max(fitS * minZoom, Math.min(fitS * maxZoom, s)) };
      fly(t, o.animate === false ? 0 : 700);
    }

    /* ---------- 交互：拖动、双指、滚轮、双击、键盘 ---------- */
    var ptrs = new Map(), drag = null, moved = 0;
    svg.addEventListener('pointerdown', function (e) {
      cancelAnimationFrame(anim);
      svg.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      moved = 0;
      drag = snapshot();
      container.classList.add('wm-dragging');
    });
    svg.addEventListener('pointermove', function (e) {
      if (!ptrs.has(e.pointerId)) return;
      var prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
      var rect = svg.getBoundingClientRect();
      if (ptrs.size === 1) {
        cam.x -= (e.clientX - prev[0]) / cam.s; cam.y -= (e.clientY - prev[1]) / cam.s; render();
      } else if (ptrs.size === 2) {
        var p = Array.from(ptrs.values());
        var d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        if (drag.d) {
          var mx = (p[0][0] + p[1][0]) / 2 - rect.left, my = (p[0][1] + p[1][1]) / 2 - rect.top;
          zoomAt(mx, my, d / drag.d);
        }
        drag.d = d;
      }
    });
    function up(e) {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2 && drag) drag.d = 0;
      if (!ptrs.size) { container.classList.remove('wm-dragging'); emit('move'); }
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    function snapshot() { var p = Array.from(ptrs.values()); return { d: p.length === 2 ? Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) : 0 }; }
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      cancelAnimationFrame(anim);
      var rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
    }, { passive: false });
    svg.addEventListener('dblclick', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      var wx = cam.x + (px - W / 2) / cam.s, wy = cam.y + (py - H / 2) / cam.s;
      fly({ x: wx, y: wy, s: cam.s * 2 }, 350);
    });
    svg.addEventListener('click', function (e) {
      if (moved > 6) return;
      var rect = svg.getBoundingClientRect();
      var wx = cam.x + (e.clientX - rect.left - W / 2) / cam.s, wy = cam.y + (e.clientY - rect.top - H / 2) / cam.s;
      var ll = unproject(wx, wy);
      var hit = e.target.closest && e.target.closest('[data-pid]');
      if (hit && polFeatures) emit('polity', polFeatures[+hit.getAttribute('data-pid')].properties, { lonlat: ll, event: e });
      emit('click', ll, e);
    });
    container.addEventListener('keydown', function (e) {
      var step = 80 / cam.s, k = e.key;
      if (k === '+' || k === '=') zoomAt(W / 2, H / 2, 1.4);
      else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, 1 / 1.4);
      else if (k === 'ArrowLeft') { cam.x -= step; render(); }
      else if (k === 'ArrowRight') { cam.x += step; render(); }
      else if (k === 'ArrowUp') { cam.y -= step; render(); }
      else if (k === 'ArrowDown') { cam.y += step; render(); }
      else return;
      e.preventDefault();
    });
    var ro = root.ResizeObserver ? new ResizeObserver(function () { var z = cam.s / fitS; measure(); cam.s = z * fitS; render(); }) : null;
    if (ro) ro.observe(container);

    /* ---------- 内容接口 ---------- */
    function symbol(node, lon, lat, o) {
      var p = project(lon, lat);
      var g = node.namespaceURI === NS && node.tagName === 'g' ? node : el('g', null);
      if (g !== node) g.appendChild(node);
      ((o && o.layer && L[o.layer]) || L.marks).appendChild(g);
      var s = { el: g, x: p[0], y: p[1], rot: (o && o.rot) || 0 };
      symbols.push(s);
      g.setAttribute('transform', 'translate(' + r1(s.x) + ',' + r1(s.y) + ') scale(' + (1 / cam.s).toFixed(5) + ')');
      return g;
    }
    function label(text, lon, lat, o) {
      o = o || {};
      var g = el('g', { class: 'wm-label r' + (o.rank || 1) + (o.cls ? ' ' + o.cls : '') });
      var t = el('text', { 'text-anchor': 'middle', dy: '0.35em' }, g);
      t.textContent = text;
      return symbol(g, lon, lat, { layer: o.layer || 'labels', rot: o.rot });
    }
    function line(lonlats, o) {
      o = o || {};
      return el('path', { d: pathOf(lonlats, false), class: o.cls || '' }, L[o.layer || 'lines']);
    }
    function removeSymbols(parent) {
      symbols = symbols.filter(function (s) { return !parent.contains(s.el); });
    }

    // 底图注记：海洋、山脉
    (G.seas || []).forEach(function (s) { label(s.n, s.at[0], s.at[1], { cls: 'wm-sea', rank: s.rank }); });
    (G.ranges || []).forEach(function (r) { label(r.n, r.at[0], r.at[1], { cls: 'wm-range', rank: r.rank, rot: r.rot }); });

    /* ---------- 政局 ---------- */
    var polFeatures = null, polLabels = null;
    function setPolities(fc, o) {
      o = o || {};
      L.polities.textContent = '';
      if (polLabels) { removeSymbols(polLabels); polLabels.remove(); }
      polLabels = el('g', { class: 'wm-pol-labels' }, L.labels);
      polFeatures = fc ? fc.features : null;
      if (fc) {
        fc.features.forEach(function (f, i) {
          var p = f.properties;
          var cls = 'wm-pol pc' + p.c + (p.tags && p.tags.rel ? ' rel-' + p.tags.rel : '');
          var d = multiPolygonPath(f.geometry.coordinates);
          el('path', { d: d, class: cls, 'data-pid': i }, L.polities);
          if (p.style === 'hatch' || p.style === 'dots') el('path', { d: d, class: 'wm-pol-tex', fill: 'url(#' + id + '-' + p.style + ')' }, L.polities);
          if (p.label && p.lp) {
            var g = el('g', { class: 'wm-label wm-pol-label r' + (p.rank || 2) });
            var t = el('text', { 'text-anchor': 'middle', dy: '0.35em' }, g);
            t.textContent = p.label;
            polLabels.appendChild(g);
            var pt = project(p.lp[0], p.lp[1]);
            symbols.push({ el: g, x: pt[0], y: pt[1], rot: 0 });
          }
        });
      }
      setMode(o.mode || 'states');
      render();
    }
    function setMode(m) {
      ['states', 'rel', 'off'].forEach(function (k) { container.classList.toggle('wm-pol-' + k, k === m); });
    }

    measure();
    if (opts.view) fit(opts.view, { animate: false, pad: 10 }); else { cam.s = fitS; render(); }

    return {
      svg: svg, project: project, unproject: unproject,
      layer: function (n) { return L[n]; },
      get zoom() { return cam.s / fitS; },
      fit: fit, symbol: symbol, label: label, line: line,
      setPolities: setPolities, setPolityMode: setMode,
      zoomBy: function (f) { zoomAt(W / 2, H / 2, f); },
      on: function (n, fn) { (listeners[n] = listeners[n] || []).push(fn); return this; },
      refresh: function () { measure(); render(); },
      destroy: function () { if (ro) ro.disconnect(); cancelAnimationFrame(anim); container.textContent = ''; container.classList.remove('wm'); }
    };
  }

  root.WorldMap = { mount: mount, project: project, unproject: unproject };
})(window);
