/*
 * 郑和七下西洋 · 交互逻辑
 * 依赖：Leaflet（L）、data/land.js（ZH_LAND）、js/data.js（ZH）、js/route.js（ZHRoute）
 */
(function () {
  'use strict';

  var D = window.ZH;
  var net = window.ZHRoute.build(D);
  var NUM = ['', '一', '二', '三', '四', '五', '六', '七'];
  var GIST = {
    1: '首航至古里，归途擒海盗陈祖义',
    2: '护送使臣，册封古里国王并立碑',
    3: '册封满剌加，锡兰山之战生擒其王',
    4: '首抵忽鲁谟斯，擒苏干剌，麒麟入贡',
    5: '分䑸首抵东非，珍禽异兽入京',
    6: '护送十六国使臣，多支䑸队分航',
    7: '最后一次远航，郑和卒于古里'
  };
  var TYPE_NAME = { '战': '用兵', '碑': '碑刻', '贡': '进贡', '使': '外交', '政': '朝政', '人': '生平', '卒': '去世' };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- 小工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem('zh:' + k);
      window.localStorage.setItem('zh:' + k, v);
    } catch (e) { return null; }
  }
  function vcolor(n) { return 'var(--v' + n + ')'; }
  function placeOf(id) { return D.ports[id] || D.places[id]; }
  function voyage(n) { return D.voyages[n - 1]; }
  function glyph(type, extra) { return '<i class="glyph g-' + type + (extra ? ' ' + extra : '') + '">' + type + '</i>'; }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 4200);
  }

  /* ---------- 地图 ---------- */
  var map = L.map('map', {
    zoomControl: false,
    minZoom: 2.5,
    maxZoom: 9,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    maxBounds: [[-35, 5], [58, 165]],
    maxBoundsViscosity: 0.7
  });
  map.setView([12, 88], 3); // 先给地图一个初始视图，之后添加的图层才能立即绘制
  L.control.zoom({ position: 'topleft', zoomInTitle: '放大', zoomOutTitle: '缩小' }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  var container = map.getContainer();

  [['basePane', 150], ['landPane', 200], ['polityPane', 202], ['coastPane', 203], ['gratPane', 205], ['polLabelPane', 226],
    ['seaPane', 230], ['routePane', 410], ['hitPane', 415], ['portPane', 430], ['shipPane', 640]].forEach(function (p) {
    map.createPane(p[0]).style.zIndex = p[1];
  });
  ['seaPane', 'coastPane', 'polLabelPane'].forEach(function (n) { map.getPane(n).style.pointerEvents = 'none'; });

  // 古卷底图：Natural Earth 海岸线，外加一圈浅色"水纹"
  var shoreLayer = L.geoJSON(window.ZH_LAND, { pane: 'landPane', interactive: false, style: { className: 'shore' } });
  var landLayer = L.geoJSON(window.ZH_LAND, { pane: 'landPane', interactive: false, style: { className: 'land' } });
  var grat = L.layerGroup();
  for (var la = -30; la <= 50; la += 10) grat.addLayer(L.polyline([[la, 10], [la, 160]], { pane: 'gratPane', className: 'grat', interactive: false }));
  for (var lo = 20; lo <= 150; lo += 10) grat.addLayer(L.polyline([[-35, lo], [58, lo]], { pane: 'gratPane', className: 'grat', interactive: false }));
  // 海岸线单独画在疆域色块之上，保证海岸始终是实线
  var coastLayer = L.geoJSON(window.ZH_LAND, { pane: 'coastPane', interactive: false, style: { className: 'coastline' } });
  var scrollBase = L.layerGroup([shoreLayer, landLayer, coastLayer, grat]).addTo(map);

  var esriAttr = '底图 &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';
  var tileBases = {
    ocean: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      pane: 'basePane', maxNativeZoom: 10, attribution: esriAttr + ', GEBCO, NOAA'
    }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      pane: 'basePane', maxNativeZoom: 12, attribution: esriAttr + ', Maxar, Earthstar Geographics'
    })
  };
  map.attributionControl.addAttribution('海岸线 <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>');

  var currentBase = 'scroll';
  function setBase(name) {
    if (name === currentBase) return;
    Object.keys(tileBases).forEach(function (k) { if (map.hasLayer(tileBases[k])) map.removeLayer(tileBases[k]); });
    if (name === 'scroll') {
      if (!map.hasLayer(scrollBase)) scrollBase.addTo(map);
      container.classList.remove('map-tiles');
    } else {
      var layer = tileBases[name];
      var loaded = false, errors = 0;
      layer.off('tileload tileerror');
      layer.on('tileload', function () { loaded = true; });
      layer.on('tileerror', function () {
        errors++;
        if (!loaded && errors >= 4 && currentBase === name) {
          setBase('scroll');
          toast('在线底图暂时无法加载，已切回古卷底图。');
        }
      });
      map.removeLayer(scrollBase);
      layer.addTo(map);
      container.classList.add('map-tiles');
    }
    currentBase = name;
    $$('.seg [data-base]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.base === name)); });
    store('base', name);
  }
  $$('.seg [data-base]').forEach(function (b) { b.addEventListener('click', function () { setBase(b.dataset.base); }); });

  // 海域注记
  D.seas.forEach(function (s) {
    L.marker(s.at, {
      pane: 'seaPane', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'sea-label' + (s.t.length <= 3 ? ' minor' : ''), html: '<span>' + esc(s.t) + '</span>', iconSize: [0, 0] })
    }).addTo(map);
  });

  /* ---------- 约 1415 年政治势力 ---------- */
  var REL = { ming: '明朝直辖', visit: '郑和船队到访', loose: '明朝羁縻（都司、卫所、宣慰司）', tribute: '遣使往来', other: '其他政权' };
  var REL_ORDER = ['ming', 'visit', 'loose', 'tribute', 'other'];
  var plain = function (t) { return String(t || '').replace(/\s+/g, ''); };
  function polityPopup(p) {
    var lab = plain(p.label);
    var ports = p.ports.map(function (id) { return D.ports[id].name; }).join('、');
    return '<div class="pop">' +
      '<div class="hd"><i class="pol-sw sw-pc' + p.c + '"></i><div><h4>' + esc(p.name) + (lab && lab !== p.name ? ' · ' + esc(lab) : '') + '</h4>' +
      '<div class="sub">' + esc(p.alt) + '</div></div></div>' +
      '<span class="rel-chip sw-' + p.rel + '">' + esc(REL[p.rel]) + '</span>' +
      '<p>' + esc(p.desc) + '</p>' +
      (ports ? '<div class="sub">境内港口：' + esc(ports) + '</div>' : '') +
      '<div class="sub">约 1415 年形势，疆界为示意。</div></div>';
  }
  var polLayer = L.geoJSON(window.ZH_POLITIES, {
    pane: 'polityPane',
    style: function (f) { return { className: 'polity pc' + f.properties.c + ' rel-' + f.properties.rel }; },
    onEachFeature: function (f, layer) {
      layer.bindPopup(function () { return polityPopup(f.properties); }, { className: 'zh-popup', maxWidth: 320, autoPanPadding: [40, 40] });
    }
  });
  var polLabels = L.layerGroup();
  window.ZH_POLITIES.features.forEach(function (f) {
    var p = f.properties;
    if (!p.label || !p.lp) return;
    polLabels.addLayer(L.marker(p.lp, {
      pane: 'polLabelPane', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'pol-label r' + p.rank, html: '<span>' + esc(p.label) + '</span>', iconSize: [0, 0] })
    }));
  });

  var polMode = null;
  function renderPolLegend() {
    var box = $('#pol-legend');
    if (polMode === 'states') {
      box.innerHTML = '<span class="ttl">疆域 · 约 1415 年</span>' +
        '<span class="strip">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (c) { return '<i class="sw-pc' + c + '"></i>'; }).join('') + '</span>' +
        '<span>一色一国，黄色为明朝；点击色块看简介</span>';
    } else if (polMode === 'rel') {
      box.innerHTML = '<span class="ttl">与明朝的关系 · 约 1415 年</span><span class="sws">' +
        REL_ORDER.map(function (r) { return '<span><i class="sw-' + r + '"></i>' + esc(REL[r].replace(/（.*）/, '')) + '</span>'; }).join('') + '</span>';
    } else {
      box.innerHTML = '';
    }
  }
  function setPolMode(m) {
    if (['off', 'states', 'rel'].indexOf(m) < 0) m = 'states';
    polMode = m;
    container.classList.toggle('pol-states', m === 'states');
    container.classList.toggle('pol-rel', m === 'rel');
    if (m === 'off') { map.removeLayer(polLayer); map.removeLayer(polLabels); }
    else { if (!map.hasLayer(polLayer)) polLayer.addTo(map); if (!map.hasLayer(polLabels)) polLabels.addTo(map); }
    $$('.seg [data-pol]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pol === m)); });
    renderPolLegend();
    store('pol', m);
  }
  $$('.seg [data-pol]').forEach(function (b) { b.addEventListener('click', function () { setPolMode(b.dataset.pol); }); });

  // 缩放级别 → 标签显示密度
  function zoomClass() {
    var z = map.getZoom();
    container.classList.toggle('z-xlo', z < 3.25);
    container.classList.toggle('z-lo', z < 4.25);
    container.classList.toggle('z-mid', z >= 4.25 && z < 5.5);
    container.classList.toggle('z-hi', z >= 5.5);
  }
  map.on('zoomend', zoomClass);

  /* ---------- 航线 ---------- */
  var V = {};   // n -> { legs, out, ret, branches, hit, bounds, outPts, retPts, brPts }
  function concat(parts) {
    var out = [];
    parts.forEach(function (p) {
      p.forEach(function (pt, i) {
        var last = out[out.length - 1];
        if (i === 0 && last && last[0] === pt[0] && last[1] === pt[1]) return;
        out.push(pt);
      });
    });
    return out;
  }
  // 按航次把相连的航段拼成若干条连续折线（中途若断开则另起一条）
  function chains(legs) {
    var res = [], cur = null, lastTo = null;
    legs.forEach(function (L1) {
      if (!cur || L1.from !== lastTo) { cur = []; res.push(cur); }
      cur.push(L1.latlngs);
      lastTo = L1.to;
    });
    return res.map(concat);
  }

  D.voyages.forEach(function (v) {
    var n = v.n, legs = [];
    for (var i = 1; i < v.stops.length; i++) {
      var r = net.leg(v.stops[i - 1].p, v.stops[i].p);
      legs.push({ from: i - 1, to: i, ret: !!v.stops[i].ret, latlngs: r.latlngs, km: r.km });
    }
    var outLegs = legs.filter(function (l) { return !l.ret; });
    var retLegs = legs.filter(function (l) { return l.ret; });
    var outPts = chains(outLegs), retPts = chains(retLegs);
    var brPts = v.branches.map(function (br) {
      var parts = [];
      for (var j = 1; j < br.stops.length; j++) parts.push(net.leg(br.stops[j - 1], br.stops[j]).latlngs);
      return concat(parts);
    });
    var mk = function (pts, cls) {
      return L.polyline(pts, { pane: 'routePane', className: 'route ' + cls + ' v' + n, interactive: false, smoothFactor: 0.6 });
    };
    var obj = {
      legs: legs, outPts: outPts, retPts: retPts, brPts: brPts,
      ret: mk(retPts, 'ret'),
      out: mk(outPts, 'out'),
      branches: brPts.map(function (p) { return mk(p, 'branch'); })
    };
    obj.hit = L.polyline(outPts.concat(retPts).concat(brPts), { pane: 'hitPane', className: 'route-hit hit-v' + n });
    obj.hit.bindTooltip(v.title + ' · ' + v.years, { sticky: true, className: 'port-label', direction: 'top', offset: [0, -8] });
    obj.hit.on('click', function () { selectVoyage(n, { fit: true }); });
    obj.group = L.layerGroup([obj.ret, obj.out].concat(obj.branches).concat([obj.hit])).addTo(map);
    var b = L.latLngBounds(outPts[0]);
    outPts.concat(retPts).concat(brPts).forEach(function (p) { p.forEach(function (pt) { b.extend(pt); }); });
    obj.bounds = b;
    V[n] = obj;
  });

  // 总览时把七条航线像地铁线路一样平行错开，避免互相遮盖
  function offsetPts(pts, px) {
    if (!px) return pts;
    var z = map.getZoom();
    var P = pts.map(function (p) { return map.project(p, z); });
    var out = [];
    for (var i = 0; i < P.length; i++) {
      var a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)];
      var dx = c.x - a.x, dy = c.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      out.push(map.unproject(L.point(P[i].x - dy / len * px, P[i].y + dx / len * px), z));
    }
    return out;
  }
  function applyOffsets() {
    D.voyages.forEach(function (v) {
      var o = V[v.n], px = state.voyage === 0 ? (v.n - 4) * 2.6 : 0;
      o.out.setLatLngs(o.outPts.map(function (p) { return offsetPts(p, px); }));
      o.ret.setLatLngs(o.retPts.map(function (p) { return offsetPts(p, px); }));
      o.branches.forEach(function (bl, i) { bl.setLatLngs(offsetPts(o.brPts[i], px)); });
    });
  }
  map.on('zoomend', function () { if (state.voyage === 0) applyOffsets(); });

  /* ---------- 港口 ---------- */
  var portMarkers = {};
  // 港口挤在一起时，缩得很小时先隐藏这些标签（2：最小缩放隐藏；3：小缩放即隐藏）
  var LABEL_PRIORITY = { liujiagang: 3, jiugang: 2, sumendala: 2, kunlun: 3 };
  var LABEL_LEFT = { nanwuli: true, xiaogelan: true, bulawa: true };
  var visitsByPort = {};
  D.voyages.forEach(function (v) {
    var seen = {};
    v.stops.forEach(function (s) {
      (visitsByPort[s.p] = visitsByPort[s.p] || []);
      visitsByPort[s.p].push({ n: v.n, d: s.d, cd: s.cd, ret: !!s.ret });
      seen[s.p] = true;
    });
    v.branches.forEach(function (br) {
      br.stops.forEach(function (p, i) {
        if (i === 0 || seen[p]) return;
        seen[p] = true;
        (visitsByPort[p] = visitsByPort[p] || []).push({ n: v.n, d: '分䑸', cd: br.name, branch: true });
      });
    });
  });
  function voyagesAt(id) {
    var s = {};
    (visitsByPort[id] || []).forEach(function (x) { s[x.n] = true; });
    return Object.keys(s).map(Number).sort();
  }

  function portPopup(id) {
    var p = D.ports[id], ns = voyagesAt(id);
    var visits = ns.map(function (n) {
      return '<button type="button" style="--vc:' + vcolor(n) + '" data-go-voyage="' + n + '">第' + NUM[n] + '次</button>';
    }).join('');
    var log = (visitsByPort[id] || []).map(function (x) {
      return '<li style="--vc:' + vcolor(x.n) + '"><b>第' + NUM[x.n] + '次</b> ' + esc(x.branch ? x.cd : (x.d + (x.ret ? '（归程）' : ''))) + '</li>';
    }).join('');
    return '<div class="pop">' +
      '<div class="hd"><div><h4>' + esc(p.name) + '</h4><div class="sub">' + esc(p.alt || '') + (p.alt ? ' · ' : '') + '今' + esc(p.modern) + '</div></div></div>' +
      '<p>' + esc(p.desc) + '</p>' +
      (ns.length ? '<div class="visits">' + visits + '</div>' : '') +
      (log ? '<ul class="log">' + log + '</ul>' : '') +
      '</div>';
  }

  Object.keys(D.ports).forEach(function (id) {
    var p = D.ports[id];
    var r = p.tier === 1 ? 5.5 : p.tier === 2 ? 4.2 : 3.4;
    var m = L.circleMarker(p.at, { pane: 'portPane', radius: r, className: 'port t' + p.tier });
    var lp = LABEL_PRIORITY[id] ? ' lp' + LABEL_PRIORITY[id] : '';
    var left = LABEL_LEFT[id];
    m.bindTooltip(p.name, { permanent: true, direction: left ? 'left' : 'right', offset: [left ? -(r + 2) : r + 2, 0], className: 'port-label t' + p.tier + lp, interactive: false });
    m.bindPopup(function () { return portPopup(id); }, { className: 'zh-popup', maxWidth: 320, autoPanPadding: [40, 40] });
    m.addTo(map);
    portMarkers[id] = m;
  });

  /* ---------- 大事 ---------- */
  var evtMarkers = {};
  var evtById = {};
  D.events.forEach(function (e) { evtById[e.id] = e; });

  function eventPopup(e) {
    var pl = placeOf(e.place);
    var vline = e.v ? '<button type="button" class="link" data-go-voyage="' + e.v + '">查看第' + NUM[e.v] + '次下西洋 →</button>' : '';
    return '<div class="pop">' +
      '<div class="hd">' + glyph(e.type) + '<div><h4>' + esc(e.title) + '</h4>' +
      '<div class="sub">' + esc(e.date) + ' · ' + esc(e.cd) + '<br>' + esc(pl.name) + (pl.modern && pl.modern !== pl.name ? '（今' + esc(pl.modern) + '）' : '') + '</div></div></div>' +
      '<p>' + esc(e.text) + '</p>' +
      (e.quote ? '<blockquote class="source">' + esc(e.quote.t) + '<cite>' + esc(e.quote.s) + '</cite></blockquote>' : '') +
      vline + '</div>';
  }

  function buildEventMarkers(list) {
    Object.keys(evtMarkers).forEach(function (id) { map.removeLayer(evtMarkers[id]); });
    evtMarkers = {};
    var slots = {};
    list.forEach(function (e) {
      var at = placeOf(e.place).at;
      var key = at.join(',');
      var k = slots[key] = (slots[key] || 0) + 1;
      var dx = 8 + (k - 1) * 25;
      var m = L.marker(at, {
        icon: L.divIcon({ className: 'evt-icon', html: glyph(e.type), iconSize: [22, 22], iconAnchor: [11 - dx, 31], popupAnchor: [dx, -34] }),
        title: e.title, alt: e.title, riseOnHover: true, keyboard: true
      });
      m.bindPopup(function () { return eventPopup(e); }, { className: 'zh-popup', maxWidth: 340, autoPanPadding: [40, 40] });
      m.addTo(map);
      evtMarkers[e.id] = m;
    });
  }

  // 弹窗中的"第 N 次"按钮
  container.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-go-voyage]');
    if (!b) return;
    map.closePopup();
    selectVoyage(Number(b.dataset.goVoyage), { fit: true });
    showTab('voyages');
  });

  /* ---------- 状态 ---------- */
  var state = { voyage: 0, tab: 'voyages' };

  function selectVoyage(n, opts) {
    opts = opts || {};
    if (player.active && player.n !== n) stopPlayer();
    state.voyage = n;
    container.classList.toggle('mode-all', n === 0);
    container.classList.toggle('mode-one', n !== 0);
    D.voyages.forEach(function (v) {
      var o = V[v.n], focus = n === v.n, ghost = n !== 0 && !focus;
      [o.out, o.ret, o.hit].concat(o.branches).forEach(function (l) {
        var el = l.getElement && l.getElement();
        if (!el) return;
        el.classList.toggle('focus', focus);
        el.classList.toggle('ghost', ghost);
      });
      if (focus) { o.ret.bringToFront(); o.out.bringToFront(); o.branches.forEach(function (b) { b.bringToFront(); }); }
    });
    applyOffsets();

    // 港口：不在本次航程的变淡
    var inV = {};
    if (n) Object.keys(D.ports).forEach(function (id) { if (voyagesAt(id).indexOf(n) >= 0) inV[id] = true; });
    Object.keys(portMarkers).forEach(function (id) {
      var m = portMarkers[id], dim = n !== 0 && !inV[id];
      var el = m.getElement(); if (el) el.classList.toggle('dim', dim);
      var tt = m.getTooltip() && m.getTooltip().getElement(); if (tt) tt.classList.toggle('dim', dim);
    });

    // 大事
    buildEventMarkers(D.events.filter(function (e) { return n === 0 ? e.key : e.v === n; }));

    // 面板、时间轴、图例
    $$('.vchip').forEach(function (c) { c.setAttribute('aria-pressed', String(Number(c.dataset.v) === n)); });
    renderVoyageBody(n);
    renderTimeline();
    if (opts.fit !== false) fitVoyage(n);
    if (!opts.noHash) setHash(n === 0 ? 'overview' : 'v' + n);
  }

  function fitVoyage(n) {
    var b = n === 0 ? allBounds() : V[n].bounds;
    var pad = container.clientWidth < 600 ? [24, 24] : [50, 60];
    map.flyToBounds(b, { paddingTopLeft: [pad[0], pad[1]], paddingBottomRight: [pad[0], 110], duration: reduceMotion ? 0 : 0.9, animate: !reduceMotion, maxZoom: 5.5 });
  }
  function allBounds() {
    var b = V[1].bounds;
    var out = L.latLngBounds(b.getSouthWest(), b.getNorthEast());
    D.voyages.forEach(function (v) { out.extend(V[v.n].bounds); });
    return out;
  }

  /* ---------- 面板：航次 ---------- */
  function renderChips() {
    var html = '<button type="button" class="vchip all" data-v="0" aria-pressed="true"><i class="dot"></i>总览</button>';
    D.voyages.forEach(function (v) {
      html += '<button type="button" class="vchip" data-v="' + v.n + '" style="--vc:' + vcolor(v.n) + '" aria-pressed="false" title="' + esc(v.title + ' ' + v.years) + '"><i class="dot"></i>第' + NUM[v.n] + '次</button>';
    });
    $('#vchips').innerHTML = html;
    $$('.vchip').forEach(function (c) {
      c.addEventListener('click', function () { selectVoyage(Number(c.dataset.v), { fit: true }); });
    });
    // 图例中的航次色
    $('#legend-voyages').innerHTML = D.voyages.map(function (v) {
      return '<button type="button" data-v="' + v.n + '" title="' + esc(v.title) + '"><i style="background:' + vcolor(v.n) + '"></i>' + NUM[v.n] + '</button>';
    }).join('');
    $$('#legend-voyages button').forEach(function (b) {
      b.addEventListener('click', function () { selectVoyage(Number(b.dataset.v), { fit: true }); showTab('voyages'); });
    });
  }

  function renderOverview() {
    var list = D.voyages.map(function (v) {
      return '<li><button type="button" data-v="' + v.n + '" style="--vc:' + vcolor(v.n) + '">' +
        '<span class="num">' + NUM[v.n] + '</span>' +
        '<span class="row1"><strong>' + esc(v.title) + '</strong><span>' + esc(v.years) + ' · ' + esc(v.reign) + '</span></span>' +
        '<span class="gist">' + esc(GIST[v.n]) + '；最远至' + esc(v.farthest.split('；')[0]) + '</span>' +
        '</button></li>';
    }).join('');
    return '' +
      '<p class="lede">明永乐三年（1405）至宣德八年（1433），郑和七次率领两万余人的船队远航"西洋"，经南海、马六甲海峡横渡印度洋，最远抵达波斯湾、红海口和东非沿岸，比欧洲人的大航海早了近一个世纪。</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>七次</b><span>远航</span></div>' +
      '<div class="stat"><b>廿八年</b><span>1405—1433</span></div>' +
      '<div class="stat"><b>三十余</b><span>所历国家与地区</span></div>' +
      '<div class="stat"><b>十万余里</b><span>碑记航程</span></div>' +
      '<div class="stat"><b>二万七千</b><span>每次随行约数</span></div>' +
      '<div class="stat"><b>六十二</b><span>首航大型宝船</span></div>' +
      '</div>' +
      '<p>明人所说的"西洋"，大致指南海西部以西直到印度洋沿岸的广大海域。明末张燮《东西洋考》以文莱为东、西洋的分界。</p>' +
      '<p>地图底色是约 1415 年（第四、五次下西洋之间）各政权的大致疆域。右上角可在"诸国"和"与明关系"两种着色之间切换，后者区分明朝直辖、船队到访、明朝羁縻和遣使往来的地区。点击色块可查看各国简介。</p>' +
      '<h3>七次航程</h3>' +
      '<ol class="vlist">' + list + '</ol>' +
      '<blockquote class="source">' + esc(voyage(7).quote.t) + '<cite>' + esc(voyage(7).quote.s) + '</cite></blockquote>' +
      '<p class="note">点击航线、港口或印章形的大事标记查看详情；选择某一次航程后，可以逐站回放船队的航行。</p>';
  }

  function renderVoyage(v) {
    var n = v.n;
    var stops = v.stops.map(function (s, i) {
      var p = D.ports[s.p];
      return '<li class="stop' + (s.ret ? ' ret' : '') + '" data-i="' + i + '" style="--vc:' + vcolor(n) + '">' +
        '<i class="node"></i><button type="button" data-stop="' + i + '">' +
        '<span class="top"><span class="port">' + esc(p.name) + '</span><span class="date">' + esc(s.d) + ' · ' + esc(s.cd) + '</span>' +
        (s.ret && !(v.stops[i - 1] || {}).ret ? '<span class="tag">归程</span>' : '') + '</span>' +
        '<span class="txt">' + esc(s.t) + '</span></button></li>';
    }).join('');
    var branches = v.branches.length ? '<h3>分䑸</h3><ul class="branches">' + v.branches.map(function (br) {
      return '<li style="--vc:' + vcolor(n) + '"><i class="swatch"></i><span><b>' + esc(br.name) + '</b>：' +
        br.stops.map(function (id) { return esc(D.ports[id].name); }).join(' → ') + '</span></li>';
    }).join('') + '</ul>' : '';
    var evs = D.events.filter(function (e) { return e.v === n; });
    var evHtml = evs.length ? '<h3>本次大事</h3><div class="evlist">' + evs.map(function (e) {
      return '<button type="button" class="evcard" data-ev="' + e.id + '">' + glyph(e.type) +
        '<strong>' + esc(e.title) + '</strong><span class="meta">' + esc(e.date) + ' · ' + esc(placeOf(e.place).name) + ' · ' + TYPE_NAME[e.type] + '</span></button>';
    }).join('') + '</div>' : '';
    return '' +
      '<div class="vhead" style="--vc:' + vcolor(n) + '"><span class="big">第' + NUM[n] + '次</span>' +
      '<span class="when"><b>' + esc(v.years) + '</b>' + esc(v.reign) + '</span></div>' +
      '<dl class="facts"><dt>规模</dt><dd>' + esc(v.fleet) + '</dd><dt>人物</dt><dd>' + esc(v.people) + '</dd><dt>最远</dt><dd>' + esc(v.farthest) + '</dd></dl>' +
      '<div class="actions"><button type="button" class="btn-play" id="btn-play" style="--vc:' + vcolor(n) + '"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>回放航程</button>' +
      '<button type="button" class="btn-line" id="btn-fit">查看全程</button></div>' +
      '<div class="summary">' + v.summary.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<blockquote class="source">' + esc(v.quote.t) + '<cite>' + esc(v.quote.s) + '</cite></blockquote>' +
      '<h3>航程 · ' + v.stops.length + ' 站</h3><ol class="stops" id="stops">' + stops + '</ol>' +
      branches + evHtml +
      '<div class="actions">' +
      (n > 1 ? '<button type="button" class="btn-line" data-nav="' + (n - 1) + '">← 第' + NUM[n - 1] + '次</button>' : '') +
      (n < 7 ? '<button type="button" class="btn-line" data-nav="' + (n + 1) + '">第' + NUM[n + 1] + '次 →</button>' : '') +
      '</div>';
  }

  function renderVoyageBody(n) {
    var body = $('#voyage-body');
    body.innerHTML = n === 0 ? renderOverview() : renderVoyage(voyage(n));
    $$('.vlist button', body).forEach(function (b) { b.addEventListener('click', function () { selectVoyage(Number(b.dataset.v), { fit: true }); scrollPanelTop(); }); });
    $$('[data-nav]', body).forEach(function (b) { b.addEventListener('click', function () { selectVoyage(Number(b.dataset.nav), { fit: true }); scrollPanelTop(); }); });
    $$('[data-ev]', body).forEach(function (b) { b.addEventListener('click', function () { focusEvent(b.dataset.ev); }); });
    $$('[data-stop]', body).forEach(function (b) {
      b.addEventListener('click', function () { startPlayer(n, Number(b.dataset.stop), false); });
    });
    var bp = $('#btn-play', body);
    if (bp) bp.addEventListener('click', function () { startPlayer(n, 0, true); });
    var bf = $('#btn-fit', body);
    if (bf) bf.addEventListener('click', function () { stopPlayer(); fitVoyage(n); });
    if (player.active && player.n === n) highlightStop(player.i);
  }
  function scrollPanelTop() {
    var panel = $('#panel');
    if (panel.scrollHeight > panel.clientHeight) panel.scrollTop = 0;
  }

  function focusEvent(id) {
    var e = evtById[id];
    if (!e) return;
    if (e.v && state.voyage !== e.v && state.voyage !== 0) selectVoyage(e.v, { fit: false });
    if (!evtMarkers[id]) buildEventMarkers(D.events.filter(function (x) { return state.voyage === 0 ? (x.key || x.id === id) : (x.v === state.voyage || x.id === id); }));
    var m = evtMarkers[id];
    var at = placeOf(e.place).at;
    var z = Math.max(map.getZoom(), 5);
    var go = function () { m.openPopup(); };
    if (reduceMotion) { map.setView(at, z); go(); }
    else { map.once('moveend', go); map.flyTo(at, z, { duration: 0.8 }); }
    if (window.matchMedia('(max-width: 760px)').matches) $('.stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- 航程回放 ---------- */
  var player = { active: false, n: 0, i: 0, playing: false, raf: 0, timer: 0, speed: 1, ship: null, trail: null, trailPts: [] };

  function shipIcon(n) {
    return L.divIcon({
      className: 'ship-icon',
      iconSize: [40, 32], iconAnchor: [20, 26],
      html: '<svg viewBox="0 0 40 32" style="--sv:' + vcolor(n) + '" aria-hidden="true">' +
        '<path class="mast" d="M12 22V5M21 22V2M30 22V8"/>' +
        '<path class="sail" d="M8.5 6.5h7l-1 15h-6z"/><path class="sail" d="M17 3.5h8l-1 18h-7z"/><path class="sail" d="M27 9.5h6l-0.8 12h-5.2z"/>' +
        '<path class="batten" d="M8.6 10h6.7M8.6 13.5h6.5M8.6 17h6.3M17 7.5h7.7M17 11.5h7.5M17 15.5h7.3M27 13h5.8M27 16.5h5.6"/>' +
        '<path class="flag" d="M21 2l5 1.5-5 1.5z"/>' +
        '<path class="hull" d="M2 21.5h36l-3.5 6.5H8z"/></svg>'
    });
  }

  function startPlayer(n, i, autoplay) {
    if (state.voyage !== n) selectVoyage(n, { fit: false });
    if (window.matchMedia('(max-width: 760px)').matches) $('.stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    stopAnim();
    player.active = true; player.n = n;
    container.classList.add('playing');
    $('.stage').classList.add('is-playing');
    var pl = $('#player');
    pl.hidden = false;
    pl.style.setProperty('--vc', vcolor(n));
    $('#p-v').textContent = '第' + NUM[n] + '次';
    if (!player.ship) {
      player.ship = L.marker(D.ports[voyage(n).stops[i].p].at, { pane: 'shipPane', icon: shipIcon(n), interactive: false, keyboard: false }).addTo(map);
    } else {
      player.ship.setIcon(shipIcon(n));
      player.ship.setLatLng(D.ports[voyage(n).stops[i].p].at);
      if (!map.hasLayer(player.ship)) player.ship.addTo(map);
    }
    if (player.trail) map.removeLayer(player.trail);
    player.trail = L.polyline([], { pane: 'routePane', className: 'trail', interactive: false, color: getComputedStyle(document.documentElement).getPropertyValue('--v' + n).trim() || '#245' }).addTo(map);
    rebuildTrail(n, i);
    player.i = i;
    arrive(i, true);
    setPlaying(!!autoplay);
  }

  function rebuildTrail(n, i) {
    var pts = [];
    V[n].legs.slice(0, i).forEach(function (l) { pts = pts.concat(l.latlngs); });
    player.trailPts = pts;
    player.trail.setLatLngs(pts);
  }

  function stopAnim() {
    cancelAnimationFrame(player.raf); player.raf = 0;
    clearTimeout(player.timer); player.timer = 0;
    if (player.onMoveEnd) map.off('moveend', player.onMoveEnd);
  }

  function stopPlayer() {
    if (!player.active) return;
    stopAnim();
    player.active = false; player.playing = false;
    container.classList.remove('playing');
    $('.stage').classList.remove('is-playing');
    $('#player').hidden = true;
    if (player.ship) map.removeLayer(player.ship);
    if (player.trail) { map.removeLayer(player.trail); player.trail = null; }
    $$('.stop.is-current').forEach(function (s) { s.classList.remove('is-current'); });
  }

  function setPlaying(on) {
    player.playing = on;
    var b = $('#p-play');
    b.setAttribute('aria-label', on ? '暂停' : '播放');
    b.innerHTML = on ? '<svg viewBox="0 0 16 16"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>' : '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>';
    if (on && !player.raf && !player.timer) scheduleNext(600);
    if (!on) { clearTimeout(player.timer); player.timer = 0; }
  }

  function scheduleNext(ms) {
    clearTimeout(player.timer);
    player.timer = setTimeout(function () { player.timer = 0; if (player.playing) goTo(player.i + 1, true); }, ms / player.speed);
  }

  function highlightStop(i) {
    $$('.stop').forEach(function (s) { s.classList.toggle('is-current', Number(s.dataset.i) === i); });
    var cur = $('.stop.is-current');
    var panel = $('#panel');
    if (cur && panel.scrollHeight > panel.clientHeight + 4) {
      var top = cur.offsetTop - panel.clientHeight / 3;
      panel.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  function arrive(i, jump) {
    var v = voyage(player.n), s = v.stops[i], p = D.ports[s.p];
    player.i = i;
    player.ship.setLatLng(p.at);
    $('#p-count').textContent = '第 ' + (i + 1) + ' 站 / 共 ' + v.stops.length + ' 站' + (s.ret ? ' · 归程' : '');
    $('#p-port').textContent = p.name;
    $('#p-date').textContent = s.d + ' · ' + s.cd;
    $('#p-txt').textContent = s.t;
    $('#p-bar').style.width = (100 * i / (v.stops.length - 1)) + '%';
    highlightStop(i);
    Object.keys(portMarkers).forEach(function (id) {
      var el = portMarkers[id].getElement(); if (el) el.classList.toggle('on', id === s.p);
    });
    if (jump) {
      var z = Math.max(4.5, Math.min(map.getZoom(), 6));
      if (reduceMotion) map.setView(p.at, z); else map.flyTo(p.at, z, { duration: 0.7 });
    }
    if (player.playing) {
      if (i >= v.stops.length - 1) { setPlaying(false); return; }
      scheduleNext(Math.min(7000, 2000 + s.t.length * 45));
    }
  }

  function goTo(i, animate) {
    var v = voyage(player.n);
    if (i < 0 || i >= v.stops.length) { setPlaying(false); return; }
    stopAnim();
    if (!animate || i !== player.i + 1 || reduceMotion) {
      rebuildTrail(player.n, i);
      arrive(i, true);
      return;
    }
    var leg = V[player.n].legs[i - 1];
    var pts = leg.latlngs;
    var bounds = L.latLngBounds(pts);
    var started = false;
    var startAnim = function () {
      if (started) return;
      started = true;
      map.off('moveend', player.onMoveEnd);
      clearTimeout(player.timer); player.timer = 0;
      animateLeg(pts, leg.km, function () {
        player.trailPts = player.trailPts.concat(pts);
        player.trail.setLatLngs(player.trailPts);
        arrive(i, false);
      });
    };
    player.onMoveEnd = startAnim;
    map.once('moveend', player.onMoveEnd);
    player.timer = setTimeout(startAnim, 1600); // 万一地图未触发 moveend
    var pad = container.clientWidth < 600 ? 40 : 90;
    map.flyToBounds(bounds, { padding: [pad, pad], maxZoom: 6, duration: 0.8 });
  }

  function animateLeg(pts, km, done) {
    var cum = [0];
    for (var k = 1; k < pts.length; k++) cum.push(cum[k - 1] + window.ZHRoute.km(pts[k - 1], pts[k]));
    var total = cum[cum.length - 1] || 1;
    var dur = Math.max(900, Math.min(4600, 700 + km * 0.75)) / player.speed;
    var t0 = performance.now();
    var shipEl = player.ship.getElement();
    var base = player.trailPts.slice();
    function frame(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var d = e * total, j = 1;
      while (j < cum.length - 1 && cum[j] < d) j++;
      var a = pts[j - 1], b = pts[j], f = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
      var pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      player.ship.setLatLng(pos);
      if (shipEl) shipEl.classList.toggle('west', b[1] < a[1]);
      player.trail.setLatLngs(base.concat(pts.slice(0, j)).concat([pos]));
      if (t < 1) player.raf = requestAnimationFrame(frame);
      else { player.raf = 0; done(); }
    }
    player.raf = requestAnimationFrame(frame);
  }

  $('#p-play').addEventListener('click', function () {
    var v = voyage(player.n);
    if (!player.playing && player.i >= v.stops.length - 1) { rebuildTrail(player.n, 0); arrive(0, true); }
    setPlaying(!player.playing);
  });
  $('#p-next').addEventListener('click', function () { goTo(player.i + 1, true); });
  $('#p-prev').addEventListener('click', function () { setPlaying(false); goTo(player.i - 1, false); });
  $('#p-close').addEventListener('click', function () { stopPlayer(); fitVoyage(state.voyage); });
  $('#p-speed').addEventListener('click', function () {
    player.speed = player.speed === 1 ? 2 : player.speed === 2 ? 0.5 : 1;
    this.textContent = (player.speed === 0.5 ? '½' : player.speed) + '×';
  });
  document.addEventListener('keydown', function (e) {
    if (!player.active || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { stopPlayer(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(player.i + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); goTo(player.i - 1, false); }
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('#p-play').click(); }
  });

  /* ---------- 时间轴 ---------- */
  var TL = { y0: 1398, y1: 1436 };
  function renderTimeline() {
    var box = $('#timeline');
    var W = Math.max(640, box.clientWidth - 16), H = 78;
    var padL = 46, padR = 12;
    var x = function (y) { return padL + (y - TL.y0) / (TL.y1 - TL.y0) * (W - padL - padR); };
    var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="1398—1436 年时间轴">';
    s += '<text class="tl-title" x="0" y="35">航程</text><text class="tl-title" x="0" y="15">大事</text>';
    s += '<line class="axis" x1="' + padL + '" y1="50" x2="' + (W - padR) + '" y2="50"/>';
    for (var y = 1400; y <= 1435; y += 5) {
      s += '<line class="tk" x1="' + x(y) + '" y1="47" x2="' + x(y) + '" y2="53"/><text x="' + x(y) + '" y="63" text-anchor="middle">' + y + '</text>';
    }
    [['建文', 1399, 1402.5], ['永乐', 1403, 1424.9], ['洪熙', 1425, 1425.9], ['宣德', 1426, 1435.9]].forEach(function (r) {
      var a = x(r[1]), b = x(r[2]);
      s += '<line class="reign-line" x1="' + (a + 1) + '" y1="70" x2="' + (b - 1) + '" y2="70"/>';
      if (b - a > 24) s += '<text class="reign" x="' + (a + b) / 2 + '" y="77" text-anchor="middle">' + r[0] + '</text>';
    });
    D.voyages.forEach(function (v) {
      var a = x(v.t0), b = x(v.t1), on = state.voyage === v.n;
      s += '<g class="bar' + (on ? ' on' : '') + '" data-v="' + v.n + '" tabindex="0" role="button" aria-label="' + esc(v.title + ' ' + v.years) + '">' +
        '<title>' + esc(v.title + ' · ' + v.years + ' · ' + v.reign) + '</title>' +
        '<rect x="' + a + '" y="27" width="' + Math.max(6, b - a) + '" height="14" fill="' + vcolor(v.n) + '" style="fill:' + vcolor(v.n) + '"/>' +
        (b - a > 14 ? '<text x="' + (a + b) / 2 + '" y="38" text-anchor="middle">' + NUM[v.n] + '</text>' : '') + '</g>';
    });
    D.events.filter(function (e) { return e.y >= TL.y0 && e.y <= TL.y1; }).forEach(function (e) {
      var cx = x(e.y), dim = state.voyage !== 0 && e.v !== state.voyage;
      s += '<g class="ev t-' + e.type + (dim ? ' dim' : '') + '" data-ev="' + e.id + '" tabindex="0" role="button" aria-label="' + esc(e.date + ' ' + e.title) + '">' +
        '<title>' + esc(e.date + ' ' + e.title) + '</title>' +
        '<rect x="' + (cx - 4) + '" y="7" width="8" height="8" transform="rotate(45 ' + cx + ' 11)"/></g>';
    });
    s += '</svg>';
    box.innerHTML = s;
    box.classList.toggle('has-focus', state.voyage !== 0);
    $$('.bar', box).forEach(function (g) {
      var go = function () { selectVoyage(Number(g.dataset.v), { fit: true }); showTab('voyages'); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    $$('.ev', box).forEach(function (g) {
      var go = function () { focusEvent(g.dataset.ev); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(renderTimeline, 150); });

  /* ---------- 罗盘 ---------- */
  var DIRS = '子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬'.split('');
  function compassSVG(size, full) {
    var c = size / 2, R = c - 2;
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="二十四向罗盘">';
    s += '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" style="fill:var(--paper);stroke:var(--ink-2)" stroke-width="1.2"/>';
    s += '<circle cx="' + c + '" cy="' + c + '" r="' + (R * 0.62) + '" style="fill:none;stroke:var(--rule)"/>';
    for (var i = 0; i < 24; i++) {
      var ang = (i * 15 - 90) * Math.PI / 180;
      var major = i % 6 === 0, mid = i % 3 === 0;
      var r1 = R * (full ? 0.64 : 0.66), r2 = R * (major ? 0.98 : 0.86);
      s += '<line x1="' + (c + Math.cos(ang) * r1) + '" y1="' + (c + Math.sin(ang) * r1) + '" x2="' + (c + Math.cos(ang) * r2) + '" y2="' + (c + Math.sin(ang) * r2) + '" style="stroke:var(--' + (major ? 'ink-2' : 'rule') + ')" stroke-width="' + (major ? 1.4 : 1) + '"/>';
      if (full || mid) {
        var rt2 = full ? R * 0.8 : R * 0.5;
        var fs = full ? (major ? 17 : 14) : (major ? 12 : 10);
        var col = DIRS[i] === '午' || DIRS[i] === '子' ? 'var(--seal)' : 'var(--ink)';
        s += '<text x="' + (c + Math.cos(ang) * rt2) + '" y="' + (c + Math.sin(ang) * rt2) + '" text-anchor="middle" dominant-baseline="central" style="fill:' + col + ';font-family:var(--f-body);font-weight:700" font-size="' + fs + '">' + DIRS[i] + '</text>';
      }
      if (full && major) {
        var rd = R * 0.5;
        s += '<text x="' + (c + Math.cos(ang) * rd) + '" y="' + (c + Math.sin(ang) * rd) + '" text-anchor="middle" dominant-baseline="central" style="fill:var(--muted);font-family:var(--f-ui)" font-size="10">' + (i * 15) + '°</text>';
      }
    }
    // 磁针
    var nl = R * (full ? 0.36 : 0.3);
    s += '<path d="M' + c + ' ' + (c - nl) + 'L' + (c + 4) + ' ' + c + 'L' + c + ' ' + (c + nl) + 'L' + (c - 4) + ' ' + c + 'Z" style="fill:var(--ink-2)"/>';
    s += '<path d="M' + c + ' ' + (c - nl) + 'L' + (c + 4) + ' ' + c + 'L' + (c - 4) + ' ' + c + 'Z" style="fill:var(--seal)"/>';
    s += '<circle cx="' + c + '" cy="' + c + '" r="2.5" style="fill:var(--paper);stroke:var(--ink-2)"/>';
    return s + '</svg>';
  }
  $('#compass-float').innerHTML = compassSVG(92, false);
  $('#compass-big').innerHTML = compassSVG(280, true);
  $('#compass-float').addEventListener('click', function () { showTab('nav'); });

  /* ---------- 年表 ---------- */
  function renderChron() {
    var items = [];
    D.events.forEach(function (e) { items.push({ y: e.y, date: e.date, cd: e.cd, title: e.title, text: e.text, ev: e.id, v: e.v }); });
    D.voyages.forEach(function (v) {
      var last = v.stops[v.stops.length - 1];
      items.push({ y: v.t1 - 0.001, date: last.d, cd: last.cd, title: v.title + '船队回国', text: GIST[v.n] + '。', voy: v.n, v: v.n });
    });
    D.later.forEach(function (l) { items.push({ y: l.y, date: l.date, title: l.title, text: l.text }); });
    items.sort(function (a, b) { return a.y - b.y; });
    var html = '', section = '';
    items.forEach(function (it) {
      var sec = it.y < 1405 ? '早年' : it.y < 1434 ? '下西洋' : '身后';
      if (sec !== section) { section = sec; html += '<li class="chron-h">' + sec + '</li>'; }
      var go = it.ev ? '<button type="button" class="go" data-ev="' + it.ev + '">在图上查看</button>' :
        it.voy ? '<button type="button" class="go" data-voy="' + it.voy + '">查看航线</button>' : '';
      html += '<li><span class="y"><b>' + Math.floor(it.y) + '</b>' + (it.cd ? esc(it.cd) : '') + '</span>' +
        '<span class="t">' + (it.v ? '<span class="vtag" style="--vc:' + vcolor(it.v) + '">第' + NUM[it.v] + '次下西洋</span>' : '') +
        '<strong>' + esc(it.title) + '</strong><p>' + esc(it.text) + '</p>' + go + '</span></li>';
    });
    var list = $('#chron-list');
    list.innerHTML = html;
    $$('[data-ev]', list).forEach(function (b) { b.addEventListener('click', function () { focusEvent(b.dataset.ev); }); });
    $$('[data-voy]', list).forEach(function (b) { b.addEventListener('click', function () { selectVoyage(Number(b.dataset.voy), { fit: true }); showTab('voyages'); }); });
  }

  /* ---------- 标签页与地址 ---------- */
  var TABS = ['voyages', 'people', 'ships', 'nav', 'chron', 'review', 'sources'];
  function showTab(name, noHash) {
    if (TABS.indexOf(name) < 0) name = 'voyages';
    state.tab = name;
    $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === name)); });
    TABS.forEach(function (t) { $('#pane-' + t).hidden = t !== name; });
    scrollPanelTop();
    if (!noHash) setHash(name === 'voyages' ? (state.voyage ? 'v' + state.voyage : 'overview') : name);
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { showTab(t.dataset.tab); }); });
  $('.tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = TABS.indexOf(state.tab) + (e.key === 'ArrowRight' ? 1 : -1);
    i = (i + TABS.length) % TABS.length;
    showTab(TABS[i]);
    $('#tab-' + TABS[i]).focus();
  });

  var hashLock = false;
  function setHash(h) {
    if (location.hash.slice(1) === h) return;
    hashLock = true;
    try { history.replaceState(null, '', '#' + h); } catch (e) { location.hash = h; }
    setTimeout(function () { hashLock = false; }, 0);
  }
  function readHash() {
    var h = location.hash.replace('#', '');
    var m = /^v([1-7])$/.exec(h);
    if (m) { showTab('voyages', true); selectVoyage(Number(m[1]), { fit: true, noHash: true }); return true; }
    if (h === 'overview') { showTab('voyages', true); selectVoyage(0, { fit: true, noHash: true }); return true; }
    if (TABS.indexOf(h) >= 0) { showTab(h, true); return false; }
    return false;
  }
  window.addEventListener('hashchange', function () { if (!hashLock) readHash(); });

  /* ---------- 选项 ---------- */
  function bindToggle(id, cls, key) {
    var input = $('#' + id);
    var saved = store(key);
    if (saved === '0') input.checked = false;
    var apply = function () { container.classList.toggle(cls, !input.checked); store(key, input.checked ? '1' : '0'); };
    input.addEventListener('change', apply);
    apply();
  }
  bindToggle('opt-labels', 'no-labels', 'labels');
  bindToggle('opt-events', 'no-events', 'events');
  bindToggle('opt-branches', 'no-branches', 'branches');

  var legend = $('#legend');
  $('#legend-toggle').addEventListener('click', function () {
    var c = legend.classList.toggle('collapsed');
    this.setAttribute('aria-expanded', String(!c));
  });
  if (window.matchMedia('(max-width: 760px)').matches) { legend.classList.add('collapsed'); $('#legend-toggle').setAttribute('aria-expanded', 'false'); }

  // 昼夜
  var root = document.documentElement;
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function syncThemeBtn() { $('#theme-toggle').textContent = isDark() ? '昼航' : '夜航'; }
  var savedTheme = store('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') root.setAttribute('data-theme', savedTheme);
  $('#theme-toggle').addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store('theme', next);
    syncThemeBtn();
    if (player.trail) player.trail.setStyle({ color: getComputedStyle(root).getPropertyValue('--v' + player.n).trim() });
  });
  syncThemeBtn();
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', syncThemeBtn);
  }
  new MutationObserver(syncThemeBtn).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- 启动 ---------- */
  renderChips();
  renderChron();
  map.fitBounds(allBounds(), { paddingTopLeft: [30, 40], paddingBottomRight: [30, 110] });
  zoomClass();
  setPolMode(store('pol') || 'states');
  var savedBase = store('base');
  if (savedBase === 'ocean' || savedBase === 'sat') setBase(savedBase);
  if (!readHash()) selectVoyage(0, { fit: false, noHash: true });
  // 窗口尺寸变化（如手机旋转）后修正地图
  window.addEventListener('resize', function () { map.invalidateSize(); });
})();
