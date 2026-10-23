# 生成图转表情素材：把生图得到的透明 PNG 处理成能直接放进 240×240 透明 GIF 的图
#
# 用法：npm run sticker-art -- <图.png>… --out=<目录> [--size=200] [--outline=3] [--color=auto|#2b2b2b]
#   --out       输出目录，一般是 public/stickers/<套系>/，文件名和原图一样（扩展名换成 .png）。
#               会盖掉原图时直接报错，所以原图不能就放在这个目录里
#   --size      处理后图片的长边像素（含描边），默认 200，给 240 画布留出动作的空间
#   --outline   外圈描边粗细（像素），默认 3；原图自带很粗的深色描边时可以写 0
#   --color     描边颜色。auto（默认）取角色边缘的颜色再压暗，不用白色
#
# 处理步骤：按不透明区域裁掉空白 → 缩到 --size → 透明度二值化（GIF 只有全透明和不透明）→ 加不透明外描边。
# 多张图一起处理时按同一个比例缩放；原图尺寸相同时（同一角色的差分图）还用同一个裁剪框，输出的图叠在一起完全对齐。
# 一样大但内容范围差得多（重合度低于 0.5）时会提示：不是差分图的，分开处理。

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# 原图透明度高于这个值才算角色的一部分
ALPHA_CUT = 128


class ArtError(Exception):
    pass


def show(path: Path) -> str:
    """仓库里的路径打印成相对路径，外面的照原样"""
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)


def parse_color(value: str) -> tuple[int, int, int] | None:
    if value == "auto":
        return None
    hex_value = value.lstrip("#")
    if len(hex_value) != 6:
        raise ArtError(f"--color 要写成 #2b2b2b 这样，现在是 {value}")
    return tuple(int(hex_value[i : i + 2], 16) for i in (0, 2, 4))


def disk_offsets(radius: int) -> list[tuple[int, int]]:
    return [
        (dy, dx)
        for dy in range(-radius, radius + 1)
        for dx in range(-radius, radius + 1)
        if dx * dx + dy * dy <= radius * radius + radius
    ]


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """把不透明区域往外扩 radius 像素（圆形），mask 四周已留出足够的空白"""
    out = mask.copy()
    for dy, dx in disk_offsets(radius):
        out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def load(path: Path) -> Image.Image:
    try:
        image = Image.open(path)
    except OSError as err:
        raise ArtError(f"打不开图片 {path}：{err}") from err
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    alpha = np.asarray(image)[:, :, 3]
    if alpha.min() == 255:
        raise ArtError(f"{path.name} 没有透明背景。生图时加 --background=transparent")
    return image


def opaque_box(image: Image.Image):
    return image.getchannel("A").point(lambda a: 255 if a >= ALPHA_CUT else 0).getbbox()


def box_iou(a, b) -> float:
    """两个裁剪框的交并比：1 是完全重合，越小差得越多"""
    inter = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return inter / (area_a + area_b - inter)


def process(image: Image.Image, box, scale: float, outline: int, color) -> tuple[Image.Image, dict]:
    # 裁掉空白
    image = image.crop(box)
    # 按预乘透明度缩放，边缘不会混进透明像素的杂色
    width, height = image.size
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    image = image.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")

    pad = outline + 2
    canvas = Image.new("RGBA", (size[0] + pad * 2, size[1] + pad * 2), (0, 0, 0, 0))
    canvas.paste(image, (pad, pad))
    pixels = np.asarray(canvas).copy()
    body = pixels[:, :, 3] >= ALPHA_CUT

    if color is None:
        # 角色最外一圈像素的中位色，压暗到 35%
        edge = body & ~(np.roll(body, 1, 0) & np.roll(body, -1, 0) & np.roll(body, 1, 1) & np.roll(body, -1, 1))
        color = tuple(int(c * 0.35) for c in np.median(pixels[edge][:, :3], axis=0))

    pixels[:, :, 3] = np.where(body, 255, 0)
    if outline > 0:
        ring = dilate(body, outline) & ~body
        pixels[ring] = (*color, 255)
    return Image.fromarray(pixels), {"color": "#%02x%02x%02x" % color}


def main() -> int:
    parser = argparse.ArgumentParser(description="生成图转表情素材")
    parser.add_argument("images", nargs="+")
    parser.add_argument("--out", required=True)
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--outline", type=int, default=3)
    parser.add_argument("--color", default="auto")
    args = parser.parse_args()
    if not 16 <= args.size <= 240:
        raise ArtError("--size 要在 16–240 之间")
    if not 0 <= args.outline <= 12:
        raise ArtError("--outline 要在 0–12 之间")
    color = parse_color(args.color)

    paths = [(Path.cwd() / p).resolve() for p in args.images]
    out_dir = (Path.cwd() / args.out).resolve()
    # 输出文件名跟原图一样（扩展名换成 .png），--out 指向原图所在目录时会把生图原图盖掉
    targets = [out_dir / f"{p.stem}.png" for p in paths]
    for target in targets:
        if target in paths:
            raise ArtError(
                f"{show(target)} 是输入的原图，处理结果会把它盖掉。"
                "--out 换一个目录，或者先把原图挪到别处"
            )
    for i, target in enumerate(targets):
        if target in targets[:i]:
            raise ArtError(f"有两张图都会输出成 {show(target)}，后一张会盖掉前一张。改个文件名再处理")

    images = [load(p) for p in paths]
    boxes = [opaque_box(img) for img in images]
    if len({img.size for img in images}) == 1:
        # 原图一样大（同一角色的差分图）时用同一个裁剪框，输出的图叠在一起完全对齐。
        # 各自的内容范围差得多，多半不是差分图，硬套同一个框会让每张都偏到一边
        worst = min(
            ((box_iou(a, b), i, j) for i, a in enumerate(boxes) for j, b in enumerate(boxes) if i < j),
            default=None,
        )
        if worst and worst[0] < 0.5:
            print(
                f"[注意] {paths[worst[1]].name} 和 {paths[worst[2]].name} 的内容范围差得多（重合度 {worst[0]:.2f}），"
                "现在按同一个裁剪框处理。不是同一角色的差分图就分开处理"
            )
        union = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        boxes = [union] * len(images)
    # 统一比例：最大那张的长边（含描边）正好是 --size
    longest = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
    scale = (args.size - (args.outline + 2) * 2) / longest

    out_dir.mkdir(parents=True, exist_ok=True)
    for path, image, box, target in zip(paths, images, boxes, targets):
        result, info = process(image, box, scale, args.outline, color)
        # auto 的描边色取自第一张，同一套差分图描边颜色一致
        color = color or parse_color(info["color"])
        result.save(target, optimize=True)
        alpha = np.asarray(result)[:, :, 3]
        semi = int(((alpha > 0) & (alpha < 255)).sum())
        print(
            f"{path.name} → {show(target)}"
            f"：{result.width}×{result.height}，描边 {args.outline}px {info['color']}，半透明像素 {semi}"
        )
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    try:
        sys.exit(main())
    except ArtError as err:
        print(f"\n出错：{err}", file=sys.stderr)
        sys.exit(1)
