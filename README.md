# 七下西洋 · 郑和船队交互航海图

本站用交互地图、图表和三维模型，详细呈现郑和于明永乐三年至宣德八年（1405—1433）七次下西洋的经过：航线、停靠港口、分船队（分䑸）去向、重要事件、当时的世界政局、各次人员与船队，以及船只复原。

**在线浏览：<https://meverseen.github.io/zheng-he-voyages/>**

## 页面

| 页面 | 内容 |
|---|---|
| [航海图](index.html) `index.html` | 七次航线、港口、大事、航程回放、时间轴和专题 |
| [天下全图](world.html) `world.html` | 约 1415 年的世界政局，叠加七次航线与同期世界大事 |
| [航次档案](voyages.html) `voyages.html` | 七次对比，以及逐次的人员、官员、船队、航程统计、成果和史料 |
| [舰队复原](fleet.html) `fleet.html` | 五类船型的三维示意复原和七次舰队 |
| 人物复原 `people.html` | 未上线，需求见 [`docs/PEOPLE-PLAN.md`](docs/PEOPLE-PLAN.md) |

各页共用页眉导航和昼夜配色，手机上也能浏览。

### 航海图

- **七次航线**：去程画实线，归程画虚线，分䑸画点线。总览时七条航线平行错开，便于比较各次远近。
- **航程回放**：选定一次航程后点"回放航程"，宝船沿航线逐站航行，面板同步显示每站的日期（公历与年号纪年）和事迹。第七次的日期逐日取自祝允明《前闻记》。
- **港口**：三十余个港口和地标，点击可查看古名、今地、史料描述和历次停靠记录。
- **大事**：用印章形标记（战、碑、贡、使、政、人、卒）标出事件，例如旧港擒陈祖义、锡兰山之战、麒麟入贡、长乐立碑、郑和病逝，并附史料原文。
- **疆域**：约 1415 年各政权的范围，可切换"诸国"与"与明关系"两种着色。数据与天下全图共用。
- **时间轴与专题**：时间轴覆盖 1398—1436 年，标出年号；专题包括人物、宝船、航海术、年表、评说、史料与参考文献。
- **底图**：默认"古卷"底图用内置的 Natural Earth 海岸线绘制，无需联网。也可以切换 Esri 在线海图或卫星图。

### 天下全图

形式仿照 `songjin-zhizhan` 全景图：底图是真实地形晕渲加分层设色，河流、湖泊、山脉和海洋注记都用矢量绘制。图上画出约 1415 年（第四、五次下西洋之间）全世界 120 个政权的大致范围。亚非沿岸画得较细，欧洲、非洲内陆和美洲只作粗略示意。图上叠加郑和七次航线、各国都城、黄河夺淮故道和 1405—1433 年的同期世界大事。

底图是独立模块 [`worldmap/`](worldmap/README.md)，不依赖本项目的其他文件，可以复制到其他项目中使用。

### 航次档案

七次放在一起对比：起止时间、示意航程、人数、船只数和所到国家。点开任一次，可以看到人员与主要官员、船队、航程统计、成果和史料原文。第七次按《前闻记》列出逐日行程。史料没有记载的项目标为"史料未载"，不作推测。

### 舰队复原

可以观察五类船型的船体、桅帆、艉舵、锚和隔舱，切换宝船尺度、剖视和七次舰队。复原方案和假设都附说明；舰队数量没有记载的，保留"史料未载"。250 艘编成是统一的教学假设，不代表各次的真实规模。

计划与依据见 [`docs/FLEET-PLAN.md`](docs/FLEET-PLAN.md)，验收范围见 [`docs/FLEET-VALIDATION.md`](docs/FLEET-VALIDATION.md)，评审意见见 [`docs/FLEET-REVIEW.md`](docs/FLEET-REVIEW.md)。

## 打开方式

