# 接口、数据格式与样式规范

配合 [`ROADMAP.md`](ROADMAP.md) 使用。新代码都按本文约定写；改动约定时，先改本文，再改代码。

---

## 1 总体结构

### 1.1 目录

```
index.html              航海图（Leaflet，已有）
world.html              天下全图：1415 年世界政局（A）
voyages.html            航次档案（B）
fleet.html              舰队复原 3D（C）
people.html             人物复原（D）

css/base.css            共用：设计令牌、页眉导航、按钮、引文、标签页、弹窗（E1）
css/style.css           航海图专用（已有）
css/<page>.css          其他页面专用

js/data.js              港口、海道、七次航程、大事、年表（已有）
js/route.js             海道最短路径与平滑（已有）
js/stats.js             航程统计 ZHStats（B2）
js/voyages-detail.js    航次档案数据 ZH_DETAIL（B1）
js/fleet-data.js        船型与舰队构成 ZH_FLEET（C1、C4）
js/people-data.js       人物角色 ZH_PEOPLE（D1）
js/nav.js               共用页眉导航与昼夜切换（E1）

worldmap/               可复用的世界底图模块，不依赖本项目其他文件
  README.md             本模块的独立说明（内容同本文 §2、§3）
  worldmap.js           渲染引擎 WorldMap（A4）
  worldmap.css          底图图层样式
  geo/world.geo.js      矢量：陆地、海岸、湖泊、河流（生成，A3）
  assets/terrain_*.jpg  地形底图（生成，A2）
  polities/1415.mjs     1415 年政局源数据（手写，A5）
  polities/1415.js      裁剪配色后的政局（生成，A6）
  scripts/              fetch_world.py、build_world.py、build_polities.mjs
  data/raw/             原始下载数据（git 忽略）

three/ships.js          参数化船体（C2）
three/fleet.js          舰队场景（C5）
three/figures.js        3D 人物（D3）
three/scene.js          共用：渲染器、相机、灯光、海面、自适应画质

art/people/<role>.svg   2D 人物立绘（D2）
vendor/leaflet/         Leaflet 1.9.4（已有）
vendor/three/           three.js 0.160.0（E2）
tools/                  构建与校验脚本
docs/                   本文与任务清单
```

### 1.2 普通脚本与全局变量

- 数据文件是普通 `<script>`，各自挂一个全局对象，不互相改写：`ZH`、`ZHRoute`、`ZHStats`、`ZH_DETAIL`、`ZH_FLEET`、`ZH_PEOPLE`、`WorldMap`、`WM_GEO`、`WM_POLITIES`。
- 加载顺序：`vendor` → `worldmap/geo` 与 `polities` → `js/data.js` → `js/route.js` → 其他数据 → 页面脚本。
- 页面脚本用 IIFE 包起来，除上面列出的全局对象外不新增全局变量。

### 1.3 three.js（ES 模块）

3D 页面用 import map，路径都相对页面：

```html
<script type="importmap">
{ "imports": {
    "three": "./vendor/three/three.module.min.js",
    "three/addons/": "./vendor/three/addons/"
} }
</script>
<script type="module" src="three/fleet-page.js"></script>
```

3D 模块只从 `three` 导入，数据仍从全局对象读取（`window.ZH_FLEET` 等）。

### 1.4 坐标顺序

- **新代码一律用 `[经度, 纬度]`**（GeoJSON 顺序）。
- 现有 `js/data.js` 的 `at: [纬度, 经度]` 是 Leaflet 顺序，保留不改；读取时用 `ZH.ll(p)`（待加的小工具）转换，不要就地改数组。

---

## 2 世界底图 `worldmap/`

### 2.1 投影

等距圆柱投影，标准纬线 ±30°。世界坐标单位记作 u：

```
K   = 10                     // 每度纬度 10 u
C   = cos(30°) ≈ 0.8660      // 经向压缩
x   = (lon + 180) × K × C    // 0 … 3117.7
y   = (90 − lat)  × K        // 0 … 1800
```

