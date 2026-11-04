/*
 * 航程统计 ZHStats（docs/SPEC.md §4.2）
 * 依赖：js/data.js（ZH）、js/route.js（ZHRoute）、js/voyages-detail.js（ZH_DETAIL，可选）
 * 里程按示意航线（海道网最短路径）计算，只用于比较各次远近，并非实测航迹。
 */
(function (root) {
  'use strict';
  var D = root.ZH, net = root.ZHRoute.build(D);
  var LI_KM = 1800 * 0.311 / 1000;          // 1 明里 = 360 步 × 5 尺 = 1800 尺，1 尺约 0.311 米
  var NM_KM = 1.852;
  var DOMESTIC = { nanjing: 1, liujiagang: 1, changle: 1, quanzhou: 1 };
  var LANDMARK = { kunlun: 1, cuilanyu: 1 };  // 航海地标，不计入"国家与地区"

  function units(km) {
    var r = function (v) { return Math.round(v); };
    return {
      km: { out: r(km.out), ret: r(km.ret), branch: r(km.branch), total: r(km.out + km.ret + km.branch) },
      nm: { out: r(km.out / NM_KM), ret: r(km.ret / NM_KM), branch: r(km.branch / NM_KM), total: r((km.out + km.ret + km.branch) / NM_KM) },
      li: { out: r(km.out / LI_KM), ret: r(km.ret / LI_KM), branch: r(km.branch / LI_KM), total: r((km.out + km.ret + km.branch) / LI_KM) }
    };
  }

  var dayMs = 86400000;
  function day(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / dayMs; }

  // 逐日记录（目前只有第七次）：各段在航、在港天数与里程
  function logLegs(n) {
    var det = root.ZH_DETAIL && root.ZH_DETAIL[n];
    if (!det || !det.log) return null;
    var log = det.log, legs = [], sea = 0, port = 0;
    for (var i = 0; i < log.length; i++) {
      var s = log[i];
      if (s.arr && s.dep) {
        var d = day(s.dep) - day(s.arr);
        port += d;
        legs.push({ kind: 'port', p: s.p, from: s.arr, to: s.dep, days: d, note: s.note || '' });
      }
      var nx = log[i + 1];
      if (nx && s.dep && nx.arr) {
        var ds = day(nx.arr) - day(s.dep);
        var km = net.leg(s.p, nx.p).km;
        sea += ds;
        legs.push({ kind: 'sea', p: s.p, q: nx.p, from: s.dep, to: nx.arr, days: ds, km: Math.round(km), kmPerDay: Math.round(km / ds) });
      } else if (nx && s.arr && !s.dep && nx.arr) {
        // 只知到港、不知开船日期：在港与航行混在一起，单独列出，不计入在航、在港合计
        legs.push({ kind: 'mixed', p: s.p, q: nx.p, from: s.arr, to: nx.arr, days: day(nx.arr) - day(s.arr), km: Math.round(net.leg(s.p, nx.p).km) });
      }
    }
    return { legs: legs, sea: sea, port: port, start: log[0].dep || log[0].arr, end: log[log.length - 1].arr };
  }

  function voyage(n) {
    var v = D.voyages[n - 1];
    var km = { out: 0, ret: 0, branch: 0 };
    var visited = {};
    for (var i = 1; i < v.stops.length; i++) {
      var L = net.leg(v.stops[i - 1].p, v.stops[i].p);
      if (v.stops[i].ret) km.ret += L.km; else km.out += L.km;
    }
    v.stops.forEach(function (s) { visited[s.p] = true; });
    v.branches.forEach(function (br) {
      for (var j = 1; j < br.stops.length; j++) km.branch += net.leg(br.stops[j - 1], br.stops[j]).km;
      br.stops.forEach(function (p) { visited[p] = true; });
    });
    var places = Object.keys(visited).filter(function (p) { return !DOMESTIC[p] && !LANDMARK[p]; });
    var out = units(km);
    out.n = n;
    out.months = Math.round((v.t1 - v.t0) * 12);
    out.stops = v.stops.length;
    out.places = places;                         // 所到国家与地区（港口 id）
    out.countries = places.length;
    out.log = logLegs(n);
    out.days = out.log ? { sea: out.log.sea, port: out.log.port } : null;
    return out;
  }

  var cache = {};
  root.ZHStats = {
    LI_KM: LI_KM,
    NM_KM: NM_KM,
    voyage: function (n) { return cache[n] || (cache[n] = voyage(n)); },
    all: function () { return D.voyages.map(function (v) { return root.ZHStats.voyage(v.n); }); },
    legKm: function (a, b) { return Math.round(net.leg(a, b).km); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
