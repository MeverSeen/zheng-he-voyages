# 七下西洋 · 郑和船队交互航海图

用一张可交互的地图，详细呈现郑和于明永乐三年至宣德八年（1405—1433）七次下西洋的经过：每次的航线、停靠港口、分船队（分䑸）去向、重要事件和史料原文。

## 功能

- **七次航线**：去程实线、归程虚线、分䑸点线；总览时七条航线平行错开，便于比较各次航程的远近。
- **航程回放**：选择任一航次后点击"回放航程"，宝船会沿航线逐站航行，面板同步显示每站的日期（公历与年号纪年）和事迹。第七次的日期逐日取自祝允明《前闻记》。
- **港口**：三十余个港口和地标，点击可查看古名、今地、史料描述，以及历次停靠记录。
- **大事**：以印章形标记（战、碑、贡、使、政、人、卒）标出旧港擒陈祖义、锡兰山之战、苏门答剌擒苏干剌、麒麟入贡、泉州行香、长乐立碑、郑和病逝等事件，附史料原文。
- **时间轴**：1398—1436 年的航次与大事，并标出建文、永乐、洪熙、宣德年号。
- **专题**：人物、宝船（按比例的船长比较）、航海术（二十四向罗盘、针路、更、牵星、打水）、年表、评说、史料与参考文献。
- **政治疆域**：以约 1415 年（第四、五次下西洋之间）为准，为明朝、交趾、帖木儿帝国、马穆鲁克苏丹国、阿瑜陀耶、满者伯夷、孟加拉苏丹国、毗奢耶那伽罗等 73 个政权着色。可切换"诸国"（一色一国）与"与明关系"（明朝直辖 / 郑和船队到访 / 明朝羁縻 / 遣使往来 / 其他）两种着色，点击色块可查看各国简介与境内港口。
- **底图**：默认"古卷"底图由内置的 Natural Earth 海岸线绘制，无需联网；也可切换 Esri 在线海图或卫星图。支持昼/夜两种配色和手机屏幕。

## 舰队复原

打开 `fleet.html`，可观察五类船型的船体、桅帆、艉舵、锚及隔舱，切换宝船尺度、剖视和七次舰队。复原方案与假设均附说明，舰队数量未知时保留“史料未载”。250艘编成为统一教学假设，不代表各次真实规模。

计划与依据见 [`docs/FLEET-PLAN.md`](docs/FLEET-PLAN.md)，验收范围见 [`docs/FLEET-VALIDATION.md`](docs/FLEET-VALIDATION.md)。

```bash
npm ci
npm run check
npm run build
```

`dist/index.html`、`dist/voyages.html`、`dist/fleet.html` 均为离线单文件；放在同一目录可互相跳转。`dist/zheng-he-voyages-standalone.html` 为航海图兼容文件名。生成的 `dist/artifact/` 是多文件发布包。

## Blender 宝船样板

二千料尺度宝船默认提供精修样板，可在页面关闭该选项对照参数化模型。完整和剖视 GLB 位于 `assets/ships/`，可编辑源文件为 `assets/ships/baochuan.blend`，渲染图为 `assets/ships/baochuan-preview.png`。原有五类船参数、争议大船方案和低细节舰队继续保留。

从参数基准重新生成（会覆盖样板源文件，手工精修前请另存副本）：

```bash
npm run model:baseline
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 4 --python tools/blender/build-baochuan.py
npm run check
npm run build
```

Blender 源文件按 `Baochuan_full`、`Baochuan_section` 集合分开保存。每个集合有六类构件分组；剖视集合初始隐藏，可在大纲视图中启用。手工编辑后应分别选择根对象及子对象，导出 GLB，启用自定义属性（Extras）和 Y Up，保留根对象的 `metadata` 与分组的 `part` 属性；不要直接重新运行生成脚本覆盖手工修改。网页版使用米制、+X 船首、+Y 向上；Blender 源文件为 Z 向上，导出时自动转换。

