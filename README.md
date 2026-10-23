# CodeVideo

用代码做视频和表情包的个人工作台。基于 [Remotion](https://www.remotion.dev/)（用 React 写动画），配合 Claude Code 在对话里一起做：说清楚想要什么，助手问清细节、写代码、渲染、自检，再交给你看。

- 视频：任意题材，默认 1920×1080 30fps，可以发 B 站
- 表情包：微信/QQ 自用的 240×240 透明 GIF，≤500KB

给助手看的完整工作手册在 [CLAUDE.md](CLAUDE.md)。

公开仓库 [shenmingganlin/CodeVideo](https://github.com/shenmingganlin/CodeVideo) 只有工作台：脚本、通用组件、模板、自检示例和工作手册。做出来的视频、表情和它们的素材在作者的私有仓库里，所以公开仓库的 `src/videos/`、`src/stickers/` 只有一份说明。

## 能做什么

| 能力 | 怎么用 |
| --- | --- |
| 配音 | 免费的 Edge 语音，台词写在 `voice.json`，`npm run voice` 生成配音和逐词时间 |
| 字幕 | 按配音的逐词时间自动断句，可逐词高亮 |
| 公式 | KaTeX 排版静态公式，Manim 做公式变形、几何动画 |
| 生图 | 接 OpenAI 兼容的生图接口，文生图、图生图，角色、插画、封面底图交给它 |
| 表情 | 生成图一键裁切描边（`npm run sticker-art`），导出 GIF 并校验体积、循环、接缝（`npm run sticker`） |
| 成片 | `npm run video` 渲染 MP4，校验分辨率、帧率、帧数、响度 |
| 检查 | `npm run contact` 出关键帧预览图，`npm run doctor` 检查环境 |
| 模板 | 做成功的效果存成模板（`src/templates/`），下次给张图就能套 |
| 灵感本 | 想到的点子记在 `ideas.md` |
| 素材库 | 自己收集的音效、BGM、图形放 `public/library/` |

## 在新电脑上恢复

1. 装 [Node.js](https://nodejs.org/) 22 以上、[FFmpeg](https://www.gyan.dev/ffmpeg/builds/)（5.1 以上，放进 PATH）、[uv](https://docs.astral.sh/uv/)、[TeX Live](https://tug.org/texlive/)（Manim 公式用，要 ctex 和 dvisvgm）
2. 克隆仓库（自己的电脑上克隆私有仓库，作品都在里面），然后：
   ```bash
   npm install
   ```
   ```bash
   uv sync
   ```
3. 从 [gifski 的 GitHub Releases](https://github.com/ImageOptim/gifski/releases) 下载命令行版，把 `gifski.exe` 放到 `tools/gifski/`（winget 装的是图形版，不能用）
4. 要生图的话，把 `.env.example` 复制成 `.env`，填上地址、模型和 Key
5. 有版权问题的作品在 `src/private/` 和 `public/private/`，哪个仓库都不进，要从旧电脑拷过来
6. 检查环境，然后打开 Studio：
   ```bash
   npm run doctor
   ```
   ```bash
   npm run dev
   ```

## 目录

- `src/videos/`、`src/stickers/`：一个作品一个目录，里面有 `brief.md` 记方案，`index.tsx` 注册 Composition（只在私有仓库）
- `src/shared/`：配音时间轴、字幕、公式、表情规格等通用代码
- `src/templates/`：模板；`src/checks/`：环境自检和用法示例
- `src/private/`：有版权问题的作品，不进 git
- `public/`：字体、配音、素材；`scripts/`：配音、生图、导出、校验脚本

## 说明

本仓库的代码和文档用 [MIT 许可证](LICENSE)。第三方的部分各有各的许可：

- 字体是思源黑体（SIL OFL）
- Remotion 对个人和小团队免费，公司使用要买许可，见 [Remotion 的许可说明](https://www.remotion.dev/license)
- Edge 语音是微软的免费接口，不是正式服务，所以生成的配音都提交进仓库，不依赖重新生成
