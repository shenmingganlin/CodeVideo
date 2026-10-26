# CodeVideo

用 Remotion 写代码动画的个人工作区，做各种题材的视频（可能发 B 站）和微信/QQ 自用表情包。题材、内容和风格都不固定，每次在对话里定。

## 做视频先调技能

这条排在本文件所有流程前面。之前三个视频（楞次定律、排序算法、诗笺）都没调用 motioner，做出来是"幻灯片 + 字幕条"：本文件自带一整套流程，却一直没提技能，技能就被跳过了。

- 新做视频，或改现有视频的画面、动效、转场、声音：第一个动作是用 Skill 工具调用 `anthropic-skills:motioner`，排在提问、写方案、读代码之前。用户没提也要调。只改错字、换配音这类不碰画面的小改动不用调
- 写 Remotion 代码时，用到字幕、音频、渲染、Studio、转场、动态模糊、漏光、effects、Lottie、地图、3D、GIF 之类的具体 API，按需调用 `remotion-best-practices`（它的描述只有一句"Router for all Remotion skills"，不会自己冒出来，要主动调）；写 Manim 场景前调用 `manimce-best-practices`
- 顺序：新视频先调 motioner → 照"开工前先问清楚"分轮提问，画面手法这一项先读 `techniques.md` 再问 → 写分镜评审页，改到定稿 → 样片 → 成片。动手写某种手法的代码前，调它在选型表里对应的技能或子文档。用户说"快速模式"时，分镜定稿以后照"快速模式"一节做
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
    - 作品里用 `src/shared/timeline.ts` 读：`const tl = timeline(data)` 加载时就查章节有没有首尾相接、铺满整片，事件帧有没有超出片长；`tl.chapterAt(f)`、`tl.local(f)`（本章第几帧和进度）、`tl.event("名字")`（写错名字直接报错）、`tl.beat(n)`、`tl.blend(f, ch => ch.field)`（章节交界处混颜色或数字）。不在作品里再写"现在在哪一章"。2026-10-24 之前的作品是自己写的，不用改
    - 名字容易混：`gapMs` 是配音的句间停顿，`gap_ms` 是配乐合成的音符间隔，两个不是一回事
  - 配音片的节拍：配音定长度，节拍去迁就它。先用 `layoutVoice` 排好配音，再调章节交界那句的 `pauseAfterMs`，让每个章节起点吸附到最近的整拍，差得多就小幅调 BPM；章节内部的动作和音效照常踩拍。改了 `pauseAfterMs` 要重跑 `npm run voice` 才会写进清单（文字没变的句子不会重新请求）
  - 反过来，画面定长度、配音往里塞的片子（动作要演多久就多久）：在 timeline.json 写 `voiceAt`（每句第一个词开口的帧），`npm run place-voice -- src/videos/<作品>` 反推每句的 `pauseAfterMs` 和 `leadInMs`，前一句没读完后一句就要开口时直接报错、列出差多少帧，再 `npm run voice`。不手调停顿
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
- `guides/`：不是每次都用的细则，用到时才读：表情（`stickers.md`）、地图（`maps.md`）、生图（`image-gen.md`）、演讲稿（`decks.md`）。本文件只留一行指路，免得每一轮对话都带着
- `src/checks/`：环境自检用的 Composition。`checks/voice/`、`checks/formula/` 是配音字幕和公式的完整用法示例，`StickerArtCheck` 是生成图做表情的示例，`LottieCheck`、`RoughCheck`、`D3Check`、`MapCheck` 是各种画面手法的示例（见"画面手法"），`checks/sketch/` 是分镜草图（`ShotSketches` + `npm run sketch`）的示例，`CanvasCheck`、`ShaderCheck`、`ThreeCheck` 是 Canvas 2D、着色器、Three.js 图层的示例，`BakeCheck` 是预览烘焙（`npm run bake`）的示例，`LayoutCheck` 是版面检查（`npm run layout`）的自检，应该正好报出三处
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
- 表情包：240×240 GIF、≤500KB、帧率 20 或 25、无限循环、首尾无缝，`npm run sticker -- <id>` 导出校验。做表情前先读 `guides/stickers.md`（规格细则、透明背景的描边、生图转素材、导出命令）

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
- 任务清单（Claude Desktop 的 `update_plan`）照下面的轮次列，就这 8 步，不拆不加（调技能不单列一步）：大类和主题 → 故事线和素材 → 属性 → 挑样片 → 风格和手法 → 分镜页定稿 → 样片 → 成片。快速模式的后两步不一样，见"快速模式"
  - 每出一张卡片之前先看一眼：这张卡问的事属于清单上哪一步？那一步不是当前"进行中"的，就在出这张卡的同一条消息里用 `{"done": [...], "start": N}` 把清单拨到那一步。所以每轮的第一张卡都带一次清单更新，同一轮后面的卡不用
  - 对照：大类、主题、时长 → 1；故事线、素材 → 2；用途到片头片尾 → 3；跑 `npm run gallery` 和问编号 → 4；风格、配色、手法 → 5；开分镜页 → 6
  - 踩过的坑：开场推进了一次，之后连出 8 张卡（主题、时长、故事线、素材、用途、画幅、配音、音乐）一次没动，清单一直停在"问大类"转圈
  - 没做的步骤不能标完成（比如没打开样片库，"挑样片"就不算完）