样板已深化船壳、船板、护舷材、分层船楼、屋面梯口及分幅桅帆和索具。形制核对与来源边界见 `docs/FLEET-PLAN.md`；九桅九主帆、三层艉楼和细部尺寸仍是明确标注的建模假设。细部检查图为 `assets/ships/baochuan-deckhouse.png`、`assets/ships/baochuan-rig.png`。单文件构建会内嵌两个 GLB，不依赖模型网络请求。

## 开发计划

第二阶段（统一世界底图与 1415 年世界政局、航次档案、舰队 3D 复原、人物复原）的任务清单见 [`docs/ROADMAP.md`](docs/ROADMAP.md)，接口、数据格式与样式规范见 [`docs/SPEC.md`](docs/SPEC.md)。

## 打开方式

- **直接打开**：下载 `dist/zheng-he-voyages-standalone.html`，双击即可在浏览器中离线浏览（所有脚本与数据均已内联）。
- **GitHub Pages**：在仓库 Settings → Pages 中选择 `main` 分支根目录，即可通过 `https://<用户名>.github.io/<仓库名>/` 访问。
- **本地服务**：

  ```bash
  python3 -m http.server 8000
  ```

  然后访问 <http://localhost:8000>。

## 目录结构

```
index.html            页面结构与专题内容
css/style.css         样式（昼/夜配色、手机适配）
js/data.js            港口、海道、七次航程、大事、年表等全部史事数据
js/route.js           在海道网上求最短海路并平滑航线
js/app.js             地图、面板、回放、时间轴等交互
data/land.js          Natural Earth 1:50m 海岸线（裁剪到相关海域）
data/polities.js      约 1415 年各政权疆域（由 tools/build-polities.mjs 生成）
vendor/leaflet/       Leaflet 1.9.4
tools/build-land.mjs  重新生成 data/land.js
tools/polities-src.mjs 各政权的手绘大致范围、与明朝的关系和简介
tools/build-polities.mjs 用海岸线裁剪疆域、去除重叠并自动配色
tools/check-routes.mjs 检查所有航线（含平滑后）均不穿越陆地
tools/build.mjs       生成单文件版 dist/zheng-he-voyages-standalone.html
```

修改 `tools/polities-src.mjs` 后需要重新生成疆域数据（需先安装 `polygon-clipping`）：

```bash
npm install --no-save polygon-clipping@0.15.7 && node tools/build-polities.mjs node_modules
```

修改 `js/data.js` 后建议运行：

```bash
node tools/check-routes.mjs
```

```bash
node tools/build.mjs
```

## 资料与说明

内容依据《明史·郑和传》及外国诸传、《明太宗实录》、长乐《天妃灵应之记》碑、刘家港《通番事迹记》、马欢《瀛涯胜览》、费信《星槎胜览》、巩珍《西洋番国志》、祝允明《前闻记》、《郑和航海图》等整理，详见页面"史料"栏目。

- 航线是按史料所记停靠顺序、沿主要海道绘出的示意路线，并非精确航迹。
- 第一至六次各港停靠的具体日期大多失载，图中只标年份。
- 1582 年以前的公历日期按史学惯例折算为儒略历（如永乐三年六月十五日 = 1405 年 7 月 11 日）。
- 古今地名对应采用通行说法，有争议者注明"一说"。
- 政治疆域参照通行历史地图集手绘，只表示约 1415 年的大致范围；许多边界在当时本就模糊或多变（如交趾 1407—1427 年为明朝直辖）。未着色地区为部族地区或资料不详。

## 致谢

- 海岸线：[Natural Earth](https://www.naturalearthdata.com)（公有领域），经 [world-atlas](https://github.com/topojson/world-atlas) 获取
- 地图引擎：[Leaflet](https://leafletjs.com)（BSD-2-Clause）
- 可选在线底图：Esri World Ocean Base / World Imagery
- 字体：Ma Shan Zheng、Noto Serif SC（Google Fonts，无法访问时自动回退到系统字体）
