# 表情包

做表情（`src/stickers/`）前先读这份。提问流程见 CLAUDE.md"开工前先问清楚"的表情精简版。

## 规格

表情包只做自用主图，不做上架用的封面、图标、横幅：

- 240×240 GIF，≤500KB，无限循环
- 帧率用 20 或 25。GIF 帧时长以 1/100 秒计，15fps 会节奏不均；50fps（每帧 2/100 秒）文件本身合法，但微信播放时会把这么短的帧往上取整，实测整个慢一倍，不要用
- 首尾帧要能无缝衔接
- 透明背景时，角色外圈加不透明描边，用深色或角色本身的颜色，不用白色。成品放在 #EDEDED（微信浅色底）和 #111111（深色底）上各检查一遍
- 透明背景上不用半透明的光晕和柔和阴影：Remotion 导出会直接把它们丢掉，gifski 会把它们抖成一圈点
- 导出和校验统一用 `npm run sticker -- <id>`（`scripts/sticker.mjs`）。它先用 Remotion 自带的 GIF 导出，平涂画面这样效果最好；超过 500KB 就自动改用 PNG 序列 + gifski，quality 按 90、80、70、60、50 往下降直到达标。降到 50 还超就报体积"不合格"，不会自己减帧或缩图，这时减少帧数或缩小角色。渐变多的画面用 gifski 体积能小约 40%，但会带一点颗粒
- 导出后会校验尺寸、体积、循环、帧时长和首尾接缝，并在 `out/stickers/` 生成浅色底、深色底的抽帧预览图（校验现成的 GIF 时也放这里）。帧时长：有短于 4/100 秒（超过 25fps）或为 0 的帧算"不合格"；不是每帧 4 或 5/100 秒（比如 10fps）、或者忽快忽慢算"注意"；编码器把相同帧合并成整数倍的长帧不算问题。"透明背景"看的是解码后的像素。交付前看一遍预览图；有"不合格"就修好再交，"注意"要跟用户说明

## 生图做表情

- 做表情：提示词要求"大轮廓、粗深色描边、少细节、透明背景"（240×240 下细节看不清）；生成后用 `npm run sticker-art -- <图.png>… --out=public/stickers/<套系>/` 处理：裁掉空白、缩到长边 200、透明度二值化、加不透明外描边。同一角色的差分图一起处理，一样大的图共用一个裁剪框，输出完全对齐，可以直接来回切换；不是差分的图分开处理（一起处理时内容范围重合度低于 0.5 会提示）。输出文件名和原图一样，所以生图原图别放在 `--out` 目录里：会盖掉原图时脚本直接报错，原图要留着做图生图。用法示例是 `src/checks/StickerArtCheck.tsx`（眨眼 + 呼吸）
- 插画颜色多，GIF 体积容易超过 500KB，一般会走 gifski；还超就减少帧数或缩小角色

## 命令

- `npm run sticker-art -- <图.png>… --out=<目录> [--size=200] [--outline=3] [--color=auto]`：生成图转表情素材
- `npm run image-box -- <图.png|webp>…`：量图片的透明留白，打印内容范围和 `box` 参数（配合模板 `squish` 用）
- `npm run sticker -- <id> [<id>…]`：导出并校验表情，id 可用 `*` 通配，比如 `"Cat*"`；`--all` 导出所有 240×240 的 Composition
- `npm run sticker -- <文件.gif>`：只校验现成的 GIF，比如剪映或 gifski 图形版导出的
- `npm run sticker -- <id> --encoder=remotion` 或 `--encoder=gifski`：只用指定的编码方式，用来对比。要用等号连着写，不认识的选项直接报错
- `npx remotion render <id> out/<名字>.gif --codec=gif --image-format=png`：Remotion 自带的 GIF 导出，保留透明
- `npx remotion render <id> out/frames/<名字> --sequence --image-format=png`：导出透明 PNG 序列
- `tools/gifski/gifski.exe --fps <帧率> --quality 90 -o out/<名字>.gif out/frames/<名字>/element-*.png`：用 gifski 编码 PNG 序列，`--fps` 要和 Composition 的帧率一致