- 视频分这几轮：
  1. 大类：知识讲解、动画短片、产品介绍、片头、音乐可视化、数据故事……只问大类
  2. 小主题和粗略时长：在大类下给具体方向，定了再用下一张卡问时长范围，它决定后面能装多少内容
  3. 整体内容：给三条真正不同的故事线（不是同一个故事的三种说法），每条两三句讲清开头、中段、结尾。同一轮问用户有没有素材（截图、插画、Logo、录音），有的话建 `public/videos/<作品>/materials/`，按用途分子文件夹，写一份 `README.md` 说明每个文件夹放什么、文件怎么命名（比如 `s03-截图-登录页.png`，前缀是镜头编号），用 `explorer` 打开给用户
  4. 属性按这个顺序一张一张问，前面的答案决定后面的选项：用途和发在哪 → 横竖屏和分辨率 → 精确时长 → 配音和用哪个声音 → 音乐方向（推荐代码合成、踩着画面的拍子，素材库有合适的列成备选）→ 要不要片头片尾。用途放第一个，因为它决定画幅和要不要封面（发 B 站才问封面）。帧率、字幕照"不用问的不问"处理
     - 精确时长要出卡问，不算"不用问的"：第 2 轮只定了范围（比如 45–60 秒），选项在这个范围里按故事线的段数给 2–3 个具体秒数（"56 秒：五段各约 11 秒（推荐）"）。用户第 2 轮已经说了确切秒数才跳过。踩过：跳过这张卡，自己定了 56 秒
  5. 风格和动效：
     - 先挑样片，这一步不能省：跑 `npm run gallery` 打开动效样片库，再出一张卡问"喜欢哪几个编号"。直接跑，不用先读样片源码、数文件（踩过：先跑了 5 条命令看目录）；出选项要的编号、名字用 `npm run gallery -- --list` 一次拿到，不 grep 源码
       - 卡片的选项：2–3 组按这次内容推荐的编号组合（每组写编号和名字，比如"#16 推镜穿过圆窗 + #18 颜色从按钮里涌出"，说明写为什么配这片），最后一个是"没有特别喜欢的，你看着办"。只有第一个标"（推荐）"。题目里写明"喜欢别的编号就在'其他'里写，也可以写'要 #3 的感觉，但慢一点'"：86 个里只摆 4 个单独的编号，等于替用户挑了（踩过）
       - 挑中的编号和名字写进分镜页对应镜头的 `motion` 开头（"样片 #16 推镜穿过圆窗：……"），`media` 里挂 `out/gallery/<文件名>.mp4`，写法见 `scripts/board/example.json` 的 s1。踩过：挑了 #16、#18，分镜页里一个编号都没有
       - 样片源码没变时不到 1 秒就打开，别拿"样片多、渲染慢"当理由跳过（踩过）。它开头报"要渲染 N 个"就是样片用到的代码真改过，几十个要几分钟：用 Bash 的后台模式跑，跟用户说要等几分钟，跑完会有通知，不用 `sleep` 轮询；等的工夫可以先出风格那几张卡（清单拨到 5），网页打开了再拨回 4 问编号，两步都做完才各自标完成
     - 再一张一张问风格方向、配色，再按 `techniques.md` 的选型表问画面手法（多选）。`techniques.md` 不会自动读进来，问之前先读它；说明里写用什么技术、调哪个技能、成本和坑，第一个推荐项按内容挑。选了还没接入的技术（表里标"未接入"）要说明这次会顺带搭起来、大概多花多少工夫。画面用代码画还是生图也在这一轮定（见"生图"）
  6. 分镜评审页：问完第 5 轮马上开页面，不先写片子。见下面"分镜评审页"
     - 顺序：在对话里用几句大白话讲概念四行（单独一段，不埋在别的话里）→ 写只有文字的 `board.json`（镜头表、样片编号和样片的 `media`）→ 马上用 `run_in_terminal` 打开页面 → 再一个镜头一个镜头补草图。页面每 1.5 秒自动刷新，草图出一张页面上多一张，用户不用干等。问完到页面打开应在 10 分钟内
     - 草图只做到这个程度：每个镜头一两张静帧，各画各的。写法：作品的 `index.tsx` 用 `src/shared/sketch.tsx` 的 `<ShotSketches prefix shots={{ s1: { component: S1 }, … }} />` 一个镜头注册一个小 Composition（键名和 board.json 的镜头 id 一样），board.json 写 `"sketch": "<prefix>"`，再 `npm run sketch -- src/videos/<作品>` 出到 `out/board/<作品>/<镜头>.png`，它会列出哪些图还没挂进 `media`。示例 `src/checks/sketch/`。不做镜头之间的衔接，不逐帧修接缝，不对拍子（BPM、章节落在第几拍只当数字写进分镜页），不调配乐。草图里看到的毛病写进那个镜头的 `questions` 或说明，不去修
     - 限时：一个镜头的草图超过 5 分钟左右还没出来，就先只留文字，在说明里写"草图后补"
     - 不写 `timeline.json`，不逐帧写整部片，不改 `src/shared/` 和别的作品。草稿 Composition 建在作品目录里，定稿后照定下来的改成正式的
     - 先算再写：台词或画面说的是算出来的事实（哪个圆最大、谁反着转、剩三个圆时像什么、曲线过不过某点、数据的最大值在哪），写进分镜页之前先用一小段脚本把它算出来，结果和用的参数写进那个镜头的说明。算出来和想的不一样，就改台词或改素材，再定稿。这不算"逐帧写整部片"，只算数、不画画面。踩过：一部讲解片的分镜写的画面事实是凭印象定的，到样片才算出来不成立，素材、笔顺、排序全部返工
     - 版面分区：画面上同时有主体和字（公式、标注、字幕）的镜头，在说明里写每块占的矩形（"公式区 右上 x 1020–1866、y 96–480；波 y 420–900"），算一下会不会撞：数字会变长的（"剩 9 个圆"→"剩 100 个圆"）按最长的算，会动的主体按它跑到的最远处算。成片前 `npm run layout` 再逐帧查一遍
     - 第一轮的提问是"请在页面上逐个镜头留言，看完回来说'看留言'"，不问"能定稿吗"：用户还没留过一条言
     - 踩过的坑（两次）：第一次问完风格就写了整部片（时间线、逐帧画面、三个图层），半小时后才开分镜页。第二次规则已经写了"只做草图"，还是把 56 秒整片写成一个 586 行的"草稿 Composition"，又花 20 分钟逐帧修第 1255–1263 帧的接缝、把章节挪到整拍上，问完 32 分钟才开页面。草稿只要画得出来就会一路修下去，所以先开页面、草图按镜头分开画、不修
  7. 样片：挑全片最难或最有代表性的 5–10 秒（不一定是开头），按成片的画质和声音做，改到用户满意。只渲染这一段：`npm run video -- <id> --frames=<起>-<止> --mix=public/videos/<作品>/audio/fullmix.wav`，混音会自动从起帧对应的时间截同一段合进去，出 `out/<id>-f<起>-<止>.mp4`。交给用户前审一遍：`npm run review -- src/videos/<作品> out/<id>-f<起>-<止>.mp4 --frames=<起>-<止>`，转场计划和音效清单自动平移，基线混音截同一段，打印的帧号是全片的，结果在 `out/review/<作品>-f<起>-<止>/`。别自己拼脚本平移（踩过：临时拼的 Python 报了三次错）
  8. 成片：照"工作方式"渲染、转场审查、音效对帧后交付
