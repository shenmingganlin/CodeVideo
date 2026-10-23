import { useCurrentFrame } from "remotion";
import { clamp01, mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一个强光点从左边画外沿一条拱形弧线掠到右边画外，两头慢、中间快；
// 光点和画面中心的连线上排着一串彩色光圈，光点往右走它们往左滑；一条横向长条炫光和星芒跟着光点，越靠近中心整体越亮
const FRAMES = 150;
const TAU = Math.PI * 2;
const CX = W / 2;
const CY = H / 2;
const SPAN = 260; // 光点在画外多走的距离，进出画都在暗处，接缝无痕

// x 走 s(p) = p - a·sin(2πp)/2π：p=0、1 处速度只有 1-a，中间是 1+a，自然的先慢后快再慢
const sunAt = (f: number) => {
  const p = f / FRAMES;
  const s = p - (0.65 * Math.sin(TAU * p)) / TAU;
  const x = -SPAN + (W + 2 * SPAN) * s;
  const u = (x - CX) / (CX + SPAN);
  return { x, y: 230 + 360 * u * u };
};

const smooth = (t: number) => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};

// 光圈：沿 光点→中心 的连线排开，t>1 的跑到中心另一侧，所以和光点反着走
const GHOSTS = [
  { t: 0.42, r: 24, c: C.accent, a: 0.4, kind: "disk" },
  { t: 0.68, r: 64, c: C.cool, a: 0.22, kind: "ring" },
  { t: 1.0, r: 12, c: "#FFFFFF", a: 0.45, kind: "disk" },
  { t: 1.22, r: 92, c: mixColor(C.cool, "#9B6BFF", 0.5), a: 0.13, kind: "hex" },
  { t: 1.42, r: 38, c: mixColor(C.accent, "#7CE0A0", 0.5), a: 0.26, kind: "disk" },
  { t: 1.6, r: 150, c: C.cool, a: 0.08, kind: "hex" },
  { t: 1.84, r: 22, c: C.accent, a: 0.34, kind: "disk" },
  { t: 2.1, r: 210, c: mixColor(C.accent, C.cool, 0.5), a: 0.1, kind: "ring" },
] as const;

const hexPts = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * TAU + 0.26; // 光圈是光阑的形状，角度固定
    return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");

