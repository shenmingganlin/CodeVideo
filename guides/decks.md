# 演讲稿

工作台也做演讲稿，用两个装在用户目录的技能（`~/.claude/repos/` 下的 git 克隆，停在版本标签上，用目录联接挂进 `~/.claude/skills/`），不进本仓库：

- 选哪个：
  - 要在 PowerPoint、WPS 里打开和改的 PPTX：`ppt-master`（hugohe3/ppt-master v6.7.3，MIT）。页面先写成 SVG，再导出原生可编辑的 PPTX；它自带浏览器实时预览，用户在页面元素上留意见，助手跑它的 `check_annotations.py` 处理
  - 在浏览器里放、带动画的单文件 HTML 演讲稿：`frontend-slides`（zarazhangrui/frontend-slides v2.1.0，MIT），零依赖。导出 PDF 会丢动画
  - 视频照样用 Remotion 做，这两个不出视频画面
- 用户要演讲稿时，先问要 PPTX 还是网页，再调对应技能，照技能自己的流程走。提问照样用选项卡片、用中文，不加"自己补充"选项
- 作品放 `decks/<名字>/`，只进私有仓库（`sync-public` 不发布）。ppt-master 建项目时加 `--dir decks`，不然会建在当前目录的 `projects/` 下；它建的目录名带画幅和日期
- ppt-master 的 Python：技能里写的 `python3` 一律换成 `~/.claude/repos/ppt-master/.venv/Scripts/python.exe`。这是 uv 建的独立环境，实际装的版本记在 `~/.claude/repos/ppt-master/requirements.lock.txt`，不装进本仓库的 `.venv`
- ppt-master 的生图（`image_gen.py`）先不用：它读当前目录的 `.env`，也就是本仓库的生图配置，两边的后端设置对不上。要配图用本仓库的 `npm run image`，照 `guides/image-gen.md` 先问用户
- 导出要加 `--native-charts-and-tables`：SVG 里写了 `data-pptx-replace-with="table"` 的表格，不加这个参数会静默导出成"矩形 + 一堆文本框"——质量门照过（检查器只报识别到 1 个原生表格），PPTX 里却一张表都没有。踩过：对比页的表格导出后是 15 个文本框拼的，单元格不能编辑。导出后核实一次：`python -c` 读一遍 `has_table`，或者看幻灯片里有没有 `graphicFrame`
- 别用 LibreOffice 渲染 PPTX 来验收：它不认 `wrap="none"`，会把单行文字按估算宽度折行，看起来像版面炸了，实际在 PowerPoint 里完全正常。用户机器上装了 Microsoft Office，用它的 COM 导出真图：`Presentations.Open(...).Export(dir, "PNG", 1280, 720)`。验收以 PowerPoint 的图为准
- 文字框宽度是导出器估算的（全角标点按 0.55 字宽算，实际是 1 字宽），偏窄的框在 PowerPoint 里靠 `wrap="none"` 撑开，没问题；但在 WPS、LibreOffice 里会折行。要兼容 WPS 就把那几行写短些，或者别让文本框成为唯一的宽度来源
- frontend-slides 的 `deploy.sh` 会把演讲稿发布到 Vercel 公网，用户明确要才跑；`export-pdf.sh` 在临时目录装 Playwright 和 Chromium，不碰本仓库
- ppt-master 的环境里有 PyMuPDF（AGPL-3.0），别把它或它的代码带进本仓库
- 更新：`git -C ~/.claude/repos/<技能> fetch --tags` 后 checkout 新的版本标签；ppt-master 再跑 `uv pip install --python .venv/Scripts/python.exe -r skills/ppt-master/requirements.txt`，重新导出 `requirements.lock.txt`。不用它自带的 `update_repo.py`：克隆停在标签上，不在分支上
