/*
 * 航路计算：在 data.js 定义的海道网上用 Dijkstra 求港口之间的最短海路，
 * 再对中途转折点做 Chaikin 平滑，使航线贴近古代帆船沿岸、跨洋的实际走法。
 */
(function (root) {
  var R = 6371;
  function rad(d) { return d * Math.PI / 180; }
  function km(a, b) {
    var dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function build(D) {
    var nodes = {}, adj = {}, kind = {};
    Object.keys(D.ports).forEach(function (id) { nodes[id] = D.ports[id].at; });
    Object.keys(D.waypoints).forEach(function (id) { nodes[id] = D.waypoints[id]; });
    Object.keys(nodes).forEach(function (id) { adj[id] = []; });
    D.edges.forEach(function (e) {
      var a = e[0], b = e[1];
      if (!nodes[a] || !nodes[b]) throw new Error('未知航点：' + a + ' / ' + b);
      var w = km(nodes[a], nodes[b]);
      adj[a].push([b, w]); adj[b].push([a, w]);
      kind[a + '|' + b] = kind[b + '|' + a] = e[2] || 's';
    });

    var cache = {};
    function shortest(from, to) {
      var key = from + '>' + to;
      if (cache[key]) return cache[key];
      var dist = {}, prev = {}, done = {};
      Object.keys(nodes).forEach(function (id) { dist[id] = Infinity; });
      dist[from] = 0;
      for (;;) {
        var u = null, best = Infinity;
        for (var id in dist) if (!done[id] && dist[id] < best) { best = dist[id]; u = id; }
        if (u === null || u === to) break;
        done[u] = true;
        adj[u].forEach(function (nb) {
          var alt = dist[u] + nb[1];
          if (alt < dist[nb[0]]) { dist[nb[0]] = alt; prev[nb[0]] = u; }
        });
      }
      if (dist[to] === Infinity) throw new Error('无可达海路：' + from + ' → ' + to);
      var path = [to];
      while (path[0] !== from) path.unshift(prev[path[0]]);
      cache[key] = path;
      return path;
    }

    // Chaikin 平滑：只平滑连续的海上航段，港口与河道/陆路端点保持不动
    function smooth(pts, fixed, iterations) {
      for (var it = 0; it < iterations; it++) {
        var out = [pts[0]], fx = [true];
        for (var i = 0; i < pts.length - 1; i++) {
          var p = pts[i], q = pts[i + 1];
          if (fixed[i] && fixed[i + 1] && pts.length === 2) { out.push(q); fx.push(true); continue; }
          var a = [0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]];
          var b = [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]];
          if (!fixed[i]) { out.push(a); fx.push(false); }
          if (!fixed[i + 1]) { out.push(b); fx.push(false); }
          if (fixed[i + 1]) { out.push(q); fx.push(true); }
        }
        pts = out; fixed = fx;
      }
      return pts;
    }

    // 一段航程（相邻两个停靠点之间）的坐标串
    function leg(from, to) {
      var ids = shortest(from, to);
      var pts = ids.map(function (id) { return nodes[id].slice(); });
      // 港口、河道与陆路两端都视为固定点
      var fixed = ids.map(function (id, i) {
        if (i === 0 || i === ids.length - 1 || D.ports[id]) return true;
        var prevK = i > 0 ? kind[ids[i - 1] + '|' + id] : 's';
        var nextK = i < ids.length - 1 ? kind[id + '|' + ids[i + 1]] : 's';
        return prevK !== 's' || nextK !== 's';
      });
      var overland = [];
      for (var i = 0; i < ids.length - 1; i++) if (kind[ids[i] + '|' + ids[i + 1]] === 'l') overland.push(i);
      return { ids: ids, latlngs: smooth(pts, fixed, 2), overland: overland.length > 0, km: pathKm(pts) };
    }

    function pathKm(pts) {
      var s = 0;
      for (var i = 1; i < pts.length; i++) s += km(pts[i - 1], pts[i]);
      return s;
    }

    return { nodes: nodes, shortest: shortest, leg: leg, km: km, pathKm: pathKm };
  }

  root.ZHRoute = { build: build, km: km };
})(typeof window !== 'undefined' ? window : globalThis);
