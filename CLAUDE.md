# CodeVideo

用 Remotion 写代码动画的个人工作区，做各种题材的视频（可能发 B 站）和微信/QQ 自用表情包。题材、内容和风格都不固定，每次在对话里定。

## 做视频先调技能

这条排在本文件所有流程前面。之前三个视频（楞次定律、排序算法、诗笺）都没调用 motioner，做出来是"幻灯片 + 字幕条"：本文件自带一整套流程，却一直没提技能，技能就被跳过了。

- 新做视频，或改现有视频的画面、动效、转场、声音：第一个动作是用 Skill 工具调用 `anthropic-skills:motioner`，排在提问、写方案、读代码之前。用户没提也要调。只改错字、换配音这类不碰画面的小改动不用调
- 写 Remotion 代码时，用到字幕、音频、渲染、Studio、转场、动态模糊、漏光、effects、Lottie、地图、3D、GIF 之类的具体 API，按需调用 `remotion-best-practices`（它的描述只有一句"Router for all Remotion skills"，不会自己冒出来，要主动调）；写 Manim 场景前调用 `manimce-best-practices`
- 顺序：新视频先调 motioner → 照"开工前先问清楚"分轮提问，画面手法这一项先读 `techniques.md` 再问 → 写分镜评审页，改到定稿 → 样片 → 成片。动手写某种手法的代码前，调它在选型表里对应的技能或子文档
- 技能的示例和本文件冲突时以本文件为准：Composition 不写进 `Root.tsx`，建作品目录的 `index.tsx`；Lottie 用 `<LottieClip>`，不直接用 `<Lottie>`；地图用 `<MapLibre>`；规格、风格、配色照本文件
- 名字相近但不用于本项目的技能：`algorithmic-art`（出独立的 p5 HTML）、`canvas-design`（出 PNG/PDF 海报）、`slack-gif-creator`（Slack 规格的 GIF，和表情规格冲突）、`hana-design-studio`（HTML 课件；HTML 演讲稿用 `frontend-slides`，见"演讲稿"）、`archify-diagrams`（HTML 图表），以及 `visual-design`、`ui-ux-pro-max`、`impeccable-design`、`frontend-design`、`theme-factory` 这类界面设计和配色主题技能。它们的产物进不了 Remotion，自带的配色字体还会盖掉用户这次说的风格。视频、表情、封面一律在 Remotion 里做，构思可以借鉴，产物照本文件的流程出。用户点名要用其中某个时照用户说的
- 表情包不调 motioner，它是为成片写的
- 用户装的 superpowers 插件每次开场都要求"先 brainstorming 再动手"。本项目做视频和表情不走它的 brainstorming、writing-plans、executing-plans：问需求照"开工前先问清楚"，方案只写作品目录的 `brief.md`，不在 `docs/superpowers/` 下写 spec 或 plan，也不为它们单独提交。改脚本、查 bug 时它的 systematic-debugging、verification-before-completion 照常用
- 和本文件的分工：
  - 方法以 motioner 为准：概念四行、每道场景边界只有一个变形载体、一条时间线踩拍子、音效按帧写、逐个转场审查。它的硬规则全部照做
  - 口味让位于本文件：它的四色场配色、英文字体搭配（extended grotesk + italic serif + mono）、方向偏好只是缺省值。风格照"工作方式"里"没有固定风格"和用户这次的描述来，中文字体照"字体"那条
  - 规格、配音、字幕、成片校验（`npm run video`）照本文件
  - 它的 Remotion 模板已经放在 `src/shared/motion/`，不再复制到 `src/motioner/`。`motion.ts` 改过 `hexToRgb`，技能更新时对比着合并，不要整个覆盖
  - 它的 Python 脚本（`transition_review.py`、`contact_sheet.py`、`sync_check.py`、`synth_score.py`、`build_mix.py`、`beat_grid.py` 等）在技能目录的 `scripts/` 下，调用技能时会给出目录，不复制进仓库。用 `.venv/Scripts/python.exe` 运行，要的 NumPy、SciPy、Pillow 在 uv 环境里，FFmpeg 在 PATH 上。没装 OpenCV，`transition_review.py` 退回 PIL 解码，审一部 90 秒的片子要几分钟。混音用 `npm run mix`，转场审查和音效对帧用 `npm run review`，它们自己找技能目录
  - 时间线：一个作品一份 `src/videos/<作品>/timeline.json`（不是技能写的 `src/timeline.json`），章节、事件帧、BPM 都只写在这里，画面、配乐、审查计划都读它，别的地方不再手写帧号。其中 `transitions` 直接写成 `transition_review.py` 的计划格式（`[{name, start, end, kind, handoffs?}]`），不另抄一份 transitions.json
  - 配音片的节拍：配音定长度，节拍去迁就它。先用 `layoutVoice` 排好配音，再调章节交界那句的 `pauseAfterMs`，让每个章节起点吸附到最近的整拍，差得多就小幅调 BPM；章节内部的动作和音效照常踩拍。改了 `pauseAfterMs` 要重跑 `npm run voice` 才会写进清单（文字没变的句子不会重新请求）
  - 声音：配乐和音效默认用代码合成，用户点名素材库或别的曲子时才用现成的，这时先跑技能的 `beat_grid.py`，把 BPM 和首拍写进 timeline.json 再排画面。合成用 `npm run mix -- src/videos/<作品>`，依次跑下面四步，改了 timeline.json 就整个重跑：
    - `scripts/make_score.py` 把 timeline.json 转成 `audio/score.json` → 技能的 `synth_score.py audio/score.json --out audio/synth` → `build_mix.py audio/synth/cues.json --out audio/mix.wav`，同时出 `mix.cues.json`（对帧用）、`mix.cues.md`、`mix.timeline.png`
    - `scripts/voice_mix.py`：按 `layoutVoice` 的帧号把配音铺上去（没有配音就只做母带），用 `build_mix.py` 的线性增益 + 限幅器压到 -14 LUFS，出 `public/videos/<作品>/audio/fullmix.wav`（`src/private/` 的作品对应 `public/private/`）。没有配音也要这一步：`build_mix.py` 自己的响度表有个优先级错误，读数偏高 3–6 dB，`mix.wav` 实际偏轻，`voice_mix.py` 会把它修正了再测
    - `voice_mix.py` 照 `layoutVoice` 的算法排配音，`leadInMs`、`gapMs` 从 timeline.json 读（都缺省 500），所以这两个值只写在 timeline.json，作品调用 `layoutVoice` 时从那里传，两边才对得上
    - 音乐音效床和配音的比例写在 timeline.json 的 `voiceMix`（`bedGainDb`、`voiceGainDb`，motioner 建议音乐压在混音下 12–13 LU），命令行的 `--bed-gain` 只用来试，试好写回去，不然重新生成就不是同一条混音。限幅超过 `maxLimitingDb`（默认 4 dB）它会降目标响度而不是压扁瞬态，这时 `npm run video` 报响度"注意"，跟用户说明，要更响就调高配音或压低音效床
    - 这些 WAV 不进 git（`.gitignore` 已排除），新克隆的仓库跑一遍 `npm run mix` 就能逐字节重建；提交 `score.json`、`synth/cues.json`、`mix.cues.json` 这些文本。合成那两步在 motioner 技能里，没有技能的机器重建不了
    - 成片用 `npm run video -- <id> --mix=public/videos/<作品>/audio/fullmix.wav`：画面静音渲染，再用 FFmpeg 合入混音。这是技能的硬规则：让渲染器自己编码音频，实测每个音效晚 42.7ms，音轨还比画面长。有合成配乐的作品别漏了 `--mix`，不然成片只有配音
    - Studio 里要听声音，可以临时用 `<Audio>` 放 fullmix，这时去掉 `<VoiceTrack>`，不然配音播两遍。别提交这样的代码：fullmix 不进 git，克隆下来是 404
    - 最后 `npm run review` 对帧，见"工作方式"
  - 字幕条不算它禁止的"对观众说话的文字"。但字幕以外的大字照它的要求演，不要把画面做成字幕条加幻灯片