- **离线单文件**：`dist/` 下的 `index.html`、`world.html`、`voyages.html`、`fleet.html` 都已内联全部脚本、样式和数据（天下全图内嵌地形底图，舰队页内嵌宝船模型），双击即可浏览。几个文件放在同一目录，就可以互相跳转。`dist/zheng-he-voyages-standalone.html` 是航海图的兼容文件名。
- **在线**：<https://meverseen.github.io/zheng-he-voyages/>，由 GitHub Pages 从 `main` 分支根目录发布，推送后一两分钟内更新。离线单文件也可在线下载，例如 <https://meverseen.github.io/zheng-he-voyages/dist/index.html>。
- **本地服务**：

  ```bash
  python3 -m http.server 8000
  ```

  然后访问 <http://localhost:8000>。源码页面要通过 HTTP 访问；直接双击源码页面时，舰队页的三维模块无法加载。

## 开发与检查

```bash
npm ci
```

```bash
npm run check
```

```bash
npm run build
```

- `npm run check`：检查舰队数据与几何、Blender 样板，以及所有航线（含平滑后）都不穿越陆地。
- `npm run build`：为每个页面生成离线单文件 `dist/<页面>.html` 和多文件发布包 `dist/artifact/`，并检查内联脚本能否解析、有无外部依赖。
- `npm run check:pages`：页面检查，需要 Playwright 与 Chromium，按需另装：

  ```bash
  npm i -D playwright && npx playwright install chromium
  ```

  每个页面在桌面 1440×900、手机 390×844 和昼夜两种配色下打开，再执行几步典型操作（切换航次、回放、点选政权、切换标签、切换舰队等）。脚本检查控制台报错、请求失败和横向滚动，截图存在 `.screens/`。源码页面和 `dist/` 离线单文件各检查一遍；Google Fonts 一律拦截，按字体无法访问的情况检查。检查线上网站：

  ```bash
  node tools/check-pages.mjs --url https://meverseen.github.io/zheng-he-voyages/
  ```

修改 `js/data.js` 后运行 `npm run check`。修改政局数据 `worldmap/polities/1415.mjs` 后，要重新生成政局文件：

```bash
node worldmap/scripts/build_polities.mjs 1415 --center ming --ports js/data.js
```

重新生成地形底图和矢量数据的步骤见 [`worldmap/README.md`](worldmap/README.md)。

## Blender 母版与网页模型

二千料尺度宝船默认使用 Blender 导出的网页模型，可关闭精修选项对照参数化版本。现在将三类资产分开保存：

| 用途 | 文件 | 更新方式 |
| --- | --- | --- |
| 可再生成的参数底稿 | `models/baochuan/generated/baochuan-baseline.blend` | `npm run model:baseline`，只更新底稿 |
| 独立精修母版 | `models/baochuan/baochuan-master.blend` | 在 Blender 中编辑、保存；无三万面限制 |
| 网页完整/剖视模型 | `assets/ships/baochuan-full.glb`、`baochuan-section.glb` | `npm run model:export` 从已保存母版导出 |

日常精修时，打开母版编辑并保存，然后运行：

```bash
npm run model:export
npm run check
npm run build
```

`npm run model:init-master` 只用于母版不存在时的首次初始化，已有母版会拒绝覆盖。重新生成参数底稿不会更新母版或网页资产；导出也不改写母版。完整/剖视的船楼木构件倒角已分别烘焙为1024像素法线图并嵌入GLB。网页保留三万面预算；母版的细分和倒角可独立调整。

`npm run model:render` 生成母版与实际网页GLB的检查图；`npm run model:check` 验证底稿隔离、禁止覆盖母版、编辑传递和只读导出。需要安装 Blender；非默认安装路径可用 `BLENDER_BIN` 指定。模型资产记录母版指纹，母版修改后未重新导出时，网页构建会提示先导出。

详细的修改器约定、烘焙范围和编辑步骤见 [母版工作说明](models/baochuan/README.md)。原 `assets/ships/baochuan.blend` 已迁移为独立底稿与母版，后续精修应打开上表中的母版文件。

形制核对见 `docs/FLEET-PLAN.md`；九桅九主帆、三层艉楼及细部尺寸仍为建模假设。制作流程调整没有改变这些历史依据的边界。

## 目录结构

