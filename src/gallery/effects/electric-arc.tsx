import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一个圆角方块外面爬满细电弧：一段段弧贴着轮廓游走，根扎在边上、中间往外拱，每 2 帧噼啪换一次形；
// 隔一阵有一根弧从角上甩出去打到画外，方块和里面的字跟着电流一亮一暗
const FRAMES = 120;
const CX = W / 2;
const CY = H / 2;
const HW = 230; // 半边长
const RAD = 70; // 圆角
const ARC = mixColor(C.cool, "#FFFFFF", 0.35);

// 圆角矩形按周长参数化：s ∈ [0,1) → 轮廓上的点和朝外的法线
const SIDE = 2 * (HW - RAD);
const QUART = (Math.PI / 2) * RAD;
const PER = 4 * (SIDE + QUART);
const onShape = (s: number) => {
  let d = (((s % 1) + 1) % 1) * PER;
  const corners = [
    { cx: HW - RAD, cy: -(HW - RAD), a0: -Math.PI / 2 },
    { cx: HW - RAD, cy: HW - RAD, a0: 0 },
    { cx: -(HW - RAD), cy: HW - RAD, a0: Math.PI / 2 },
    { cx: -(HW - RAD), cy: -(HW - RAD), a0: Math.PI },
  ];
  for (let k = 0; k < 4; k++) {
    const c = corners[k];
    const prev = corners[(k + 3) % 4];
    // 先走直边（从上一个圆角的终点到这个圆角的起点），再走圆角
    if (d < SIDE) {
      const nx = Math.cos(c.a0), ny = Math.sin(c.a0);
      const sx = prev.cx + Math.cos(c.a0) * RAD, sy = prev.cy + Math.sin(c.a0) * RAD;
      const tx = -ny, ty = nx;
      return { x: CX + sx + tx * d, y: CY + sy + ty * d, nx, ny };
    }
    d -= SIDE;
    if (d < QUART) {
      const a = c.a0 + d / RAD;
      return { x: CX + c.cx + Math.cos(a) * RAD, y: CY + c.cy + Math.sin(a) * RAD, nx: Math.cos(a), ny: Math.sin(a) };
    }
    d -= QUART;
  }
  return { x: CX, y: CY - HW, nx: 0, ny: -1 };
};

// 一维中点位移：n 段的锯齿偏移序列，两端为 0
const jag = (seed: number, depth: number): number[] => {
  let v = [0, 0];
  let amp = 1;
  for (let d = 0; d < depth; d++) {
    const next = [v[0]];
    for (let i = 0; i < v.length - 1; i++) {
      next.push((v[i] + v[i + 1]) / 2 + (rand(seed + d * 97 + i * 13) - 0.5) * 2 * amp, v[i + 1]);
    }
    v = next;
    amp *= 0.55;
  }
  return v;
};

// 贴着轮廓游走的弧：起点 s0，每个循环绕 laps 圈（整数，首尾无缝），长 len（占周长），往外拱 bulge 像素
const CRAWL = Array.from({ length: 7 }, (_, i) => ({
  s0: i / 7 + rand(i + 3) * 0.05,
  laps: i % 2 === 0 ? 1 : -1,
  len: 0.06 + rand(i + 21) * 0.05,
  bulge: 26 + rand(i + 41) * 34,
  hold: 2 + (i % 2), // 几帧换一次形
}));

const arcPath = (s0: number, len: number, bulge: number, seed: number) => {
  const off = jag(seed, 5); // 33 个点
  const n = off.length - 1;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = onShape(s0 + len * t);
    const env = Math.sin(Math.PI * t); // 两头扎在边上，中间往外拱
    const h = env * (bulge * (0.5 + 0.5 * rand(seed + 5)) + off[i] * bulge * 0.9);
    const o = Math.max(-6, h);
    pts.push(`${(p.x + p.nx * o).toFixed(1)},${(p.y + p.ny * o).toFixed(1)}`);
  }
  return "M" + pts.join("L");
};