- motioner 是 Claude 桌面版的账号技能，终端里的 `claude` 没有它。调不到时照 `src/shared/motion/` 的约定和 `StyleDemo.tsx` 做，并告诉用户这次没用上技能

## 目录约定

- `src/Root.tsx`：注册 Composition，用 `<Folder>` 分组。`checks/` 里的直接 import；作品不写死，`src/videos/`、`src/stickers/`、`src/private/` 下每个子目录的 `index.tsx` 默认导出一个注册 Composition 的组件，自动收进同名分组（写法见各目录的 `README.md`）。新作品要建 `index.tsx`，不然 Studio 里看不到
- `src/shared/`：和题材、风格都无关的通用代码，比如默认字体（`fonts.ts`）、表情用的 `StickerComposition`（`sticker.tsx`）。某个作品专用的字体、配色放在它自己的目录里
- `src/stickers/<套系>/`：一个表情一个 Composition，用 `StickerComposition` 注册：固定 240×240，帧率只能选 20 或 25，Studio 里渲染默认就是透明 GIF。生成图处理后的素材放 `public/stickers/<套系>/`
- `src/videos/<作品>/`：一个视频一个目录，不按题材分。配音台词 `voice.json`、Manim 场景 `*.py`、分镜评审页的 `board/` 也放在这里
- 每个作品目录（视频或表情套系）都有一份 `brief.md`，见"作品方案"
- `src/private/<作品>/`：用了商标、他人形象、网络梗图等有版权问题的作品，连私有仓库也不进（不进 git），`Root.tsx` 自动收进 private 分组，用法见 `src/private/README.md`。素材放 `public/private/<作品>/`（同样不进 git），换电脑要自己拷。其他作品照常放 `src/videos/`、`src/stickers/`，它们只进私有仓库，不会公开（见"仓库"）
- `decks/<名字>/`：演讲稿（PPTX 或 HTML），见"演讲稿"。和作品一样只进私有仓库
- `src/templates/<名字>/`：用户存下来的模板，每个有 `template.md` 和参数化组件；`ideas.md`：灵感本。见"模板和灵感"
- `src/checks/`：环境自检用的 Composition。`checks/voice/`、`checks/formula/` 是配音字幕和公式的完整用法示例，`StickerArtCheck` 是生成图做表情的示例，`LottieCheck`、`RoughCheck`、`D3Check`、`MapCheck` 是各种画面手法的示例（见"画面手法"）
- `src/gallery/`：动效样片库，`effects/` 下一个效果一个文件，见"动效样片库"
- `public/`：字体、图片、配音、BGM/SFX，代码里用 `staticFile()` 引用。`npm run voice`、`npm run manim` 的产物放在和作品目录对应的位置（`src/videos/foo/` → `public/videos/foo/voice/`、`public/videos/foo/manim/`），跟着提交进私有仓库
- `public/library/`：用户平时收集的素材库，分 `sfx/`（音效）、`bgm/`（背景音乐）、`svg/`（图标、角色、装饰）、`images/`。清单在 `public/library/index.md`，每个素材一行：描述、来源、许可。直接用 `staticFile("library/...")` 引用，不复制到作品目录。用户放了新素材但没写描述时，帮着补上：图形打开看，音频用 ffprobe 测时长、音量
- `scripts/`：转码、校验、配音等脚本
- `out/`：渲染产物，不进 git

## 仓库

- 两个 GitHub 仓库：`origin` 是私有的 `shenmingganlin/CodeVideo-private`，工作台加作品、素材都在这里，平时的提交、推送、PR 照常往这里走；`public` 是公开的 `shenmingganlin/CodeVideo`，只有工作台
- 公开仓库只用 `npm run sync-public` 写：它从私有仓库的 `main`（`--ref=` 可改）挑出白名单里的文件拼成一个提交，缺省只预演，`--push` 才推送。两边历史互不相干，别把 `public` 设成 origin，也别往公开仓库直接推
- 算工作台的：`scripts/`、`src/shared/`、`src/templates/`、`src/checks/`、`public/fonts/`、`public/checks/`、`CLAUDE.md`、`README.md` 和配置文件；`ideas.md`、`public/library/index.md` 只发布表头。作品目录（`src/videos/*`、`src/stickers/*` 和 `public/` 下对应的素材）、素材库里的文件只在私有仓库。新加的顶层文件或目录不在白名单里时脚本会列出来，是工作台就加进 `scripts/sync-public.mjs` 的 `PUBLISH`
- 工作台的改动合进私有仓库的 `main` 后，问用户要不要同步到公开仓库，不自己推。公开仓库的提交说明（`--message=`）只写工作台改了什么；会发布的文件（脚本、模板、示例、CLAUDE.md）里别抄进作品的台词、方案和素材

## 默认规格

