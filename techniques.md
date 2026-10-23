# 画面手法选型表

开工提问时，"画面手法"一项照这张表问。选项写效果，说明里写用什么技术、调哪个技能、成本多少。

状态有两种：
- 已接入：有共享组件和自检，可以直接用。
- 未接入：第一次用时顺带搭起来，做法见 CLAUDE.md 的"画面手法"。

所有技术都要守一条硬规则：画面只能由帧号算出来。

表中信息核对于 2026-10-23。仓库后面标的是许可证，星数可能已经变了。

## 按效果挑

| 想要的效果 | 技术 | 接法 | 状态 |
| --- | --- | --- | --- |
| 扁平 MG、信息图、逐字动效、描边生长、UI 演示 | HTML/CSS/SVG | 现画 | 已接入（缺省） |
| 手绘白板、草图批注、抖线 | Rough.js | 现画 | 已接入 |
| 图标和 UI 微动效、角色小循环、现成的 AE 动画 | Lottie | 现画 | 已接入 |
| 数据图表、关系图、树图、桑基图 | D3 | 现画 | 已接入 |
| 地球推进到城市、航线、地点、3D 建筑 | MapLibre 地图 | 现画 | 已接入 |
| 公式变形、几何证明 | Manim（静态公式用 KaTeX） | 预渲染 | 已接入 |
| 傅里叶本轮、上万粒子、流场、像素风 | Canvas 2D | 现画 | 未接入（不用装包） |
| 生成艺术、水彩晕染、手绘笔刷 | p5.js + p5.brush | 现画；逐笔累积的要预渲染 | 未接入 |
| 流体渐变背景、光效、溶解和故障转场 | WebGL 着色器 | 现画；自反馈的要预渲染 | 未接入 |
| 3D 物体、立体字、地球、镜头运动 | Three.js | 现画 | 未接入 |
| 写实材质、布料流体、Grease Pencil 手绘 | Blender | 预渲染 | 不装，要用先问用户 |
| 实拍感镜头、真人、自然景观 | AI 视频生成 | 素材 | 未接入 |
| 刚体碰撞、堆叠 | matter.js | 预先算好每帧 | 未接入 |
| 扁平圆润的伪 3D（适合表情） | Zdog | 现画 | 未接入 |

表情包的画面是 240×240、256 色的 GIF，平涂的手法最合适：SVG、Rough.js、Lottie、Zdog。渐变、水彩、PBR 材质在 256 色下会出色带。

## 已接入

### HTML/CSS/SVG（缺省）

- 擅长：扁平 MG、信息图、逐字动效、SVG 描边生长和形变、UI 演示
- 接法：
  - 用 `interpolate` 和 `spring` 算样式，配合 `src/shared/motion/` 的工具箱
  - 按需装 `@remotion/paths`（描边生长、沿路径移动、形变）、`@remotion/shapes`（星形、饼图等参数化图形）、`@remotion/noise`（带种子的噪声，做漂浮和抖动）
  - 不用 CSS 的 animation 和 transition
- GSAP：还没接，许可和用法如下
  - 许可：2025 年起由 Webflow 支持，全部免费可商用，原来的付费插件也包括在内
  - 用法：用官方的 `@remotion/gsap`，它的 `useGsapTimeline` 建一条暂停的时间线，每帧 seek 过去
  - 不能用：`play()`、`onUpdate` 一类回调、`"random()"`、单独调用的 `gsap.to()`
  - 还不支持 SplitText、MorphSVG 等插件。补间多到几百个时会变慢
