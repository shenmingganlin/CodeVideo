# 运行 Manim 命令行之前，先把 public/fonts/ 里的字体注册给 Manim。
# 场景里写 Text("…", font="Noto Sans SC")，用的就是工程里的字体文件，不依赖系统装了什么字体。
# 由 scripts/manim.mjs 调用，一般不直接运行

import sys
from pathlib import Path

import manimpango
from manim.__main__ import main

FONTS = Path(__file__).resolve().parent.parent / "public" / "fonts"

for font in sorted(FONTS.rglob("*")):
    if font.suffix.lower() in (".ttf", ".otf", ".ttc") and not manimpango.register_font(str(font)):
        sys.exit(f"Manim 注册字体失败：{font}")

sys.exit(main())