- 视频：用户没说规格时用 1920×1080、30fps；要竖屏、方形或别的规格时，照用户说的来
- 表情包只做自用主图，不做上架用的封面、图标、横幅：
  - 240×240 GIF，≤500KB，无限循环
  - 帧率用 20 或 25。GIF 帧时长以 1/100 秒计，15fps 会节奏不均；50fps（每帧 2/100 秒）文件本身合法，但微信播放时会把这么短的帧往上取整，实测整个慢一倍，不要用
  - 首尾帧要能无缝衔接
  - 透明背景时，角色外圈加不透明描边，用深色或角色本身的颜色，不用白色。成品放在 #EDEDED（微信浅色底）和 #111111（深色底）上各检查一遍
  - 透明背景上不用半透明的光晕和柔和阴影：Remotion 导出会直接把它们丢掉，gifski 会把它们抖成一圈点
  - 导出和校验统一用 `npm run sticker -- <id>`（`scripts/sticker.mjs`）。它先用 Remotion 自带的 GIF 导出，平涂画面这样效果最好；超过 500KB 就自动改用 PNG 序列 + gifski，quality 按 90、80、70、60、50 往下降直到达标。降到 50 还超就报体积"不合格"，不会自己减帧或缩图，这时减少帧数或缩小角色。渐变多的画面用 gifski 体积能小约 40%，但会带一点颗粒
  - 导出后会校验尺寸、体积、循环、帧时长和首尾接缝，并在 `out/stickers/` 生成浅色底、深色底的抽帧预览图（校验现成的 GIF 时也放这里）。帧时长：有短于 4/100 秒（超过 25fps）或为 0 的帧算"不合格"；不是每帧 4 或 5/100 秒（比如 10fps）、或者忽快忽慢算"注意"；编码器把相同帧合并成整数倍的长帧不算问题。"透明背景"看的是解码后的像素。交付前看一遍预览图；有"不合格"就修好再交，"注意"要跟用户说明

## 开工前先问清楚

用户提出新视频或新表情时，和用户把方案商量到定稿再动手：分几轮问，前一轮的回答决定后一轮给什么选项；方案写成分镜评审页，用户逐个镜头留言，改到定稿；先做一段样片，满意了再做全片。改现有作品、修小问题不走这一套。

- 怎么问：
  - 用提问工具（Claude Desktop 里是选项卡片），没有提问工具时用文字列出来。卡片自带"其他"，不要再加"自己补充"这类选项
  - 一张卡片只问一个问题，用户答完再出下一张。同一张卡上的几个问题看不到彼此的答案，后一个的选项就没法照前一个来编。工具一次能放 4 个问题，也不这么用
  - 每轮只问这一步要定的，选项照前面所有的回答现编，不套固定清单。每个问题给 2–4 个具体选项，第一个是推荐项，标"（推荐）"并用一句话说明为什么（比如"讲解类 B 站视频常见 3–5 分钟"）
  - 不用问的不问：前面的回答已经定了的（没配音就不问字幕），或者只有一个合理答案的（帧率缺省 30），直接写进分镜页的规格，用户要改就在页面上留言
  - 回答之间有冲突时单独出一张卡问怎么取舍，不自己调和。比如选了水彩手绘又选了深色底的发光线条，或者选上的手法在选项说明里写着"和……冲突"。踩过的坑：思考里发现了好几次冲突，最后一次也没问用户
  - 用户在消息里已经说清楚的轮次直接跳过。任何一轮用户说"你看着办""随便"，剩下的轮次都按推荐项填，在分镜页里写明选了什么，不再追问
  - 选项写看得见的效果（"格子落进水里泛起涟漪""手绘草图感"），技术名放在说明里。用户说不清想要的动画是常态，靠给具体的画面让用户挑，不靠追问形容词
  - 涉及素材时先查 `public/library/index.md`，`ideas.md` 里有相关的点子也列成选项
- 任务清单（Claude Desktop 的 `update_plan`）照下面的轮次列：大类和主题 → 故事线和素材 → 属性 → 挑样片 → 风格和手法 → 分镜页定稿 → 样片 → 成片。每一轮的提问卡片和"推进一步"放在同一条消息里发出，答完一轮就推进一轮，不要攒到最后一次打勾。没做的步骤不能标完成（比如没打开样片库，"挑样片"就不算完）
- 视频分这几轮：
  1. 大类：知识讲解、动画短片、产品介绍、片头、音乐可视化、数据故事……只问大类
  2. 小主题和粗略时长：在大类下给具体方向，定了再用下一张卡问时长范围，它决定后面能装多少内容
  3. 整体内容：给三条真正不同的故事线（不是同一个故事的三种说法），每条两三句讲清开头、中段、结尾。同一轮问用户有没有素材（截图、插画、Logo、录音），有的话建 `public/videos/<作品>/materials/`，按用途分子文件夹，写一份 `README.md` 说明每个文件夹放什么、文件怎么命名（比如 `s03-截图-登录页.png`，前缀是镜头编号），用 `explorer` 打开给用户
  4. 属性按这个顺序一张一张问，前面的答案决定后面的选项：用途和发在哪 → 横竖屏和分辨率 → 精确时长 → 配音和用哪个声音 → 音乐方向（推荐代码合成、踩着画面的拍子，素材库有合适的列成备选）→ 要不要片头片尾。用途放第一个，因为它决定画幅和要不要封面（发 B 站才问封面）。帧率、字幕照"不用问的不问"处理
  5. 风格和动效：
     - 先挑样片，这一步不能省：跑 `npm run gallery` 打开动效样片库，再出一张卡问"喜欢哪几个编号"，选项带一个"没有特别喜欢的，你看着办"，用户也可以在"其他"里写"要 #3 的感觉，但慢一点"。挑中的编号和名字写进分镜页对应镜头的 `动效`。源码没变的样片不重渲，打开只要几秒，别拿"样片多、渲染慢"当理由跳过（踩过）
     - 再一张一张问风格方向、配色，再按 `techniques.md` 的选型表问画面手法（多选）。`techniques.md` 不会自动读进来，问之前先读它；说明里写用什么技术、调哪个技能、成本和坑，第一个推荐项按内容挑。选了还没接入的技术（表里标"未接入"）要说明这次会顺带搭起来、大概多花多少工夫。画面用代码画还是生图也在这一轮定（见"生图"）
  6. 分镜评审页：问完第 5 轮马上开页面，不先写片子。先在对话里用几句大白话讲概念四行，再写分镜表、配粗略草图，用户在浏览器里逐个镜头留言，改到用户点"定稿"。见下面"分镜评审页"
     - 定稿前只做便宜的草图：挂样片库的片子、几张静帧、几秒低分辨率草稿，每个镜头花几分钟。不写 `timeline.json`，不逐帧写整部片，不改 `src/shared/` 和别的作品。草稿 Composition 可以先建在作品目录里，定稿后照定下来的改成正式的
     - 踩过的坑：问完风格就直接写了整部片（时间线、逐帧画面、三个图层），花了半小时自己出图修图，快做完才开分镜页。用户要是否定方向，这些就白做了
  7. 样片：挑全片最难或最有代表性的 5–10 秒（不一定是开头），按成片的画质和声音做，改到用户满意。只渲染这一段：`npx remotion render <id> out/<id>-sample.mp4 --frames=<起>-<止> --muted`，再用 FFmpeg 从 `fullmix.wav` 截同一段时间（起帧 ÷ 帧率）合进去
  8. 成片：照"工作方式"渲染、转场审查、音效对帧后交付
