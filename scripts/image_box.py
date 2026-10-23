# 量图片的透明留白：算出不透明内容在图片里的范围
#
# 用法：npm run image-box -- <图.png|webp>…
#
# 表情里的角色要贴住画面底边、水平居中，对齐的应该是「内容」而不是整张图。生图或别人给的图
# 四周常有一圈透明留白，直接拿整张图对齐，角色就会偏上或偏左，压扁时看起来没踩在地上。
# 这个脚本把内容范围打出来，粘进 <Squish box={…} /> 即可。没有留白就不用跑。
#
# 输出的是右开区间：right / bottom 是内容右边和下边的下一列 / 下一行，直接和 left / top 相减就是宽高。

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# 和 sticker_art.py 一致：GIF 的透明只有 1 位，高于这个值才算内容
ALPHA_CUT = 128


class BoxError(Exception):
    pass


# Windows 控制台默认不是 UTF-8，中文会变成乱码
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding="utf-8")


def measure(path: Path) -> tuple[int, int, int, int, int, int]:
    try:
        image = Image.open(path).convert("RGBA")
    except OSError as error:
        raise BoxError(f"{path} 打不开：{error}") from error

    width, height = image.size
    alpha = np.array(image.getchannel("A"))
    ys, xs = np.nonzero(alpha >= ALPHA_CUT)
    if xs.size == 0:
        raise BoxError(f"{path} 整张都是透明的，没有内容可量")
    return width, height, int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def main() -> int:
    if len(sys.argv) < 2:
        print("用法：npm run image-box -- <图.png|webp>…")
        return 1

    failed = False
    for arg in sys.argv[1:]:
        path = Path(arg)
        try:
            width, height, left, top, right, bottom = measure(path)
        except BoxError as error:
            print(f"× {error}")
            failed = True
            continue
        print(f"{path}")
        print(
            f"  原图 {width}×{height}，内容 ({left}, {top}) – ({right}, {bottom})，"
            f"四周留白 左{left} 上{top} 右{width - right} 下{height - bottom}"
        )
        print(
            f"  box={{{{ width: {width}, height: {height}, "
            f"left: {left}, top: {top}, right: {right}, bottom: {bottom} }}}}"
        )
        print()

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