- 整个世界是 3117.7 × 1800 u 的画布，北向上，经度 −180° 到 180°（不跨日界线拼接）。
- 赤道附近东西方向约放大 15%，纬度 30° 处形状不变，中纬度（中国、地中海）基本不变形。
- 换算函数只有 `WorldMap.project(lon, lat)` 和 `WorldMap.unproject(x, y)` 两个，其他代码不要自己写公式。

### 2.2 地形底图（栅格）

| 文件 | 范围（经度、纬度） | 分辨率 | 用途 |
|---|---|---|---|
| `terrain_world.jpg` | −180—180°，−90—90° | 1 像素 = 1 u（0.1°） | 全球，缩放 < 2 时 |
| `terrain_io.jpg` | 20—150°E，20°S—55°N | 1 像素 = 0.4 u（0.04°） | 印度洋—东亚，缩放 ≥ 2 时 |

- 渲染方法同 `songjin-zhizhan/scripts/build_geodata.py`：Terrarium 高程 → 双光源晕渲（西北 315° 和正北 0°）× 分层设色；海面近岸浅、远海深。
- 陆地色阶（高程 m → 颜色）：`-1 #dde3c4 · 0 #dde3c4 · 20 #e1e4c3 · 60 #e8e4bf · 120 #e9dcb0 · 220 #dfc897 · 380 #d2b482 · 600 #c09d6d · 900 #a9875c · 1400 #977a58 · 2500 #8a7660 · 4500 #9a8f84 · 6000 #b4aca2`。海面：近岸 `#d3dfd8`，远海 `#a7c0bd`。
- 底图只有一套（日间色调）；夜间模式在 CSS 里加滤镜：`filter: brightness(.55) saturate(.8) contrast(1.05)`。
- 底图边界写在 `WM_GEO.rasters` 中，见 §2.3。

### 2.3 矢量数据 `geo/world.geo.js`

```js
window.WM_GEO = {
  proj: { K: 10, C: 0.8660254, phi0: 30 },     // 与 §2.1 一致，供校验
  rasters: [
    { id: 'world', src: 'assets/terrain_world.jpg', box: [0, 0, 3117.7, 1800], minScale: 0 },
    { id: 'io',    src: 'assets/terrain_io.jpg',    box: [x0, y0, w, h],        minScale: 0.9 }   // minScale：屏幕像素/世界单位
  ],
  land:   'M…z…',                // 陆地轮廓（SVG path，世界坐标，用于裁剪疆域）
  coast:  'M…',                  // 海岸线（描边用）
  lakes:  'M…z…',
  rivers: [ { n: '尼罗河', en: 'Nile', w: 2, d: 'M…', ld: 'M…', len: 512 } ],  // w：1 小河，2 大河；d：全部河段；ld：最长一段，沿线注记用；len：最长段长度（u）
  ranges: [ { n: '喜马拉雅山脉', at: [84.5, 28.6], rot: -14, rank: 1 } ],  // 山脉、高原、沙漠注记，[经度, 纬度]，旋转角度，显示级别
  seas:   [ { n: '印度洋', at: [78, -15], rank: 1 } ]
};
```

- 路径用相对坐标（`l dx,dy`），保留 1 位小数。
- 河流只保留有中文通行译名的主要河流；中文名表放在 `build_world.py` 的 `RIVER_ZH` 中。

### 2.4 引擎接口 `worldmap.js`