- 表情走精简版：大类（反应、打招呼、节日……）→ 梗或台词 → 角色（用户给的图、代码画，还是生图）、动作、帧率和帧数、透明还是带底色、单个还是一套 → 风格和画法（代码画的话按 `techniques.md` 挑平涂类的手法：SVG、Rough.js、Lottie、Zdog）→ 分镜评审页（每个表情一个镜头，配静帧或草稿 GIF）→ 先做一个表情当样片，满意了再做全套

### 分镜评审页

视频和表情的方案不在对话里贴大段文字，写成分镜表在浏览器里给用户看。工具是 `scripts/board.mjs`，文件在作品目录的 `board/`：

- `board/board.json` 是分镜表，格式照 `scripts/board/example.json`：
  - 顶层写标题、轮次 `round`（从 1 起）、一段话的概要、规格、概念四行（种子、章节动词、变成链、首尾呼应）、节拍和声音、要用户拍板的 `questions`
  - 每个镜头写时间、第几拍、章节、画面、动效、运镜、转场、声音、技术，`why` 写为什么这么做
  - 写数字不写形容词："镜头 1.5 秒推近到 1.3 倍""涟漪每拍一圈"，不写"流畅""高级感"。拿不准的点写进镜头的 `questions`
  - 动画光靠文字说不清，每个镜头在 `media` 里先挂用户挑中的样片 `out/gallery/<文件名>.mp4`（文件名用 `npm run gallery -- --list` 查），再挂一两张静帧草图（`npm run sketch`，见第 6 轮）。几秒的动态草稿（`npm run video -- <id> --frames=<起>-<止> --draft --out=out/board/<作品>/s1.mp4`）只在某一镜的动作用样片和静帧都说不清时才做。草图只能放在 `out/`、`public/` 或作品目录里
  - 表情用的是同一个页面：每个表情一个镜头，`media` 挂静帧和草稿 GIF