```
index.html  world.html  voyages.html  fleet.html     各页面
css/base.css           共用：设计令牌、页眉导航、按钮、表格等
css/<页面>.css         各页面专用样式（航海图为 style.css）
js/nav.js              共用页眉导航与昼夜切换
js/data.js             港口、海道、七次航程、大事、年表等史事数据
js/route.js            在海道网上求最短海路并平滑航线
js/stats.js            航程统计（里程、历时、在航天数）
js/voyages-detail.js   航次档案数据
js/fleet-data.js       船型与舰队构成；js/fleet-info.js 为舰队页文字资料
js/people-data.js      人物角色数据（草稿）；js/figure2d.js 为 2D 立绘生成器（草稿）
js/app.js              航海图交互；js/world-page.js、js/voyages-page.js 为其他页面脚本
three/                 三维模块：船体、舰队、场景、Blender 样板载入、人物（草稿）
data/land.js           航海图用的 Natural Earth 1:50m 海岸线（裁剪到相关海域）
worldmap/              可复用的世界底图模块与 1415 年世界政局，见 worldmap/README.md
models/baochuan/       独立 Blender 精修母版、可重建参数底稿与母版检查图
assets/ships/          网页 GLB、内嵌贴图的检查副本、导出记录与检查图
vendor/                Leaflet 1.9.4、three.js 0.160.0
tools/                 构建（build.mjs）与检查（check-*.mjs）脚本，Blender 生成脚本
dist/                  离线单文件（npm run build 生成）
docs/                  任务清单、接口规范、舰队与人物复原方案
```

## 文档

| 文档 | 内容 |
|---|---|
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 第二阶段任务清单与进度 |
| [`docs/SPEC.md`](docs/SPEC.md) | 接口、数据格式、样式与书写约定 |
| [`docs/FLEET-PLAN.md`](docs/FLEET-PLAN.md)、[`FLEET-VALIDATION.md`](docs/FLEET-VALIDATION.md)、[`FLEET-REVIEW.md`](docs/FLEET-REVIEW.md) | 舰队复原的方案、验收和评审 |
| [`models/baochuan/README.md`](models/baochuan/README.md) | 宝船母版编辑、网页导出与烘焙范围 |
| [`docs/PEOPLE-PLAN.md`](docs/PEOPLE-PLAN.md) | 人物复原的需求表、详细要求与史料核查表 |
| [`worldmap/README.md`](worldmap/README.md) | 世界底图模块的用法、投影、数据与重新生成 |

## 资料与说明

内容依据《明史·郑和传》及外国诸传、《明太宗实录》、长乐《天妃灵应之记》碑、刘家港《通番事迹记》、马欢《瀛涯胜览》、费信《星槎胜览》、巩珍《西洋番国志》、祝允明《前闻记》、《郑和航海图》等整理，详见各页面的"史料"栏目。

- 航线是按史料所记停靠顺序、沿主要海道绘出的示意路线，并非精确航迹；航次档案中的里程也据此计算，只用于比较各次远近。
- 第一至六次各港停靠的具体日期大多失载，图中只标年份。
- 1582 年以前的公历日期按史学惯例折算为儒略历，例如永乐三年六月十五日 = 1405 年 7 月 11 日。
- 古今地名对应采用通行说法，有争议的注明"一说"。
- 政权范围参照通行历史地图集手绘，只表示约 1415 年的大致范围。许多边界在当时本就模糊或多变，例如交趾 1407—1427 年为明朝直辖。未着色的地区是部族地区或资料不详。
- 船只与人物都是有依据的示意复原，不是原物图纸或画像；依据与假设分别写在各自的方案文档中。

## 致谢

- 海岸线、湖泊、河流：[Natural Earth](https://www.naturalearthdata.com)（公有领域），海岸线经 [world-atlas](https://github.com/topojson/world-atlas) 获取
- 地形：[AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（源自 SRTM、GMTED、ETOPO1 等）
- 地图引擎：[Leaflet](https://leafletjs.com)（BSD-2-Clause）
- 三维：[three.js](https://threejs.org)（MIT）
- 构建：[esbuild](https://esbuild.github.io)（MIT）、[polygon-clipping](https://github.com/mfogel/polygon-clipping)（MIT）
- 可选在线底图：Esri World Ocean Base / World Imagery
- 字体：Ma Shan Zheng、Noto Serif SC（Google Fonts，无法访问时自动回退到系统字体）