- 表情走精简版：大类（反应、打招呼、节日……）→ 梗或台词 → 角色（用户给的图、代码画，还是生图）、动作、帧率和帧数、透明还是带底色、单个还是一套 → 风格和画法（代码画的话按 `techniques.md` 挑平涂类的手法：SVG、Rough.js、Lottie、Zdog）→ 分镜评审页（每个表情一个镜头，配静帧或草稿 GIF）→ 先做一个表情当样片，满意了再做全套

### 分镜评审页

视频和表情的方案不在对话里贴大段文字，写成分镜表在浏览器里给用户看。工具是 `scripts/board.mjs`，文件在作品目录的 `board/`：

- `board/board.json` 是分镜表，格式照 `scripts/board/example.json`：
  - 顶层写标题、轮次 `round`（从 1 起）、一段话的概要、规格、概念四行（种子、章节动词、变成链、首尾呼应）、节拍和声音、要用户拍板的 `questions`
  - 每个镜头写时间、第几拍、章节、画面、动效、运镜、转场、声音、技术，`why` 写为什么这么做
  - 写数字不写形容词："镜头 1.5 秒推近到 1.3 倍""涟漪每拍一圈"，不写"流畅""高级感"。拿不准的点写进镜头的 `questions`
  - 动画光靠文字说不清，每个镜头尽量在 `media` 里挂几秒粗草图（`npx remotion render <id> out/board/<作品>/s1.mp4 --frames=<起>-<止> --scale=0.5`）或几张静帧（`npm run stills`）；用户挑中的样片可以直接挂 `out/gallery/<名字>.mp4`。草图只能放在 `out/`、`public/` 或作品目录里
  - 表情用的是同一个页面：每个表情一个镜头，`media` 挂静帧和草稿 GIF
- 打开：用 `run_in_terminal` 在用户的终端面板里跑 `npm run board -- src/videos/<作品>`（表情是 `src/stickers/<套系>`），它在 3200 起的空端口起本地服务器并打开浏览器。不要用 Bash 跑，它要一直开着。页面每 1.5 秒自动刷新，改了分镜或草图不用叫用户刷新
- 一轮循环：
  1. 用户留完言回对话里说"看留言"，跑 `npm run board -- src/videos/<作品> --list` 读待处理的留言
  2. 照留言改 `board.json`、重做草图，`round` 加 1。意思不清的留言先在对话里问，不要猜
  3. 每条改完跑 `--resolve=<编号,…> --reply="<改了什么>"`，回复显示在页面上那条留言下面。没照做的也要回复说明为什么
  4. 在对话里一两句话说这轮改了什么，请用户再看
- 定稿：用户在页面上点"这一轮定稿"，`--list` 会显示"已定稿"。之后 `round` 再变就算没定稿，要用户重新点。定稿后把定下来的写进 `brief.md`，章节、事件帧、转场写进 `timeline.json`，再做样片
- `comments.json` 只让页面和 `--resolve` 写，不要手改。`board/` 跟着作品提交进私有仓库，留着方案是怎么改过来的；`out/` 下的草图不进 git

### 动效样片库

用户说不清想要什么动画时，给现成的画面挑。样片在 `src/gallery/effects/<名字>.tsx`，`npm run gallery` 渲染成循环小片，拼成 `out/gallery/index.html` 用浏览器打开（直接开文件，不用起服务器）：

- 每个效果有固定编号和中文名（写看得见的效果，比如"#1 格子落水泛涟漪"），分组：文字、形状、水墨、线条、转场、数据、镜头、粒子、质感、背景、特效。用户按编号点名，编号不重排，新效果接着往后编
- 样片只演动效，配色是 `kit.tsx` 里的中性占位色，作品里照用户的风格换。做作品时把样片的代码抄进作品目录改，不 import `src/gallery/`
- 加效果：照 `effects/grid-ripple.tsx` 写，默认导出 `GalleryEffect`（编号、名字、分组、一句话描述、技术、帧数、组件），`index.tsx` 自动收进 Studio 的 gallery 分组，id 是 `G-<文件名>`。3–5 秒、首尾无缝、一段只演一种效果
- 源码没变的不重渲（哈希记在 `out/gallery/<名字>.json`），`--force` 全部重渲。网页的格子放 480×270 的小片（`<名字>.small.mp4`）和封面，只播屏幕上看得见的，点开放大才播原片：二十几段原片一起解码网页会卡。每段渲染完量首尾接缝：报"接缝跳"是最后一帧接不回第一帧，报"不动"是整段几乎没变化，都要修好再给用户看
- 做作品时搭出来的、能复用的效果，问用户要不要收进样片库

## 作品方案

用户在分镜评审页定稿后，在作品目录写 `brief.md`，之后接着改、换对话、换模型都先读它。只记定下来的事，几行到十几行，不写过程：

- 需求（用户原话的要点）、规格（分辨率、帧率、时长或帧数、封面）
- 视频：概念四行（种子、章节动词、变成链、首尾呼应）、节拍（BPM，章节落在第几拍）、内容分段
- 表情：套系里每个表情的梗
- 风格：配色色值、字体、画风；用了生图就写上统一的风格提示词，同一作品的每张图都带上它
- 画面手法和工具：用了哪些技术（Lottie、Rough.js、D3、地图、Manim……）、各管哪几段画面、调了哪些技能；用了现成素材（Lottie 动画、地图图源）写上来源和许可
- 声音（语音、语速、BGM、音效）、字幕、用到的素材库文件
- 用户后来提的修改，改完同步更新对应条目

## 模板和灵感

- 灵感：用户说"记一下""有个点子"时，追加一行到 `ideas.md`（日期、点子、做视频还是表情、参考），不当场展开做。用户开新作品时，`ideas.md` 里有相关的就列成选项
- 存模板：作品做成、用户满意后，其中有能换素材重复用的效果或流程（比如"上传一张图就能做的跳动表情"），问用户要不要存成模板，不擅自存。存的时候：
  - 把效果抽成参数化组件放 `src/templates/<名字>/`，原作品改成用这个组件，保证模板是跑通过的
  - 写 `template.md`：效果、用户要提供什么、要问的（每项带推荐默认）、固定做法（不再问）、步骤、参数、坑、来源作品。格式参照 `src/templates/blink-breathe/template.md`
  - 模板只管做法，不带风格：配色、字体、文字都做成参数，每次按本次需求定
- 套用：用户说"用 X 模板"时先读 `template.md`，只问"要问的"里用户没说清的，其余照模板做，不再走完整的开工提问；`brief.md` 写上"套用模板 X"和用了哪些参数。用户要的超出模板范围时，照常问
- 改模板：改组件前 grep 一下哪些作品用了它，改完这些作品要照样能渲染
- 现有模板：`blink-breathe`（眨眼呼吸，生图角色 + 闭眼差分做待机表情）、`squish`（原地压扁回弹，一张透明图做成"duang duang"表情）

## 工作方式