- 打开：用 `run_in_terminal` 在用户的终端面板里跑 `npm run board -- src/videos/<作品>`（表情是 `src/stickers/<套系>`），它在 3200 起的空端口起本地服务器并打开浏览器。不要用 Bash 跑，它要一直开着。页面每 1.5 秒自动刷新，改了分镜或草图不用叫用户刷新
- 一轮循环：
  1. 用户留完言回对话里说"看留言"，跑 `npm run board -- src/videos/<作品> --list` 读待处理的留言
  2. 照留言改 `board.json`、重做草图，`round` 加 1。意思不清的留言先在对话里问，不要猜
  3. 每条改完跑 `--resolve=<编号,…> --reply="<改了什么>"`，回复显示在页面上那条留言下面。没照做的也要回复说明为什么
  4. 在对话里一两句话说这轮改了什么，请用户再看
- 留言编号是"镜头 id-第几条"：`s3-2` 是 s3 镜头的第 2 条，`整体-1` 是整体的第 1 条。页面上、`--list`、`--resolve=s3-2,整体-1`、对话里都用这个编号，问用户某条留言的意思时也写编号（"s3-2 说的'最后一种'是指……"）。编号一经给出不变，撤回的也占号；老的纯数字 id 也认
- 定稿：用户在页面上点"这一轮定稿"，确认区里点"确定定稿"，`--list` 会显示"已定稿"，终端里也记一行"第 N 轮定稿"。之后 `round` 再变就算没定稿，要用户重新点。定稿后把定下来的写进 `brief.md`，章节、事件帧、转场写进 `timeline.json`，再做样片
  - 用户说"定稿了"以后先跑 `--list`。显示的不是"已定稿"就告诉用户没记上、请再点一次，不要照"用户说了"往下做。踩过：页面上点了定稿却没记上（旧版用浏览器的 prompt 问备注，点"取消"就整个作废），助手查到 approvals 是空的，没告诉用户，自己当定稿往下做了
- `comments.json` 只让页面和 `--resolve` 写，不要手改。`board/` 跟着作品提交进私有仓库，留着方案是怎么改过来的；`out/` 下的草图不进 git

### 动效样片库

用户说不清想要什么动画时，给现成的画面挑。样片在 `src/gallery/effects/<名字>.tsx`，`npm run gallery` 渲染成循环小片，拼成 `out/gallery/index.html` 用浏览器打开（直接开文件，不用起服务器）：

- 每个效果有固定编号和中文名（写看得见的效果，比如"#1 格子落水泛涟漪"），分组：文字、形状、水墨、线条、转场、数据、镜头、粒子、质感、背景、特效。用户按编号点名，编号不重排，新效果接着往后编
- 样片只演动效，配色是 `kit.tsx` 里的中性占位色，作品里照用户的风格换。做作品时把样片的代码抄进作品目录改，不 import `src/gallery/`
- 加效果：照 `effects/grid-ripple.tsx` 写，默认导出 `GalleryEffect`（编号、名字、分组、一句话描述、技术、帧数、组件），`index.tsx` 自动收进 Studio 的 gallery 分组，id 是 `G-<文件名>`。3–5 秒、首尾无缝、一段只演一种效果
- 源码没变的不重渲（哈希记在 `out/gallery/<名字>.json`），`--force` 全部重渲。哈希只算这个效果沿相对路径 import 到的文件，加上 `index.tsx`、`kit.tsx` 和它们 import 到的；改 `src/shared/` 里样片没用到的文件不会触发重渲（以前整个 `src/shared/` 一起算，别的对话改了样片没用到的着色器引擎，就让 86 段全部重渲了好几分钟）。字体文件、npm 包升级不在哈希里，要重渲加 `--force`。网页的格子放 480×270 的小片（`<名字>.small.mp4`）和封面，只播屏幕上看得见的，点开放大才播原片：二十几段原片一起解码网页会卡。每段渲染完量首尾接缝：报"接缝跳"是最后一帧接不回第一帧，报"不动"是整段几乎没变化，都要修好再给用户看
- 做作品时搭出来的、能复用的效果，问用户要不要收进样片库

## 快速模式

用户说"快速模式"时走这一套，没说就走正常流程。开工前照常问清楚，之后一次写完全片，用户在 Studio 里实时看、按反馈改：不反复渲染、不看图调试、不抠细节、不审查。第一版粗是预期的，靠用户的反馈一轮轮改好。