const RAYS = Array.from({ length: 12 }, (_, i) => ({
  a: (i / 12) * 180 + (i % 2) * 7,
  len: i % 3 === 0 ? 560 : i % 3 === 1 ? 300 : 190,
}));

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const s = sunAt(frame);
  // 出了画面按距离淡掉；越靠中心越亮
  const edge = Math.min(s.x, W - s.x);
  const vis = smooth((edge + 420) / 480); // 光点刚出画时光圈和炫光还留一点余光
  const d = Math.hypot(s.x - CX, s.y - CY);
  const near = Math.exp(-((d / 640) ** 2));
  const bright = vis * (0.45 + 0.55 * near);
  const spin = ((s.x - CX) / W) * 28; // 星芒随位置慢慢转
  const scr = { mixBlendMode: "screen" as const };

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="lf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.bg2} />
            <stop offset="1" stopColor={C.bg} />
          </linearGradient>
          <radialGradient id="lf-core">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <stop offset="0.18" stopColor="#FFFFFF" stopOpacity={0.95} />
            <stop offset="0.45" stopColor={mixColor(C.accent, "#FFFFFF", 0.4)} stopOpacity={0.45} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lf-veil">
            <stop offset="0" stopColor={C.accent} stopOpacity={0.5} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lf-ray">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lf-streak">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <stop offset="0.25" stopColor={mixColor(C.cool, "#FFFFFF", 0.4)} stopOpacity={0.6} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lf-halo">
            <stop offset="0.78" stopColor={C.cool} stopOpacity={0} />
            <stop offset="0.86" stopColor={C.cool} stopOpacity={0.5} />
            <stop offset="0.93" stopColor={C.accent} stopOpacity={0.5} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          {GHOSTS.map((g, i) =>
            g.kind === "ring" ? (
              <radialGradient key={i} id={`lf-g${i}`}>
                <stop offset="0.7" stopColor={g.c} stopOpacity={0} />
                <stop offset="0.9" stopColor={g.c} stopOpacity={1} />
                <stop offset="1" stopColor={g.c} stopOpacity={0} />
              </radialGradient>
            ) : (
              <radialGradient key={i} id={`lf-g${i}`}>
                <stop offset="0" stopColor={g.c} stopOpacity={0.5} />
                <stop offset="0.82" stopColor={g.c} stopOpacity={0.85} />
                <stop offset="1" stopColor={g.c} stopOpacity={0} />
              </radialGradient>
            ),
          )}
          <filter id="lf-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={2.5} />
          </filter>
          <filter id="lf-wide" x="-10%" y="-300%" width="120%" height="700%">
            <feGaussianBlur stdDeviation="6 14" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#lf-sky)" />
        {/* 地平线上一排暗色剪影，给光一个"在场景里"的参照 */}
        <path
          d={`M0,${H} L0,900 L180,900 L180,840 L330,840 L330,880 L520,880 L520,800 L600,800 L600,870 L860,870 L860,820 L1010,820 L1010,890 L1240,890 L1240,780 L1330,780 L1330,860 L1560,860 L1560,830 L1740,830 L1740,890 L${W},890 L${W},${H} Z`}
          fill="#0C0D11"
        />
        {/* 整体泛光：光点靠近中心时整屏微微发亮 */}
        <rect width={W} height={H} fill={C.accent} opacity={0.07 * near * vis} style={scr} />
        <g style={scr} opacity={bright}>
          <circle cx={s.x} cy={s.y} r={620} fill="url(#lf-veil)" opacity={0.35} />
          <circle cx={s.x} cy={s.y} r={330} fill="url(#lf-halo)" opacity={0.35 + 0.4 * near} />
          {/* 横向长条炫光：一条细的亮芯加一层宽的柔光 */}
          <ellipse cx={s.x} cy={s.y} rx={260 + 980 * bright} ry={34} fill="url(#lf-streak)" opacity={0.35} filter="url(#lf-wide)" />
          <ellipse cx={s.x} cy={s.y} rx={220 + 900 * bright} ry={4.5} fill="url(#lf-streak)" />
          {RAYS.map((r, i) => (
            <ellipse
              key={i}
              cx={s.x}
              cy={s.y}
              rx={r.len * (0.5 + 0.5 * bright)}
              ry={2.2}
              fill="url(#lf-ray)"
              transform={`rotate(${(r.a + spin).toFixed(2)} ${s.x.toFixed(2)} ${s.y.toFixed(2)})`}
            />
          ))}
          <circle cx={s.x} cy={s.y} r={110} fill="url(#lf-core)" />
        </g>
        <g style={scr} opacity={bright} filter="url(#lf-soft)">
          {GHOSTS.map((g, i) => {
            const gx = s.x + (CX - s.x) * g.t;
            const gy = s.y + (CY - s.y) * g.t;
            // 大光圈离光点越远越淡一点
            const a = g.a * (0.6 + 0.4 * near);
            return g.kind === "hex" ? (
              <polygon key={i} points={hexPts(gx, gy, g.r)} fill={g.c} fillOpacity={a} stroke={g.c} strokeOpacity={a * 1.6} strokeWidth={2} />
            ) : (
              <circle key={i} cx={gx} cy={gy} r={g.r} fill={`url(#lf-g${i})`} opacity={a * 1.4} />
            );
          })}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 67,
  name: "镜头光晕划过",
  group: "特效",
  desc: "一个强光点从左边画外沿拱形弧线掠到右边，两头慢中间快；连线上一串彩色圆光圈和六边形光圈反着滑过画面，横向一条长炫光和星芒跟着光点，靠近画面中心时整屏都亮起来",
  tech: "SVG 径向渐变 + mix-blend-mode: screen 叠加；光点 x 用 p - a·sin(2πp)/2π 做先慢后快再慢，光圈位置 = 光点 + (中心 - 光点)·t，t>1 的落在中心另一侧；亮度随离中心距离做高斯衰减，出画按距离淡掉",
  frames: FRAMES,
  component: Scene,
};
export default effect;
