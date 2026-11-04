/*
 * 天下全图页（world.html）
 * 依赖：WorldMap（worldmap/worldmap.js）、WM_GEO、WM_POLITIES['1415']、ZH（js/data.js）、ZHRoute（js/route.js）
 */
(function () {
  'use strict';
  var D = window.ZH, FC = window.WM_POLITIES['1415'];
  var NUM = ['', '一', '二', '三', '四', '五', '六', '七'];
  var REL = { ming: '明朝直辖', visit: '郑和船队到访', loose: '明朝羁縻（都司、卫所、宣慰司）', tribute: '遣使往来', other: '与明朝无直接往来' };
  var REL_ORDER = ['ming', 'visit', 'loose', 'tribute', 'other'];
  var KIND = {
    empire: '帝国', kingdom: '王国', sultanate: '苏丹国', khanate: '汗国', khanates: '汗国诸部', emirate: '埃米尔国', imamate: '伊玛目国', duchy: '公国',
    'grand-duchy': '大公国', principality: '公国', principalities: '诸公国', despotate: '专制公国', republic: '共和国', theocracy: '教权国家', order: '骑士团国',
    union: '共主联盟', confederation: '部族联盟', city: '城邦', 'city-states': '城邦群', kingdoms: '诸王国', chiefdoms: '诸酋邦', hegemony: '霸权',
    province: '明朝布政使司', garrison: '明朝卫所', pacification: '明朝宣慰司', chieftaincies: '土司', shogunate: '幕府', tribes: '诸部', beyliks: '诸侯国'
  };
  var VIEWS = {
    world: [-170, -50, 180, 75], voyage: [30, -12, 125, 42], east: [92, 8, 145, 50],
    europe: [-12, 28, 45, 62], americas: [-125, -25, -55, 45]
  };

  // 都城（约 1415 年）：[名称, 经度, 纬度]
  var CAPITALS = [
    ['南京', 118.78, 32.06], ['北京（1421 年起为京师）', 116.4, 39.9], ['汉城', 126.98, 37.57], ['京都', 135.77, 35.01], ['阿瑜陀耶', 100.57, 14.35],
    ['满者伯夷', 112.38, -7.56], ['德里', 77.21, 28.61], ['毗奢耶那伽罗', 76.46, 15.34], ['哈烈', 62.2, 34.35], ['撒马尔罕', 66.97, 39.65],
    ['大不里士', 46.29, 38.08], ['开罗', 31.24, 30.04], ['埃迪尔内', 26.56, 41.68], ['君士坦丁堡', 28.98, 41.01], ['萨莱', 47.0, 48.0],
    ['莫斯科', 37.62, 55.75], ['克拉科夫', 19.94, 50.06], ['维尔纽斯', 25.28, 54.69], ['巴黎', 2.35, 48.86], ['伦敦', -0.13, 51.51],
    ['里斯本', -9.14, 38.72], ['格拉纳达', -3.6, 37.18], ['威尼斯', 12.33, 45.44], ['罗马', 12.5, 41.9], ['突尼斯', 10.18, 36.8],
    ['廷巴克图', -3.0, 16.77], ['阿斯卡波察尔科', -99.19, 19.48], ['库斯科', -71.97, -13.53]
  ];
  // 同期世界大事
  var EVENTS = [
    { y: 1405, at: [68.3, 42.85], t: '帖木儿去世', d: '帖木儿在东征明朝途中病逝于讹答剌，大军随即撤回。同年郑和首次下西洋。' },
    { y: 1410, at: [20.1, 53.5], t: '格伦瓦尔德之战', d: '波兰—立陶宛联军大败条顿骑士团。' },
    { y: 1414, at: [62.2, 34.35], t: '陈诚出使哈烈', d: '明朝使臣陈诚抵达帖木儿帝国都城哈烈与撒马尔罕，归国后撰《西域行程记》《西域番国志》。' },
    { y: 1415, at: [-5.32, 35.89], t: '葡萄牙攻占休达', d: '葡萄牙夺取北非港口休达，此后沿非洲西海岸逐步南下。这一年郑和船队第四次下西洋归国。' },
    { y: 1415, at: [2.14, 50.46], t: '阿金库尔之战', d: '英王亨利五世以长弓手大败法军，百年战争进入英格兰占优的阶段。' },
    { y: 1417, at: [9.17, 47.66], t: '康斯坦茨会议', d: '1414—1418 年召开的宗教会议于 1417 年选出新教皇，结束天主教会大分裂；1415 年胡斯在此被处火刑。' },
    { y: 1419, at: [-16.9, 32.7], t: '葡萄牙人到达马德拉', d: '葡萄牙航海者登上马德拉群岛并开始殖民，与郑和船队到达东非海岸几乎同时。' },
    { y: 1420, at: [66.97, 39.65], t: '兀鲁伯天文台', d: '撒马尔罕的统治者兀鲁伯在 1420 年代兴建天文台，编制《兀鲁伯星表》。' },
    { y: 1421, at: [116.4, 39.9], t: '北京成为京师', d: '明成祖正式迁都北京；同年第六次下西洋出发。' },
    { y: 1428, at: [-99.13, 19.43], t: '阿兹特克三城同盟', d: '特诺奇蒂特兰与特斯科科、特拉科潘结盟，推翻特帕内克霸权。' },
    { y: 1429, at: [1.9, 47.9], t: '奥尔良解围', d: '贞德率军解除英军对奥尔良的围困，百年战争局势逆转。' },
    { y: 1431, at: [103.86, 13.41], t: '暹罗攻陷吴哥', d: '阿瑜陀耶军队攻陷吴哥，高棉王室此后南迁金边一带。这一年郑和第七次下西洋启程。' },
    { y: 1433, at: [-3.0, 16.77], t: '图阿雷格人夺取廷巴克图', d: '马里帝国失去廷巴克图；同年郑和在第七次下西洋归途中去世。' }
  ];
  // 黄河 1194—1855 年间夺淮入海的下游故道（郑州以东），与今日河道不同
  var HUANG_OLD = [[113.85, 34.92], [114.3, 34.88], [115.0, 34.62], [115.6, 34.45], [116.4, 34.3], [117.2, 34.25], [117.8, 34.1], [118.3, 33.95], [119.1, 33.6], [119.6, 33.85], [120.25, 34.25]];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function store(k, v) { return window.ZHNav ? window.ZHNav.store(k, v) : null; }

  var stage = $('#worldmap');
  var wm = window.WorldMap.mount(stage, { base: 'worldmap/', view: VIEWS.voyage, label: '约 1415 年的世界政局图' });
  wm.setPolities(FC, { mode: 'states' });

  /* ---------- 郑和航线、港口 ---------- */
  var net = window.ZHRoute.build(D);
  var ll = function (pts) { return pts.map(function (p) { return [p[1], p[0]]; }); };
  D.voyages.forEach(function (v) {
    for (var i = 1; i < v.stops.length; i++) wm.line(ll(net.leg(v.stops[i - 1].p, v.stops[i].p).latlngs), { cls: 'zroute v' + v.n, layer: 'routes' });
    v.branches.forEach(function (b) {
      for (var j = 1; j < b.stops.length; j++) wm.line(ll(net.leg(b.stops[j - 1], b.stops[j]).latlngs), { cls: 'zroute br v' + v.n, layer: 'routes' });
    });
  });
  Object.keys(D.ports).forEach(function (id) {
    var p = D.ports[id];
    if (p.tier > 2) return;
    var g = svg('g', { class: 'wm-label port' });
    svg('circle', { r: p.tier === 1 ? 3.4 : 2.6 }, g);
    var t = svg('text', { x: 6, y: 4 }, g); t.textContent = p.name;
    wm.symbol(g, p.at[1], p.at[0], { layer: 'routes' });
  });
  var old = wm.line(HUANG_OLD, { cls: 'huang-old', layer: 'lines' });
  old.appendChild(svg('title', {})).textContent = '黄河 1415 年前后的下游故道（夺淮入海）';
  wm.label('黄河故道', 116.6, 34.0, { cls: 'wm-range', rank: 3 });

  /* ---------- 都城 ---------- */
  CAPITALS.forEach(function (c) {
    var g = svg('g', { class: 'wm-label cap' });
    svg('circle', { class: 'o', r: 4.6 }, g); svg('circle', { class: 'i', r: 1.8 }, g);
    var t = svg('text', { x: 7, y: 4 }, g); t.textContent = c[0];
    wm.symbol(g, c[1], c[2], { layer: 'marks' });
  });

  /* ---------- 同期大事 ---------- */
  var evLayer = svg('g', { class: 'wevs' }, wm.layer('marks'));
  var evEls = EVENTS.map(function (e, i) {
    var g = svg('g', { class: 'wev', 'data-i': i, tabindex: 0, role: 'button', 'aria-label': e.y + ' ' + e.t });
    svg('rect', { x: -9, y: -27, width: 18, height: 18, rx: 2.5 }, g);
    var t = svg('text', { class: 'g', x: 0, y: -14, 'text-anchor': 'middle' }, g); t.textContent = '事';
    svg('line', { x1: 0, y1: -9, x2: 0, y2: 0, style: 'stroke:var(--seal);stroke-width:1.5' }, g);
    evLayer.appendChild(g);
    wm.symbol(g, e.at[0], e.at[1], { layer: 'marks' });
    evLayer.appendChild(g);
    g.addEventListener('click', function (ev) { ev.stopPropagation(); showEvent(i, false); });
    g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') showEvent(i, false); });
    return g;
  });
  $('#wevents').innerHTML = EVENTS.map(function (e, i) {
    return '<li><button type="button" data-i="' + i + '"><span class="y">' + e.y + '</span><span class="t"><b>' + esc(e.t) + '</b>' + esc(e.d) + '</span></button></li>';
  }).join('');
  $$('#wevents button').forEach(function (b) { b.addEventListener('click', function () { showEvent(+b.getAttribute('data-i'), true); }); });
  function showEvent(i, fly) {
    var e = EVENTS[i];
    evEls.forEach(function (g, k) { g.classList.toggle('on', k === i); });
    $('#polity-card').innerHTML = '<span class="sub">' + e.y + ' 年 · 同期世界大事</span><h4>' + esc(e.t) + '</h4><p>' + esc(e.d) + '</p>';
    if (fly) wm.fit([e.at[0] - 14, e.at[1] - 9, e.at[0] + 14, e.at[1] + 9]);
  }

  /* ---------- 政权卡片 ---------- */
  var mode = 'states';
  wm.on('polity', function (p) {
    var lab = String(p.label || '').replace(/\s+/g, '');
    var ports = (p.ports || []).map(function (id) { return D.ports[id] ? D.ports[id].name : id; }).join('、');
    var sup = p.suzerain ? FC.features.filter(function (f) { return f.properties.id === p.suzerain; })[0] : null;
    $('#polity-card').innerHTML =
      '<h4><i class="sw sw-pc' + p.c + '"></i>' + esc(p.name) + (lab && lab !== p.name ? ' · ' + esc(lab) : '') + '</h4>' +
      '<span class="sub">' + esc(p.alt || '') + ' · ' + esc(KIND[p.kind] || '') + (p.detail === 'coarse' ? ' · 粗略范围' : '') + '</span>' +
      '<span class="chip sw-' + p.tags.rel + '">' + esc(REL[p.tags.rel]) + '</span>' +
      (sup ? '<span class="sub">宗主：' + esc(sup.properties.name) + '</span>' : '') +
      '<p>' + esc(p.desc) + '</p>' +
      (ports ? '<span class="sub">境内的下西洋港口：' + esc(ports) + '</span>' : '');
    evEls.forEach(function (g) { g.classList.remove('on'); });
  });

  /* ---------- 图例与选项 ---------- */
  function legend() {
    var h = '';
    if (mode === 'states') {
      h += '<span class="ttl">约 1415 年诸国</span><span class="strip">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (c) { return '<i class="sw-pc' + c + '"></i>'; }).join('') + '</span>' +
        '<span>一色一国，黄色为明朝；斜线为藩属，点纹为城邦群或部族联盟</span>';
    } else if (mode === 'rel') {
      h += '<span class="ttl">与明朝的关系</span><span class="sws">' + REL_ORDER.map(function (r) { return '<span><i class="sw-' + r + '"></i>' + esc(REL[r].replace(/（.*）/, '')) + '</span>'; }).join('') + '</span>';
    }
    h += '<span class="row"><i class="ln"></i>郑和航线（七次，分色）</span><span class="row"><i class="ln old"></i>黄河故道（夺淮入海）</span>';
    $('#wlegend').innerHTML = h;
    $('#wlegend-panel').innerHTML = h;   // 窄屏时浮动图例隐藏，改在说明栏显示
  }
  function setMode(m) {
    mode = m;
    wm.setPolityMode(m);
    $$('.seg [data-pol]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pol') === m)); });
    legend();
    store('wpol', m);
  }
  $$('.seg [data-pol]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-pol')); }); });
  [['opt-routes', 'no-routes'], ['opt-events', 'no-events'], ['opt-rivers', 'no-rivers']].forEach(function (o) {
    var input = $('#' + o[0]);
    input.addEventListener('change', function () { stage.classList.toggle(o[1], !input.checked); });
  });
  $('#zoom-in').addEventListener('click', function () { wm.zoomBy(1.6); });
  $('#zoom-out').addEventListener('click', function () { wm.zoomBy(1 / 1.6); });
  $('#zoom-home').addEventListener('click', function () { wm.fit(VIEWS.world); });
  $$('.jump [data-view]').forEach(function (b) { b.addEventListener('click', function () { wm.fit(VIEWS[b.getAttribute('data-view')]); }); });

  var saved = store('wpol');
  setMode(saved === 'rel' || saved === 'off' ? saved : 'states');
})();