- 不变的：先调 motioner（概念四行、章节动词、变形载体照用，它的转场审查、音效对帧不做）；8 轮提问照问，样片库照挑；规格、字体、目录、`brief.md`、`timeline.json` 照本文件。画面照样只由帧号算出来，Studio 里看到的和导出的才一样
- 任务清单前 6 步照常，后两步换成三步：写第一版 → 按反馈改 → 导出
- 分镜页只写文字：镜头表、概念四行照写，`media` 只挂样片库的视频，不画草图（不建 `<ShotSketches>`、不跑 `npm run sketch`）。照留言改到定稿，定稿后写 `brief.md`、`timeline.json`
- 定稿后一次写完整部片，不单做样片，第一版就是样片
- 声音：配音照常 `npm run voice`，Studio 里能听到配音、看到字幕。合成配乐和音效先不做，画面定了、导出前跑一次 `npm run mix`
- 怎么看：`preview_start` 起 `remotion-studio`（3100 端口），在桌面版的浏览器面板里打开这部片子；用户也可以自己 `npm run dev` 在浏览器里看。时间轴能拖，显示帧号和秒数。很重的画面在 Studio 里可能卡，导出不受影响：这层基本定了以后，用 `<PreviewBake>` + `npm run bake` 烘焙成视频给 Studio 播（见"画面手法"），先跟用户说是哪一层、要等多久；这层后来又改了就重烘。不靠降画质换流畅
- 每改一次只做秒级的检查：`npm run lint`，再用 `preview_console_logs` 看有没有报错白屏。不为看效果截图、渲静帧、渲草稿；只有用户说的问题从代码里看不出原因时，才截那一帧看一次。改完说改了哪几处、在第几秒，请用户看
- 反馈请用户带上时间或帧号（"第 8 秒那个字"）。同一轮的反馈攒齐一起改
- 导出：用户说"导出"时，有配乐先 `npm run mix`，再 `npm run video -- <id> [--mix=…] [--gl=angle]`，它照常校验规格和响度，"不合格"要修。不跑 `npm run review`、`npm run layout`、`npm run contact`。导出的渲染时间和正常成片一样，只渲这一次。Studio 自带的 Render 按钮不校验规格、不合混音，不用它交付

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

- 用户看的所有文字一律中文：最后的回复、提问卡片，也包括调工具之间那一两句"现在做什么"的过程说明（"开始写分镜页""草图出好了，挂进页面"）。用户英文不好，这些话是用户跟进度的主要途径。代码、命令、文件名、报错原文照写，不用翻。踩过：一部片子的过程说明 40 段里 32 段是英文（"Opening the motion-effects gallery now."）
- 先在 Studio 里预览，用户明确要成片时才渲染。转场审查和分镜评审页要用的草稿自己渲染就行，不用等用户开口；样片是用户定稿后要的，也照常渲染。视频成片用 `npm run video -- <id>`（有合成混音时加 `--mix=…`），它渲染完会校验规格、像素格式和响度；有"不合格"就修，"注意"跟用户说明
- 改一版要看效果时先用草稿档，不整片出成片：`--draft` 是半分辨率、crf 28、x264 ultrafast，`--frames=<起>-<止>` 只渲改了的那一段，两个可以一起用。整片出成片只在用户要成片、或者交付前审查时。踩过：一部 60 秒的着色器片子每遍 24 分钟，改了十几遍、跑了六七个小时。只渲一段或草稿档时不量响度。草稿档省的是画面计算，打包每次固定要几秒，简单的 SVG 片子快不了多少，重的画面（WebGL、大量粒子）才明显
- 省上下文（用户的额度按"上下文长度 × 调用次数"烧，一部片子做到 400k 上下文、四百多次调用就很费）。质量第一，所以省的是重复和来回，不省审查：
  - 能用数字查的不出图：重叠、出界、残留、谁最大、帧号对不对，写一小段脚本算出数值再下结论。踩过：傅里叶猫调试时同一张静帧改一点渲一次、打开一次，29 张图里 21 张是这样来的
  - 要看局部就只看局部：`npm run stills -- <id> <帧> --crop=x,y,w,h` 原尺寸裁一块，比整帧缩小看得清，图也小
  - 攒一批改动再渲一次看，不改一处看一次。改代码用小块 Edit，不整文件重写；命令输出用 `tail`、`grep` 截到要看的几行
  - 交付前的审查照"工作方式"做全：每张转场审查图、关键帧图都打开看，不为省额度跳过
  - 到阶段节点（分镜定稿写好 `brief.md` 和 `timeline.json`、样片通过）提醒用户 `/compact` 或开新对话，新对话先读 `brief.md` 接上
  - 子代理要从头写一遍缓存（系统提示加本文件几万 token），不当省上下文的手段，只在真有一批独立的活要并行时用