```js
const wm = WorldMap.mount(container, {
  view: [lonW, latS, lonE, latN],   // 初始视野
  minZoom: 1, maxZoom: 12,          // 相对于"全图正好放下"的倍数
  theme: 'auto'                     // 'auto' | 'light' | 'dark'
});

wm.project(lon, lat)        // → [x, y]（世界坐标 u）
wm.unproject(x, y)          // → [lon, lat]
wm.layer(name)              // → <g>，name 见 §2.5
wm.fit([lonW, latS, lonE, latN], { pad: 40, animate: true })
wm.zoom                     // 当前缩放倍数（只读）
wm.on('zoom' | 'move' | 'click' | 'polity', fn)   // polity：点击政权色块，回调参数为该政权的 properties
wm.symbol(el, lon, lat, { rot })   // 放置不随缩放变大的符号（注记、城池、箭头标签）
wm.label(text, lon, lat, { cls, rank })  // 带避让的注记；rank 1—3，缩放不够时隐藏
wm.line(lonlats, { cls, layer })   // 折线，返回 <path>
wm.setPolities(fc, { mode: 'states' | 'rel' | 'off' })
wm.setPolityMode(mode)
wm.zoomBy(factor)
wm.refresh()
wm.destroy()
```

- 平移缩放：鼠标滚轮或触控板、拖动、双指捏合、双击放大；键盘 `+`、`-`、方向键。
- 符号层用"反缩放"：`translate(x,y) scale(1/zoom)`，与 `songjin-zhizhan` 的 `addPSym` 相同思路。
- 引擎不依赖 Leaflet，也不依赖本项目的 `ZH` 等数据。

### 2.5 图层顺序（自下而上）

| 名称 | 内容 |
|---|---|
| `terrain` | 栅格底图 |
| `water` | 湖泊、河流 |
| `polities` | 疆域色块（裁剪到 `land`）、斜线或点纹、疆界虚线 |
| `coast` | 海岸线（压在疆域之上，保持实线） |
| `lines` | 长城等线状要素 |
| `routes` | 航线、行军路线 |
| `marks` | 城池、港口、事件印章 |
| `labels` | 政权名、海名、山名、河名 |
| `ui` | 比例尺、指北针（屏幕坐标） |

---

## 3 政局数据

### 3.1 源文件 `worldmap/polities/<年份>.mjs`

```js
export default {
  year: 1415,
  title: '约 1415 年',
  note: '依据通行历史地图集手绘，边界为示意。',
  polities: [
    {
      id: 'ming',                 // 小写英文，全局唯一
      name: '明朝',               // 当时的汉文称谓（明代文献用名优先）
      alt: '大明 · 永乐年间',      // 别名、王朝名、今地
      label: '大 明',             // 地图注记；'' 表示不单独注记（如与港口同名的城邦）
      rank: 1,                    // 1 全图可见；2 中等缩放；3 放大后
      lp: [112.5, 31.0],          // 注记位置 [经度, 纬度]
      kind: 'empire',             // empire | kingdom | sultanate | khanate | city | confederation | tribal
      suzerain: null,             // 宗主国 id；有值时按 style 画附属纹
      style: 'fill',              // fill 实色 | hatch 斜线（附属）| dots 点纹（藩属）
      detail: 'core',             // core 核心区 | coarse 粗略区
      tags: { rel: 'ming' },      // 项目自定义分类，引擎不解释；本项目用 rel，见 §3.3
      desc: '……',
      src: ['《明史·地理志》'],
      outline: [[lon, lat], …]    // 或多段：[[[lon, lat], …], [[lon, lat], …]]
    }
  ]
};
```

- 数组顺序即优先级：靠前的先占地，后面的扣除重叠部分。城邦、小国放在前面。
- `outline` 可以伸到海里，生成时会用 `WM_GEO.land` 裁掉。

### 3.2 生成文件 `worldmap/polities/<年份>.js`

```js
window.WM_POLITIES = window.WM_POLITIES || {};
window.WM_POLITIES['1415'] = {
  type: 'FeatureCollection', year: 1415, title: '约 1415 年',
  features: [ { type: 'Feature',
    properties: { …源文件字段（不含 outline）, c: 3, ports: ['guli'] },  // c：配色序号 0—8；0 固定给 rank 最高的中心政权
    geometry: { type: 'MultiPolygon', coordinates: [ … ] } } ]          // [经度, 纬度]，两位小数
};
```

### 3.3 本项目的 `rel` 分类

