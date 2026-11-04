/*
 * 航次档案页（voyages.html）
 * 依赖：ZH（js/data.js）、ZH_DETAIL（js/voyages-detail.js）、ZHStats（js/stats.js）
 */
(function () {
  'use strict';
  var D = window.ZH, X = window.ZH_DETAIL, S = window.ZHStats;
  var NUM = ['', '一', '二', '三', '四', '五', '六', '七'];
  var KIND = {
    conferral: ['封', '册封'], tribute: ['贡', '进贡'], envoy: ['使', '遣使'], battle: ['战', '用兵'],
    trade: ['商', '贸易'], stele: ['碑', '立碑'], other: ['记', '其他']
  };
  var SEGS = [['out', '去程', 's1'], ['ret', '归程', 's2'], ['branch', '分䑸', 's3']];
  var NS = 'http://www.w3.org/2000/svg';
  var state = { n: 1, tab: 'overview' };

  /* ---------- 小工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function wan(n) { return n === 0 ? '0' : (n / 10000) + '万'; }
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    var t = svgEl('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function vc(n) { return 'var(--v' + n + ')'; }
  function shortPlace(id) { return D.ports[id] ? D.ports[id].name : id; }
  function dateCN(iso) { var p = iso.split('-'); return +p[0] + '.' + (+p[1]) + '.' + (+p[2]); }

  /* ---------- 提示框（只用 textContent 写入） ---------- */
  var tip = $('#tip');
  function showTip(evt, title, rows) {
    tip.textContent = '';
    var b = document.createElement('b'); b.textContent = title; tip.appendChild(b);
    (rows || []).forEach(function (r) {
      var d = document.createElement('div'); d.className = 'row';
      if (r.color) { var i = document.createElement('i'); i.style.background = r.color; d.appendChild(i); }
      d.appendChild(document.createTextNode(r.text));
      tip.appendChild(d);
    });
    tip.hidden = false;
    var pt = evt && evt.clientX != null ? [evt.clientX, evt.clientY] : null;
    if (!pt) { var bb = evt.target.getBoundingClientRect(); pt = [bb.left + bb.width / 2, bb.top]; }
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.min(window.innerWidth - w - 8, Math.max(8, pt[0] + 14));
    var y = pt[1] - h - 12 < 8 ? pt[1] + 18 : pt[1] - h - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function bindTip(el, fn) {
    el.addEventListener('pointermove', function (e) { var c = fn(); showTip(e, c[0], c[1]); });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focus', function (e) { var c = fn(); showTip({ target: e.target }, c[0], c[1]); });
    el.addEventListener('blur', hideTip);
  }
  function bindRow(g, n) {
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.addEventListener('click', function () { select(n, true); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n, true); } });
  }

  var ALL = S.all();

  /* ---------- 对比：起止时间 ---------- */
  function renderGantt() {
    var box = $('#chart-gantt');
    var W = Math.max(300, box.clientWidth), rowH = 30, top = 6, labW = 54, right = 64;
    var H = top + rowH * 7 + 44;
    var y0 = 1404.5, y1 = 1434;
    var x = function (y) { return labW + (y - y0) / (y1 - y0) * (W - labW - right); };
    box.textContent = '';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '七次下西洋的起止时间' }, box);
    var axisY = top + rowH * 7 + 6;
    for (var yr = 1405; yr <= 1430; yr += 5) {
      svgEl('line', { class: 'grid', x1: x(yr), x2: x(yr), y1: top, y2: axisY }, svg);
      text(svg, x(yr), axisY + 13, String(yr), { 'text-anchor': 'middle' });
    }
    [['永乐', 1403, 1424.9], ['洪熙', 1425, 1425.9], ['宣德', 1426, 1434]].forEach(function (r) {
      var a = Math.max(x(r[1]), labW), b = Math.min(x(r[2]), W - right);
      svgEl('line', { class: 'reign-line', x1: a + 1, x2: b - 1, y1: axisY + 22, y2: axisY + 22 }, svg);
      if (b - a > 26) text(svg, (a + b) / 2, axisY + 35, r[0], { class: 'reign', 'text-anchor': 'middle' });
    });
    D.voyages.forEach(function (v, i) {
      var cy = top + i * rowH + rowH / 2;
      var g = svgEl('g', { class: 'row' + (state.n === v.n ? ' on' : ''), 'data-n': v.n, 'aria-label': v.title + '，' + v.years + '，约 ' + ALL[i].months + ' 个月' }, svg);
      svgEl('rect', { class: 'hl', x: 0, y: cy - rowH / 2, width: W, height: rowH, rx: 4 }, g);
      text(g, 0, cy + 4, '第' + NUM[v.n] + '次', { class: 'rowlab' });
      var a = x(v.t0), b = x(v.t1);
      svgEl('rect', { class: 'gbar', x: a, y: cy - 6, width: Math.max(4, b - a), height: 12, rx: 4 }, g);
      text(g, b + 6, cy + 4, '约 ' + ALL[i].months + ' 个月', { class: 'val' });
      bindRow(g, v.n);
      bindTip(g, function () { return [v.title, [{ text: v.years + ' · ' + v.reign }, { text: '受命至回国约 ' + ALL[i].months + ' 个月' }]]; });
    });
  }

  /* ---------- 对比：示意航程 ---------- */
  function renderKm() {
    $('#legend-km').innerHTML = SEGS.map(function (s) { return '<span><i class="' + s[2] + '"></i>' + s[1] + '</span>'; }).join('');
    var box = $('#chart-km');
    var W = Math.max(300, box.clientWidth), rowH = 30, top = 6, labW = 54, right = 56;
    var H = top + rowH * 7 + 26;
    var max = 40000;
    var x = function (km) { return labW + km / max * (W - labW - right); };
    box.textContent = '';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '七次下西洋的示意航程（公里），分去程、归程、分䑸' }, box);
    var axisY = top + rowH * 7 + 4;
    for (var k = 0; k <= max; k += 10000) {
      svgEl('line', { class: 'grid', x1: x(k), x2: x(k), y1: top, y2: axisY }, svg);
      text(svg, x(k), axisY + 13, wan(k), { 'text-anchor': 'middle' });
    }
    ALL.forEach(function (s, i) {
      var v = D.voyages[i], cy = top + i * rowH + rowH / 2, bh = 14;
      var g = svgEl('g', { class: 'row' + (state.n === v.n ? ' on' : ''), 'aria-label': v.title + '，示意航程约 ' + fmt(s.km.total) + ' 公里' }, svg);
      svgEl('rect', { class: 'hl', x: 0, y: cy - rowH / 2, width: W, height: rowH, rx: 4 }, g);
      text(g, 0, cy + 4, '第' + NUM[v.n] + '次', { class: 'rowlab' });
      var acc = 0;
      var parts = SEGS.filter(function (sg) { return s.km[sg[0]] > 0; });
      parts.forEach(function (sg, j) {
        var a = x(acc), b = x(acc + s.km[sg[0]]);
        acc += s.km[sg[0]];
        var last = j === parts.length - 1;
        var w = Math.max(1, b - a - (last ? 0 : 2));            // 2px 纸色间隙
        var seg;
        if (last) {
          var r = Math.min(4, w);
          seg = svgEl('path', { class: 'seg ' + sg[2], d: 'M' + a + ',' + (cy - bh / 2) + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (bh - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + (-r) + ',' + r + 'h' + (-(w - r)) + 'z' }, g);
        } else {
          seg = svgEl('rect', { class: 'seg ' + sg[2], x: a, y: cy - bh / 2, width: w, height: bh }, g);
        }
        bindTip(seg, function () {
          return [fmt(s.km[sg[0]]) + ' 公里', [{ text: v.title + ' · ' + sg[1], color: 'var(--chart-' + sg[2].slice(1) + ')' }]];
        });
      });
      text(g, x(acc) + 6, cy + 4, fmt(s.km.total), { class: 'val' });
      bindRow(g, v.n);
    });
  }

  /* ---------- 对比表（也是两张图的表格版） ---------- */
  function fleetShort(n) {
    var f = X[n].fleet;
    if (f.total && f.total.n) return (n === 2 ? '改造 ' : '') + f.total.n + ' 艘';
    if (f.large && f.large.n) return '大船 ' + f.large.n + ' 艘';
    return null;
  }
  function renderTable() {
    var tb = $('#cmp-table tbody');
    tb.innerHTML = ALL.map(function (s, i) {
      var v = D.voyages[i], p = X[v.n].personnel.total, f = fleetShort(v.n);
      return '<tr data-n="' + v.n + '" class="' + (state.n === v.n ? 'on' : '') + '" tabindex="0">' +
        '<td><span class="vn" style="--vc:' + vc(v.n) + '"><i></i>第' + NUM[v.n] + '次</span></td>' +
        '<td>' + esc(v.years) + '</td>' +
        '<td class="num">约 ' + s.months + ' 个月</td>' +
        '<td class="num">' + (p.n ? (p.approx ? '约 ' : '') + fmt(p.n) : '<span class="na">史料未载</span>') + '</td>' +
        '<td class="num">' + (f ? esc(f) : '<span class="na">史料未载</span>') + '</td>' +
        '<td class="num">' + s.stops + ' 站</td>' +
        '<td class="num">' + s.countries + '</td>' +
        '<td class="num">' + fmt(s.km.total) + ' 公里</td>' +
        '<td class="wrap">' + esc(v.farthest) + '</td></tr>';
    }).join('');
    $$('tr', tb).forEach(function (tr) {
      var n = +tr.getAttribute('data-n');
      tr.addEventListener('click', function () { select(n, true); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') select(n, true); });
    });
  }

  /* ---------- 详情 ---------- */
  var TABS = [['overview', '概况'], ['people', '人员'], ['fleet', '船队'], ['route', '航程'], ['results', '成果'], ['sources', '史料']];

  function renderPick() {
    $('#vpick').innerHTML = D.voyages.map(function (v) {
      return '<button type="button" role="tab" data-n="' + v.n + '" style="--vc:' + vc(v.n) + '" aria-selected="' + (state.n === v.n) + '"><i></i>第' + NUM[v.n] + '次</button>';
    }).join('');
    $$('#vpick button').forEach(function (b) { b.addEventListener('click', function () { select(+b.getAttribute('data-n'), false); }); });
  }

  function tile(lab, value, sub, na) {
    return '<div class="tile"><span class="lab">' + lab + '</span><span class="v' + (na ? ' na' : '') + '">' + value + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  }

  function renderDetail() {
    var n = state.n, v = D.voyages[n - 1], d = X[n], s = S.voyage(n);
    var p = d.personnel.total, f = fleetShort(n);
    var html = '' +
      '<div class="dhead" style="--vc:' + vc(n) + '"><span class="big">第' + NUM[n] + '次</span>' +
      '<span class="when"><b>' + esc(v.years) + '</b>' + esc(v.reign) + '</span>' +
      '<span class="links"><a href="index.html#v' + n + '">在航海图上查看航线 →</a></span></div>' +
      '<div class="tiles">' +
      tile('历时', s.months + '<small>个月</small>', '受命至回国') +
      tile('人数', p.n ? fmt(p.n) + '<small>' + (p.approx ? '余人' : '人') + '</small>' : '史料未载', p.n ? esc(p.src) : '', !p.n) +
      tile('船只', f ? esc(f) : '史料未载', f ? esc((d.fleet.total && d.fleet.total.n ? d.fleet.total.src : d.fleet.large.src) || '') : '', !f) +
      tile('示意航程', fmt(s.km.total) + '<small>公里</small>', '约 ' + fmt(s.li.total) + ' 明里 · ' + fmt(s.nm.total) + ' 海里') +
      tile('所到国家与地区', s.countries + '<small>处</small>', '停靠 ' + s.stops + ' 站（含往返）') +
      '</div>' +
      '<div class="dtabs" role="tablist">' + TABS.map(function (t) {
        return '<button class="dtab" role="tab" type="button" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="dpane" id="dpane"></div>';
    $('#detail-body').innerHTML = html;
    $$('.dtab').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); $$('.dtab').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); renderPane(); });
    });
    renderPane();
  }

  function renderPane() {
    var n = state.n, v = D.voyages[n - 1], d = X[n], s = S.voyage(n), el = $('#dpane');
    var t = state.tab;
    if (t === 'overview') {
      el.innerHTML = v.summary.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<dl class="kv"><dt>最远</dt><dd>' + esc(v.farthest) + '</dd><dt>所到</dt><dd>' + s.places.map(shortPlace).join('、') + '</dd></dl>' +
        '<blockquote class="source">' + esc(v.quote.t) + '<cite>' + esc(v.quote.s) + '</cite></blockquote>';
    } else if (t === 'people') {
      var p = d.personnel.total;
      el.innerHTML = '<div class="facts2"><div class="fact"><span class="k">随行人数</span>' +
        (p.n ? '<span class="n">' + fmt(p.n) + (p.approx ? ' 余人' : ' 人') + '</span><span class="t">"' + esc(p.text) + '"</span><span class="s">' + esc(p.src) + '</span>'
          : '<span class="n na">史料未载</span><span class="s">各次人数只有第一、三、七次见于记载，通常认为每次都在两万七千人上下。</span>') +
        '</div></div>' +
        (d.personnel.categories ? '<h4 class="pane-h">人员构成</h4><p class="note">《前闻记》只列名目，未分项计数。</p><div class="chips">' +
          d.personnel.categories.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
        '<h4 class="pane-h">主要官员与随员</h4><div class="table-wrap"><table class="data"><thead><tr><th>姓名</th><th>职衔</th><th>职责与事迹</th><th>出处</th></tr></thead><tbody>' +
        d.officials.map(function (o) { return '<tr><td><b>' + esc(o.name) + '</b></td><td>' + esc(o.title) + '</td><td>' + esc(o.role) + '</td><td class="note">' + esc(o.src) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    } else if (t === 'fleet') {
      var fc = function (lab, x, textOnly) {
        var head = textOnly ? '' : x.n ? '<span class="n">' + fmt(x.n) + ' 艘</span>'
          : '<span class="n na">' + (x.text && x.text !== '史料未载' ? '无确切数字' : '史料未载') + '</span>';
        return '<div class="fact"><span class="k">' + lab + '</span>' + head +
          (x.text && x.text !== '史料未载' ? '<span class="t">"' + esc(x.text) + '"</span>' : '') +
          (x.src ? '<span class="s">' + esc(x.src) + '</span>' : '') + (x.note ? '<span class="s">' + esc(x.note) + '</span>' : '') + '</div>';
      };
      el.innerHTML = '<div class="facts2">' + fc('总船数', d.fleet.total) + (n === 7 ? fc('船名', d.fleet.large, true) : fc('大船', d.fleet.large)) + '</div>' +
        (d.fleet.note ? '<p>' + esc(d.fleet.note) + '</p>' : '') +
        '<p class="note">各次船只的型号构成史无明载。宝船、马船、粮船、坐船、战船等船型及其 3D 复原，将在"舰队复原"页给出。</p>';
    } else if (t === 'route') {
      renderRoute(el, n, v, s);
    } else if (t === 'results') {
      el.innerHTML = '<ul class="results">' + d.results.map(function (r) {
        var k = KIND[r.kind] || KIND.other;
        return '<li><i class="glyph g-' + k[0] + '">' + k[0] + '</i><span class="t">' + esc(r.text) + '</span>' +
          '<span class="m"><span>' + k[1] + '</span><span>' + esc(r.src) + '</span>' + (r.ev ? '<a href="index.html#v' + n + '">在航海图上查看</a>' : '') + '</span></li>';
      }).join('') + '</ul>';
    } else if (t === 'sources') {
      el.innerHTML = d.sources.map(function (q) { return '<blockquote class="source">' + esc(q.t) + '<cite>' + esc(q.s) + '</cite></blockquote>'; }).join('');
    }
  }

  function renderRoute(el, n, v, s) {
    var legsHtml = '';
    for (var i = 1; i < v.stops.length; i++) {
      var a = v.stops[i - 1], b = v.stops[i];
      legsHtml += '<tr><td>' + i + '</td><td>' + esc(shortPlace(a.p)) + ' → ' + esc(shortPlace(b.p)) + (b.ret ? ' <span class="note">归程</span>' : '') + '</td><td>' + esc(b.d) + '</td><td class="num">' + fmt(S.legKm(a.p, b.p)) + '</td></tr>';
    }
    var br = v.branches.map(function (bb) {
      var km = 0;
      for (var j = 1; j < bb.stops.length; j++) km += S.legKm(bb.stops[j - 1], bb.stops[j]);
      return '<tr><td>' + esc(bb.name) + '</td><td>' + bb.stops.map(shortPlace).join(' → ') + '</td><td class="num">' + fmt(km) + '</td></tr>';
    }).join('');
    el.innerHTML = '<h4 class="pane-h">里程构成</h4><div class="legend-row" id="legend-split"></div><div class="chart" id="chart-split"></div>' +
      '<p class="note">按示意航线计算：约 ' + fmt(s.km.total) + ' 公里，合 ' + fmt(s.li.total) + ' 明里（1 明里按 1800 尺、1 尺 0.311 米折算），' + fmt(s.nm.total) + ' 海里。</p>' +
      (s.log ? '<div class="strip-wrap"><h4 class="pane-h">逐日行程（据祝允明《前闻记》）</h4><div class="legend-row" id="legend-strip"></div><div class="chart" id="chart-strip"></div>' +
        '<p class="note">从南京启航到回京共 ' + fmt(days(s.log.start, s.log.end)) + ' 天，其中有记载的在航 ' + s.days.sea + ' 天、在港 ' + s.days.port + ' 天；在长乐候风就用了 279 天。</p></div>' +
        '<div class="table-wrap"><table class="data legs"><thead><tr><th>行程</th><th>起止</th><th class="num">天数</th><th class="num">公里</th><th class="num">日均公里</th></tr></thead><tbody>' +
        s.log.legs.map(function (g) {
          var lab = g.kind === 'port' ? '驻泊' + shortPlace(g.p) + (g.note ? '（' + g.note + '）' : '') : shortPlace(g.p) + ' → ' + shortPlace(g.q) + (g.kind === 'mixed' ? '（开船日期不详）' : '');
          return '<tr class="' + g.kind + '"><td>' + esc(lab) + '</td><td>' + dateCN(g.from) + '—' + dateCN(g.to) + '</td><td class="num">' + g.days + '</td><td class="num">' + (g.km ? fmt(g.km) : '') + '</td><td class="num">' + (g.kmPerDay ? g.kmPerDay : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '') +
      '<h4 class="pane-h">停靠顺序</h4><div class="table-wrap"><table class="data legs"><thead><tr><th>#</th><th>航段</th><th>到达</th><th class="num">公里</th></tr></thead><tbody>' + legsHtml + '</tbody></table></div>' +
      (br ? '<h4 class="pane-h">分䑸</h4><div class="table-wrap"><table class="data legs"><thead><tr><th>船队</th><th>航线</th><th class="num">公里</th></tr></thead><tbody>' + br + '</tbody></table></div>' : '');
    renderSplit(s);
    if (s.log) renderStrip(s.log);
  }

  function days(a, b) { var p = a.split('-'), q = b.split('-'); return Math.round((Date.UTC(+q[0], +q[1] - 1, +q[2]) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 864e5); }

  // 单次里程：高分段条，块内能放下才写数字
  function renderSplit(s) {
    var parts = SEGS.filter(function (sg) { return s.km[sg[0]] > 0; });
    $('#legend-split').innerHTML = parts.map(function (sg) { return '<span><i class="' + sg[2] + '"></i>' + sg[1] + '</span>'; }).join('');
    var box = $('#chart-split'), W = Math.max(280, box.clientWidth), H = 28;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '里程构成：' + parts.map(function (sg) { return sg[1] + ' ' + fmt(s.km[sg[0]]) + ' 公里'; }).join('，') }, box);
    var acc = 0, tot = s.km.total;
    parts.forEach(function (sg, j) {
      var a = acc / tot * W, w = s.km[sg[0]] / tot * W - (j < parts.length - 1 ? 2 : 0);
      acc += s.km[sg[0]];
      var r = svgEl('rect', { class: 'seg ' + sg[2], x: a, y: 0, width: Math.max(1, w), height: H, rx: 4 }, svg);
      var label = fmt(s.km[sg[0]]) + ' 公里 · ' + Math.round(s.km[sg[0]] / tot * 100) + '%';
      if (w > label.length * 6.6 + 16) text(svg, a + 8, H / 2 + 4, label, { style: 'fill:#fff;font-weight:600' });
      bindTip(r, function () { return [fmt(s.km[sg[0]]) + ' 公里', [{ text: sg[1] + ' · 占 ' + Math.round(s.km[sg[0]] / tot * 100) + '%', color: 'var(--chart-' + sg[2].slice(1) + ')' }]]; });
    });
  }

  // 第七次逐日行程：时间轴上的在航、在港、不详三类区间
  function renderStrip(log) {
    $('#legend-strip').innerHTML = '<span><i class="s1"></i>在航</span><span><i class="s2"></i>在港</span><span><i class="mixed"></i>日期不详</span>';
    var box = $('#chart-strip'), W = Math.max(300, box.clientWidth), H = 66, bh = 28;
    var t0 = days('1431-01-01', log.start), total = days(log.start, log.end);
    var x = function (iso) { return days(log.start, iso) / total * W; };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '第七次下西洋逐日行程：在航与在港的时间分布' }, box);
    var defs = svgEl('defs', {}, svg);
    var pat = svgEl('pattern', { id: 'hatch-mixed', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
    svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, style: 'stroke:var(--chart-muted);stroke-width:3' }, pat);
    log.legs.forEach(function (g) {
      var a = x(g.from), b = x(g.to), w = Math.max(1, b - a - 1);
      var cls = g.kind === 'sea' ? 'seg s1' : g.kind === 'port' ? 'seg s2' : 'seg';
      var r = svgEl('rect', { class: cls, x: a, y: 0, width: w, height: bh, rx: Math.min(3, w / 2), fill: g.kind === 'mixed' ? 'url(#hatch-mixed)' : null }, svg);
      var name = g.kind === 'port' ? shortPlace(g.p) : shortPlace(g.p) + '→' + shortPlace(g.q);
      if (g.kind === 'port' && w > name.length * 13 + 30) text(svg, a + 6, bh / 2 + 4, name + ' ' + g.days + '天', { style: 'fill:#fff;font-weight:600' });
      bindTip(r, function () {
        return [g.days + ' 天', [{ text: (g.kind === 'sea' ? '在航 · ' : g.kind === 'port' ? '在港 · ' : '日期不详 · ') + name }, { text: dateCN(g.from) + '—' + dateCN(g.to) + (g.km ? ' · ' + fmt(g.km) + ' 公里' : '') }]];
      });
      r.setAttribute('tabindex', '0');
    });
    ['1431-07-01', '1432-01-01', '1432-07-01', '1433-01-01', '1433-07-01'].forEach(function (iso) {
      var xx = x(iso);
      svgEl('line', { class: 'grid', x1: xx, x2: xx, y1: bh + 2, y2: bh + 8 }, svg);
      var p = iso.split('-');
      text(svg, xx, bh + 22, p[1] === '01' ? p[0] + '年' : '7月', { 'text-anchor': 'middle' });
    });
    void t0;
  }

  /* ---------- 选择与地址 ---------- */
  function select(n, scroll) {
    if (n < 1 || n > 7) return;
    state.n = n;
    renderGantt(); renderKm(); renderTable(); renderPick(); renderDetail();
    try { history.replaceState(null, '', '#v' + n); } catch (e) { /* 查看器可能禁止 */ }
    if (scroll) $('#detail').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function fromHash() {
    var m = /^#v([1-7])$/.exec(location.hash);
    return m ? +m[1] : 0;
  }
  window.addEventListener('hashchange', function () { var n = fromHash(); if (n && n !== state.n) select(n, true); });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { renderGantt(); renderKm(); if (state.tab === 'route') renderPane(); }, 150);
  });

  var first = fromHash();
  select(first || 1, false);
  if (first) setTimeout(function () { $('#detail').scrollIntoView({ block: 'start' }); }, 50);
})();
