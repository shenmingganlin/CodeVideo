import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 左上方画外有扇窗，一束束光斜着照进暗屋，光束各自忽明忽暗、整体随云慢慢摇；
// 空气里的灰尘缓缓飘，飘进光束才亮起来，飘出去就暗下去；光束落到地上照出几块光斑
const FRAMES = 150;
const TAU = Math.PI * 2;
const SRC = { x: -260, y: -380 }; // 光源在画外左上
const LIGHT = mixColor(C.accent, "#FFFFFF", 0.55);

// 每束光：方向角、半宽（弧度）、基础亮度、闪烁的圈数和相位（整数圈，首尾无缝）
const BEAMS = Array.from({ length: 9 }, (_, i) => ({
  ang: 0.62 + i * 0.075 + (rand(i * 7 + 1) - 0.5) * 0.03,
  half: 0.012 + rand(i * 7 + 2) * 0.022,
  base: 0.35 + rand(i * 7 + 3) * 0.5,
  k1: 1 + (i % 3),
  k2: 2 + ((i * 2) % 3),
  ph: rand(i * 7 + 4) * TAU,
}));

const LEN = 2900;
const beamState = (b: (typeof BEAMS)[number], u: number) => {
  // 整体随"云"慢慢摇一点：角度和亮度都是缓慢的正弦
  const sway = 0.012 * Math.sin(TAU * u) + 0.005 * Math.sin(TAU * 2 * u + 1.1);
  const cloud = 0.75 + 0.25 * Math.sin(TAU * u - 0.6);
  const flick = 0.6 + 0.25 * Math.sin(TAU * b.k1 * u + b.ph) + 0.15 * Math.sin(TAU * b.k2 * u + b.ph * 2);
  return {
    ang: b.ang + sway,
    half: b.half * (0.9 + 0.1 * Math.sin(TAU * u + b.ph)),
    lum: b.base * cloud * flick,
  };
};

// 灰尘：每粒在一个小椭圆上慢慢转，同时整体往下飘一个整圈的正弦，首尾无缝
const DUST = Array.from({ length: 260 }, (_, i) => ({
  x: rand(i * 5 + 11) * W,
  y: rand(i * 5 + 12) * H,
  ax: 20 + rand(i * 5 + 13) * 50,
  ay: 14 + rand(i * 5 + 14) * 40,
  k: rand(i * 5 + 15) < 0.5 ? 1 : -1,
  ph: rand(i * 5 + 16) * TAU,
  r: 0.9 + rand(i * 5 + 17) ** 3 * 3.2, // 少数大颗粒离镜头近
}));

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  const beams = BEAMS.map((b) => beamState(b, u));

  const beamPolys = beams.map((s) => {
    const a0 = s.ang - s.half;
    const a1 = s.ang + s.half;
    return `${SRC.x},${SRC.y} ${SRC.x + Math.cos(a0) * LEN},${SRC.y + Math.sin(a0) * LEN} ${SRC.x + Math.cos(a1) * LEN},${SRC.y + Math.sin(a1) * LEN}`;
  });

  // 一粒灰尘有多亮：看它离每束光的中线差多少角度（高斯），再乘这束光此刻的亮度
  const litAt = (x: number, y: number) => {
    const a = Math.atan2(y - SRC.y, x - SRC.x);
    const dist = Math.hypot(x - SRC.x, y - SRC.y);
    const fade = Math.max(0, 1 - (dist - 500) / 2200);
    let l = 0;
    for (const s of beams) {
      const d = (a - s.ang) / (s.half * 1.25);
      l += s.lum * Math.exp(-d * d);
    }
    return Math.min(1, l * fade);
  };

  // 光束落到地面（y = FLOOR）的位置：照出光斑
  const FLOOR = 930;
  const pools = beams.map((s) => {
    const t = (FLOOR - SRC.y) / Math.sin(s.ang);
    return { x: SRC.x + Math.cos(s.ang) * t, w: t * s.half * 2.6, lum: s.lum };
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="gr-beam" gradientUnits="userSpaceOnUse" x1={SRC.x} y1={SRC.y} x2={SRC.x + 1500} y2={SRC.y + 2100}>
            <stop offset="0" stopColor={LIGHT} stopOpacity={1} />
            <stop offset="0.35" stopColor={LIGHT} stopOpacity={0.75} />
            <stop offset="1" stopColor={LIGHT} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gr-room" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.bg2} />
            <stop offset="1" stopColor="#0C0D11" />
          </linearGradient>
          <radialGradient id="gr-pool">
            <stop offset="0" stopColor={LIGHT} stopOpacity={0.6} />
            <stop offset="1" stopColor={LIGHT} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="gr-window" cx="0" cy="0" r="1">
            <stop offset="0" stopColor={LIGHT} stopOpacity={0.5} />
            <stop offset="1" stopColor={LIGHT} stopOpacity={0} />
          </radialGradient>
          <filter id="gr-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <filter id="gr-blur2" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={50} />
          </filter>
          <filter id="gr-dust" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={0.8} />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#gr-room)" />
        <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#0E1014" />
        {/* 窗口那一角的散射光 */}
        <rect width={W} height={H} fill="url(#gr-window)" style={{ mixBlendMode: "screen" }} opacity={0.45 + 0.15 * Math.sin(TAU * u - 0.6)} />
        {/* 光束：一层宽而虚的空气散射 + 一层清楚一点的光柱 */}
        <g style={{ mixBlendMode: "screen" }}>
          <g filter="url(#gr-blur2)" opacity={0.5}>
            {beamPolys.map((p, i) => (
              <polygon key={i} points={p} fill="url(#gr-beam)" opacity={beams[i].lum * 0.8} />
            ))}
          </g>
          <g filter="url(#gr-blur)">
            {beamPolys.map((p, i) => (
              <polygon key={i} points={p} fill="url(#gr-beam)" opacity={beams[i].lum * 0.42} />
            ))}
          </g>
          <g filter="url(#gr-blur)">
            {pools.map((p, i) => (
              <ellipse key={i} cx={p.x} cy={FLOOR + 18} rx={p.w} ry={26} fill="url(#gr-pool)" opacity={p.lum} />
            ))}
          </g>
        </g>
        {/* 灰尘：暗处几乎看不见，进了光束才亮 */}
        <g filter="url(#gr-dust)" style={{ mixBlendMode: "screen" }}>
          {DUST.map((d, i) => {
            const th = TAU * u * d.k + d.ph;
            const x = d.x + Math.cos(th) * d.ax;
            const y = d.y + Math.sin(th) * d.ay + 18 * Math.sin(TAU * u + d.ph * 0.5);
            const l = litAt(x, y);
            if (l < 0.02) return null;
            return <circle key={i} cx={x} cy={y} r={d.r} fill={LIGHT} opacity={Math.min(1, 0.04 + l * 1.15)} />;
          })}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 68,
  name: "体积光穿过",
  group: "特效",
  desc: "左上方画外有扇窗，九束光斜照进暗屋，各自忽明忽暗、整体随云轻轻摇；空气里的灰尘慢慢飘，飘进光束才被照亮，地上落着几块光斑",
  tech: "SVG 三角形光柱（同一个画外光源）+ 两层高斯模糊 + mix-blend-mode: screen；每束的亮度是整数圈正弦叠加，角度随一个慢正弦摇；灰尘沿小椭圆转圈，亮度按它离每束光中线的角度差做高斯，乘这束光的当前亮度",
  frames: FRAMES,
  component: Scene,
};
export default effect;
