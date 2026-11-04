# worldmap · 统一世界底图

一张可复用的世界底图：真实地形晕渲加分层设色的栅格底图，叠加海岸、湖泊、河流（中文名）、山脉与海洋注记，以及按年份保存的政局数据。形式仿照 `songjin-zhizhan` 全景图（`main-ubbrbw` 分支）：地形用图片，其余一律是 SVG 矢量，注记和符号不随缩放变大。

本模块不依赖 Leaflet，也不依赖郑和项目的其他文件，可以整个目录复制到其他项目中使用。

## 用法

```html
<link rel="stylesheet" href="worldmap/worldmap.css">
<div id="map" style="height: 600px"></div>
<script src="worldmap/geo/world.geo.js"></script>
<script src="worldmap/polities/1415.js"></script>   <!-- 可选 -->
<script src="worldmap/worldmap.js"></script>
<script>
  var wm = WorldMap.mount(document.getElementById('map'), { base: 'worldmap/', view: [30, -12, 125, 42] });
  wm.setPolities(WM_POLITIES['1415'], { mode: 'states' });
  wm.line([[118.78, 32.06], [121.3, 31.52]], { cls: 'my-route', layer: 'routes' });
  wm.label('南京', 118.78, 32.06, { rank: 2 });
  wm.on('polity', function (props) { console.log(props.name); });
</script>
```

接口详见 `docs/SPEC.md` §2.4：`project`、`unproject`、`fit`、`layer`、`symbol`、`label`、`line`、`setPolities`、`setPolityMode`、`zoomBy`、`on('zoom' | 'move' | 'click' | 'polity')`、`refresh`、`destroy`。

## 投影

等距圆柱投影，标准纬线 ±30°：`x = (经度 + 180) × 10 × cos 30°`，`y = (90 − 纬度) × 10`。整个世界是 3117.7 × 1800 个世界单位。注记分级、细图切换都按绝对比例尺（屏幕像素 / 世界单位）判断，手机与桌面在同一比例尺下显示相同内容。

## 文件

| 文件 | 内容 | 来源 |
|---|---|---|
| `assets/terrain_world.jpg` | 全球底图，1 像素 = 0.1° 纬度 | 生成 |
| `assets/terrain_io.jpg` | 印度洋—东亚细图（20—150°E，20°S—55°N），1 像素 = 0.04° | 生成 |
| `geo/world.geo.js` | `WM_GEO`：陆地、湖泊、河流、山脉与海洋注记 | 生成 |
| `polities/<年份>.mjs` | 政局源数据（手绘范围、简介、分类） | 手写 |
| `polities/<年份>.js` | `WM_POLITIES[年份]`：裁剪、去重、配色后的 GeoJSON | 生成 |
| `scripts/` | 下载与生成脚本 | — |

## 重新生成

```bash
python3 -I worldmap/scripts/fetch_world.py
```

```bash
python3 -I worldmap/scripts/build_world.py
```

```bash
node worldmap/scripts/build_polities.mjs 1415 --center ming --ports js/data.js
```

第一步下载约 36 MB 原始数据到 `worldmap/data/raw/`（不入库）。第二步需要 numpy、scipy、Pillow；第三步需要 npm 包 `polygon-clipping`（已列入项目 `devDependencies`）。

## 新增一个年份的政局

1. 复制 `polities/1415.mjs` 为新的年份文件，修改各政权的范围和说明；数组顺序即优先级，小政权放在前面。
2. 运行 `build_polities.mjs <年份>`，在页面中加载 `polities/<年份>.js`。
3. `tags` 字段由各项目自行定义；本项目用 `tags.rel` 表示与明朝的关系，引擎只把它变成 `rel-*` 样式类。

## 数据来源

- 地形：AWS Open Data Terrain Tiles（Terrarium 编码，源自 SRTM、GMTED、ETOPO1 等）。
- 海岸、湖泊、河流：Natural Earth（公有领域）。
- 政局范围：参照通行历史地图集手绘，只表示大致范围；详细程度分为 `core`（亚非沿岸）与 `coarse`（其他地区）。
