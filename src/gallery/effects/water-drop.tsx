import { useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 斜着俯看一片水面：一滴水加速落下（水面上的倒影迎上来），入水溅起一圈薄薄的皇冠，
// 皇冠边沿是一根根尖刺，尖上甩出水珠飞出去落回、各自打出小涟漪；皇冠塌下去时中心弹起一根水柱，
// 柱顶掐断出一颗水珠，飞高再落回，打出第二组涟漪；同心涟漪一圈圈散开变淡，水面恢复平静
const FRAMES = 150;
const CX = W / 2;
const PY = 700; // 落点在屏幕上的位置
const HZ = 380; // 远处水天交界
const P = 0.3; // 透视压扁：水面上的圆看起来是 1 : 0.3 的椭圆
const HIT = 24; // 入水那一帧
const JET = HIT + 18; // 水柱开始升起
const G = 0.7; // 水珠的重力，px/帧²
const N = 14; // 皇冠尖刺数

// 水面上的点 (x, z, 高度 h) 投影到屏幕：z 越大越近（越靠下）
const pr = (x: number, z: number, h: number) => [CX + x, PY + z * P - h] as const;
const pts = (a: (readonly [number, number])[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// 皇冠：半径一直往外扩、慢下来；高度很快冲上去再慢慢塌下
const crownR = (t: number) => 30 + 150 * (1 - Math.exp(-t / 9));
const crownH = (t: number) => (t <= 0 ? 0 : 160 * (t / 7) * Math.exp(1 - t / 7));
// 边沿的尖刺：每根高矮不一，尖而窄
const SPIKE = Array.from({ length: N }, (_, i) => 0.6 + 0.8 * rand(i + 11));
const rimH = (th: number, Hc: number) => {
  const u = ((th / (Math.PI * 2)) * N + N) % N;
  const i = Math.round(u) % N;
  const d = u - Math.round(u); // 离最近一根刺的距离，-0.5..0.5
  const spike = Math.exp(-((d / 0.16) ** 2)) * SPIKE[i];
  return Hc * (0.62 + 0.45 * spike);
};

// 刺尖甩出的水珠：第 6 帧脱开，往外、往上飞，走抛物线
const DETACH = 6;
const BEADS = Array.from({ length: N }, (_, i) => ({
  th: (i / N) * Math.PI * 2,
  vr: 3.2 + 2.2 * rand(i + 31),
  vh: 5 + 3.5 * rand(i + 51) * SPIKE[i],
  r: 4 + 4 * rand(i + 71),
}));
const beadAt = (b: (typeof BEADS)[number], t: number) => {
  const r0 = crownR(DETACH) * 1.2;
  const h0 = rimH(b.th, crownH(DETACH)) + 6;
  const s = t - DETACH;
  return { rr: r0 + b.vr * s, h: h0 + b.vh * s - 0.5 * G * s * s };
};
// 落回水面的时刻（解 h = 0）
const landT = (b: (typeof BEADS)[number]) => {
  const h0 = rimH(b.th, crownH(DETACH)) + 6;
  return DETACH + (b.vh + Math.sqrt(b.vh * b.vh + 2 * G * h0)) / G;
};

// 中心水柱：柱顶按抛体运动升起落回；第 10 帧掐断出一颗水珠，比柱顶多一点速度，飞得更高
const JV = 30.7;
const JG = 2.04;
const jetH = (s: number) => Math.max(0, JV * s - 0.5 * JG * s * s);
const PINCH = 10;
const bead0 = { h: jetH(PINCH) + 14, v: JV - JG * PINCH + 2.5 };
const beadH = (s: number) => bead0.h + bead0.v * (s - PINCH) - 0.5 * JG * (s - PINCH) ** 2;
const BEAD_LAND = JET + PINCH + (bead0.v + Math.sqrt(bead0.v ** 2 + 2 * JG * bead0.h)) / JG;

// 一组同心涟漪：亮的波峰 + 内侧暗的波谷，越往外越淡越细
const Ripples: React.FC<{ t: number; x?: number; z?: number; amp: number; n: number; speed: number; life: number }> = ({
  t,
  x = 0,
  z = 0,
  amp,
  n,
  speed,
  life,
}) => {
  if (t <= 0 || t > life) return null;
  const [sx, sy] = pr(x, z, 0);
  const out: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const r = speed * t - k * 34;
    if (r <= 4) continue;
    // 衰减到 life 那一帧正好为 0，不会突然消失
    const a = amp * Math.exp(-t / (life * 0.45)) * (1 - t / life) * (1 - k / (n + 1));
    if (a < 0.02) continue;
    out.push(
      <g key={k}>
        <ellipse cx={sx} cy={sy + 3} rx={r - 9} ry={(r - 9) * P} fill="none" stroke="#000" strokeWidth={5} opacity={a * 0.5} />
        <ellipse cx={sx} cy={sy} rx={r} ry={r * P} fill="none" stroke={C.fg} strokeWidth={1.5 + 2.5 * a} opacity={a} />
      </g>,
    );
  }
  return <>{out}</>;
};

const Drop: React.FC<{ x: number; y: number; r: number; fill: string; stretch: number; opacity?: number; flip?: boolean }> = ({
  x,
  y,
  r,
  fill,
  stretch,
  opacity = 1,
  flip,
}) => {
  const s = flip ? -1 : 1;
  const tip = y - r * 2.2 * stretch * s;
  return (
    <path
      d={`M ${x} ${tip} C ${x + r * 0.45} ${y - r * 1.2 * stretch * s}, ${x + r} ${y - r * 0.5 * s}, ${x + r} ${y} A ${r} ${r} 0 0 ${flip ? 0 : 1} ${x - r} ${y} C ${x - r} ${y - r * 0.5 * s}, ${x - r * 0.45} ${y - r * 1.2 * stretch * s}, ${x} ${tip} Z`}
      fill={fill}
      opacity={opacity}
    />
  );
};

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const t = f - HIT;
  const near = mixColor(C.bg, C.cool, 0.07);
  const far = mixColor(C.bg, C.cool, 0.3);
  const wall = mixColor(C.cool, C.fg, 0.35);

  // 皇冠的前后两半：后半圈（远）先画，水柱和前半圈盖在上面
  let crater: React.ReactNode = null;
  let backWall: React.ReactNode = null;
  let frontWall: React.ReactNode = null;
  let frontRim: React.ReactNode = null;
  const backBeads: React.ReactNode[] = [];
  const frontBeads: React.ReactNode[] = [];
  const landRipples: React.ReactNode[] = [];
  if (t > 0) {
    const Rc = crownR(t);
    const Hc = crownH(t);
    const flare = 1 + 0.22 * clamp01(Hc / 160); // 壁往外撇
    const half = (a0: number) => {
      const top: (readonly [number, number])[] = [];
      const base: (readonly [number, number])[] = [];
      for (let i = 0; i <= 56; i++) {
        const th = a0 + (Math.PI * i) / 56;
        top.push(pr(Rc * flare * Math.cos(th), Rc * flare * Math.sin(th), rimH(th, Hc)));
        base.unshift(pr(Rc * Math.cos(th), Rc * Math.sin(th), 0));
      }
      return { top, base };
    };
    if (Hc > 3) {
      const b = half(Math.PI);
      const fr = half(0);
      const fade = clamp01(Hc / 40);
      crater = <ellipse cx={CX} cy={PY} rx={Rc * 0.96} ry={Rc * 0.96 * P} fill="#000" opacity={0.35 * fade} />;
      backWall = <polygon points={pts([...b.top, ...b.base])} fill={mixColor(C.cool, C.bg, 0.25)} opacity={0.75 * fade} />;
      frontWall = <polygon points={pts([...fr.top, ...fr.base])} fill="url(#wd-wall)" opacity={fade} />;
      frontRim = (
        <polyline points={pts(fr.top)} fill="none" stroke={C.fg} strokeWidth={3} strokeLinejoin="round" opacity={0.85 * fade} />
      );
    }
    for (const [i, b] of BEADS.entries()) {
      if (t < DETACH) continue;
      const lt = landT(b);
      if (t < lt) {
        const { rr, h } = beadAt(b, t);
        const [x, y] = pr(rr * Math.cos(b.th), rr * Math.sin(b.th), h);
        const node = <circle key={i} cx={x} cy={y} r={b.r} fill={C.fg} opacity={0.9} />;
        (Math.sin(b.th) < 0 ? backBeads : frontBeads).push(node);
      } else {
        const { rr } = beadAt(b, lt);
        landRipples.push(
          <Ripples key={i} t={t - lt} x={rr * Math.cos(b.th)} z={rr * Math.sin(b.th)} amp={0.5} n={1} speed={2.2} life={22} />,
        );
      }
    }
  }

  // 中心水柱和它掐出来的水珠
  const s = f - JET;
  let jet: React.ReactNode = null;
  let bead: React.ReactNode = null;
  if (s > 0) {
    const hj = jetH(s);
    if (hj > 2) {
      const bw = 26;
      const tw = 9;
      const [x0, y0] = pr(0, 0, 0);
      jet = (
        <path
          d={`M ${x0 - bw} ${y0} C ${x0 - bw * 0.45} ${y0 - hj * 0.35}, ${x0 - tw} ${y0 - hj * 0.7}, ${x0 - tw} ${y0 - hj} A ${tw} ${tw} 0 0 1 ${x0 + tw} ${y0 - hj} C ${x0 + tw} ${y0 - hj * 0.7}, ${x0 + bw * 0.45} ${y0 - hj * 0.35}, ${x0 + bw} ${y0} Z`}
          fill="url(#wd-jet)"
        />
      );
    }
    if (s >= PINCH && f < BEAD_LAND) {
      const [x, y] = pr(0, 0, beadH(s));
      bead = <circle cx={x} cy={y} r={12} fill={C.fg} />;
    }
  }

  // 落下的水滴：自由落体，越快拉得越长；离水面近时倒影迎上来
  let drop: React.ReactNode = null;
  if (f < HIT) {
    const u = f / HIT;
    const y = -60 + (PY + 60) * u * u;
    const gap = PY - y;
    drop = (
      <>
        {gap < 360 ? <Drop x={CX} y={PY + gap * P * 0.9} r={15} fill={C.fg} stretch={1 + u * 0.5} opacity={0.22 * (1 - gap / 360)} flip /> : null}
        <Drop x={CX} y={y} r={16} fill={C.fg} stretch={1 + u * 0.6} />
      </>
    );
  }

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="wd-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={far} />
            <stop offset="1" stopColor={near} />
          </linearGradient>
          <linearGradient id="wd-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.fg} stopOpacity={0.85} />
            <stop offset="1" stopColor={wall} stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="wd-jet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.fg} />
            <stop offset="1" stopColor={wall} stopOpacity={0.6} />
          </linearGradient>
          <filter id="wd-soft">
            <feGaussianBlur stdDeviation={6} />
          </filter>
        </defs>
        <rect x={0} y={HZ} width={W} height={H - HZ} fill="url(#wd-sea)" />
        <rect x={0} y={HZ - 6} width={W} height={12} fill={far} filter="url(#wd-soft)" />
        <Ripples t={t} amp={0.9} n={4} speed={6.5} life={100} />
        <Ripples t={f - BEAD_LAND} amp={0.55} n={2} speed={4.5} life={60} />
        {landRipples}
        {crater}
        {backWall}
        {backBeads}
        {jet}
        {frontWall}
        {frontRim}
        {frontBeads}
        {bead}
        {drop}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 51,
  name: "水滴落水溅起",
  group: "水墨",
  desc: "斜着俯看水面：一滴水加速落下，溅起一圈带尖刺的薄皇冠，尖上甩出水珠落回打出小涟漪；皇冠塌下时中心弹起水柱，掐出一颗水珠飞高落回，同心涟漪一圈圈散开",
  tech: "SVG 俯视透视（水面圆投成 1:0.3 椭圆）：皇冠是前后两半的薄壁多边形，边沿高度按 14 根高斯尖刺算；半径 1−e^(−t/9) 扩张、高度 t·e^(1−t/7) 冲起再塌；水珠和水柱都按抛体运动；创意参考 remotion-scenes 的 LiquidWaterDrop",
  frames: FRAMES,
  component: Scene,
};
export default effect;