- 先在 Studio 里预览，用户明确要成片时才渲染。转场审查和分镜评审页要用的草稿自己渲染就行，不用等用户开口；样片是用户定稿后要的，也照常渲染。视频成片用 `npm run video -- <id>`（有合成混音时加 `--mix=…`），它渲染完会校验规格、像素格式和响度；有"不合格"就修，"注意"跟用户说明
- 环境出怪问题、换了电脑或升级了工具，先跑 `npm run doctor`
- 交付前用 `npm run contact -- <id>` 出关键帧预览图（或 `npx remotion still` 渲染单帧），自己看过再交
- 视频交付前还要跑 `npm run review -- src/videos/<作品> out/<id>.mp4`：
  - 转场：按 timeline.json 的 `transitions` 跑 motioner 的 `transition_review.py`，审查图出在 `out/review/<作品>/`。打开每张图，逐个转场写结论（好 / 弱 / 坏、帧号、原因），坏的修好再交。脚本的 flag 只是提示，结论要看图下
  - 音效：有 `audio/mix.cues.json` 时跑 `sync_check.py`。合成音效的起音点本身就可能偏一点，配音盖住的地方也会匹配偏，所以先测合进成片的那条混音当基线（缺省找 `fullmix.wav`，没有再用 `mix.wav`，别的用 `--mix` 指定），再拿成片逐条和基线比，差不超过半帧算对上。"不合格"要修：偏了，或者混音里有、成片里找不到（成片音轨静音、截短、合错文件）；整体偏一个常数多半是没用 `--mix` 合轨。"注意"是混音里也匹配不上的条目，去听一下。脚本自己出错（没有音轨、技能目录不对）会直接报错退出，不会拿上一次的结果充数
  - 没打开看过的图不说"看过了"
- 用户在对话之外改过的代码不要覆盖，看到意外改动先确认
- 视频一律用 Remotion 做，不改用 HyperFrames 或浏览器录屏
- 没有固定题材。每个视频的内容和结构都在对话里和用户一起定，不自己预设题材模板，比如固定的片头片尾、分镜结构、版式。模板只来自用户点头保存的、已经做成的效果（见"模板和灵感"），而且只在用户点名时套用。motioner 的概念四行是方法，不是题材模板：每片的种子和章节都重新想，也不和上一片重复
- 没有固定风格。每次按用户在对话里描述的风格做；用户没指定时，按内容挑合适的，简单说明理由，方便用户再改。不要把某个作品的风格做成全局主题或默认配色
- 字体随每次的风格挑选，但都要显式加载，不依赖系统字体：
  - 本地的可商用字体放 `public/fonts/`，用 `@remotion/fonts` 加载
  - Google Fonts 上的中文字体（站酷快乐体、马善政楷书、志莽行书等）用 `@remotion/google-fonts` 加载，第一次用到时再安装
  - 没有特别要求时用思源黑体
- 作品要用到还没有的能力时（比如音乐卡点、3D），在做这个作品时一起搭。其中能复用、和题材风格都无关的部分放进 `src/shared/` 或 `scripts/`，并写进本文件，后面的对话直接用
- 改 `src/shared/`、`scripts/` 里已有的代码之前，先用 `git status` 看那几个文件有没有别的对话没提交的改动，有就先问用户。改完把用到它的作品和自检各渲染一帧（`npx remotion still`），渲染过了才能说"别的还能跑"
- 新增 `@remotion/*` 包时，版本和 `remotion` 保持一致（当前 4.0.537），写固定版本号

## 工具

