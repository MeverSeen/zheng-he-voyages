# 舰队页评审第 7、8、10、11 条：执行记录

日期：2026-11-10。状态：完成；已完成纯格式化、页面外壳/样式作用域、航次用语和手机热点四项提交，以及源码页和离线构建的页面验收与截图归档。

## 基线变化

任务原文以 `d2f4aa6` 为基线。本任务分支开始前已合并当前本地 `main` 的五类船独立母版重建（`d9496f6`，合并提交 `e26a1cb`）及 `origin/main`（`79f5e90`，合并提交 `f92925d`）。因此，任务原文中的旧宝船 Blender 三角面数 `29,865 / 22,183` 不再适用；当前正式网页 GLB 为 `29,626 / 21,898`，并且检查已覆盖五类船的独立母版与完整/剖视产物。下面的格式化前后检查输出是本任务实际基线，不以旧数字替代。

## 已完成提交

| 提交 | 内容 |
| --- | --- |
| `75871a2` | 仅用 Prettier 格式化指定舰队页源码与重新生成的 `dist/fleet.html`；没有行为改动。 |
| `21ed6db` | 对齐 `fleet.html` 页面外壳，并把舰队页样式限定至 `.fleet-page`；`tools/build.mjs` 的正则同步兼容 Prettier 对 void stylesheet link 的排版。以 `:where()` 保持原有选择器优先级。 |
| `d48b599` | 将舰队页的航次界面用语统一为“第一次”至“第七次”。 |
| `9e62eef` | 用编号整理手机热点，补入触控布局检查、最终 `dist/fleet.html` 与四张审阅证明图。 |

已改动文件：`.prettierrc.json`、`.prettierignore`、`fleet.html`、`css/fleet.css`、`js/fleet-data.js`、`js/fleet-info.js`、`three/fleet-page.js`、`three/fleet.js`、`three/scene.js`、`three/ships.js`、`three/blender-ships.js`、`tools/build.mjs`、`tools/check-pages.mjs`、`dist/fleet.html`，以及 `docs/img/fleet-review-page/` 的四张审阅证明图和两张格式化前对照图。格式化提交只触及任务列出的九个源码文件、配置/忽略文件及对应构建产物；其余提交未改船只形制、三维几何、史料数据或证据分级。

## Prettier

使用 `npx prettier@3.6.2`。没有将 Prettier 加入 `package.json` 或锁文件。配置为：

```json
{
  "printWidth": 120,
  "singleQuote": true
}
```

`.prettierignore` 采用白名单，只允许本任务的九个源码文件和配置文件进入格式化范围；`dist/`、`vendor/`、`node_modules/`、`worldmap/`、`assets/`、`models/` 以及其他未列出的源码不在范围内。

## 已运行的检查

| 命令 | 状态 | 结果 |
| --- | --- | --- |
| `npm ci` | 通过 | 依赖安装完成。 |
| `npm run check`（格式化前） | 通过 | 完整 stdout 见下节。 |
| `npm run check`（格式化后） | 通过 | 完整 stdout 见下节；与格式化前完全一致。 |
| 每项已完成提交后的 `npm run check` | 通过 | 三次提交均通过。 |
| 每项已完成提交后的 `npm run build` | 通过 | 三次提交均通过；仅 `dist/fleet.html` 发生预期变化。 |
| 最终 `npm run check` | 通过 | 输出保存于 `/tmp/fleet-page-final-check-20261110.log`，与格式化前 stdout 逐字相同。 |
| 最终 `npm run build` | 通过 | 构建完成。 |
| `awk 'length>300{print FILENAME\": \"FNR}' fleet.html css/fleet.css three/fleet-page.js three/fleet.js three/scene.js three/ships.js three/blender-ships.js js/fleet-data.js js/fleet-info.js` | 通过 | 无输出。 |
| 非 `dist/` 源码差异检查 | 通过 | 仅发现本任务预期的源码、配置和结果文件变化。 |
| `CHECK_PAGES_CHANNEL=chrome npm run check:pages` | 通过 | 源码页与 `dist/` 离线单文件均通过；共生成48张截图，全部无控制台报错、无横向滚动。 |

### 格式化前 `npm run check` 完整 stdout