- 环境出怪问题、换了电脑或升级了工具，先跑 `npm run doctor`
- 交付前用 `npm run contact -- <id>` 出关键帧预览图（或 `npx remotion still` 渲染单帧），自己看过再交
- 视频交付前还要跑 `npm run review -- src/videos/<作品> out/<id>.mp4`：
  - 转场：按 timeline.json 的 `transitions` 跑 motioner 的 `transition_review.py`，审查图出在 `out/review/<作品>/`。打开每张图，逐个转场写结论（好 / 弱 / 坏、帧号、原因），坏的修好再交。脚本的 flag 只是提示，结论要看图下
  - 音效：有 `audio/mix.cues.json` 时跑 `sync_check.py`。合成音效的起音点本身就可能偏一点，配音盖住的地方也会匹配偏，所以先测合进成片的那条混音当基线（缺省找 `fullmix.wav`，没有再用 `mix.wav`，别的用 `--mix` 指定），再拿成片逐条和基线比，差不超过半帧算对上。"不合格"要修：偏了，或者混音里有、成片里找不到（成片音轨静音、截短、合错文件）；整体偏一个常数多半是没用 `--mix` 合轨。"注意"是混音里也匹配不上的条目，去听一下。脚本自己出错（没有音轨、技能目录不对）会直接报错退出，不会拿上一次的结果充数
  - 没打开看过的图不说"看过了"
- 有字、公式、标注叠在画面上的片子，交付前（样片和成片都要）跑 `npm run layout -- <id> [--gl=angle]`：逐帧量出打了名字的元素，报出同一帧里互相压住、跑出安全区的，报帧号和名字，不出图。1080p 两分钟的片子五帧一量约 20 秒
  - 作品里给字、公式、标注、字幕加 `{...box("名字")}`，根组件放 `<LayoutProbe safe={…} free={["字幕"]} regions={…} />`（`src/shared/layout.tsx`，示例 `src/checks/LayoutCheck.tsx`）。Canvas 画的主体（波、曲线、角色）用 `regions` 按帧报屏幕矩形，曲线切成窄条报，不报一整个包围盒。故意叠着的写进 `allow`
  - 报出来的每处用 `npm run stills -- <id> <帧> --crop=…` 裁那一块看一眼再下结论，真压住了就修，不是问题就写进 `allow`
  - 踩过：一部片子交付后补跑才查出三处肉眼审查漏掉的：曲线顶到旁注、曲线穿过公式框（分镜评审时用户提过，成片又犯了）、数字变成三位数后挤进画框
- 用户在对话之外改过的代码不要覆盖，看到意外改动先确认
- 视频一律用 Remotion 做，不改用 HyperFrames 或浏览器录屏
- 没有固定题材。每个视频的内容和结构都在对话里和用户一起定，不自己预设题材模板，比如固定的片头片尾、分镜结构、版式。模板只来自用户点头保存的、已经做成的效果（见"模板和灵感"），而且只在用户点名时套用。motioner 的概念四行是方法，不是题材模板：每片的种子和章节都重新想，也不和上一片重复
- 没有固定风格。每次按用户在对话里描述的风格做；用户没指定时，按内容挑合适的，简单说明理由，方便用户再改。不要把某个作品的风格做成全局主题或默认配色
- 字体随每次的风格挑选，但都要显式加载，不依赖系统字体：
  - 本地的可商用字体放 `public/fonts/`，用 `@remotion/fonts` 加载
  - Google Fonts 上的中文字体（站酷快乐体、马善政楷书、志莽行书等）用 `@remotion/google-fonts` 加载，第一次用到时再安装。不在模块顶层调 `loadFont()`：`Root.tsx` 会 import 全部作品，一个作品在顶层拉字体，渲染别的作品时也会去请求 Google Fonts，断网就整个崩。用 `src/shared/googleFont.ts` 的 `lazyFont` 包一层，字体族名写成常量，在作品的根组件里调一次加载：`const MONO = "JetBrains Mono"; const loadFonts = lazyFont(() => loadMono("normal", {...}));`，根组件开头 `loadFonts();`
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
  - 地图：`src/shared/map.tsx` 的 `<MapLibre>`，`setup` 加图层、设地球投影，`update(map, frame)` 每帧 `jumpTo` 相机、改数据，不用 flyTo/easeTo。航线、距离用 `@turf/turf`。示例 `MapCheck`（地球视角画航线，推进到曼哈顿看 3D 建筑）。联网、图层整层跳亮、署名、发 B 站的中国地图合规都写在 `guides/maps.md`，用地图前先读。开工提问选了地图、内容又涉及中国时，照那里的取舍列成选项问用户
  - Canvas 2D：`src/shared/canvas.tsx`。`<CanvasLayer draw={(ctx, frame, size) => …} />` 每帧清空重画；要一步步积分的粒子、弹簧用 `simulate({ init, step, every })`，`.at(frame)` 从最近的检查点往后算，乱序取帧结果一样。拖尾画成"几帧前 → 现在"的线段，不靠不清屏。`simulate` 记着最近 8 帧，Studio 顺着播放时每帧只走一步。示例 `CanvasCheck`、样片 #87
  - 预览烘焙：`src/shared/bake.tsx`。Studio 里实时画不动的重图层（多半是上万粒子、大量线条的 Canvas；着色器、Three.js 走显卡，一般不用）包进 `<PreviewBake id="…">`，`npm run bake -- <id> <烘焙 id> [--frames=<起>-<止>] [--gl=…]` 把这一层单独渲成透明 VP9（crf 10），Studio 两秒内自动换上，层左上角标"烘焙预览"。只给预览用：导出、静帧、版面检查照样现场画，成片和不烘焙一样。包住的层要铺满画面，外层的位移、淡入不进烘焙，在 Studio 里照常套上；放在 `<Sequence>` 里帧号自动对上。这层的代码改了要重烘，`--clear` 删掉回到现场画，`--list` 看烘了哪些。文件在 `public/bake/`，不进 git。实测（`BakeCheck`，12000 根线 6 秒）：烘 35 秒、105MB，和现场画比 PSNR 40.5 dB，解码每帧约 14ms。`public/` 下的文件每次打包都会拷一遍，烘焙用完了 `--clear` 掉
  - 着色器：`src/shared/shader.tsx`。`<ShaderLayer frag={SHADER_NOISE + FRAG} uniforms={…} />`，Shadertoy 写法（只写 `mainImage`）自动补 `iTime`、`iFrame`、`iResolution`；半透明输出要预乘。噪声用 `SHADER_NOISE`（整数哈希），别用 `fract(sin(…))`：显卡和软件渲染能差出整片噪点。示例 `ShaderCheck`、样片 #88
  - Three.js：`src/shared/three.tsx`。`<ThreeLayer shadows>` 包住场景，`<FrameCamera position lookAt fov />` 每帧设相机（`<Canvas camera>` 只读一次），`orbit()` 算绕转机位。动画只由 `useCurrentFrame()` 算，不用 `useFrame()`、`Clock`；命令式改的（InstancedMesh 矩阵、材质参数）必须写在 `useLayoutEffect` 里，写在 `useEffect` 里会画错（实测每个渲染标签页的第一帧方柱全没摆上）。示例 `ThreeCheck`、样片 #89
  - 细节、成本和坑见 `techniques.md`