- gifski 命令行版 1.34.0 放在 `tools/gifski/gifski.exe`（不进 git），脚本里用这个路径调用。`C:\Program Files\gifski\` 下的是图形版，从命令行运行会弹出窗口并卡住，不要调用它，也不要依赖 PATH 里的 `gifski`
- FFmpeg 和 ffprobe 在 PATH 上，用来转码和检查成品
- Python 工具（edge-tts 7.3.1、Manim 0.22.0、Pillow 13.0.0、NumPy 2.5.4、SciPy 1.18.1）用 uv 管理：依赖写在 `pyproject.toml`，版本锁在 `uv.lock`，环境在 `.venv/`（不进 git）。`npm run voice`、`npm run manim`、`npm run sticker-art` 会自动用这个环境，改了依赖运行 `uv sync`
- TeX Live 2026 装在 `C:\texlive\2026`，给 Manim 的 `MathTex` 用（含 ctex、dvisvgm）
- 抠图用 `rembg`（uv 依赖，带 `[cpu]`）：`from rembg import remove` 一行就能去背景，u2net 模型首次自动下载。
  适合照片/梗图这种主体和背景色差小的图；纯色背景的简单图用色差阈值也行，但软阴影分不开。只换 alpha 不改像素
- Edge 语音是微软的免费接口，不是正式服务，随时可能变或失效，所以生成的配音要提交进私有仓库，不依赖重新生成
- 视频的配乐默认照 motioner 合成（见"做视频先调技能"）。`scripts/bgm.py` 只出不踩事件的底噪和音景，适合不需要卡点的片子（uv 环境）：`npm run bgm -- public/videos/<作品>/bgm` 出 `bed.mp3`，没有版权问题。默认 `--style=bed` 是可无缝循环的轻电子底噪，所有频率都取整到整周期，接缝不会咔哒；和弦 8 秒一换，长度向上取整到 8 秒的倍数。`--style=sparse` 是长鸣加钟音的稀疏音景（适合无配音的短片），出 `ambient.mp3`，不循环，靠首尾淡入淡出。`--loudness=-16` 顺手做响度归一。用户点名素材库的曲子时就用素材库
- 纸纹、颗粒这类防色带的底图用 `scripts/paper.py` 生成：`npm run paper -- <输出.png> [--width] [--height] [--color] [--seed]`
- Studio 固定用 3100 端口（`remotion.config.ts` 里设置）。别把它改回 3000，否则开着 Studio 时渲染会误连到它而报错

## 配音、字幕、公式

这些都只管数据和排版，字幕、公式画成什么样由每个作品自己定。

- 配音（`scripts/voice.py`）：台词写在作品目录的 `voice.json`，运行 `npm run voice -- src/videos/<作品>` 生成每句的 mp3 和逐词时间。格式见脚本开头的注释
  - `voice` 必填，没有默认语音：每个作品按内容挑，跟用户说明理由。`npm run voice -- --voices` 列出中文语音
  - 文字和语音参数没变的句子不会重新请求。Edge 不支持自定义 SSML，想在句中停顿就拆成两句
  - Edge 报的词起点比 mp3 解码后真正出声早约 100ms，脚本统一往后挪了 70ms，实测字幕比声音早 0–40ms
- 时间轴（`src/shared/voice.tsx`）：在 `calculateMetadata` 里用 `loadVoice("videos/<作品>")` 读清单，`layoutVoice(清单, { fps })` 把每句一句接一句排开，返回每句的起始帧和视频总长；`<VoiceTrack lines={...} />` 播放配音，`lineById()` 按 id 找某句，用来让画面对上配音
  - 句间停顿 `gapMs`（默认 500ms）按"上一句最后一个词读完到下一句开口"算，不受 Edge 音频首尾静音的影响；单句用 `voice.json` 里的 `pauseAfterMs` 覆盖
- 字幕（`src/shared/captions.ts`）：`toSubtitles(layout.lines, { maxChars })` 按标点和停顿断成一条条字幕，`activeSubtitle(字幕, 毫秒)` 取当前该显示的那条；每条的 `tokens` 可以做逐词高亮。逐词时间是 Remotion 的 `Caption` 格式，`@remotion/captions` 的工具也能直接用
- 公式（`src/shared/tex.tsx`）：``<Tex tex={String.raw`...`} display />`` 用 KaTeX 排版，字体在渲染前就加载好。字号跟 `style.fontSize`，局部上色用 `\textcolor`，局部动画用 `\htmlClass`、`\htmlStyle`；公式里的汉字默认思源黑体，`cjkFont` 可以换
- Manim（`scripts/manim.mjs`）：公式变形、几何动画写成 Manim 场景，`npm run manim -- src/videos/<作品>/scenes.py` 渲染成透明 WebM，再用 `src/shared/manim.tsx` 的 `<ManimClip>` 嵌入（时长用 `loadManimMeta()` 在 `calculateMetadata` 里读）
  - 帧率默认 30，要和 Composition 一致；`--size` 可以改画面尺寸
  - 场景里的文字写 `public/fonts/` 里的字体名，比如 `Text("…", font="Noto Sans SC")`；公式里有汉字时 `MathTex` 加 `tex_template=TexTemplateLibrary.ctex`
  - Manim 默认是白字，浅色背景上要自己设颜色。颜色、字体都按作品的风格写在场景里

## 动效

- `src/shared/motion/`：做"电影感"的通用工具箱，来自 motioner 技能的 `templates/remotion/`，和题材风格无关，任何作品都能用。方法以技能为准（见"做视频先调技能"），这里只记工具和本仓库踩过的坑。画面要好看靠的是方法，不是工具，所以先读这里的约定
  - `motion.ts`：缓动按用途挑（`ease.out` 入场、`ease.inOut` 位移、`ease.snap` 变形载体、`ease.whip` 甩镜），`smoothTrack` 做不减速穿过关键帧的轨道，`mixColor`/`colorRamp` 在 OKLab 里混色，`rand` 给确定性随机
  - `creative.tsx`：`Grain`（颗粒+暗角，防色带）、`HudFrame`、`Burst`、`Counter`（滚数）、`KineticWord`（字随词义动）、`EchoTrail`、`ParticleForm` 等，还有 `beatFrame`（把拍子换成帧）、`speedCurve`（给甩镜音效跟速度用）
  - `transitions.tsx`：`FloodReveal`（从某个元素涌出下一场）、`ZoomThrough`、`WhipPan`、`MotionBlur`、`SharpZoom`
  - `Morph.tsx`：`MorphCarrier` 共享元素变形，`PathMorph`/`LetterMorph` 靠 flubber
  - 用之前记住几条硬规则：一个种子物体贯穿全片，首尾呼应；场与场之间用变形/涌动/推镜，不用硬切和淡入淡出；章节切换落在拍子上；画面永远有一个明确的视觉焦点，别让字飘在一片空里；重要的话让字形自己演出意思；不要"元素出现/消失"式的动画，要连续运动
  - 坑：`mixColor` 的返回值是 `rgb(...)`，再喂回去也能用（已支持），但别把 `rgba()` 的四段当三段
  - 参考实现：`src/checks/StyleDemo.tsx`（一个方块炸成 1000 个，再变回一个，12 秒）

## 画面手法

- 选型表在 `techniques.md`：每种技术擅长什么画面、怎么接进 Remotion、对应技能、成本和坑、接入了没有。开工提问的"画面手法"照它问；新接入一种技术、或者踩到新坑，回头更新这张表
- Remotion 始终是总装线（时间线、配音、混音、成片、审查），其他技术只是画面层，两种接法：
  - 现画：在 Composition 里每帧画出来（SVG、Canvas、Lottie、Rough.js、D3、地图，以后的 p5.js、着色器、Three.js）
  - 预渲染：在外面渲染成透明 WebM 或 PNG 序列再嵌回来（Manim，以后的 Blender、逐笔累积的笔刷、物理模拟）
- 硬规则：画面只能由帧号算出来。Remotion 用多个标签页并行、乱序渲染，靠自己时钟跑的东西（requestAnimationFrame、CSS 动画和过渡、库自带的 play()/flyTo、Math.random）每个标签页跑得不一样。新接一个库先查它有没有"跳到第 N 帧/第 t 秒"的接口，没有就预渲染
- 已接入的（用法示例都在 `src/checks/`）：
  - Lottie：`src/shared/lottie.tsx`。`loadLottie()` 在 `calculateMetadata` 里读 `public/` 下的 JSON，`<LottieClip>` 播放，`lottieFrames()` 换算时长。别直接用 `@remotion/lottie` 的 `<Lottie>`：它把视频的帧号直接当 Lottie 的帧号，60fps 的动画放进 30fps 的视频会慢一半。带 `wiggle()`、`random()` 表达式的动画每个标签页抖得不一样，要在 AE 里先转成关键帧。示例 `LottieCheck`（同一个手写弹球的 30fps、60fps 两份，并排应该同步）。现成动画的来源和许可证写进 `brief.md`
  - Rough.js：`src/shared/rough.tsx`。一律用 `roughGenerator(seed)` 生成图形：Rough.js 的 seed 缺省为 0，会改用 Math.random；不传 options 时几个图形还共用一个随机数状态，前面多画一个图形后面全变样。`<RoughPaths progress>` 画进 `<svg>`，描边和排线一笔笔画出来；`useBoilSeed(seed, 3)` 做手绘的抖线。示例 `RoughCheck`
  - D3：只当计算库，d3-scale、d3-shape、d3-geo、d3-hierarchy 算出坐标再自己画 SVG；d3-selection、d3-transition 直接改 DOM、靠时钟动，不用。力导向图用 `src/shared/d3.ts` 的 `precomputeForce()` 预先 tick 出每帧位置。示例 `D3Check`
  - 地图：`src/shared/map.tsx` 的 `<MapLibre>`，`setup` 加图层、设地球投影，`update(map, frame)` 每帧 `jumpTo` 相机、改数据，不用 flyTo/easeTo。航线、距离用 `@turf/turf`。示例 `MapCheck`（地球视角画航线，推进到曼哈顿看 3D 建筑）。要点：
    - 渲染时要联网（样式、瓦片、字形、unpkg 上的 worker）。1080p 120 帧本机约 1 分 40 秒；本机缺省 GL 就能画，报 WebGL 错时加 `--gl=angle`，出问题把并发调小
    - 矢量样式的图层按缩放级别整层出现（建筑 14 级、POI 15 级），推镜头穿过这些级别时亮度会跳一下，要平滑就在图层的 opacity 上按 zoom 插值
    - 每帧都动相机时，卫星图、地形纹理在无界面渲染里可能闪。只做 2D 平移缩放就用 remotion-best-practices 技能里 maps 的 fixed map plate；真 3D 地形飞行用 Cesium，要 MapTiler 或 Google 的 key，还没接
    - 图源署名必须留在画面上（`attribution` 必填）
    - 图源：缺省用 OpenFreeMap 的 Liberty 样式（不要 key、不限量、允许商用、带 3D 建筑；没有 SLA，可能停服），署名"OpenFreeMap © OpenMapTiles Data from OpenStreetMap"。OSM 的署名规范：地图是画面主体时角落署名，简介或片尾再写一遍并附 openstreetmap.org/copyright。MapTiler、Stadia 的免费档不许商用，换图源先查条款。地形可以接 Mapterhorn 或 AWS Terrain Tiles（terrarium 编码，免 key），还没接、没实测
    - 发 B 站的中国合规（2026-10-23 整理的资料，不是法律意见）：《地图管理条例》要求公开的地图送审、标审图号，景区图、街区图、地铁线路图这类简单地图除外；"谁公开谁送审"，视频也算。OSM 系图源（OpenFreeMap、MapTiler、Stadia、CARTO 都是）按实际控制画国界，台湾、钓鱼岛等和我国标准地图不一致，也没有审图号，所以：
      - 画面里有国界、中国全图或有争议地区时，不用 OSM 系图源。用天地图（自然资源部的 WMTS 栅格瓦片，能当 MapLibre 的 raster 源；在 lbs.tianditu.gov.cn 注册开发者申请 key，写进 `.env`），不改边界、不删注记，画面上标来源和审图号（2026-10 是 GS（2026）4921号，用的时候去官网核对）；只要一张静态底图就从标准地图服务（bzdt.ch.mnr.gov.cn）下载，标它的审图号；或者避开这个机位。天地图还没接、没实测，没有 3D 建筑
      - 只拍城市街区、不带国界的画面可以用 OSM 系图源（算不算街区图例外是推断）。国内 OSM 数据薄，建筑多半没有高度
      - 在有审图号的地图上叠路线、调色、倾斜算不算"直接使用"，没查到官方说法。拿不准就问省级自然资源主管部门，或者送审（免费，约 20 个工作日）
      - 从高德、腾讯、百度取的坐标是 GCJ-02 / BD-09，放到 OSM 或天地图上要先转回 WGS-84，不然偏几百米
    - 开工提问选了地图、内容又涉及中国时，把上面的取舍列成选项问用户
- 还没接入的，用到再搭（见"工作方式"：作品要用到还没有的能力时一起搭）：Canvas 2D、p5.js、着色器、Three.js（`@remotion/three`，规则在 remotion-best-practices 技能的 3D 部分）。搭的时候照上面的样子：接入组件放 `src/shared/`，自检放 `src/checks/`，写进本节和 `techniques.md`
- Blender 用户定了不装（2026-10-23）：3D 先用 Three.js，作品确实需要写实材质、物理模拟、Grease Pencil 时，先问用户再装
- 社区的 Three.js、着色器、生成艺术技能大多用 rAF 或墙钟时间，有几个触发范围过宽，只当参考读，不装（见 `techniques.md`"现成的技能"）

## 生图

- `scripts/image.mjs` 调用「猫肥生图」（`gpt-image-2.5-sunburst`，OpenAI 兼容接口）。地址、模型、Key 在 `.env`（不进 git，格式见 `.env.example`），不要读出或打印 Key。提示词和参考图会发到这个第三方服务
- 文生图、图生图（`--image`）实测可用，`--background=transparent` 返回真透明的 RGBA PNG。分辨率、质量、张数每次按用途定，不写进配置；实测要 1024x1024 返回的是 1254×1254，用之前用 ffprobe 看实际尺寸
- 局部重绘（`--mask`）不适合透明素材：带 `--background=transparent` 时接口返回 502，不带时返回的是不透明的 RGB 图。要做差分（眨眼、换嘴型）就用不带蒙版的图生图，提示词写"保持角色、画风、描边、配色和姿势完全不变，只改……"，实测位置几乎不动
- 每次调用都花用户的钱、要 30–100 秒，偶尔返回 502"模型服务暂时不可用"，等一会儿重试：先用 `--quality=medium` 出一两张定方向，用户确认后再出 high 或多张
- 同一角色的不同表情、差分都用图生图，把基准图当参考图。动作用 Remotion 做，不逐帧生图
- 什么交给生图：角色、插画、场景背景、氛围图、封面底图。什么用代码画：要求准确的内容（物理示意、公式、图表、几何、文字），这些生图画不准也改不了细节
- 一个作品里的多张图用 `brief.md` 里同一段风格提示词，不然每张画风不一样
- 生成的图旁边有同名 `.json` 记提示词和参数。要留作素材的放进 `public/library/images/` 并在清单里记来源"猫肥生图 gpt-image-2.5-sunburst"
- 做表情：提示词要求"大轮廓、粗深色描边、少细节、透明背景"（240×240 下细节看不清）；生成后用 `npm run sticker-art -- <图.png>… --out=public/stickers/<套系>/` 处理：裁掉空白、缩到长边 200、透明度二值化、加不透明外描边。同一角色的差分图一起处理，一样大的图共用一个裁剪框，输出完全对齐，可以直接来回切换；不是差分的图分开处理（一起处理时内容范围重合度低于 0.5 会提示）。输出文件名和原图一样，所以生图原图别放在 `--out` 目录里：会盖掉原图时脚本直接报错，原图要留着做图生图。用法示例是 `src/checks/StickerArtCheck.tsx`（眨眼 + 呼吸）
- 插画颜色多，GIF 体积容易超过 500KB，一般会走 gifski；还超就减少帧数或缩小角色

## 演讲稿

工作台也做演讲稿，用两个装在用户目录的技能（`~/.claude/repos/` 下的 git 克隆，停在版本标签上，用目录联接挂进 `~/.claude/skills/`），不进本仓库：

- 选哪个：
  - 要在 PowerPoint、WPS 里打开和改的 PPTX：`ppt-master`（hugohe3/ppt-master v6.7.3，MIT）。页面先写成 SVG，再导出原生可编辑的 PPTX；它自带浏览器实时预览，用户在页面元素上留意见，助手跑它的 `check_annotations.py` 处理
  - 在浏览器里放、带动画的单文件 HTML 演讲稿：`frontend-slides`（zarazhangrui/frontend-slides v2.1.0，MIT），零依赖。导出 PDF 会丢动画
  - 视频照样用 Remotion 做，这两个不出视频画面
- 用户要演讲稿时，先问要 PPTX 还是网页，再调对应技能，照技能自己的流程走。提问照样用选项卡片、用中文，不加"自己补充"选项
- 作品放 `decks/<名字>/`，只进私有仓库（`sync-public` 不发布）。ppt-master 建项目时加 `--dir decks`，不然会建在当前目录的 `projects/` 下；它建的目录名带画幅和日期
- ppt-master 的 Python：技能里写的 `python3` 一律换成 `~/.claude/repos/ppt-master/.venv/Scripts/python.exe`。这是 uv 建的独立环境，实际装的版本记在 `~/.claude/repos/ppt-master/requirements.lock.txt`，不装进本仓库的 `.venv`
- ppt-master 的生图（`image_gen.py`）先不用：它读当前目录的 `.env`，也就是本仓库的生图配置，两边的后端设置对不上。要配图用本仓库的 `npm run image`，照"生图"那节先问用户
- frontend-slides 的 `deploy.sh` 会把演讲稿发布到 Vercel 公网，用户明确要才跑；`export-pdf.sh` 在临时目录装 Playwright 和 Chromium，不碰本仓库
- ppt-master 的环境里有 PyMuPDF（AGPL-3.0），别把它或它的代码带进本仓库
- 更新：`git -C ~/.claude/repos/<技能> fetch --tags` 后 checkout 新的版本标签；ppt-master 再跑 `uv pip install --python .venv/Scripts/python.exe -r skills/ppt-master/requirements.txt`，重新导出 `requirements.lock.txt`。不用它自带的 `update_repo.py`：克隆停在标签上，不在分支上

## 封面

- 发 B 站的视频要封面时，在作品目录加一个 `Cover` Composition（单帧），用 `npx remotion still` 导出 PNG。底图可以生图，标题文字用代码排，不让生图写字
- B 站上传页会按 16:10 和 4:3 两种比例裁封面（记忆中推荐 1146×717，没查到最新官方说明）：画成 1920×1080，标题和主体放在中间 4:3 的范围里，上传时在裁剪框里再看一眼

## 常用命令

- `npm run dev`：打开 Studio
- `npm run lint`：ESLint + TypeScript 检查
- `npx remotion still <id> out/<名字>.png --frame=<帧号>`：渲染单帧
- `npm run video -- <id> [--out=out/<id>.mp4] [--crf=18] [--mix=<混音.wav>] [--gl=angle] [--concurrency=1]`：渲染视频成片（yuv420p、bt709）并校验分辨率、帧率、帧数、像素格式、音轨时长、响度（目标 -14±3 LUFS）和 true peak（≤ -1 dBTP）；`--mix` 时画面静音渲染、FFmpeg 合入混音；`--gl`、`--concurrency` 给 WebGL 画面用（见"画面手法"）；`npm run video -- <文件.mp4>` 只校验
- `npm run review -- src/videos/<作品> <成片.mp4> [--only=transitions|sync] [--mix=<混音.wav>]`：motioner 的转场审查和音效对帧，结果在 `out/review/<作品>/`。技能目录找不到时设 `MOTIONER_DIR`
- `npm run mix -- src/videos/<作品>`：timeline.json → 总谱 → 合成 → 按帧混音 → 配音和母带，出 `public/videos/<作品>/audio/fullmix.wav`，约 1–2 分钟。只改了 `voiceMix` 时单独跑 `.venv/Scripts/python.exe scripts/voice_mix.py src/videos/<作品> [--bed-gain=<dB>] [--voice-gain=<dB>]`，增益缺省读 timeline.json 的 `voiceMix`
- `npm run stills -- <id> <帧号…> [--scale=0.5] [--out=out/stills/<id>]`：一次打包渲染多张单帧，比逐张 `npx remotion still` 快
- `npm run sync-public [-- --push] [--ref=main] [--message=<说明>]`：把工作台同步到公开仓库，缺省只预演，见"仓库"
- `npm run board -- <作品目录> [--list] [--resolve=<编号,…> --reply=<回复>] [--no-open]`：分镜评审页，见"开工前先问清楚"
- `npm run gallery [-- <名字…>] [--force] [--no-open]`：渲染动效样片库并打开网页，见"动效样片库"
- `npm run doctor`：环境预检（Node、FFmpeg、gifski、uv 和 Python 依赖、TeX、字体、motioner 技能目录、.env 是否填好）
- `npm run voice -- src/videos/<作品>`：生成配音和逐词时间，加 `--force` 全部重新生成；`npm run voice -- --voices` 列出中文语音
- `npm run manim -- src/videos/<作品>/scenes.py [场景名…] [--fps=30] [--size=1920x1080]`：渲染透明的 Manim 片段，不写场景名就渲染全部
- `npm run image -- "<提示词>" --out=<路径.png> [--image=参考图] [--mask=蒙版] [--size=1024x1024] [--quality=medium] [--background=transparent] [--n=1]`：生图、改图
- `npm run bgm -- public/videos/<作品>/bgm [--seconds=32] [--bpm=60] [--style=bed|sparse] [--loudness=-16]`：合成 BGM，bed 可循环，sparse 适合无配音短片
- `npm run paper -- <输出.png> [--width=1080] [--height=1920] [--color=F6F3EC] [--seed=7]`：生成细颗粒纸纹底图
- `npm run contact -- <id> [--count=8] [--frames=0,90,300] [--cols=4] [--bg=EDEDED]`：关键帧预览图，出在 `out/contact/<id>.png`，每张标帧号和时间
- `npm run sticker-art -- <图.png>… --out=<目录> [--size=200] [--outline=3] [--color=auto]`：生成图转表情素材
- `npm run image-box -- <图.png|webp>…`：量图片的透明留白，打印内容范围和 `box` 参数（配合模板 `squish` 用）
- `npm run sticker -- <id> [<id>…]`：导出并校验表情，id 可用 `*` 通配，比如 `"Cat*"`；`--all` 导出所有 240×240 的 Composition
- `npm run sticker -- <文件.gif>`：只校验现成的 GIF，比如剪映或 gifski 图形版导出的
- `npm run sticker -- <id> --encoder=remotion` 或 `--encoder=gifski`：只用指定的编码方式，用来对比。要用等号连着写，不认识的选项直接报错
- `npx remotion render <id> out/<名字>.gif --codec=gif --image-format=png`：Remotion 自带的 GIF 导出，保留透明
- `npx remotion render <id> out/frames/<名字> --sequence --image-format=png`：导出透明 PNG 序列
- `tools/gifski/gifski.exe --fps <帧率> --quality 90 -o out/<名字>.gif out/frames/<名字>/element-*.png`：用 gifski 编码 PNG 序列，`--fps` 要和 Composition 的帧率一致
