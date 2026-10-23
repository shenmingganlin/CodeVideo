import { useCurrentFrame } from "remotion";
import { rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一道分叉的闪电从顶上极快地劈下来，整屏闪白再衰减，残影闪两下消失；一个循环劈两次，位置和形状都不同
const FRAMES = 120;
const GROW = 5; // 从顶到底长出来用几帧

type P = { x: number; y: number };
type Bolt = { pts: P[]; w: number }[];

// 中点位移：每层把每段从中间折一下，折的幅度逐层减半
const displace = (a: P, b: P, rough: number, depth: number, seed: number): P[] => {
  let pts = [a, b];
  let amp = rough;
  for (let d = 0; d < depth; d++) {
    const next: P[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const off = (rand(seed + d * 131 + i * 17) - 0.5) * 2 * amp;
      next.push({ x: (p.x + q.x) / 2 + (-(q.y - p.y) / len) * off, y: (p.y + q.y) / 2 + ((q.x - p.x) / len) * off }, q);
    }
    pts = next;
    amp /= 2;
  }
  return pts;
};

const makeBolt = (x0: number, x1: number, seed: number): Bolt => {
  const main = displace({ x: x0, y: -20 }, { x: x1, y: H * 0.92 }, 220, 7, seed);
  const parts: Bolt = [{ pts: main, w: 1 }];
  // 从主干上岔出几根分支，往下斜着走，越靠下越短
  for (let k = 0; k < 6; k++) {
    const i = 12 + Math.floor(rand(seed + 900 + k) * (main.length - 40));
    const from = main[i];
    const side = rand(seed + 950 + k) < 0.5 ? -1 : 1;
    const len = (1 - from.y / H) * 420 + 120;
    const ang = Math.PI / 2 + side * (0.45 + rand(seed + 970 + k) * 0.5);
    const to = { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
    parts.push({ pts: displace(from, to, len * 0.25, 5, seed + 2000 + k * 50), w: 0.45 });
  }
  return parts;
};

const STRIKES = [
  { at: 6, bolt: makeBolt(W * 0.42, W * 0.55, 11) },
  { at: 66, bolt: makeBolt(W * 0.7, W * 0.6, 37) },
];

// 亮度：劈下时满亮，快速衰减，第 7、12 帧各再闪一下
const glow = (t: number) => {
  if (t < 0) return 0;
  const decay = Math.exp(-t / 5);
  const flick = (c: number) => Math.max(0, 1 - Math.abs(t - c) / 1.6);
  return Math.min(1, decay + 0.8 * flick(7) + 0.55 * flick(12));
};

const toD = (pts: P[], frac: number) => {
  const vis = pts.filter((p) => p.y <= -20 + (H * 0.92 + 20) * frac);
  return vis.length < 2 ? "" : "M" + vis.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L");
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  let flash = 0;
  const layers = STRIKES.map((s, si) => {
    const t = frame - s.at;
    const g = glow(t);
    flash = Math.max(flash, t >= 0 ? 0.55 * Math.exp(-t / 3) + 0.25 * Math.max(0, 1 - Math.abs(t - 7) / 1.5) : 0);
    if (g < 0.02) return null;
    const frac = Math.min(1, (t + 1) / GROW);
    return (
      <g key={si} opacity={g}>
        {s.bolt.map((b, bi) => {
          const d = toD(b.pts, frac);
          return d ? (
            <g key={bi}>
              <path d={d} fill="none" stroke={C.cool} strokeWidth={26 * b.w} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} filter="url(#lt-blur)" />
              <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={6 * b.w} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ) : null;
        })}
      </g>
    );
  });
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="lt-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={14} />
          </filter>
        </defs>
        {/* 地平线一抹暗色，闪的时候被照亮 */}
        <rect x={0} y={H * 0.9} width={W} height={H * 0.1} fill={C.bg2} />
        {layers}
        <rect x={0} y={0} width={W} height={H} fill={C.fg} opacity={flash} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 30,
  name: "闪电劈下",
  group: "粒子",
  desc: "一道带分叉的闪电 5 帧内从天顶劈到地面，整屏闪白一下再衰减，残影又闪两下才消失；一个循环劈两次，换个位置换个形状",
  tech: "中点位移法（确定性随机，7 层折线）生成主干，再岔出 6 根细分支；SVG 两层：粗的蓝色高斯模糊光晕 + 细白芯；亮度是指数衰减加两次闪烁，接缝落在暗处。创意参考 remotion-scenes 的 ParticleLightning",
  frames: FRAMES,
  component: Scene,
};
export default effect;