- GL 后端：Chrome 无界面渲染缺省用的是**软件渲染**（SwiftShader，CPU），`--gl=angle` 才用显卡（RTX 5060，经 D3D11）。着色器用显卡快一倍，Three.js 快两倍多（150 帧带阴影 11 秒对 27 秒），几万根线的 Canvas 反而是软件渲染快。有着色器或 Three.js 的片子一律加 `--gl=angle`。一部片子定一个，静帧（`npm run stills -- … --gl=angle`）、草图（`npm run sketch -- … --gl=angle`）、草稿、成片都用同一个，不然同一帧画出来不一样
- 还没接入的，用到再搭（见"工作方式"：作品要用到还没有的能力时一起搭）：p5.js、Three.js 里的中文立体字（TextGeometry 要 typeface 字体，中文字库太大）。搭的时候照上面的样子：接入组件放 `src/shared/`，自检放 `src/checks/`，写进本节和 `techniques.md`
- Blender 用户定了不装（2026-10-23）：3D 先用 Three.js，作品确实需要写实材质、物理模拟、Grease Pencil 时，先问用户再装
- 社区的 Three.js、着色器、生成艺术技能大多用 rAF 或墙钟时间，有几个触发范围过宽，只当参考读，不装（见 `techniques.md`"现成的技能"）

## 生图

- 角色、插画、场景背景、氛围图、封面底图可以生图；公式、图表、几何、文字这类要求准确的用代码画。每次调用花用户的钱，先问用户
- 用 `npm run image` 之前先读 `guides/image-gen.md`（接口、参数、坑、风格提示词）。Key 在 `.env`，不读出、不打印

## 演讲稿

用户要演讲稿（PPTX 用 `ppt-master`，网页用 `frontend-slides`）时先读 `guides/decks.md`：先问要 PPTX 还是网页，再照那里调技能。作品放 `decks/<名字>/`，只进私有仓库

## 封面

- 发 B 站的视频要封面时，在作品目录加一个 `Cover` Composition（单帧），用 `npx remotion still` 导出 PNG。底图可以生图，标题文字用代码排，不让生图写字
- B 站上传页会按 16:10 和 4:3 两种比例裁封面（记忆中推荐 1146×717，没查到最新官方说明）：画成 1920×1080，标题和主体放在中间 4:3 的范围里，上传时在裁剪框里再看一眼

## 常用命令

