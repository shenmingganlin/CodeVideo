import { useCurrentFrame } from "remotion";
import { clamp01, colorRamp, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一堆篝火：上百个火苗团从柴堆上冒出来，越往上窜越快、往中间收拢、边走边缩小，颜色从黄白烧到橙红再到暗红；
// 火舌左右舔动，顶上不时飘出火星，地上的光跟着一明一暗
const FRAMES = 150;
const TAU = Math.PI * 2;
const CX = W / 2;
const BASE = H * 0.76;

// 每个火苗在一个循环里走 k 轮（寿命 FRAMES/k），k 取整数，第 FRAMES 帧每个火苗都正好回到同一相位
const ROUNDS = [3, 4, 5];
const frac = (x: number) => x - Math.floor(x);

type Flame = { k: number; off: number; xo: number; hh: number; size: number; ph: number };

const makeFlames = (n: number, seed: number, spread: number, height: number, size: number): Flame[] =>
  Array.from({ length: n }, (_, i) => {
    const r = (j: number) => rand(seed + i * 31 + j * 7);
    // 两个均匀分布相加是三角分布：中间密、两边稀
    const xo = (r(1) + r(2) - 1) * spread;
    return {
      k: ROUNDS[Math.floor(r(3) * ROUNDS.length)],
      off: r(4),
      xo,
      // 中间的火苗窜得高，两边的矮
      hh: height * (0.75 + 0.5 * r(5)) * (1 - 0.45 * Math.min(1, Math.abs(xo) / spread)),
      size: size * (0.6 + 0.6 * r(6)),
      ph: (r(7) - 0.5) * 0.8,
    };
  });

const OUTER = makeFlames(90, 11, 160, 540, 72);
const CORE = makeFlames(40, 517, 75, 290, 52);
const SPARKS = Array.from({ length: 28 }, (_, i) => {
  const r = (j: number) => rand(9000 + i * 13 + j * 5);
  return { k: r(1) < 0.5 ? 2 : 3, off: r(2), x0: CX + (r(3) - 0.5) * 180, y0: BASE - 200 - r(4) * 160, drift: (r(5) - 0.5) * 2, ph: r(6) * TAU };
});

const OUTER_RAMP = ["#FFF6DA", "#FFD98A", C.accent, "#E0582A", "#8A2414"];
const CORE_RAMP = ["#FFFFF6", "#FFF3BE", "#FFD98A", C.accent];

// 火舌：横向摆动是"往上走的波"，相位 = 时间 − 高度，波峰随时间往上爬；时间项都是整数圈
const sway = (a: number, f: number, ph: number) => {
  const t = (TAU * f) / FRAMES;
  return Math.pow(a, 1.2) * (46 * Math.sin(2 * t - a * 5 + ph) + 20 * Math.sin(5 * t - a * 8 + ph * 2 + 1));
};

const renderFlames = (list: Flame[], f: number, ramp: string[], tag: string) =>
  list.map((p, i) => {
    const a = frac((f * p.k) / FRAMES + p.off);
    // 浮力：往上越走越快
    const y = BASE - p.hh * (0.15 * a + 0.85 * a * a);
    const x = CX + p.xo * (1 - 0.72 * a) + sway(a, f, p.ph);
    const r = p.size * Math.pow(1 - a, 1.1) * clamp01(a / 0.08);
    if (r < 0.5) return null;
    return (
      <ellipse
        key={`${tag}${i}`}
        cx={x}
        cy={y}
        rx={r}
        ry={r * 1.45}
        fill={colorRamp(ramp, a)}
        opacity={clamp01(a / 0.06) * Math.pow(1 - a, 0.5)}
      />
    );
  });

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const t = (TAU * f) / FRAMES;
  const flicker = 0.86 + 0.09 * Math.sin(7 * t) + 0.05 * Math.sin(13 * t + 1);

  const sparks = SPARKS.map((s, i) => {
    const a = frac((f * s.k) / FRAMES + s.off);
    const pos = (u: number) => ({
      x: s.x0 + s.drift * 160 * u + 50 * Math.sin(u * 9 + s.ph) * u,
      y: s.y0 - 660 * Math.pow(u, 1.15),
    });
    const p = pos(a);
    const q = pos(Math.max(0, a - 0.025));
    // 快灭时一闪一闪
    const tw = a > 0.55 ? (rand(i * 97 + (Math.floor(f / 2) % 75)) > 0.3 ? 1 : 0.2) : 1;
    return (
      <line
        key={`s${i}`}
        x1={q.x}
        y1={q.y}
        x2={p.x}
        y2={p.y}
        stroke={colorRamp(["#FFF3C4", C.accent, "#C2401E"], a)}
        strokeWidth={3.2 * (1 - a * 0.5)}
        strokeLinecap="round"
        opacity={Math.pow(1 - a, 1.3) * clamp01(a / 0.05) * tw}
      />
    );
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <radialGradient id="fire-halo">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          {/* 模糊后把透明度拉陡：一团团的火苗粘成边缘清楚的火舌，再叠一层大模糊当辉光 */}
          <filter id="fire-body" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={14} result="b" />
            <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 9 -2.2" result="goo" />
            <feGaussianBlur in="goo" stdDeviation={24} result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="goo" />
            </feMerge>
          </filter>
          <filter id="fire-spark" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={3} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* 地上和周围的火光，跟着火苗一明一暗 */}
        <ellipse cx={CX} cy={BASE - 220} rx={620} ry={560} fill="url(#fire-halo)" opacity={0.32 * flicker} />
        <ellipse cx={CX} cy={BASE + 40} rx={560} ry={70} fill="url(#fire-halo)" opacity={0.7 * flicker} />
        {/* 柴堆 */}
        <g transform={`translate(${CX} ${BASE + 30})`}>
          {[-14, 14].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <rect x={-230} y={-22} width={460} height={44} rx={22} fill={C.bg2} />
              <rect x={-150} y={-22} width={300} height={8} rx={4} fill={C.accent} opacity={0.55 * flicker} />
            </g>
          ))}
        </g>
        <g filter="url(#fire-body)">{renderFlames(OUTER, f, OUTER_RAMP, "o")}</g>
        <g filter="url(#fire-body)" style={{ mixBlendMode: "screen" }}>
          {renderFlames(CORE, f, CORE_RAMP, "c")}
        </g>
        <g filter="url(#fire-spark)">{sparks}</g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 65,
  name: "火焰燃烧",
  group: "特效",
  desc: "一堆篝火，火苗从柴堆上往上窜，越往上越快、越细，从黄白烧到橙红再到暗红，火舌左右舔动，顶上飘火星，地上的火光一明一暗",
  tech: "SVG 椭圆火苗粒子：浮力 y = h(0.15a + 0.85a²) 往上加速，往中线收拢，半径随寿命缩小，颜色按 OKLab colorRamp；外焰、内焰两层各套 gooey 滤镜（模糊 14 + alpha ×9−2.2）粘成火舌，再叠模糊 24 的辉光，内焰 screen 叠加；火舌摆动是相位 = 时间 − 高度的上行波。每个火苗一个循环走整数轮（寿命 30/37.5/50 帧），首尾无缝",
  frames: FRAMES,
  component: Scene,
};
export default effect;