// 甩出去的长弧：在第几帧、从轮廓哪儿起跳、打向哪个方向
const JUMPS = [
  { at: 18, s: 0.125, ang: -0.75, len: 760 },
  { at: 76, s: 0.62, ang: 2.55, len: 820 },
];
const jumpPath = (j: (typeof JUMPS)[number], seed: number, grow: number) => {
  const p = onShape(j.s);
  const off = jag(seed, 6);
  const n = off.length - 1;
  const dx = Math.cos(j.ang), dy = Math.sin(j.ang);
  const pts: string[] = [];
  for (let i = 0; i <= n * grow; i++) {
    const t = i / n;
    const o = off[i] * 160 * (0.3 + t);
    const x = p.x + dx * j.len * t - dy * o;
    const y = p.y + dy * j.len * t + dx * o;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.length < 2 ? "" : "M" + pts.join("L");
};
const jumpGlow = (t: number) => {
  if (t < 0) return 0;
  return Math.min(1, Math.exp(-t / 3) + 0.7 * Math.max(0, 1 - Math.abs(t - 5) / 1.5));
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;

  let energy = 0;
  const crawls = CRAWL.map((c, i) => {
    const step = Math.floor(frame / c.hold);
    const seed = i * 1000 + step * 37;
    // 每段弧也会时强时弱：有时整根灭掉一两拍，接着又噼啪亮起
    const lum = rand(seed + 9) < 0.15 ? 0.25 : 0.65 + 0.35 * rand(seed + 11);
    energy += lum;
    const s0 = c.s0 + c.laps * u;
    return { d: arcPath(s0, c.len, c.bulge, seed), lum, root: [onShape(s0), onShape(s0 + c.len)] };
  });
  energy /= CRAWL.length;

  let jumpE = 0;
  const jumps = JUMPS.map((j, ji) => {
    const t = frame - j.at;
    const g = jumpGlow(t);
    jumpE = Math.max(jumpE, g);
    if (g < 0.02) return null;
    const grow = Math.min(1, (t + 1) / 2.5);
    return { d: jumpPath(j, ji * 500 + Math.floor(t / 2) * 13, grow), g, root: onShape(j.s) };
  });

  const body = Math.min(1, 0.35 + 0.35 * energy + 0.6 * jumpE);
  const bodyFill = mixColor(C.bg2, C.cool, 0.12 + 0.2 * body);
  const textColor = mixColor(C.dim, "#FFFFFF", 0.3 + 0.7 * body);

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="ea-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
          <filter id="ea-wide" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={40} />
          </filter>
          <radialGradient id="ea-spark">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* 方块整体的外发光，跟着电流亮暗 */}
        <rect x={CX - HW} y={CY - HW} width={HW * 2} height={HW * 2} rx={RAD} fill={C.cool} opacity={0.12 + 0.3 * body} filter="url(#ea-wide)" />
        <rect x={CX - HW} y={CY - HW} width={HW * 2} height={HW * 2} rx={RAD} fill={bodyFill} stroke={mixColor(C.cool, "#FFFFFF", 0.5 * body)} strokeWidth={3} />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={900} fontSize={240} fill={textColor}>
          电
        </text>
        <g style={{ mixBlendMode: "screen" }}>
          {crawls.map((c, i) => (
            <g key={i} opacity={c.lum}>
              <path d={c.d} fill="none" stroke={C.cool} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} filter="url(#ea-glow)" />
              <path d={c.d} fill="none" stroke={ARC} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
              {c.root.map((p, k) => (
                <circle key={k} cx={p.x} cy={p.y} r={14} fill="url(#ea-spark)" opacity={0.8} />
              ))}
            </g>
          ))}
          {jumps.map((j, i) =>
            j && j.d ? (
              <g key={`j${i}`} opacity={j.g}>
                <path d={j.d} fill="none" stroke={C.cool} strokeWidth={20} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} filter="url(#ea-glow)" />
                <path d={j.d} fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={j.root.x} cy={j.root.y} r={40} fill="url(#ea-spark)" />
              </g>
            ) : null,
          )}
        </g>
        {/* 长弧甩出去时整屏被照亮一下 */}
        <rect width={W} height={H} fill={C.cool} opacity={0.14 * jumpE} style={{ mixBlendMode: "screen" }} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 69,
  name: "电流缠绕",
  group: "特效",
  desc: "一个写着字的圆角方块外面爬满细电弧，一段段贴着轮廓绕圈游走，两头扎在边上、中间往外拱，每两三帧噼啪换一次形；隔一阵有根长弧从边上甩出去打到画外，整屏闪一下，方块和字跟着电流一亮一暗",
  tech: "圆角矩形按周长参数化（点 + 外法线），弧沿轮廓取一段，法向偏移 = sin 包络 × 一维中点位移（5 层，种子按 floor(帧/2) 换）；长弧在法线方向外甩 6 层中点位移，2.5 帧长出、指数衰减再闪一次；SVG 模糊外辉 + 细白芯 + screen 叠加，方块亮度跟弧的平均亮度走",
  frames: FRAMES,
  component: Scene,
};
export default effect;