```text
> check
> node tools/check-fleet.mjs && node tools/check-all-blender-ships.mjs && node tools/check-routes.mjs

baochuan/estimated/full: 27921 triangles
baochuan/estimated/section: 20585 triangles
baochuan/recorded/full: 28317 triangles
baochuan/recorded/section: 20981 triangles
machuan/estimated/full: 27119 triangles
machuan/estimated/section: 19895 triangles
liangchuan/estimated/full: 24880 triangles
liangchuan/estimated/section: 17978 triangles
zuochuan/estimated/full: 24174 triangles
zuochuan/estimated/section: 16856 triangles
zhanchuan/estimated/full: 22741 triangles
zhanchuan/estimated/section: 15593 triangles
Fleet data, geometry, both scales, section views and all seven voyage counts passed.
Blender baochuan full: 29626 triangles; scale, parts, coordinates and layout passed
Blender baochuan section: 21898 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 55 material batches
Blender web adapter section: 55 material batches
Blender machuan full: 23628 triangles; scale, parts, coordinates and layout passed
Blender machuan section: 17340 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 46 material batches
Blender web adapter section: 46 material batches
Blender liangchuan full: 24624 triangles; scale, parts, coordinates and layout passed
Blender liangchuan section: 18736 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 47 material batches
Blender web adapter section: 47 material batches
Blender zuochuan full: 20840 triangles; scale, parts, coordinates and layout passed
Blender zuochuan section: 14704 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 46 material batches
Blender web adapter section: 46 material batches
Blender zhanchuan full: 18836 triangles; scale, parts, coordinates and layout passed
Blender zhanchuan section: 13044 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 47 material batches
Blender web adapter section: 47 material batches
全部航段均在海上 ✓
```

### 格式化后 `npm run check` 完整 stdout

```text
> check
> node tools/check-fleet.mjs && node tools/check-all-blender-ships.mjs && node tools/check-routes.mjs

baochuan/estimated/full: 27921 triangles
baochuan/estimated/section: 20585 triangles
baochuan/recorded/full: 28317 triangles
baochuan/recorded/section: 20981 triangles
machuan/estimated/full: 27119 triangles
machuan/estimated/section: 19895 triangles
liangchuan/estimated/full: 24880 triangles
liangchuan/estimated/section: 17978 triangles
zuochuan/estimated/full: 24174 triangles
zuochuan/estimated/section: 16856 triangles
zhanchuan/estimated/full: 22741 triangles
zhanchuan/estimated/section: 15593 triangles
Fleet data, geometry, both scales, section views and all seven voyage counts passed.
Blender baochuan full: 29626 triangles; scale, parts, coordinates and layout passed
Blender baochuan section: 21898 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 55 material batches
Blender web adapter section: 55 material batches
Blender machuan full: 23628 triangles; scale, parts, coordinates and layout passed
Blender machuan section: 17340 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 46 material batches
Blender web adapter section: 46 material batches
Blender liangchuan full: 24624 triangles; scale, parts, coordinates and layout passed
Blender liangchuan section: 18736 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 47 material batches
Blender web adapter section: 47 material batches
Blender zuochuan full: 20840 triangles; scale, parts, coordinates and layout passed
Blender zuochuan section: 14704 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 46 material batches
Blender web adapter section: 46 material batches
Blender zhanchuan full: 18836 triangles; scale, parts, coordinates and layout passed
Blender zhanchuan section: 13044 triangles; scale, parts, coordinates and layout passed
Blender web adapter full: 47 material batches
Blender web adapter section: 47 material batches
全部航段均在海上 ✓
```

## 页面验收通道

第 11 条已实现：手机热点编号、32×32 点击区、可访问名称，以及 `tools/check-pages.mjs` 中手机热点外接矩形不重叠的检查均已随第四项提交加入。

页面验收实际运行命令：

```sh
CHECK_PAGES_CHANNEL=chrome npm run check:pages > /tmp/fleet-page-browser-20261110.log
```

`tools/check-pages.mjs` 新增可选 `CHECK_PAGES_CHANNEL` 参数；未设置时仍使用原有 bundled Chromium。此次指定 `chrome`，以本机 Google Chrome `156.0.8078.81` 的独立检查会话运行，不接触个人浏览器会话。源码页与 `dist/` 离线单文件的四页、桌面/手机、昼夜与操作后状态共48张截图均通过，控制台无报错且无横向滚动。另以同一通道、在格式化前快照 `/tmp/zh-fleet-page-before-20261110` 中使用原检查脚本的 `--pages fleet` 生成对照截图。

Playwright `1.56.1` 曾以不保存依赖的方式临时安装成功；其 bundled Chromium 下载完成后的解压挂起，已停止，因此本次以 Chrome 通道作为已通过的回退执行环境，不把 bundled Chromium 写成已通过。两次内置 CUA 自动化尝试也超时，未作为任何通过结论的依据。

视觉复核了桌面浅色、桌面深色、手机浅色和手机操作后状态：标题和导航与基线一致，模型可见；手机热点为清晰分离的圆点。审阅用证明图归档为 `docs/img/fleet-review-page/desktop-light.png`、`desktop-dark.png`、`mobile-light.png`、`mobile-after.png`。

## 交付

结果随报告提交推送到指定分支。页面整理任务完成后，才可按任务顺序开始船只形制修订。

## 需要负责人决定的问题

无。
