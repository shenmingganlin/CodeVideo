import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, mixColor, prog, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 球往后一缩，猛地加速撞上方块：撞上的一帧闪白、画面顿住 5 帧（只有方块在打颤、冲击星往外迸），
// 一松开火星带着拖尾四溅，越飞越慢、往下掉；方块被撞得往后一仰再弹回，球弹开后慢慢飘回原位
const FRAMES = 120;
const WIND = [6, 15]; // 往后缩
const RUSH = [15, 24]; // 冲上去
const HIT = 24; // 撞上
const GO = 29; // 顿帧结束
const BACK = [50, 100]; // 球飘回原位

const CY = H / 2 + 20;
const R = 70; // 球半径
const TS = 130; // 方块半边长
const TX = W / 2 + 160; // 方块中心
const CONTACT = TX - TS - R; // 撞上时球心的位置
const SX0 = W / 2 - 600; // 球的待机位置
const IMPACT = { x: TX - TS, y: CY };

// 球心的 x：缩、加速冲、贴住、弹开、飘回
const ballX = (f: number) => {
  if (f < RUSH[0]) return SX0 - 70 * prog(f, WIND[0], WIND[1], ease.inOut);
  if (f < HIT) return lerp(SX0 - 70, CONTACT, ease.in(clamp01((f - RUSH[0]) / (HIT - RUSH[0]))) ** 1.4);
  if (f < GO) return CONTACT;
  const out = CONTACT - 330 * (1 - Math.exp(-(f - GO) / 6));
  return lerp(out, SX0, prog(f, BACK[0], BACK[1], ease.inOut));
};

// 火星：从撞击点往回、往上下喷，带空气阻力和重力
const SPARKS = Array.from({ length: 52 }, (_, i) => {
  const a = Math.PI + (rand(i * 5 + 1) - 0.5) * 3.2; // 以正左为中心，散开约 180°
  const v = 18 + rand(i * 5 + 2) ** 0.7 * 62;
  return {
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v - 6,
    life: 20 + rand(i * 5 + 3) * 32,
    w: 2 + rand(i * 5 + 4) * 5,
  };
});
const DRAG = 0.13;
const G = 0.85;
// 阻力 + 重力的解析解：速度指数衰减，竖直方向趋近终端速度 G/DRAG
const sparkPos = (s: (typeof SPARKS)[number], t: number) => {
  const e = 1 - Math.exp(-DRAG * t);
  return {
    x: IMPACT.x + (s.vx * e) / DRAG,
    y: IMPACT.y + (s.vy * e) / DRAG + (G / DRAG) * t - (G / (DRAG * DRAG)) * e,
  };
};

