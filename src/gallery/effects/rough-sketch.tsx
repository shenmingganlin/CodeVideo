import { useCurrentFrame } from "remotion";
import { ease, prog } from "../../shared/motion/motion";
import { RoughPaths, roughGenerator } from "../../shared/rough";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 手绘草图一笔笔画出来：房子、屋顶、窗、太阳、地面。画完线条每 3 帧抖一下，最后倒着擦掉
const FRAMES = 150;
const STROKES = 6;
const DRAW = [6, 70]; // 一笔接一笔画完
const ERASE = [110, 144]; // 倒着擦

// 第 i 笔现在画出来多少：画的时候按顺序，擦的时候后画的先擦
const stroke = (frame: number, i: number) => {
  const span = (DRAW[1] - DRAW[0]) / STROKES;
  const drawn = prog(frame, DRAW[0] + i * span, DRAW[0] + (i + 1.4) * span, ease.inOut);
  const espan = (ERASE[1] - ERASE[0]) / STROKES;
  const j = STROKES - 1 - i;
  const erased = prog(frame, ERASE[0] + j * espan, ERASE[0] + (j + 1.4) * espan, ease.inOut);
  return Math.min(drawn, 1 - erased);
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 画的过程中线条不变，画完才开始抖（8–12fps 的抖动最像手绘）
  const seed = frame < DRAW[1] + 6 ? 5 : 5 + Math.floor(frame / 3);
  const g = roughGenerator(seed);
  const ink = { stroke: C.fg, strokeWidth: 5, roughness: 1.6 };
  const shapes = [
    g.line(360, 820, 1560, 820, { ...ink, roughness: 2.2, bowing: 3 }),
    g.rectangle(640, 500, 440, 320, { ...ink, fill: C.cool, fillStyle: "hachure", hachureGap: 16, seed: seed + 1 }),
    g.polygon(
      [
        [600, 510],
        [860, 300],
        [1120, 510],
      ],
      { ...ink, fill: C.accent, fillStyle: "cross-hatch", hachureGap: 18, seed: seed + 2 },
    ),
    g.rectangle(720, 580, 110, 110, { ...ink, seed: seed + 3 }),
    g.rectangle(910, 640, 100, 180, { ...ink, seed: seed + 4 }),
    g.circle(1380, 300, 180, { ...ink, stroke: C.accent, fill: C.accent, fillStyle: "zigzag", hachureGap: 14, seed: seed + 5 }),
  ];
  return (
    <Stage>
      <svg width={W} height={H}>
        {shapes.map((d, i) => (
          <RoughPaths key={i} drawable={d} progress={stroke(frame, i)} />
        ))}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 14,
  name: "手绘草图",
  group: "线条",
  desc: "地面、房子、屋顶、门窗、太阳一笔笔画出来，排线跟着填上；画完线条轻轻抖，最后倒着擦掉",
  tech: "Rough.js：roughGenerator(seed) 固定 seed，RoughPaths 的 progress 一笔笔描；画完每 3 帧换 seed 做抖线（line boil）",
  frames: FRAMES,
  component: Scene,
};
export default effect;