- `npm run dev`：打开 Studio
- `npm run lint`：ESLint + TypeScript 检查
- `npx remotion still <id> out/<名字>.png --frame=<帧号>`：渲染单帧
- `npm run video -- <id> [--draft] [--frames=<起>-<止>]`：草稿档（半分辨率、快编码）或只渲一段，混音跟着截同一段，看效果、做样片用，见"工作方式"
- `npm run video -- <id> [--out=out/<id>.mp4] [--crf=18] [--mix=<混音.wav>] [--gl=angle] [--concurrency=1]`：渲染视频成片（yuv420p、bt709）并校验分辨率、帧率、帧数、像素格式、音轨时长、响度（目标 -14±3 LUFS）和 true peak（≤ -1 dBTP）；`--mix` 时画面静音渲染、FFmpeg 合入混音；`--gl`、`--concurrency` 给 WebGL 画面用（见"画面手法"）；`npm run video -- <文件.mp4>` 只校验
- `npm run review -- src/videos/<作品> <成片.mp4> [--only=transitions|sync] [--mix=<混音.wav>] [--frames=<起>-<止>]`：motioner 的转场审查和音效对帧，结果在 `out/review/<作品>/`。审样片加 `--frames`，和渲染样片时写的一样，只审整个落在这段里的转场，结果在 `out/review/<作品>-f<起>-<止>/`。技能目录找不到时设 `MOTIONER_DIR`
- `npm run mix -- src/videos/<作品>`：timeline.json → 总谱 → 合成 → 按帧混音 → 配音和母带，出 `public/videos/<作品>/audio/fullmix.wav`，约 1–2 分钟。只改了 `voiceMix` 时单独跑 `.venv/Scripts/python.exe scripts/voice_mix.py src/videos/<作品> [--bed-gain=<dB>] [--voice-gain=<dB>]`，增益缺省读 timeline.json 的 `voiceMix`
- `npm run stills -- <id> <帧号…> [--scale=0.5] [--crop=x,y,w,h] [--out=out/stills/<id>] [--gl=angle]`：一次打包渲染多张单帧，比逐张 `npx remotion still` 快。`--crop` 按原尺寸渲染再裁出一块（坐标是原尺寸的像素），看局部细节用它，图小、细节不糊。`--gl` 和成片用同一个（以前写死了 angle，2026-10-24 改成缺省和 `npm run video` 一样）
- `npm run layout -- <id> [--every=5] [--frames=<起>-<止>] [--min=6] [--gl=angle]`：版面检查，报同一帧里互相压住、跑出安全区的字和公式，结果在 `out/layout/<id>.json`，见"工作方式"
- `npm run place-voice -- src/videos/<作品>`：按 timeline.json 的 `voiceAt` 反推配音停顿，见"做视频先调技能"的配音片节拍
- `npm run sync-public [-- --push] [--ref=main] [--message=<说明>]`：把工作台同步到公开仓库，缺省只预演，见"仓库"
- `npm run board -- <作品目录> [--list] [--resolve=<编号,…> --reply=<回复>] [--no-open]`：分镜评审页，见"开工前先问清楚"；编号写 `s3-2`、`整体-1`
- `npm run sketch -- <作品目录> [镜头 id…] [--scale=0.5] [--gl=angle]`：把 `<ShotSketches>` 注册的每个镜头渲成静帧，出在 `out/board/<作品>/`，对照 board.json 列出没挂上的图
- `npm run gallery [-- <名字…>] [--force] [--no-open] [--list]`：渲染动效样片库并打开网页，见"动效样片库"；`--list` 只打印编号、名字、分组、文件名和描述
- `npm run bake -- <id> <烘焙 id> [--frames=<起>-<止>] [--gl=angle] [--clear] [--list]`：把 `<PreviewBake>` 包住的重图层烘成透明视频，只给 Studio 预览用，见"画面手法"
- `npm run doctor`：环境预检（Node、FFmpeg、gifski、uv 和 Python 依赖、TeX、字体、motioner 技能目录、.env 是否填好）
- `npm run voice -- src/videos/<作品>`：生成配音和逐词时间，加 `--force` 全部重新生成；`npm run voice -- --voices` 列出中文语音
- `npm run manim -- src/videos/<作品>/scenes.py [场景名…] [--fps=30] [--size=1920x1080]`：渲染透明的 Manim 片段，不写场景名就渲染全部
- `npm run image -- "<提示词>" --out=<路径.png> [--image=参考图] [--mask=蒙版] [--size=1024x1024] [--quality=medium] [--background=transparent] [--n=1]`：生图、改图
- `npm run bgm -- public/videos/<作品>/bgm [--seconds=32] [--bpm=60] [--style=bed|sparse] [--loudness=-16]`：合成 BGM，bed 可循环，sparse 适合无配音短片
- `npm run paper -- <输出.png> [--width=1080] [--height=1920] [--color=F6F3EC] [--seed=7]`：生成细颗粒纸纹底图
- `npm run contact -- <id> [--count=8] [--frames=0,90,300] [--cols=4] [--bg=EDEDED]`：关键帧预览图，出在 `out/contact/<id>.png`，每张标帧号和时间
- 表情的命令（`sticker`、`sticker-art`、`image-box`、gifski 编码）见 `guides/stickers.md`