| 值 | 含义 | 颜色令牌 |
|---|---|---|
| `ming` | 明朝直辖（含交趾） | `--rel-ming` |
| `visit` | 郑和船队到访 | `--rel-visit` |
| `loose` | 明朝羁縻（都司、卫所、宣慰司） | `--rel-loose` |
| `tribute` | 遣使往来 | `--rel-tribute` |
| `other` | 其他 | `--rel-other` |

---

## 4 航次档案

### 4.1 `js/voyages-detail.js`

```js
window.ZH_DETAIL = {
  1: {
    personnel: {
      total: { n: 27800, approx: true, text: '二万七千八百余人', src: '《明史·郑和传》' },
      groups: [ { role: '官校旗军', n: null, src: null, note: '史料未分项' } ]
    },
    officials: [
      { name: '郑和', title: '正使太监', role: '统帅', src: '长乐《天妃灵应之记》碑' }
    ],
    fleet: {
      total: { n: null, text: '众说不一', src: null },
      large: { n: 62, text: '修四十四丈、广十八丈者六十二', src: '《明史·郑和传》' },
      note: ''
    },
    results: [
      { kind: 'battle', text: '旧港擒陈祖义', ev: 'chenzuyi', src: '《明太宗实录》' }
      // kind：conferral 册封 | tribute 朝贡 | envoy 遣使 | battle 用兵 | trade 贸易 | stele 立碑 | other
    ],
    sources: [ { t: '原文……', s: '出处' } ]
  }
  // … 2—7
};
```

规则：

- `n` 只写史料中的数字；史料写"余"时 `approx: true`，原文写进 `text`。
- 史料未载的写 `n: null`，界面显示"史料未载"，不显示 0。
- `ev` 引用 `ZH.events` 的 `id`，用于跳转地图。

### 4.2 `js/stats.js`：`ZHStats`

```js
ZHStats.voyage(n) → {
  km:   { out: 9800, ret: 9600, branch: 7200, total: 26600 },   // 公里，按示意航线
  nm:   { … },                     // 海里（km / 1.852）
  li:   { … },                     // 明里（1 明里 ≈ 0.576 km）
  months: 25,                      // 受命至回国的月数（按 t0、t1）
  days: { sea: 260, port: 300 } | null,   // 仅有逐日记录的航次（第七次）
  stops: 18, countries: 15         // 停靠次数、所到国家与地区数（含分䑸）
}
ZHStats.all() → [ voyage(1) … voyage(7) ]
```

界面上里程一律标"按示意航线估算"。

---

## 5 舰队（2026-11-04 实现约定）

### 5.1 数据与证据

`js/fleet-data.js` 挂载 `ZH_FLEET`，依赖 `ZH_DETAIL`。`sources` 保存出处标题、链接和适用限制。`types` 包含 `baochuan`、`machuan`、`liangchuan`、`zuochuan`、`zhanchuan`。

每个船型有 `name`、`role`、`variants`、`model` 和 `src`。每个尺度方案含 `L`、`B`（米）、`label`、`evidence`、`src`。宝船 `estimated` 为金国平文章第557页介绍的61.2×13.8米解释，`recorded` 按《明史》44丈×18丈、尺长0.311米折算为136.84×55.98米，不混同44丈4尺的另一版本。其余四类船尺度明确为建模假设，不称为研究定论。

`model` 保存展示桅数、船楼层数、隔舱数、用途布置和假设说明。吃水、干舷及构件比例由模型的长度比例推定；并非原船图纸。五至九桅采用传统模型展示体系，不能作为同时代实测证据。

### 5.2 七次舰队

`voyages[n].recorded` 含 `n`、`text`、`src`、`scope`；未知数量为 null。第一次62艘为大舶数，第二次249艘为改造数（不能当出航数），第三次48号为海舶记载。其余保留未载。

`model` 是船型到数量的映射，`estimate: true`、`basis` 必填。现用250艘统一教学编成；七次共用同一假设，不能用于比较历史规模。记载模式的重复船形仅是计数符号，不断言全部同型。

### 5.3 模型接口