- 案例：[remotion-dev/github-unwrapped-2023](https://github.com/remotion-dev/github-unwrapped-2023)、[greensock/GSAP](https://github.com/greensock/GSAP)

### Rough.js

- 擅长：手绘白板讲解、手绘图表、"沸腾"的抖线、圈画批注
- 接法：用 `src/shared/rough.tsx`，示例是 `RoughCheck`，seed 的坑见 CLAUDE.md
- 坑：rough-notation 的圈画、下划线动画靠 CSS 动画，不能直接用，要自己用 `RoughPaths` 画
- 案例：[rough-stuff/rough](https://github.com/rough-stuff/rough)（MIT）。[excalidraw](https://github.com/excalidraw/excalidraw) 可以当风格参考

### Lottie

- 擅长：图标和 UI 微动效、角色小循环、AE 做好的 MG 包
- 接法：用 `src/shared/lottie.tsx` 的 `<LottieClip>`，示例是 `LottieCheck`
  - 不要直接用 `@remotion/lottie` 的 `<Lottie>`：它不换算帧率，60fps 的动画放进 30fps 的视频会慢一半
- 坑：
  - 带 `wiggle()`、`random()` 表达式的动画，每个标签页抖得不一样。先在 AE 里把表达式转成关键帧再导出
  - lottie-web 基本只在维护，不再加新功能
- 来源：
  - LottieFiles 的免费动画用 Lottie Simple License：可商用、可修改，署名是鼓励但不强制；改过的文件再分发时要带同一份许可证
  - `@remotion/animated-emoji`（Google Noto 动画 emoji，CC BY 4.0，要署名）
- 自己做：
  - 简单的动画手写 JSON，`LottieCheck` 的弹球就是手写的
  - Glaxnimate（KDE 的 Lottie 编辑器，GPL-3）
- 案例：[airbnb/lottie-web](https://github.com/airbnb/lottie-web)（MIT）、[LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web)

### D3

- 擅长：数据图表动画、地图投影、树图、打包图、桑基图、Voronoi
- 接法：只当计算库，示例是 `D3Check`
  - 能用：scale、shape、geo、hierarchy、interpolate、color、array、delaunay、contour、chord、ease、sankey
  - 随机数用 `randomLcg(seed)`
  - 不能用：selection、transition、timer、zoom、drag、brush
  - 力导向图用 `precomputeForce()` 预先算好每一帧
- 案例：[d3/d3](https://github.com/d3/d3)（ISC）。[observablehq/plot](https://github.com/observablehq/plot) 可以参考图表样式，它直接生成 DOM，不能直接用

### 地图（MapLibre）

- 擅长：从地球推进到城市、航线和地点标注、街区和 3D 建筑
- 接法：用 `src/shared/map.tsx` 的 `<MapLibre>`，示例是 `MapCheck`
- 图源、署名、审图号和坑见 CLAUDE.md 的"画面手法"
- 成本：渲染时要联网；1080p 120 帧本机约 1 分 40 秒
- 其他技法（规则在 remotion-best-practices 技能的 maps 部分）：
  - 真 3D 地形飞行：用 Cesium。要 MapTiler 的 key；拍城市写实建筑要 Google Map Tiles 的 key，需要开通计费
  - 只交代位置：用一张静态地图图片

### Manim

- 擅长：公式变形、几何证明、3Blue1Brown 风格的数学动画
- 接法：`npm run manim` 出透明 WebM，`<ManimClip>` 嵌回来，示例是 `FormulaCheck`。要写场景时先调 `manimce-best-practices` 技能
- 版本：本仓库用社区版 ManimCE，[ManimCommunity/manim](https://github.com/ManimCommunity/manim)（MIT）。3Blue1Brown 自己用的 ManimGL 接口不兼容，网上的代码要先分清是哪一版
- 成本：要装 TeX，带公式的场景渲染慢一些，但都在 CPU 上跑

## 未接入

### Canvas 2D

- 擅长：傅里叶本轮画图、上万粒子和流场、像素风和抖动风
- 接法：
  - canvas 固定宽高，在 `useLayoutEffect([frame])` 里同步画完
  - 轨迹不能靠"不清屏"留下来。DFT 系数用 `useMemo` 算一次，每帧把 0 到 t 的整段轨迹按公式重画
  - 粒子写成 `f(i, frame)` 的闭式解，或者用带种子的随机数预先模拟成数组，按帧取
- 成本：低，CPU 就够
- 表情：关掉抗锯齿或者加深色描边，不然 256 色下边缘有杂点
- 案例：[mattdesl/canvas-sketch](https://github.com/mattdesl/canvas-sketch)（MIT），[trozler/myFourierEpicycles](https://github.com/trozler/myFourierEpicycles)（MIT，傅里叶本轮）

### p5.js

- 擅长：生成艺术、噪声流场、水彩晕染和手绘笔触、丝网颗粒质感
- 接法：
  - 用 instance mode，setup 里 `noLoop()`、`pixelDensity(1)`，用 `delayRender` 等初始化完
  - 每帧先 `randomSeed`、`noiseSeed`，再 `redraw()`
  - 时间只用 Remotion 的帧号，不用 `frameCount`、`millis()`
- 逐笔累积的笔触有两种做法：
  - 每帧从第 0 笔重画到第 N 笔。笔数少时可以，水彩的 wash 很贵
  - 在 Remotion 外面按顺序跑一遍，导出透明 PNG 序列再嵌回来（推荐）
- 笔刷：[acamposuribe/p5.brush](https://github.com/acamposuribe/p5.brush)（MIT）。要 p5 2.x 和 WEBGL 画布，也有不依赖 p5 的 standalone 版。渲染时加 `--gl=angle`
- 混色：[spectral.js](https://github.com/rvanwijnen/spectral.js)（MIT）按颜料的规律混色，水彩叠色更像真的。同类的 Mixbox 是 CC BY-NC，不能商用
- 成本：2D 模式低，WEBGL 加笔刷中到高
- 表情：静态笔触可以；水彩渐变在 256 色下会出色带
- 案例：[processing/p5.js](https://github.com/processing/p5.js)（LGPL-2.1，只约束库本身，不影响成片）
- 技能：anthropics/skills 的 `algorithmic-art` 出的是独立 HTML，用的是全局模式的 p5 1.7，进不了 Remotion，只能借它的构思方法

### WebGL 着色器

- 擅长：流体和渐变背景、域扭曲噪声、SDF 光线步进的 3D、溶解和故障转场
- 接法：
  - 全屏三角形加 fragment shader，`iTime = frame / fps` 作为 uniform 传进去，每帧同步画一次
  - Shadertoy 的作品包一层 `mainImage` 就能移植
  - 带 Buffer 自反馈的效果（流体、反应扩散、残影）是累积状态，只能预渲染
  - Remotion 4.0.537 自带 `createEffect({ backend: "webgl2" })`，可以做能叠加的自定义效果；`@remotion/effects` 有 glow、halftone、色差等现成后期，许可证没核实
- 许可：Shadertoy 上没写许可证的作品默认是 CC BY-NC-SA 3.0，B 站有收益的视频不要直接搬
- 成本：GPU 上很快，渲染时加 `--gl=angle`
- 表情：渐变在 256 色下色带明显，在着色器里直接量化到调色板
- 案例：[regl-project/regl](https://github.com/regl-project/regl)（MIT）、[greggman/twgl.js](https://github.com/greggman/twgl.js)（MIT）

### Three.js

- 擅长：低多边形产品转台、3D 标志和立体字、地球、星空、粒子云
- 接法：用 `@remotion/three` 的 `<ThreeCanvas width height>`，规则在 remotion-best-practices 技能的 3D 部分
  - 不能用 `useFrame`。drei 里靠它自己动的组件（Float、Sparkles、autoRotate 等）都要改成帧号的函数
  - `<ThreeCanvas>` 里的 `<Sequence>` 要设 `layout="none"`
  - glTF 动画用 `mixer.setTime(frame / fps)`
  - 模型和 HDR 的加载走 `delayRender`
- 成本：中到高，要 GPU
  - Remotion 文档说缺省的 GL 画不出 Three.js，要加 `--gl=angle`，`npm run video` 已经支持这个参数。本机还没实测（地图在缺省 GL 下是能画的）
  - angle 有内存泄漏，长片分段渲染
- 表情：toon 材质的平涂小转台可以，PBR 渐变量化成 256 色后难看
- 案例：[mrdoob/three.js](https://github.com/mrdoob/three.js)（MIT）、[pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)（MIT）、[remotion-dev/template-three](https://github.com/remotion-dev/template-three)（MIT）

### 其他现画的库

| 库 | 擅长 | 坑 |
| --- | --- | --- |
| [matter.js](https://github.com/liabru/matter-js)（MIT） | 2D 刚体堆叠、碰撞 | 不用 Runner。用固定步长的 `Engine.update` 把所有帧预先算成数组；`Common._seed` 是全局变量，每次模拟前要重置 |
| [Zdog](https://github.com/metafizzy/zdog)（MIT） | 扁平圆润的伪 3D，适合表情 | 旋转直接写成帧号的函数；2022 年后停更 |
| `@remotion/skia` | 矢量和着色器混着画 | 本仓库用 Rspack，要在 `overrideBundlerConfig` 里加 `enableSkia`，没实测 |
| `@remotion/rive` | Rive 状态机动画按帧推进 | 素材要用 Rive 编辑器做 |
| anime.js v4（MIT） | 时间线动画 | 有 `seek()`，但没有官方 Remotion 包，没实测 |
| tsParticles | 粒子效果配置 | 靠 rAF 跑，没有"跳到第 N 帧"的接口。只借它的配置思路，用 Canvas 自己画 |

### Blender（不装，2026-10-23 定的）

- 擅长：写实材质和光照，布料、流体、刚体模拟，Grease Pencil 的 2D 手绘动画，复杂建模。这些是 Three.js 在浏览器里做不到或做不好的
- 为什么不装：体积大，要写 bpy 脚本，渲染慢，只能预渲染。物体转台、立体字、地球、镜头运动这些常见的 3D 用 Three.js 就能现画，表情包也用不上
- 什么时候再考虑：作品明确需要上面那几类效果，Three.js 试过不行。到时候先问用户，再装
- 接法（到时候）：命令行无界面渲染 `blender -b <场景.blend> -P <脚本.py>`，开 Film Transparent 出 RGBA 的 PNG 序列，再像 Manim 一样嵌回来。Eevee 快，Cycles 写实但慢，本机的渲染速度还没测

### AI 视频生成（未接入）

- 擅长：代码画不了的实拍感镜头、真人、自然景观
- 国内能用的有可灵、即梦、Vidu、海螺、通义万相等。API、价格、时长、分辨率、商用条款变得快，用之前去官网查当时的说明，这里不记
- 要注意：
  - 和生图一样，每次都花钱，提示词和参考图会发给第三方
  - 一般不出透明背景，只能整段当底图或转场素材用
  - 用了就在 `brief.md` 里写上服务名、提示词和条款要点

## 不用的

- HyperFrames（HeyGen）：HTML 加 GSAP 写，直接出 MP4。它和 Remotion 是同一层的竞品，加进来配音、混音、审查都要再做一套，而且它的技能会把所有视频任务都揽过去
- Motion Canvas：用 TypeScript 写动画，自带编辑器，也是和 Remotion 同一层的框架
- Claude Motion：Anthropic 在 Claude App 里的功能，只有 Team 和 Enterprise 计划能用，不是能装进仓库的库

## 现成的技能

- 已经在用的：
  - `anthropic-skills:motioner`：方法
  - `remotion-best-practices`：3D、Lottie、地图、effects、HTML-in-canvas、漏光、动态模糊都有规则
  - `manimce-best-practices`
- 社区里 Three.js、着色器、生成艺术的技能，示例大多用 `requestAnimationFrame`、`useFrame` 或墙钟时间，和硬规则冲突
- 有几个的触发描述太宽，会抢走本项目的任务：
  - camilleroux/genart-skill（写了"deterministic randomness… delivering a piece as a video"）
  - AThevon/genjutsu
  - diffusionstudio/lottie 的 text-to-lottie
  - CloudAI-X/threejs-skills
- 这些只当参考资料读，不装。真要装，先在 CLAUDE.md 写明 Remotion 的硬规则优先
- 比较安全的：iart-ai/webgl-animation-skills 的 `shader-glsl`，触发词很具体
- p5.js、Rough.js、D3 没有像样的专门技能
