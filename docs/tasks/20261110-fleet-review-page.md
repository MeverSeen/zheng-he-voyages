# 任务：舰队页评审意见第 7、8、10、11 条（页面与代码整理）

- 日期：2026-11-10
- 分支：`claude/quirky-hamilton-i713zs`（从该分支的干净检出开始，完成后推送回同一分支；不要推送到 `main`，不要强制推送，被拒绝时 `git pull --rebase`）
- 依据：[`docs/FLEET-REVIEW.md`](../FLEET-REVIEW.md) 第二节第 7、8、10、11 条
- 结果文件：`docs/tasks/20261110-fleet-review-page.result.md`（要求见文末）

## 目标

只整理舰队页的页面外壳、样式作用域、代码排版、用语和手机端热点标签。**不改变船只形制、三维几何、史料数据和证据分级**——那些属于评审第 1—6、13 条，另行安排。

## 现状（基线 `d2f4aa6`）

- `fleet.html` 的 `<head>` 缺少其他三页都有的字体链接、`viewport-fit=cover` 和 `claude:viewport-fit-sides`，标题格式也不同。
- `css/fleet.css` 第 2 行有全局规则（`*`、`body`、`button`、`select`、`input`、`button:hover`、`button[aria-pressed=true]`、`:focus-visible`、`[hidden]`），会覆盖 `css/base.css`，包括页眉里的"夜航"按钮 `#theme-toggle`。
- 超过 300 字符的行：`three/fleet-page.js` 9 行，`js/fleet-data.js` 5 行，`js/fleet-info.js` 5 行，`css/fleet.css` 3 行，`three/scene.js` 3 行，`fleet.html` 3 行，`three/fleet.js` 1 行。
- `js/fleet-info.js` 用 `'第'+n+'次'`、`'第'+n+'次船队'` 拼出"第1次"；全站其他地方写"第一次"。
- 手机宽度（390px）下热点标签互相遮挡，例如"船体与龙骨"被"水密隔舱"挡住。

## 要做的事

分成四个提交，顺序如下。**格式化必须是单独的一个提交，里面不能有任何行为改动**，方便审阅。

### 提交 1：纯格式化（第 8 条）

1. 用 prettier 格式化下列文件：`css/fleet.css`、`fleet.html`、`three/fleet-page.js`、`three/fleet.js`、`three/scene.js`、`three/ships.js`、`three/blender-ships.js`、`js/fleet-data.js`、`js/fleet-info.js`。
2. 用 `npx prettier@3`（固定一个确切版本并写进结果文件）执行即可；不要把 prettier 加进 `package.json`，不要新增配置文件以外的依赖。可以加一个最小的 `.prettierrc.json`（建议 `printWidth: 120`、`singleQuote: true`），以及 `.prettierignore`（排除 `dist/`、`vendor/`、`node_modules/`、`worldmap/`、`assets/`、`models/` 以及本任务未列出的其他源码文件），保证以后运行 prettier 不会波及别的文件。
3. 格式化后上述文件不得再有超过 300 字符的行。`js/fleet-data.js` 中的长字符串（出处说明等）如果 prettier 不拆，可以手工在数据结构层面换行，但**不得改动任何字符串内容和数值**。
4. 验证没有行为变化：格式化前后分别运行 `npm run check`，输出的各船型三角面数必须逐项相同；把前后两次输出都贴进结果文件。

### 提交 2：页面外壳与样式作用域（第 7 条）

1. `fleet.html` 的 `<head>` 对齐 `voyages.html`：
   - `viewport` 加上 `viewport-fit=cover`；
   - 加 `<meta name="claude:viewport-fit-sides" content="cover">`；
   - 加两条 `preconnect` 和 Google Fonts 样式表链接，地址与 `voyages.html` 完全相同；
   - `<title>` 改为与其他页面同一风格（例如"郑和舰队复原"）。
2. `css/fleet.css` 的全局规则全部限定到 `.fleet-page` 之内（`<main class="fleet-page">`）。页眉 `.masthead` 在 `.fleet-page` 之外，改后它的样式应完全来自 `css/base.css`，与其他三页一致。`base.css` 已经提供的规则（如 `box-sizing`、`body` 底色）在 `fleet.css` 中直接删掉，不要重复定义。
3. 第 7 行媒体查询里的 `.masthead{flex-wrap:wrap}` 属于共用页眉，从 `fleet.css` 删除；如果删掉后手机宽度下页眉换行有问题，说明原因并保留，写进结果文件。
4. 舰队页主体（`.fleet-page` 之内）的按钮、下拉框、选中态、焦点框外观应与改动前一致。

### 提交 3：用语统一（第 10 条）

1. 舰队页界面上所有"第 N 次"都用汉字数字：第一次……第七次（标题、模型名称、下拉选项、说明文字都算）。
2. 先在仓库里找现成的数字转换写法（`js/voyages-page.js`、`js/data.js`、`js/app.js`）；有就复用同一种写法，没有就在 `js/fleet-info.js` 内加一个只管 1—7 的小函数。不要改 `js/fleet-data.js` 的数据键（航次仍用数字 1—7 作键）。