`buildShip(typeId, { variant: 'estimated' | 'recorded', lod: 0 | 1 | 2, cutaway: boolean })` 返回 `THREE.Group`。

- +X 船首、+Y 向上、+Z 右舷、水线 y=0，1单位=1米。
- `userData` 提供 `L`、`B`、`groups`、`anchors`。构件键为 hull/sails/bulkheads/rudder/anchor/cabins。
- 同一构件内按材质合并几何体，保留构件点击；近景宝船约20,409三角面。
- `lod=0` 全细节；`1` 减少索具、货物和细节；`2` 舰队远景。
- `disposeObject` 释放共享几何体和材质；`triangleCount` 用于预算检查。

`buildFleet(n, { mode, variant, filter, spacing, lod })` 返回实例化舰队，`userData.count` 是实际展示数。布局按最大船长船宽留间距，并非历史阵型。当前舰队采用低细节，点击可进入单船全细节查看。

### 5.4 页面与渲染

`fleet.html#mode=fleet&v=3` 直达第三次；`ship=baochuan&scale=recorded` 选择船型与尺度；`counts=estimated` 选择教学编成。

`js/fleet-info.js` 为普通脚本，独立渲染文字资料；三维上下文不可用时仍能查看船型和航次。`three/scene.js` 提供相机、光照、海面、昼夜同步、尺寸适配和低帧率降级。移动端限制像素比，隐藏页面暂停渲染。资料出处不依赖在线请求，外部链接只用于查阅。

---

## 6 人物 `ZH_PEOPLE`

```js
window.ZH_PEOPLE = {
  roles: [
    {
      id: 'eunuch-envoy', name: '正使太监', example: '郑和、王景弘',
      rank: '内官监太监（正四品）',
      duty: '统领全军，宣读诏敕，主持册封与赏赐',
      costume: [
        { part: 'hat',  name: '乌纱帽 / 三山帽', note: '……', src: '刘若愚《酌中志》' },
        { part: 'robe', name: '曳撒',           note: '……', src: '……' },
        { part: 'belt', name: '革带',           note: '……', src: '……' },
        { part: 'boots', name: '皂靴',          note: '……', src: '……' }
      ],
      items: [ { name: '诏敕', note: '……' } ],
      palette: { robe: '#7d1f1a', trim: '#c9a54a', hat: '#1f1d1a' },   // 插画与 3D 共用
      svg: 'art/people/eunuch-envoy.svg',
      caution: '郑和无同时代画像传世，此为职官典型服饰示意'
    }
  ]
};
```

角色 `id`：`eunuch-envoy` 正使太监 · `eunuch-deputy` 副使太监 · `commander` 都指挥 · `soldier` 旗军 · `pilot` 火长 · `interpreter` 通事 · `physician` 医官 · `sailor` 水手或舵工。

`part` 取值：`hat` 冠帽 · `robe` 袍服 · `badge` 补子 · `belt` 腰带 · `boots` 靴鞋 · `armor` 甲胄 · `weapon` 兵器 · `item` 器物。

`buildFigure(roleId, { lod })` 读 `palette`，返回高约 1.7 米的 `THREE.Group`，脚底在 y = 0。

---

## 7 样式

### 7.1 设计令牌

所有颜色都写成 `css/base.css` 里的令牌，并在 `:root`、`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`、`:root[data-theme="dark"]` 三处定义。现有令牌：

| 类别 | 令牌 |
|---|---|
| 纸与墨 | `--paper` `--paper-2` `--ink` `--ink-2` `--muted` `--rule` |
| 海图 | `--sea` `--land` `--coast` `--shore` `--grat` |
| 强调 | `--accent`（石青）`--seal`（朱砂，只用于印章和用兵） |
| 七次航程 | `--v1` … `--v7` |
| 政权配色 | `--pc0` … `--pc8`；`--rel-ming` `--rel-visit` `--rel-loose` `--rel-tribute` `--rel-other`；`--pol-border` |

新增令牌：

