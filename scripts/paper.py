# 生成一张安静的纸纹底图：极低对比的纤维和颗粒，避免大片纯色在视频压缩后出现色带。
#
# 用法：npm run paper -- <输出.png> [--width=1080] [--height=1920] [--color=F6F3EC] [--seed=7]
#
# 只做底图，不带任何图案。颗粒幅度控制在 ±3/255 以内，放大看有纸感，缩到手机上看仍然是干净的米白。

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def hex_to_rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def build(width, height, color, seed):
    rng = np.random.default_rng(seed)
    base = np.array(hex_to_rgb(color), dtype=np.float32)

    # 低频起伏：模拟纸张厚薄不均，幅度很小
    small_w, small_h = max(2, width // 40), max(2, height // 40)
    low = rng.normal(0, 1, (small_h, small_w)).astype(np.float32)
    low = np.array(
        Image.fromarray(((low - low.min()) / (low.max() - low.min()) * 255).astype(np.uint8)).resize(
            (width, height), Image.Resampling.BICUBIC
        ),
        dtype=np.float32,
    )
    low = (low / 255.0 - 0.5) * 3.2

    # 细颗粒：给压缩一点抖动，避免色带
    grain = rng.normal(0, 1.1, (height, width)).astype(np.float32)

    # 纤维：很淡的短横纹，模糊后只留下一点方向感
    fibers = rng.normal(0, 0.55, (height, width)).astype(np.float32)
    fibers = np.array(
        Image.fromarray(((fibers - fibers.min()) / (fibers.max() - fibers.min()) * 255).astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(1.2))
        .resize((width, height), Image.Resampling.BICUBIC),
        dtype=np.float32,
    )
    fibers = (fibers / 255.0 - 0.5) * 2.0

    field = low + grain + fibers
    out = np.clip(base[None, None, :] + field[:, :, None], 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("out")
    parser.add_argument("--width", type=int, default=1080)
    parser.add_argument("--height", type=int, default=1920)
    parser.add_argument("--color", default="F6F3EC")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    image = build(args.width, args.height, args.color, args.seed)
    image.save(path)
    print(f"{path}（{args.width}×{args.height}）")


if __name__ == "__main__":
    main()
