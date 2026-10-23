import { useCurrentFrame } from "remotion";
import { morphPath } from "../../shared/motion/Morph";
import { ease, mixColor, prog } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一个图形连续变形：圆 → 圆角方 → 五角星 → 圆，整体一直在慢慢转，颜色跟着变
const FRAMES = 150;
const R = 230;

// 三个形状都写成从正上方起、顺时针的折线，flubber 对齐起点，中间帧不会拧成麻花
const poly = (pts: [number, number][]) =>
  `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
const circle = poly(
  Array.from({ length: 72 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 72) * Math.PI * 2;
    return [Math.cos(a) * R, Math.sin(a) * R];
  }),
);
// 圆角方：超椭圆 |x|^n + |y|^n = 1，n 大就接近方
const square = poly(
  Array.from({ length: 72 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 72) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const n = 8;
    const k = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
    return [c * k * R * 0.86, s * k * R * 0.86];
  }),
);
const star = poly(
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? R * 1.12 : R * 0.48;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }),
);

// 每段 30 帧变形、20 帧停住；起点、终点都是圆
const STEPS = [
  { from: circle, to: square, start: 10, c0: C.accent, c1: C.cool },
  { from: square, to: star, start: 60, c0: C.cool, c1: C.fg },
  { from: star, to: circle, start: 110, c0: C.fg, c1: C.accent },
];
const MORPH = 30;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 当前这一段：最后一个已经开始的
  const step = [...STEPS].reverse().find((s) => frame >= s.start) ?? STEPS[STEPS.length - 1];
  const before = frame < STEPS[0].start;
  const t = before ? 1 : prog(frame, step.start, step.start + MORPH, ease.snap);
  const d = t <= 0 ? step.from : t >= 1 ? step.to : morphPath(step.from, step.to, t, 4);
  const fill = mixColor(step.c0, step.c1, t);
  // 整体匀速转一整圈（五角星有五重对称，一圈正好接上）
  const spin = (frame / FRAMES) * 72;
  // 变形中途鼓一下，落定时回到 1
  const pulse = 1 + 0.06 * Math.sin(Math.PI * (before ? 0 : prog(frame, step.start, step.start + MORPH, ease.linear)));
  return (
    <Stage>
      <svg width={W} height={H}>
        <circle cx={W / 2} cy={H / 2} r={R * 1.35} fill="none" stroke={C.bg2} strokeWidth={3} />
        <g transform={`translate(${W / 2} ${H / 2}) rotate(${spin}) scale(${pulse})`}>
          <path d={d} fill={fill} />
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 6,
  name: "圆变方变星",
  group: "形状",
  desc: "一个图形圆 → 圆角方 → 五角星 → 圆连续变形，每次变形中途微微鼓起，整体一直慢慢转，颜色跟着过渡",
  tech: "morphPath（flubber），三个形状都从正上方起、顺时针，ease.snap；每段变形 30 帧、停 20 帧，整体 150 帧转 72°",
  frames: FRAMES,
  component: Scene,
};
export default effect;
