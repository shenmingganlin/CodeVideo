# CodeVideo

用 Remotion 写代码动画的个人工作区，做各种题材的视频（可能发 B 站）和微信/QQ 自用表情包。题材、内容和风格都不固定，每次在对话里定。

## 做视频先调技能

这条排在本文件所有流程前面。之前三个视频（楞次定律、排序算法、诗笺）都没调用 motioner，做出来是"幻灯片 + 字幕条"：本文件自带一整套流程，却一直没提技能，技能就被跳过了。

- 新做视频，或改现有视频的画面、动效、转场、声音：第一个动作是用 Skill 工具调用 `anthropic-skills:motioner`，排在提问、写方案、读代码之前。用户没提也要调。只改错字、换配音这类不碰画面的小改动不用调
- 写 Remotion 代码时，用到字幕、音频、渲染、Studio 之类的具体 API，按需调用 `remotion-best-practices`；写 Manim 场景前调用 `manimce-best-practices`
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
- `src/videos/<作品>/`：一个视频一个目录，不按题材分。配音台词 `voice.json`、Manim 场景 `*.py` 也放在这里
- 每个作品目录（视频或表情套系）都有一份 `brief.md`，见"作品方案"
- `src/private/<作品>/`：用了商标、他人形象、网络梗图等有版权问题的作品，连私有仓库也不进（不进 git），`Root.tsx` 自动收进 private 分组，用法见 `src/private/README.md`。素材放 `public/private/<作品>/`（同样不进 git），换电脑要自己拷。其他作品照常放 `src/videos/`、`src/stickers/`，它们只进私有仓库，不会公开（见"仓库"）
- `src/templates/<名字>/`：用户存下来的模板，每个有 `template.md` 和参数化组件；`ideas.md`：灵感本。见"模板和灵感"
- `src/checks/`：环境自检用的 Composition。`checks/voice/`、`checks/formula/` 是配音字幕和公式的完整用法示例，`StickerArtCheck` 是生成图做表情的示例
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

用户提出新视频或新表情的需求时，先把需求问完整，再动手。改现有作品、修小问题不用问。

- 要确认的项目（用户已经说清楚的不再问，只问缺的）：
  - 视频：主题和要点、时长、分辨率和帧率（横屏/竖屏/方形）、风格和配色、要不要配音和用哪个声音、要不要字幕、BGM 和音效（推荐代码合成、踩着画面的拍子，素材库有合适的列成备选）、要不要片头片尾、画面用代码画还是生图（见"生图"）、发 B 站的话要不要封面
  - 表情：梗或台词、角色（用户给的图、代码画，还是生图）、动作、帧率和帧数、透明还是带底色、单个还是一套
- 怎么问：
  - 用提问工具（Claude Desktop 里是选项卡片，一次最多 4 个问题，问不完就分两轮），没有提问工具时用文字列出来
  - 每个问题给 2–4 个具体选项，第一个是推荐项，标"（推荐）"并用一句话说明为什么推荐（比如"讲解类 B 站视频常见 3–5 分钟"）。用户随时可以不选选项，自己补充
  - 涉及素材时先查 `public/library/index.md`，有合适的就把它们列成选项，让用户决定用不用
  - 问完给一份简短方案，用户确认后再做。视频方案开头先写 motioner 的概念四行：种子物体、章节（5–8 段，每段一个动词）、变成链（每个箭头用哪种变形）、首尾呼应，再写节拍（BPM）、内容分段、画面、声音、规格；表情方案写内容、画面、规格。用户提出修改就改方案再确认。视频的分镜多时，先搭出粗略画面，用 `npm run contact` 出一张关键帧预览图给用户确认，再细做
- 用户说"你看着办""随便"时，直接按推荐项做，在方案里写明选了什么，不再追问

## 作品方案

用户确认方案后，在作品目录写 `brief.md`，之后接着改、换对话、换模型都先读它。只记定下来的事，几行到十几行，不写过程：

- 需求（用户原话的要点）、规格（分辨率、帧率、时长或帧数、封面）
- 视频：概念四行（种子、章节动词、变成链、首尾呼应）、节拍（BPM，章节落在第几拍）、内容分段
- 表情：套系里每个表情的梗
- 风格：配色色值、字体、画风；用了生图就写上统一的风格提示词，同一作品的每张图都带上它
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

- 先在 Studio 里预览，用户明确要成片时才渲染。转场审查要用的草稿自己渲染就行，不用等用户开口。视频成片用 `npm run video -- <id>`（有合成混音时加 `--mix=…`），它渲染完会校验规格、像素格式和响度；有"不合格"就修，"注意"跟用户说明
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

## 封面

- 发 B 站的视频要封面时，在作品目录加一个 `Cover` Composition（单帧），用 `npx remotion still` 导出 PNG。底图可以生图，标题文字用代码排，不让生图写字
- B 站上传页会按 16:10 和 4:3 两种比例裁封面（记忆中推荐 1146×717，没查到最新官方说明）：画成 1920×1080，标题和主体放在中间 4:3 的范围里，上传时在裁剪框里再看一眼

## 常用命令

- `npm run dev`：打开 Studio
- `npm run lint`：ESLint + TypeScript 检查
- `npx remotion still <id> out/<名字>.png --frame=<帧号>`：渲染单帧
- `npm run video -- <id> [--out=out/<id>.mp4] [--crf=18] [--mix=<混音.wav>]`：渲染视频成片（yuv420p、bt709）并校验分辨率、帧率、帧数、像素格式、音轨时长、响度（目标 -14±3 LUFS）和 true peak（≤ -1 dBTP）；`--mix` 时画面静音渲染、FFmpeg 合入混音；`npm run video -- <文件.mp4>` 只校验
- `npm run review -- src/videos/<作品> <成片.mp4> [--only=transitions|sync] [--mix=<混音.wav>]`：motioner 的转场审查和音效对帧，结果在 `out/review/<作品>/`。技能目录找不到时设 `MOTIONER_DIR`
- `npm run mix -- src/videos/<作品>`：timeline.json → 总谱 → 合成 → 按帧混音 → 配音和母带，出 `public/videos/<作品>/audio/fullmix.wav`，约 1–2 分钟。只改了 `voiceMix` 时单独跑 `.venv/Scripts/python.exe scripts/voice_mix.py src/videos/<作品> [--bed-gain=<dB>] [--voice-gain=<dB>]`，增益缺省读 timeline.json 的 `voiceMix`
- `npm run stills -- <id> <帧号…> [--scale=0.5] [--out=out/stills/<id>]`：一次打包渲染多张单帧，比逐张 `npx remotion still` 快
- `npm run sync-public [-- --push] [--ref=main] [--message=<说明>]`：把工作台同步到公开仓库，缺省只预演，见"仓库"
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