| 令牌 | 用途 |
|---|---|
| `--river` `--lake` | 世界底图水系 |
| `--hatch` `--dots` | 附属、藩属纹样颜色 |
| `--wood` `--lacquer` `--sail` `--rope` | 3D 船体材质基色（3D 中从 CSS 读取一次） |
| `--chart-1` … `--chart-4` | 航次档案图表（按 dataviz 规范，明暗各一套） |

### 7.2 字体与字号

- 标题与大字注记：`--f-display`（马善政楷书，回退到系统楷体）。只用于页面标题、航次序号、全图上的一级政权名。
- 正文：`--f-body`（思源宋体，回退到宋体）。
- 界面小字、数据：`--f-ui`（系统无衬线），数字用 `font-variant-numeric: tabular-nums`。
- 字号阶梯：12 / 13 / 15 / 17 / 21 / 28 / 40 px（`--t-xs` … `--t-2xl`）。

### 7.3 地图注记

| 类 | 用于 | 样式 |
|---|---|---|
| `.wm-big` | rank 1 政权 | 楷书 18—30 px，字距 0.3em，描边光晕 |
| `.wm-sub` | rank 2—3 政权、附注 | 宋体 11—13 px，`--ink-2` |
| `.wm-sea` | 海洋名 | 宋体 13—16 px，`--accent`，字距 0.4em |
| `.wm-river` | 河名 | 沿河 `textPath`，11 px，`--river` |
| `.wm-range` | 山脉 | 宋体 11 px，按 `rot` 旋转 |
| `.wm-city` | 都城（圆圈套点）、城市（方块） | 与 `songjin-zhizhan` 的 `.pcity` 相同 |

注记都用 `paint-order: stroke` 加纸色光晕，保证压在地形上仍可读。

### 7.4 2D 人物插画

- 画布 `viewBox="0 0 240 480"`，人物脚底在 y = 460，头顶约 y = 40（统一比例便于并排比较）。
- 平涂加墨线：轮廓线 1.6 px `--ink`，内部褶皱线 0.8 px；不用渐变和照片质感。
- 颜色只取角色 `palette` 与令牌；夜间模式只换背景与墨线，不改服饰本色。
- 标注线从部件引出到两侧，标注文字用 `--f-ui` 12 px；标注内容来自 `costume[].name`。

### 7.5 3D 视觉

- 光照：一盏暖色主光（模拟午后日光）加半球环境光；海面为低多边形加法线扰动，不用高成本反射。
- 船体材质基色：木 `#6b4a2b`，漆 `#8e2b20`，帆 `#c9b48a`，缆 `#3b2f22`；夜间模式只调背景与环境光。
- 所有 3D 视图右下角固定显示"示意复原"字样和比例尺。

---

## 8 书写约定

- **日期**：公历在前、年号在后，如"1405 年 7 月 11 日 · 永乐三年六月十五日"。1582 年以前的公历按儒略历。
- **出处**：书名用《》，碑刻写"地点《碑名》"，如"长乐《天妃灵应之记》碑"；今人研究写"作者《书名》"。
- **不确定**：用"一说""约""估计""示意"，不用问号。
- **数字**：史料原文保留汉字数字（写进 `text`），界面数字用阿拉伯数字。
- **地名**：首次出现写"古名（今地）"，如"古里（今印度卡利卡特）"。

---

## 9 构建与发布

- `node tools/check-routes.mjs`：航线不穿陆地（已有）。
- `node worldmap/scripts/build_polities.mjs 1415 --center ming --ports js/data.js`：生成政局数据（取代已删除的 tools/build-polities.mjs）。
- `npm run build`：为现有每个页面生成 `dist/<page>.html`（离线单文件），并生成 Artifact 多文件发布包 `dist/artifact/`。
- 世界底图：`python3 -I worldmap/scripts/fetch_world.py`，然后 `python3 -I worldmap/scripts/build_world.py`（需要 numpy、scipy、matplotlib、Pillow）。
- 提交前：对改过的页面截图检查（桌面 1440×900、手机 390×844，昼夜各一张），确认控制台没有报错、页面没有横向滚动。