// 冲击星：长短不一的尖刺
const STAR = (() => {
  const n = 14;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 170 + rand(i + 300) * 170 : 38;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(" ");
})();

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const stop = frame >= HIT && frame < GO;
  const t = frame - GO; // 松开后过了几帧

  // 球：冲的时候顺着速度拉长，贴住时压扁
  const x = ballX(frame);
  const v = frame >= RUSH[0] && frame < HIT ? x - ballX(frame - 1) : 0;
  const k = Math.min(0.7, v / 90);
  const press = stop ? 0.28 : t >= 0 ? 0.28 * Math.exp(-t / 2.5) * Math.cos(t / 1.6) : 0;
  const bsx = (1 + k) * (1 - press);
  const bsy = 1 / Math.sqrt(1 + k) / (1 - press * 0.6);
  const bx = stop ? CONTACT + R * press : x; // 压扁时贴着方块那一面

  // 方块：顿帧时原地打颤，松开后往后一仰（快冲慢回的脉冲），再压缩回弹
  const shove = t >= 0 ? 130 * (t / 5) * Math.exp(1 - t / 5) : 0;
  const tremble = stop ? (frame % 2 === 0 ? 7 : -7) * (1 - (frame - HIT) / 6) : 0;
  const tsq = stop ? 0.88 : t >= 0 ? 1 - 0.12 * Math.exp(-t / 3.5) * Math.cos(t / 2) : 1;
  const tilt = shove * 0.07;

  // 震屏：松开那一下最猛
  const shX = t >= 0 ? 16 * Math.exp(-t / 4) * Math.sin(t * 2.4) : 0;
  const shY = t >= 0 ? 12 * Math.exp(-t / 4) * Math.cos(t * 3.1) : 0;

  // 闪：撞上那一帧整屏白、星是黑剪影；下一帧反过来，暗底亮星
  const white = frame === HIT ? 0.9 : frame === HIT + 1 ? 0 : t >= 0 ? 0.25 * Math.exp(-t / 2) : 0;
  const dark = frame === HIT + 1 ? 0.45 : frame === HIT + 2 ? 0.2 : 0;
  const starS = stop ? lerp(0.55, 1.1, ease.out((frame - HIT + 1) / 5)) : t >= 0 ? 1.1 * Math.exp(-t / 3) : 0;
  const starO = stop ? 1 : t >= 0 ? Math.exp(-t / 4) : 0;
  const starRot = stop ? (frame - HIT) * 3 : 15 + t * 1.5;
  const starFill = frame === HIT ? C.bg : "#FFFFFF";

  const ring = t >= 0 ? { r: 50 + 460 * (1 - Math.exp(-t / 5)), o: 0.7 * Math.exp(-t / 5) } : null;

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="hs-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
          <filter id="hs-big" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={22} />
          </filter>
        </defs>
        <g transform={`translate(${shX.toFixed(2)} ${shY.toFixed(2)})`}>
          <g transform={`translate(${(TX + shove + tremble).toFixed(2)} ${CY}) rotate(${tilt.toFixed(3)}) scale(${tsq.toFixed(4)} ${(1 / Math.sqrt(tsq)).toFixed(4)})`}>
            <rect x={-TS} y={-TS} width={TS * 2} height={TS * 2} rx={24} fill={C.bg2} stroke={C.dim} strokeWidth={6} />
            <rect x={-TS * 0.42} y={-TS * 0.42} width={TS * 0.84} height={TS * 0.84} rx={14} fill="none" stroke={C.cool} strokeWidth={10} opacity={0.7} />
          </g>
          {/* 冲的时候身后两个残影 */}
          {k > 0.05 &&
            [1, 2].map((g) => (
              <ellipse key={g} cx={x - v * 0.45 * g} cy={CY} rx={R * (1 + k * 0.6)} ry={R * 0.85} fill={C.accent} opacity={0.22 / g} />
            ))}
          <g transform={`translate(${bx.toFixed(2)} ${CY}) scale(${bsx.toFixed(4)} ${bsy.toFixed(4)})`}>
            <circle r={R} fill={C.accent} />
            <circle cx={-R * 0.3} cy={-R * 0.32} r={R * 0.28} fill="#FFFFFF" opacity={0.4} />
          </g>
          {ring && <circle cx={IMPACT.x} cy={IMPACT.y} r={ring.r} fill="none" stroke={C.fg} strokeWidth={6} opacity={ring.o} filter="url(#hs-glow)" />}
          {t >= 0 && (
            <g>
              {SPARKS.map((s, i) => {
                if (t > s.life) return null;
                const age = t / s.life;
                const p = sparkPos(s, t);
                const q = sparkPos(s, Math.max(0, t - 2.2));
                const col = age < 0.25 ? mixColor("#FFFFFF", C.accent, age / 0.25) : mixColor(C.accent, C.dim, (age - 0.25) / 0.75);
                const o = 1 - clamp01((age - 0.6) / 0.4);
                const w = s.w * (1 - 0.7 * age);
                return (
                  <g key={i} opacity={o}>
                    <line x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={C.accent} strokeWidth={w * 3} strokeLinecap="round" opacity={0.35} filter="url(#hs-glow)" />
                    <line x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={col} strokeWidth={w} strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
          )}
        </g>
        <rect x={0} y={0} width={W} height={H} fill="#000" opacity={dark} />
        <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" opacity={white} />
        {starO > 0.01 && (
          <g transform={`translate(${IMPACT.x} ${IMPACT.y}) rotate(${starRot.toFixed(2)}) scale(${starS.toFixed(4)})`} opacity={starO}>
            {frame !== HIT && <polygon points={STAR} fill={C.accent} opacity={0.6} filter="url(#hs-big)" />}
            <polygon points={STAR} fill={starFill} />
          </g>
        )}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 62,
  name: "击中火花",
  group: "特效",
  desc: "球往后一缩再加速撞上方块，撞上的一帧闪白、画面顿住 5 帧，只有方块在打颤、冲击星往外迸；一松开火星带拖尾四溅，越飞越慢往下掉，方块往后一仰再弹回，球弹开后飘回原位",
  tech: "顿帧（hit stop）：撞上后 5 帧球和方块冻住，只有冲击星放大和方块左右 7 像素打颤；第一帧白底黑星、第二帧暗底亮星。52 颗火星用阻力 + 重力的解析解算位置，拖尾是 2.2 帧前到现在的线段，颜色白→橙→灰；方块后仰是 t·e^(1−t) 脉冲，压缩回弹和震屏是阻尼余弦",
  frames: FRAMES,
  component: Effect,
};
export default effect;
