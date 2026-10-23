import { useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一张印刷品：画面全由网点组成，冷色、暖色两版网点各转一个网角、叠印出颜色；
// 网点从左上往右下一片片长大，慢慢显出一个受光的球和一个光环，停着时光在球上缓缓转，
// 两版之间略错位，像套色没对准；最后网点缩回去，回到白纸
const FRAMES = 150;
const SP = 24; // 网点间距
const RMAX = SP * 0.72; // 最深处的网点半径，深处连成实地

// 图像：只用解析函数算每一点的"墨量"（0–1）
const SX = W * 0.4;
const SY = H * 0.5;
const SR = 320;
const RX = W * 0.69;
const RY = H * 0.42;

const coolInk = (x: number, y: number, lx: number, ly: number) => {
  const dx = (x - SX) / SR;
  const dy = (y - SY) / SR;
  const rr = dx * dx + dy * dy;
  if (rr < 1) {
    const nz = Math.sqrt(1 - rr);
    const lam = Math.max(0, dx * lx + dy * ly + nz * 0.62);
    return clamp01(0.12 + 0.95 * (1 - lam));
  }
  // 球外：地上的影子 + 很淡的渐变底
  const sh = Math.exp(-(((x - SX - 90) / 400) ** 2) - ((y - SY - SR - 10) / 55) ** 2);
  return clamp01(0.7 * sh + 0.1 * (y / H));
};

const warmInk = (x: number, y: number, lx: number, ly: number) => {
  const r = Math.hypot(x - RX, y - RY);
  const ring = 0.9 * Math.exp(-(((r - 250) / 42) ** 2));
  const glow = 0.3 * Math.exp(-r / 380);
  // 球的受光面带一点暖色
  const dx = (x - SX) / SR;
  const dy = (y - SY) / SR;
  const rr = dx * dx + dy * dy;
  const warmLit = rr < 1 ? 0.35 * Math.max(0, dx * lx + dy * ly + Math.sqrt(1 - rr) * 0.62) : 0;
  return clamp01(ring + glow + warmLit);
};

// 一个网角上的所有网点中心，以及显出、退掉的先后（从左上往右下，加一点抖动）
const grid = (deg: number, seed: number) => {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const n = Math.ceil(Math.hypot(W, H) / SP / 2) + 1;
  const out: { x: number; y: number; k: number }[] = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = W / 2 + (i * ca - j * sa) * SP;
      const y = H / 2 + (i * sa + j * ca) * SP;
      if (x < -SP || x > W + SP || y < -SP || y > H + SP) continue;
      const k = (x + y * 0.7) / (W + H * 0.7) + (rand(i * 977 + j * 131 + seed) - 0.5) * 0.12;
      out.push({ x, y, k: clamp01(k) });
    }
  }
  return out;
};
const COOL = grid(45, 1);
const WARM = grid(15, 2);

// 网点从 0 长大（墨晕开：先快后慢），退掉时加速缩没
const prog01 = (f: number, start: number, dur: number, e: (t: number) => number) =>
  e(clamp01((f - start) / dur));
const grow = (f: number, k: number) =>
  prog01(f, 4 + k * 44, 22, ease.out) * (1 - prog01(f, 100 + k * 30, 14, ease.in));

// 所有网点画成一条路径（每个圆两段弧），几千个点也只有一个元素
const dots = (pts: { x: number; y: number; k: number }[], f: number, ink: (x: number, y: number) => number, ox: number, oy: number) => {
  let d = "";
  for (const p of pts) {
    const g = grow(f, p.k);
    if (g <= 0.002) continue;
    const r = RMAX * Math.sqrt(ink(p.x, p.y)) * g;
    if (r < 0.4) continue;
    const x = p.x + ox;
    const y = p.y + oy;
    d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
  }
  return d;
};

// 角上的套准标记
const Reg: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke={C.bg} strokeWidth={2} fill="none" opacity={0.5}>
    <circle cx={x} cy={y} r={14} />
    <line x1={x - 24} y1={y} x2={x + 24} y2={y} />
    <line x1={x} y1={y - 24} x2={x} y2={y + 24} />
  </g>
);

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const ph = (f / FRAMES) * Math.PI * 2;
  // 光的方向在左上附近来回摆，球上的明暗跟着慢慢转
  const la = -2.25 + 0.45 * Math.sin(ph);
  const lx = Math.cos(la) * 0.78;
  const ly = Math.sin(la) * 0.78;
  // 暖色版套不准：一个循环里画两个小圈
  const ox = 4 * Math.sin(ph * 2);
  const oy = 3 * Math.cos(ph * 2);

  return (
    <Stage bg={C.fg}>
      <svg width={W} height={H}>
        <g style={{ mixBlendMode: "multiply" }}>
          <path d={dots(WARM, f, (x, y) => warmInk(x, y, lx, ly), ox, oy)} fill={C.accent} />
        </g>
        <g style={{ mixBlendMode: "multiply" }}>
          <path d={dots(COOL, f, (x, y) => coolInk(x, y, lx, ly), 0, 0)} fill={C.cool} />
        </g>
        <Reg x={60} y={60} />
        <Reg x={W - 60} y={60} />
        <Reg x={60} y={H - 60} />
        <Reg x={W - 60} y={H - 60} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 82,
  name: "半调网点显影",
  group: "质感",
  desc: "画面全由印刷网点组成，冷暖两版网点各转一个网角叠印，从左上往右下一片片长大显出受光的球和光环，光在球上慢慢转，两版微微套不准，最后缩回白纸",
  tech: "冷版 45°、暖版 15° 网格，每点半径 = 0.72×间距×√墨量×显影进度，墨量由解析函数算（球用朗伯光照、光向随帧摆动，光环用高斯环）；每版几千个点拼成一条 path（两段弧一个圆），mix-blend-mode: multiply 叠印；显影按对角位置错开 44 帧、ease.out 晕开，退场 ease.in 缩没；暖版偏移画小圈做套色误差；创意参考 vivmagarwal/remotion-effects-library 的 Halftone Print",
  frames: FRAMES,
  component: Effect,
};
export default effect;
