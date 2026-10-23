import { useCurrentFrame } from "remotion";
import { clamp01, ease, prog } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一条曲线一笔画出来，笔尖带一个光点；画完停一下，再从起点开始擦掉
const FRAMES = 120;

// 曲线写成参数方程，路径和笔尖位置都从它算，不用量 DOM
const curve = (t: number) => {
  const x = 260 + t * 1400;
  const y = H / 2 + Math.sin(t * Math.PI * 2.5) * 220 * (1 - t * 0.35) + Math.sin(t * Math.PI * 7) * 40;
  return { x, y };
};
const N = 400;
const pts = Array.from({ length: N + 1 }, (_, i) => curve(i / N));
// 按弧长算，笔尖匀速沿线走
const lens = [0];
for (let i = 1; i <= N; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
const TOTAL = lens[N];
const at = (s: number) => {
  const target = clamp01(s) * TOTAL;
  let i = 1;
  while (i < N && lens[i] < target) i++;
  const k = (target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
};
const D = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const head = prog(frame, 6, 54, ease.inOut); // 画
  const tail = prog(frame, 66, 112, ease.inOut); // 擦
  // 画的时候光点在线头，擦的时候跟着线尾；中间停顿时光点收起来
  const drawing = frame < 60;
  const tip = at(drawing ? head : tail);
  const fade = (f0: number, f1: number) => Math.min(clamp01((frame - f0) / 4), clamp01((f1 - frame) / 4));
  const tipOn = drawing ? fade(6, 58) : fade(64, 112);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="ld" x1={260} y1={0} x2={1660} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={C.cool} />
            <stop offset="1" stopColor={C.accent} />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stopColor={C.fg} stopOpacity={0.9} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* 淡淡的虚线是要走的路 */}
        <path d={D} fill="none" stroke={C.dim} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" opacity={0.6} />
        {head > tail ? (
          <path
            d={D}
            fill="none"
            stroke="url(#ld)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={`${head - tail} 2`}
            strokeDashoffset={-tail}
          />
        ) : null}
        {tipOn > 0 ? (
          <g opacity={tipOn}>
            <circle cx={tip.x} cy={tip.y} r={70} fill="url(#glow)" />
            <circle cx={tip.x} cy={tip.y} r={13} fill={C.fg} />
          </g>
        ) : null}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 13,
  name: "一笔画线",
  group: "线条",
  desc: "一条曲线从左到右一笔画出来，笔尖带光点；画完停一下，再从起点追着擦掉",
  tech: "pathLength=1 + stroke-dasharray/dashoffset 控制露出哪一段；曲线是参数方程，按弧长取笔尖位置；ease.inOut 48 帧画完",
  frames: FRAMES,
  component: Scene,
};
export default effect;