### 提交 4：手机端热点标签（第 11 条）

1. 视口宽度 ≤ 760px 时，热点只显示编号圆点（1、2、3……，编号顺序与右侧"构件"按钮列表 `#part-list` 一致），不显示名称文字；`#part-list` 的按钮前加同样的编号，让圆点和名称能对上。
2. 点圆点的行为与现在点标签相同（选中该构件并显示说明）。当前选中的那个热点可以展开显示名称。
3. 每个圆点的可点击区域不小于 32×32 CSS 像素，并保留可读名称（`aria-label` 或视觉隐藏文字）。
4. 宽屏（> 760px）外观和行为不变。
5. 在 `tools/check-pages.mjs` 的 `fleet` 步骤里加一步检查：手机视口下，任意两个可见热点的外接矩形不重叠；宽屏下跳过。保持脚本现有的写法和输出格式。如果在默认视角下几何上确实无法避免两个圆点重合，不要靠改断言来通过，在结果文件里说明是哪两个构件、什么视角。

## 不要改的文件

- `three/figures.js`、`js/people-data.js`、`js/figure2d.js`、`docs/PEOPLE-PLAN.md`（人物复原，另有负责人）
- `css/base.css`、`js/nav.js`、`index.html`、`world.html`、`voyages.html` 及其专用脚本与样式
- `worldmap/`、`vendor/`、`models/`、`assets/`、`tools/blender/`
- `docs/FLEET-PLAN.md`、`docs/FLEET-VALIDATION.md`、`docs/FLEET-REVIEW.md`
- `js/fleet-data.js` 与 `three/ships.js`、`three/blender-ships.js`：只允许提交 1 的排版变化，不得改任何数值、字符串或逻辑
- 不要运行 `npm run model:*`（不改 Blender 母版与导出的 GLB）

`dist/` 是提交在仓库里的构建产物：每个改了源码的提交之后运行 `npm run build`，把重新生成的 `dist/fleet.html` 一并提交（其他 `dist/*.html` 不应有变化；如果有，查明原因并写进结果文件）。

## 测试与检查命令

推送前全部运行，并在结果文件中逐条记录命令和结果：

```bash
npm ci
```

```bash
npm run check
```

```bash
npm run build
```

```bash
npm run check:pages
```

`check:pages` 需要 Playwright 与 Chromium；如果本机没有，按 README 的说明临时安装（`npm i -D playwright && npx playwright install chromium`），**但不要把 `package.json`、`package-lock.json` 的这项改动提交进来**。实在装不上就如实写"未运行"及原因。

另外检查：

```bash
awk 'length>300{print FILENAME": "FNR}' fleet.html css/fleet.css three/fleet-page.js three/fleet.js three/scene.js three/ships.js three/blender-ships.js js/fleet-data.js js/fleet-info.js
```

应没有输出。

## 验收标准

1. 上面四条命令全部通过；`npm run check` 输出的十二项参数化模型三角面数、两项 Blender 模型三角面数与基线一致（宝船估计尺度完整 27,921；Blender 完整 29,865、剖视 22,183）。
2. 提交 1 只有排版变化。
3. `fleet.html` 的 `<head>` 与 `voyages.html` 只在标题、描述、页面专用样式表和 import map 上不同。
4. `css/fleet.css` 中没有不带 `.fleet-page`（或页面内具体类名、id）前缀的元素选择器和通配选择器；`:root` 上的自定义属性定义和昼夜主题选择器除外。
5. 舰队页界面上不再出现"第1次"这类阿拉伯数字写法。
6. 手机宽度截图中热点不重叠；`check:pages` 新增的重叠检查在源码页面和 `dist/` 上都通过。
7. 桌面宽度下舰队页外观与改动前相比，除页眉字体（现在会加载网络字体）和"第一次"用语外没有可见差别。

## 提交与结果文件

- 提交信息沿用仓库现有风格，说明做了什么；每条提交信息末尾加一行共同作者，写明执行的代理（例如 `Co-Authored-By: Codex <noreply@openai.com>`）。
- 完成后写 `docs/tasks/20261110-fleet-review-page.result.md`，与代码一起推送，内容包括：
  1. 各提交的哈希与一句话说明；
  2. 改动的文件列表；
  3. 每条测试、检查命令的原文和结果（通过、失败或未运行；失败和未运行要写原因）；格式化前后两次 `npm run check` 的输出；
  4. 使用的 prettier 版本和配置；
  5. 没有做完的事项；
  6. 需要负责人决定的问题。
- **没有实际运行过的命令，不要写成已运行。**
- 更新 `docs/FLEET-REVIEW.md` 不在本任务范围内；逐条回复由审阅者在核对后补写。
