/*
 * 2D 人物立绘 ZHFigure（docs/SPEC.md §6、§7.4；要求见 docs/PEOPLE-PLAN.md §4.1）。草稿，画风可整体替换。
 * 由 ZH_PEOPLE 角色的 figure 部件与 palette 生成正面立像的 SVG 字符串。
 *   ZHFigure.svg(roleOrId, { annotate: false | 'labels' | 'numbers', title: true })
 *   ZHFigure.anchors(roleOrId) → { 部件: [x, y] }，标注线的起点
 * 画布 viewBox 0 0 240 480，脚底 y = 460，头顶约 y = 45；所有角色同一比例，可以并排比较。
 * 人物轮廓用固定墨色；标注线与文字用 currentColor，由页面决定颜色（夜间模式只换这部分）。
 */
window.ZHFigure = (function () {
  'use strict';
  var INK = '#211c17', W = 1.6, FOLD = 0.8, WHITE = '#efe8da';

  function hex(c) { c = c.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16); }); }
  // k < 0 加深，k > 0 提亮
  function shade(c, k) {
    return '#' + hex(c).map(function (v) {
      v = k < 0 ? v * (1 + k) : v + (255 - v) * k;
      return ('0' + Math.round(v).toString(16)).slice(-2);
    }).join('');
  }
  function path(d, fill, o) {
    o = o || {};
    return '<path d="' + d + '" fill="' + (fill || 'none') + '"' +
      (o.stroke === false ? '' : ' stroke="' + (o.stroke || INK) + '" stroke-width="' + (o.w || W) + '"') +
      ' stroke-linejoin="round" stroke-linecap="round"' + (o.extra || '') + '/>';
  }
  function fold(d, o) { return path(d, 'none', { w: (o && o.w) || FOLD, stroke: (o && o.stroke) || INK, extra: ' opacity="' + ((o && o.op) || 0.55) + '"' }); }
  function ellipse(cx, cy, rx, ry, fill, o) {
    o = o || {};
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' +
      (o.stroke === false ? '' : ' stroke="' + (o.stroke || INK) + '" stroke-width="' + (o.w || W) + '"') + (o.extra || '') + '/>';
  }
  // 左右对称的部件只画观者左侧一半，右侧镜像
  function mirror(s) { return '<g transform="matrix(-1 0 0 1 240 0)">' + s + '</g>'; }
  function both(s) { return s + mirror(s); }

  function role(r) {
    if (typeof r !== 'string') return r;
    var list = (window.ZH_PEOPLE && window.ZH_PEOPLE.roles) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === r) return list[i];
    throw new Error('未知角色：' + r);
  }

  // ---------- 身体各部分 ----------
  var HEM = { round: 440, cross: 440, pangao: 322, jacket: 262 };

  function bodyPath(robe) {
    var hem = HEM[robe];
    if (robe === 'round' || robe === 'cross')
      return 'M112,104 C100,106 86,109 76,117 C78,150 81,182 82,212 C76,290 68,370 62,437 Q120,447 178,437 C172,370 164,290 158,212 C159,182 162,150 164,117 C154,109 140,106 128,104 Z';
    if (robe === 'pangao')
      return 'M112,104 C98,106 82,109 72,118 C74,150 78,182 80,210 C76,250 72,290 70,' + hem + ' Q120,' + (hem + 8) + ' 170,' + hem + ' C168,290 164,250 160,210 C162,182 166,150 168,118 C158,109 142,106 128,104 Z';
    return 'M112,104 C100,106 86,109 76,117 C78,150 81,182 82,212 C80,230 79,246 79,' + hem + ' Q120,' + (hem + 6) + ' 161,' + hem + ' C161,246 160,230 158,212 C159,182 162,150 164,117 C154,109 140,106 128,104 Z';
  }

  function legs(f, p) {
    var s = '', robe = f.robe, top = HEM[robe] - 8;
    if (robe === 'round' || robe === 'cross') return '';
    var pants = p.trim && robe === 'pangao' ? shade(p.trim, -0.1) : shade(p.robe, -0.32);
    if (f.legs === 'rolled') {
      // 卷起的裤腿，小腿赤裸
      s += both(path('M92,446 C91,420 92,396 94,372 L114,372 C114,396 115,420 115,446 Z', p.skin));
      s += path('M84,' + top + ' L156,' + top + ' L156,372 L127,372 L122,312 L118,312 L113,372 L84,372 Z', pants);
      s += both(path('M84,362 L113,362 L113,376 L84,376 Z', shade(pants, 0.18)));
      return s;
    }
    if (f.legs === 'wraps') {
      // 膝下裹腿
      s += path('M86,' + top + ' L154,' + top + ' L154,356 L127,356 L122,330 L118,330 L113,356 L86,356 Z', pants);
      var wrap = shade(p.trim || p.robe, 0.55);
      s += both(path('M88,352 L114,352 L113,444 L91,444 Z', wrap) +
        fold('M88,366 L114,360 M88,382 L114,376 M89,398 L113,392 M90,414 L113,408 M90,430 L113,424', { op: 0.5 }));
      return s;
    }
    // 长裤
    s += path('M84,' + top + ' L156,' + top + ' L154,444 L127,444 L122,312 L118,312 L113,444 L86,444 Z', pants);
    s += fold('M100,330 C99,370 99,410 100,440 M140,330 C141,370 141,410 140,440');
    return s;
  }

  function feet(f, p) {
    if (f.feet === 'bare')
      return both(path('M95,442 L113,442 C114,450 115,456 113,459 C108,462 96,462 90,460 C86,459 87,454 92,451 Z', p.skin) +
        fold('M94,457 L94,461 M98,457 L98,461', { op: 0.4 }));
    var top = f.robe === 'round' || f.robe === 'cross' ? 432 : 440;
    if (f.feet === 'boots') {
      var s = path('M94,' + top + ' L116,' + top + ' L117,455 C117,460 112,461 106,461 L90,461 C85,461 85,456 90,454 L93,450 Z', p.boots);
      if (p.bootFace) s += path('M93,450 C99,447 110,447 117,451 L117,455 C117,460 112,461 106,461 L90,461 C85,461 85,456 90,454 Z', p.bootFace);
      s += path('M88,461 L117,461', 'none', { stroke: WHITE, w: 1.4 });
      return both(s);
    }
    // 布鞋（straw 草鞋用浅色）
    var col = f.feet === 'straw' ? '#b89a5e' : p.boots;
    return both(path('M93,446 L115,446 L116,455 C116,460 112,461 106,461 L90,461 C85,461 85,456 90,454 Z', col) +
      path('M88,461 L116,461', 'none', { stroke: WHITE, w: 1.4 }));
  }

  function robeDetails(f, p) {
    var s = '', robe = f.robe;
    if (robe === 'round' || robe === 'cross') {
      s += fold('M100,236 C97,300 94,370 92,432 M140,236 C143,300 146,370 148,432 M120,250 C120,290 121,330 121,360');
      // 团领衫两侧的摆
      if (robe === 'round') s += fold('M84,240 C80,300 74,370 70,432 M156,240 C160,300 166,370 170,432', { op: 0.4 });
    } else if (robe === 'pangao') {
      s += fold('M96,230 C94,260 92,290 92,314 M144,230 C146,260 148,290 148,314');
      // 棉袄的绗线
      s += fold('M82,150 L158,150 M81,178 L159,178', { op: 0.25 });
      s += path('M70,' + HEM.pangao + ' Q120,' + (HEM.pangao + 8) + ' 170,' + HEM.pangao, 'none', { stroke: p.trim, w: 4 });
    } else {
      s += fold('M96,226 C95,240 94,252 94,260 M144,226 C145,240 146,252 146,260');
    }
    return s;
  }

  function collar(f, p) {
    var s = '';
    if (f.robe === 'round') {
      // 盘领：圆形领口，内露白色护领；右衽，前襟在穿着者右肩（观者左）斜下
      s += path('M100,104 C102,128 138,128 140,104 C134,100 106,100 100,104 Z', p.robe);
      s += path('M106,104 C108,121 132,121 134,104', 'none', { stroke: WHITE, w: 3 });
      s += path('M106,104 C108,121 132,121 134,104', 'none', { w: FOLD });
      s += fold('M103,118 C96,128 89,138 83,150', { op: 0.6 });
      return s;
    }
    // 交领右衽：外襟领缘从观者右侧颈部斜到观者左侧腋下，呈"y"字
    var band = f.robe === 'pangao' ? p.trim : f.robe === 'jacket' ? shade(p.trim || p.robe, -0.1) : p.trim;
    var end = f.robe === 'jacket' ? 214 : 206;
    s += path('M108,100 L116,100 L126,132 L120,140 Z', band);
    s += path('M128,99 L137,101 C128,140 110,176 90,' + end + ' L82,' + (end - 6) + ' C104,170 122,136 128,99 Z', band);
    s += path('M129,100 C124,120 118,134 112,146', 'none', { stroke: WHITE, w: 2.4 });
    return s;
  }

  function head(f, p) {
    var s = '';
    s += path('M112,88 L112,108 L128,108 L128,88 Z', shade(p.skin, -0.08));   // 颈
    return s;
  }
  function face(f, p) {
    var s = '', hair = '#1d1a17';
    s += ellipse(101, 76, 3.5, 6, p.skin) + ellipse(139, 76, 3.5, 6, p.skin);   // 耳
    s += path('M120,47 C132,47 140,58 140,72 C140,86 131,96 120,96 C109,96 100,86 100,72 C100,58 108,47 120,47 Z', p.skin);
    // 头发（帽下露出的鬓角）
    if (f.hat !== 'wangjin')
      s += path('M101,72 C100,56 108,48 120,48 C132,48 140,56 139,72 C136,62 129,58 120,58 C111,58 104,62 101,72 Z', hair, { w: 1 });
    // 五官，只示意，不表现相貌
    s += fold('M108,68 Q112,66 116,68 M124,68 Q128,66 132,68', { w: 1.3, op: 0.85 });
    s += fold('M109,74 Q112,72.6 115,74 M125,74 Q128,72.6 131,74', { w: 1.2, op: 0.85 });
    s += fold('M120,76 Q118.6,81 121,83', { w: 0.9, op: 0.5 });
    if (f.beard) {
      s += path('M113,87 Q117,84.5 120,86 Q123,84.5 127,87', 'none', { stroke: hair, w: 1.5 });
      s += path('M116,93 Q120,95 124,93 L121,106 Q120,108 119,106 Z', hair, { w: 0.8 });
    }
    s += fold('M116,89 Q120,90.4 124,89', { w: 1, op: f.beard ? 0.35 : 0.6 });
    return s;
  }

  function hat(f, p) {
    var h = p.hat, s = '';
    switch (f.hat) {
      case 'quji':
        // 曲脚帽：帽后两脚向上曲折
        s += both(path('M108,48 C103,42 100,36 101,30 C102,26 106,26 107,30', 'none', { stroke: INK, w: 5.4 }) +
          path('M108,48 C103,42 100,36 101,30 C102,26 106,26 107,30', 'none', { stroke: h, w: 2.6 }));
        s += path('M99,64 C98,42 108,34 120,34 C132,34 142,42 141,64 Q120,60 99,64 Z', h);
        s += path('M99,64 Q120,60 141,64 L141,58 Q120,54 99,58 Z', p.trim);
        s += fold('M108,40 C114,46 126,46 132,40', { stroke: p.trim, w: 1.2, op: 0.9 });
        break;
      case 'wusha':
        // 乌纱帽：前低后高，两侧展角
        s += both(path('M108,48 L66,43 C56,42 54,53 64,54 L108,54 Z', h));
        s += path('M105,52 L105,32 C105,25 135,25 135,32 L135,52 Z', h);
        s += path('M98,65 L98,50 C98,45 142,45 142,50 L142,65 Q120,62 98,65 Z', h);
        s += fold('M98,56 Q120,53 142,56', { stroke: '#5b544b', w: 1, op: 0.9 });
        break;
      case 'sifang':
        // 四方平定巾
        s += path('M99,64 L95,22 Q95,18 99,18 L141,18 Q145,18 145,22 L141,64 Q120,61 99,64 Z', h);
        s += fold('M108,22 L109,60 M132,22 L131,60 M97,40 L143,40', { stroke: '#5b544b', w: 1, op: 0.9 });
        break;
      case 'wangjin':
        // 网巾束发，顶上露发髻
        s += ellipse(120, 41, 9, 7, '#1d1a17', { w: 1.2 });
        s += path('M117,36 L131,34', 'none', { stroke: '#b9a36a', w: 1.6 });
        s += path('M101,70 C99,55 108,46 120,46 C132,46 141,55 139,70 L136,63 Q120,58 104,63 Z', '#2a2622', { w: 1.2 });
        s += fold('M104,62 L114,48 M110,61 L124,47 M118,60 L132,49 M126,60 L137,54 M108,50 L136,62 M103,56 L128,61 M112,47 L138,57', { stroke: '#8a8070', w: 0.6, op: 0.8 });
        s += path('M101,66 Q120,58 139,66', 'none', { stroke: '#1d1a17', w: 3.4 });
        break;
      case 'helmet':
        // 铁盔：盔顶缨枪，两侧护耳
        s += both(path('M98,58 L93,98 Q99,103 106,102 L106,62 Z', shade(p.trim || h, -0.05)) +
          fold('M96,72 L106,72 M95,84 L106,84', { op: 0.5 }));
        s += path('M120,30 L120,14', 'none', { stroke: INK, w: 3 });
        s += path('M120,8 L123,16 L117,16 Z', '#8a8f94', { w: 1 });
        s += ellipse(120, 22, 6, 5, '#b8322a', { w: 1 });
        s += path('M96,62 C95,40 106,29 120,29 C134,29 145,40 144,62 Z', h);
        s += path('M93,66 Q120,58 147,66 L146,60 Q120,53 94,60 Z', shade(h, -0.2));
        s += fold('M120,30 L120,58 M108,33 C104,42 102,50 102,58 M132,33 C136,42 138,50 138,58', { stroke: '#9aa0a6', w: 1, op: 0.8 });
        break;
      case 'douli':
        // 斗笠
        s += path('M106,66 L113,96 M134,66 L127,96', 'none', { stroke: '#4a3d2c', w: 1 });
        s += path('M50,63 L120,18 L190,63 C166,72 74,72 50,63 Z', h);
        s += fold('M120,18 L86,68 M120,18 L104,70 M120,18 L120,70 M120,18 L136,70 M120,18 L154,68 M72,52 Q120,60 168,52 M90,40 Q120,46 150,40', { w: 0.7, op: 0.5 });
        s += ellipse(120, 18, 3, 2.4, shade(h, -0.3), { w: 1 });
        break;
    }
    return s;
  }

  function badge(f, p) {
    if (!f.badge) return '';
    var s = '';
    if (f.badge === 'lion') {
      // 狮子补：方补，示意
      s += path('M98,134 L142,134 L142,178 L98,178 Z', shade(p.trim, 0.2));
      s += path('M101,137 L139,137 L139,175 L101,175 Z', 'none', { stroke: p.robe, w: 1 });
      var c = shade(p.robe, -0.15);
      s += path('M108,160 C108,150 116,148 124,150 C130,151 134,156 134,162 L134,168 L130,168 L129,162 L114,163 L113,168 L109,168 Z', c, { w: 0.6 });
      s += ellipse(112, 152, 6.5, 6, c, { w: 0.6 });
      s += path('M106,148 C103,150 103,156 106,158 M118,147 C121,149 121,155 118,157', 'none', { stroke: c, w: 1.4 });
      s += path('M133,156 C138,152 138,146 134,144', 'none', { stroke: c, w: 1.4 });
      s += path('M101,171 Q106,167 111,171 T121,171 T131,171 T139,171', 'none', { stroke: p.robe, w: 1 });
      s += ellipse(132, 142, 3.4, 3.4, p.robe, { stroke: false });
    } else {
      // 胸背花：团花，示意
      var g = p.trim;
      s += ellipse(120, 156, 21, 21, 'none', { stroke: g, w: 1.2 });
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3, x = 120 + Math.cos(a) * 11, y = 156 + Math.sin(a) * 11;
        s += ellipse(x.toFixed(1), y.toFixed(1), 6, 6, 'none', { stroke: g, w: 1.2 });
      }
      s += ellipse(120, 156, 4.5, 4.5, g, { stroke: false });
    }
    return s;
  }

  function belt(f, p) {
    var s = '';
    if (f.belt === 'horn' || f.belt === 'rhino') {
      // 革带：两侧撑开，前低后高
      var plaque = f.belt === 'rhino' ? shade(p.belt, 0.45) : '#3b3631';
      s += path('M72,206 Q120,224 168,206 L168,216 Q120,234 72,216 Z', p.belt);
      [84, 96, 108, 120, 132, 144, 156].forEach(function (x) {
        var y = 211 + 9 * (1 - Math.pow((x - 120) / 48, 2)) - 1;
        s += path('M' + (x - 4) + ',' + (y - 3) + ' l8,0 l0,7 l-8,0 Z', plaque, { w: 0.8 });
      });
      return s;
    }
    if (f.belt === 'sash') {
      var c = p.belt;
      s += path('M81,204 Q120,210 159,204 L159,218 Q120,224 81,218 Z', c);
      s += path('M100,214 C96,228 94,240 92,252 L99,253 C101,240 104,228 106,216 Z', c);
      s += path('M104,214 C106,230 108,244 110,256 L116,254 C114,240 112,228 110,215 Z', c);
      s += ellipse(105, 214, 6, 5, shade(c, 0.12));
      return s;
    }
    // 丝绦：细绳系腰，结垂两股
    var k = p.belt;
    s += path('M82,212 Q120,218 158,212', 'none', { stroke: INK, w: 4.6 }) + path('M82,212 Q120,218 158,212', 'none', { stroke: k, w: 2.6 });
    s += path('M118,216 C116,250 114,280 113,300 M122,216 C124,250 126,280 127,296', 'none', { stroke: INK, w: 3.6 });
    s += path('M118,216 C116,250 114,280 113,300 M122,216 C124,250 126,280 127,296', 'none', { stroke: k, w: 1.8 });
    s += path('M110,300 L116,300 L117,314 L109,314 Z M124,296 L130,296 L131,310 L123,310 Z', k, { w: 0.8 });
    s += ellipse(120, 216, 4.5, 3.6, k, { w: 1 });
    return s;
  }

  // ---------- 手臂 ----------
  var ARMS = {
    'down-narrow': { d: 'M80,116 C68,118 60,130 58,150 C56,190 54,230 52,262 L74,266 C76,230 80,190 84,152 C85,140 84,128 80,116 Z', hand: [63, 278, 0], cuff: 'M52,262 L74,266', folds: 'M66,152 C65,190 64,222 62,252' },
    'down-wide': { d: 'M80,116 C66,118 56,132 52,160 C48,200 43,256 41,296 C40,316 52,324 70,323 L90,320 C92,296 90,262 88,232 C87,196 86,160 86,140 C86,128 84,120 80,116 Z', hand: [76, 328, 0], cuff: 'M66,320 C76,316 84,316 90,319', folds: 'M62,170 C58,220 54,270 52,306 M74,200 C72,240 70,280 70,312' },
    'front-narrow': { d: 'M80,116 C68,118 60,132 58,152 C56,180 56,200 58,214 C62,226 72,234 84,240 L94,246 L98,228 C90,224 84,218 82,209 C82,182 84,154 84,140 C84,128 83,120 80,116 Z', hand: [100, 238, -70], cuff: 'M94,246 L98,228', folds: 'M66,160 C64,184 64,200 66,212 M72,222 C78,228 84,232 90,236' },
    'front-wide': { d: 'M80,116 C66,118 56,134 54,160 C51,196 50,236 52,272 C54,298 72,306 90,298 C94,284 95,266 96,250 L98,230 C90,226 86,220 84,212 C85,182 86,154 86,140 C86,128 84,120 80,116 Z', hand: [102, 240, -70], cuff: 'M96,250 L98,230', folds: 'M64,170 C60,210 60,250 64,284 M76,232 C78,256 82,276 86,292' }
  };
  function arm(f, p, pose) {
    var a = ARMS[pose + '-' + f.sleeve], s = '';
    s += path(a.d, p.robe);
    s += fold(a.folds);
    var cuffCol = f.robe === 'pangao' ? p.trim : f.sleeve === 'wide' ? shade(p.robe, -0.25) : null;
    if (cuffCol) s += path(a.cuff, 'none', { stroke: cuffCol, w: 4 });
    return s;
  }
  function hand(p, h) {
    return '<g transform="rotate(' + h[2] + ' ' + h[0] + ' ' + h[1] + ')">' + ellipse(h[0], h[1], 7.5, 10.5, p.skin) + '</g>';
  }

  // ---------- 器物 ----------
  var FRONT = { edict: 1, compass: 1, book: 1 };
  function frontItem(f) { for (var i = 0; i < f.items.length; i++) if (FRONT[f.items[i]]) return f.items[i]; return null; }

  function itemFront(id, p) {
    var c = p.item;
    if (id === 'edict')    // 黄绢包裹的敕书匣
      return path('M92,226 L148,226 Q151,226 151,229 L151,245 Q151,248 148,248 L92,248 Q89,248 89,245 L89,229 Q89,226 92,226 Z', c) +
        path('M110,226 L110,248 M130,226 L130,248', 'none', { stroke: '#a8322a', w: 2.2 }) +
        fold('M95,232 L146,232', { op: 0.35 });
    if (id === 'compass')  // 水罗盘：木盘盛水，磁针浮于水面
      return ellipse(120, 247, 25, 10, c) + ellipse(120, 245, 19, 6.5, '#8fb3b4', { w: 0.8 }) +
        path('M110,246 L130,244', 'none', { stroke: '#a8322a', w: 1.6 }) +
        fold('M96,249 Q120,259 144,249', { op: 0.5 });
    if (id === 'book')     // 线装簿册
      return path('M94,222 L146,222 L146,256 L94,256 Z', '#3b4d63') +
        path('M128,226 L139,226 L139,246 L128,246 Z', c, { w: 0.8 }) +
        fold('M99,224 L99,254 M94,231 L99,231 M94,239 L99,239 M94,247 L99,247', { stroke: c, op: 0.9 });
    return '';
  }
  function itemsBehind(f, p) {
    var s = '';
    if (f.items.indexOf('spear') >= 0)   // 长枪：执于观者左手
      s += path('M59,40 L59,456', 'none', { stroke: INK, w: 5.4 }) + path('M59,40 L59,456', 'none', { stroke: '#8a6a44', w: 3 }) +
        path('M59,6 C64,16 65,30 59,42 C53,30 54,16 59,6 Z', '#9aa0a6') +
        path('M59,44 C66,50 68,58 64,64 L54,64 C50,58 52,50 59,44 Z', '#b8322a', { w: 1 });
    return s;
  }
  function itemsWaist(f, p) {
    var s = '';
    if (f.items.indexOf('sword') >= 0)   // 腰刀：佩于观者右侧
      s += path('M129,192 L134,214', 'none', { stroke: INK, w: 6 }) + path('M129,192 L134,214', 'none', { stroke: '#5b3b26', w: 3.6 }) +
        path('M133,218 C140,280 146,340 150,402 L144,403 C140,340 134,280 129,219 Z', '#3a2a1f') +
        ellipse(133, 216, 6, 2.6, '#c9a54a', { w: 1 }) +
        path('M135,262 L141,261 M144,380 L150,379', 'none', { stroke: '#c9a54a', w: 2.4 });
    if (f.items.indexOf('gun') >= 0)     // 手铳：插在腰带上
      s += '<g transform="rotate(28 146 214)">' + path('M134,210 L162,210 L162,218 L134,218 Z', '#8a6a3a') +
        ellipse(140, 214, 5.5, 5.5, '#8a6a3a') + path('M126,212 L134,212 L134,216 L126,216 Z', '#5b3b26', { w: 1 }) + '</g>';
    if (f.items.indexOf('book') >= 0 && frontItem(f) !== 'book')   // 针簿插在腰带上
      s += '<g transform="rotate(-12 148 214)">' + path('M140,200 L158,200 L158,226 L140,226 Z', '#3b4d63') +
        path('M150,203 L155,203 L155,214 L150,214 Z', p.item, { w: 0.6 }) + '</g>';
    if (f.items.indexOf('medbox') >= 0)  // 药箱背带
      s += path('M88,118 L160,246', 'none', { stroke: INK, w: 6 }) + path('M88,118 L160,246', 'none', { stroke: '#7a5a3a', w: 3.8 });
    return s;
  }
  function itemsFrontSide(f, p) {
    var s = '';
    if (f.items.indexOf('medbox') >= 0)
      s += path('M140,244 L180,244 L180,282 L140,282 Z', p.item) + path('M140,252 L180,252', 'none', { w: 1.2 }) +
        ellipse(160, 266, 3, 3, '#c9a54a', { w: 0.8 });
    if (f.items.indexOf('rope') >= 0) {  // 缆绳一盘挂在观者左手
      var r = p.item;
      for (var i = 0; i < 4; i++) s += ellipse(58 - i, 306 + i * 2, 17 - i * 0.6, 26 - i, 'none', { stroke: INK, w: 4.6 }) + ellipse(58 - i, 306 + i * 2, 17 - i * 0.6, 26 - i, 'none', { stroke: r, w: 2.8 });
      s += path('M64,332 C66,360 60,380 66,404', 'none', { stroke: INK, w: 4.6 }) + path('M64,332 C66,360 60,380 66,404', 'none', { stroke: r, w: 2.8 });
    }
    return s;
  }

  // ---------- 组装 ----------
  function draw(r) {
    var f = r.figure, p = r.palette, pose = frontItem(f) ? 'front' : 'down';
    var armSvg = arm(f, p, pose), a = ARMS[pose + '-' + f.sleeve];
    var s = '';
    s += '<ellipse cx="120" cy="462" rx="58" ry="6" fill="#000" opacity="0.12"/>';
    s += itemsBehind(f, p);
    s += legs(f, p) + feet(f, p);
    s += head(f, p);
    s += path(bodyPath(f.robe), p.robe) + robeDetails(f, p);
    s += collar(f, p);
    s += face(f, p) + hat(f, p);
    s += badge(f, p) + belt(f, p) + itemsWaist(f, p);
    s += both(armSvg);
    var fi = frontItem(f);
    if (fi) s += itemFront(fi, p);
    s += hand(p, a.hand) + mirror(hand(p, a.hand));
    s += itemsFrontSide(f, p);
    if (f.items.indexOf('rope') >= 0) s += hand(p, a.hand);   // 手压在缆绳上
    return s;
  }

  // 每个部件的标注起点
  function anchors(r) {
    r = role(r);
    var f = r.figure, pose = frontItem(f) ? 'front' : 'down', a = {};
    a.hat = { quji: [100, 30], wusha: [58, 48], sifang: [96, 30], wangjin: [104, 56], helmet: [98, 44], douli: [62, 60] }[f.hat];
    a.robe = f.robe === 'jacket' ? [86, 244] : f.robe === 'pangao' ? [80, 290] : [80, 380];
    if (f.badge) a.badge = [140, 146];
    a.belt = f.belt === 'cord' ? [127, 296] : f.belt === 'sash' ? [156, 212] : [166, 212];
    a.boots = f.feet === 'bare' ? [138, 410] : [138, 455];
    if (f.items.indexOf('edict') >= 0) a.item = [148, 236];
    else if (f.items.indexOf('compass') >= 0) a.item = [140, 244];
    else if (f.items.indexOf('book') >= 0) a.item = [140, 230];
    else if (f.items.indexOf('medbox') >= 0) a.item = [178, 270];
    else if (f.items.indexOf('rope') >= 0) a.item = [44, 300];
    if (f.items.indexOf('sword') >= 0) a.weapon = [148, 372];
    else if (f.items.indexOf('spear') >= 0) a.weapon = [59, 24];
    if (pose === 'down' && f.sleeve === 'wide') a.robe = [86, 400];
    return a;
  }

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // 标注：各部件取 costume 里第一条同部件的名称；同侧按高度排开，最小间距 26
  function callouts(r, mode) {
    var an = anchors(r), seen = {}, items = [];
    r.costume.forEach(function (c, i) {
      var key = c.part === 'armor' ? 'robe' : c.part;
      if (seen[key] || !an[key]) return;
      seen[key] = 1;
      items.push({ i: i, part: c.part, name: c.name, at: an[key], side: an[key][0] < 120 ? 'l' : 'r' });
    });
    var s = '';
    if (mode === 'numbers') {
      items.forEach(function (it, n) {
        s += '<g class="fig-mark" data-part="' + it.part + '" data-i="' + it.i + '"><circle cx="' + it.at[0] + '" cy="' + it.at[1] + '" r="8" fill="currentColor"/>' +
          '<text x="' + it.at[0] + '" y="' + (it.at[1] + 3.6) + '" text-anchor="middle" font-size="10" font-weight="700" fill="var(--paper, #fff)" font-family="system-ui, sans-serif">' + (n + 1) + '</text></g>';
      });
      return { svg: s, items: items };
    }
    ['l', 'r'].forEach(function (side) {
      var list = items.filter(function (it) { return it.side === side; }).sort(function (a, b) { return a.at[1] - b.at[1]; });
      var y = -Infinity;
      list.forEach(function (it) { it.y = Math.max(it.at[1], y + 26); y = it.y; });
      var over = y - 466;
      if (over > 0) list.forEach(function (it) { it.y -= over; });
      list.forEach(function (it) {
        var x0 = side === 'l' ? -6 : 246, tx = side === 'l' ? -10 : 250;
        s += '<g class="fig-callout" data-part="' + it.part + '" data-i="' + it.i + '">' +
          '<circle cx="' + it.at[0] + '" cy="' + it.at[1] + '" r="2.4" fill="currentColor"/>' +
          '<path d="M' + it.at[0] + ',' + it.at[1] + ' L' + (side === 'l' ? Math.min(it.at[0] - 10, 30) : Math.max(it.at[0] + 10, 210)) + ',' + it.y + ' L' + x0 + ',' + it.y + '" fill="none" stroke="currentColor" stroke-width="0.8"/>' +
          '<text x="' + tx + '" y="' + (it.y + 4) + '" text-anchor="' + (side === 'l' ? 'end' : 'start') + '" font-size="12" fill="currentColor" font-family="var(--f-ui, system-ui, sans-serif)">' + esc(it.name) + '</text></g>';
      });
    });
    return { svg: s, items: items };
  }

  function svg(r, o) {
    r = role(r); o = o || {};
    var mode = o.annotate || false, vb = mode === 'labels' ? '-150 0 540 480' : '0 0 240 480';
    var c = mode ? callouts(r, mode) : null;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" class="fig fig-' + r.id + '" role="img" aria-label="' + esc(r.name + '服饰示意') + '">' +
      (o.title === false ? '' : '<title>' + esc(r.name + '：' + r.costume.map(function (x) { return x.name; }).join('、')) + '</title>') +
      '<g class="fig-body">' + draw(r) + '</g>' + (c ? c.svg : '') + '</svg>';
  }

  return { svg: svg, anchors: anchors, callouts: function (r, m) { return callouts(role(r), m || 'labels').items; }, shade: shade };
})();
