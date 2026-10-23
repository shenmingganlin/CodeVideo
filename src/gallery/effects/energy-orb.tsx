import { useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 四周的光点被吸向中心，越近越快；中间的能量球越来越大、越来越亮、抖得越来越厉害，
// 爆发前猛地一缩，然后炸开一圈冲击波和碎光，碎光减速散尽，画面回落到暗
const FRAMES = 120;
const CX = W / 2;
const CY = H / 2;
const BURST = 76; // 爆发那一帧
const TAU = Math.PI * 2;

// 蓄力 0–1：从第 4 帧起加速充满
const chargeAt = (f: number) => ease.in(clamp01((f - 4) / (BURST - 10)));

// 吸入的光点：每颗在 [birth, birth+dur] 里从外圈落进中心，距离按 (1-p)^2 走，越近越快
const MOTES = Array.from({ length: 90 }, (_, i) => {
  const birth = rand(i * 3 + 1) * (BURST - 22);
  return {
    birth,
    dur: 20 + rand(i * 3 + 2) * 16,
    a: rand(i * 3 + 3) * TAU,
    r0: 380 + rand(i * 5 + 7) * 520,
    swirl: (rand(i * 5 + 9) - 0.5) * 2.2, // 绕着中心拐一点弯
    hot: rand(i * 7 + 11) < 0.35,
  };
});

// 碎光：初速有大有小，阻力让它越飞越慢
const SHARDS = Array.from({ length: 70 }, (_, i) => ({
  a: (i / 70) * TAU + (rand(i * 11 + 1) - 0.5) * 0.15,
  v: 28 + rand(i * 11 + 2) * 30,
  life: 24 + rand(i * 11 + 3) * 16,
  hot: rand(i * 11 + 4) < 0.5,
}));
const DRAG = 0.09;
const travel = (v0: number, t: number) => (v0 * (1 - Math.exp(-DRAG * t))) / DRAG;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const c = chargeAt(frame);
  const t = frame - BURST; // 爆发后过了几帧

  // 爆发前 6 帧猛地缩一下（蓄满后的回缩），爆发后球迅速塌掉
  const squeeze = t < 0 ? 1 - 0.35 * ease.in(clamp01((frame - (BURST - 6)) / 6)) : 0;
  const after = t >= 0 ? Math.exp(-t / 3) : 1;
  const radius = (14 * clamp01(frame / 12) + 96 * c) * (t < 0 ? squeeze : 0.9 * after);
  // 抖动跟蓄力平方走：快满时抖得最厉害
  const shake = c * c * 9 * (t < 0 ? 1 : 0);
  const jx = (rand(frame * 2 + 1) - 0.5) * 2 * shake;
  const jy = (rand(frame * 2 + 2) - 0.5) * 2 * shake;
  const bright = t < 0 ? 0.25 + 0.75 * c : after;
  // 球面的脉动：越到后面频率越高
  const pulse = 1 + 0.06 * c * Math.sin(frame * (0.4 + 1.2 * c));

  const motes: React.ReactNode[] = [];
  MOTES.forEach((m, i) => {
    const p = (frame - m.birth) / m.dur;
    if (p < 0 || p >= 1 || frame >= BURST) return;
    const k = (1 - p) * (1 - p);
    const r = 20 + m.r0 * k;
    const a = m.a + m.swirl * (1 - k);
    const prev = 20 + m.r0 * (1 - Math.max(0, p - 0.06)) ** 2; // 尾巴：稍早一点的位置
    const ap = m.a + m.swirl * (1 - (1 - Math.max(0, p - 0.06)) ** 2);
    const op = Math.min(1, p * 5) * (0.5 + 0.5 * c);
    motes.push(
      <line
        key={i}
        x1={CX + Math.cos(ap) * prev}
        y1={CY + Math.sin(ap) * prev}
        x2={CX + Math.cos(a) * r}
        y2={CY + Math.sin(a) * r}
        stroke={m.hot ? C.fg : C.cool}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={op}
      />,
    );
  });

  // 冲击波：半径减速扩大，越扩越细越淡
  const waves: React.ReactNode[] = [];
  const shards: React.ReactNode[] = [];
  if (t >= 0) {
    [0, 5].forEach((lag, wi) => {
      const tt = t - lag;
      if (tt < 0) return;
      const wr = 60 + 1150 * (1 - Math.exp(-tt / 9));
      const fade = Math.exp(-tt / 10);
      waves.push(
        <circle key={wi} cx={CX} cy={CY} r={wr} fill="none" stroke={wi ? C.cool : C.fg} strokeWidth={46 * fade + 2} opacity={fade * (wi ? 0.6 : 0.9)} />,
      );
    });
    SHARDS.forEach((s, i) => {
      if (t >= s.life) return;
      const d1 = 40 + travel(s.v, t);
      const d0 = 40 + travel(s.v, Math.max(0, t - 2.5));
      const fade = (1 - t / s.life) ** 1.5;
      shards.push(
        <line
          key={i}
          x1={CX + Math.cos(s.a) * d0}
          y1={CY + Math.sin(s.a) * d0}
          x2={CX + Math.cos(s.a) * d1}
          y2={CY + Math.sin(s.a) * d1}
          stroke={s.hot ? C.fg : C.cool}
          strokeWidth={5 * fade + 1}
          strokeLinecap="round"
          opacity={fade}
        />,
      );
    });
  }
  // 闪白：爆发那一下最亮，几帧就退
  const flash = t >= 0 ? 0.55 * Math.exp(-t / 2.5) : 0;
  // 环境光：蓄力时慢慢亮，爆发后衰减
  const ambient = t < 0 ? 0.03 + 0.55 * c : 0.58 * Math.exp(-t / 14);

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="eo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={18} />
          </filter>
          <filter id="eo-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={5} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="eo-amb">
            <stop offset="0" stopColor={C.cool} stopOpacity={0.55} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="eo-core">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.45" stopColor={C.fg} />
            <stop offset="0.8" stopColor={C.cool} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={760} fill="url(#eo-amb)" opacity={ambient} />
        <g filter="url(#eo-soft)">{motes}</g>
        <g filter="url(#eo-soft)">
          {waves}
          {shards}
        </g>
        {radius > 0.5 && (
          <g transform={`translate(${CX + jx} ${CY + jy}) scale(${pulse})`}>
            <circle r={radius * 2.2} fill={C.cool} opacity={0.55 * bright} filter="url(#eo-glow)" />
            <circle r={radius} fill="url(#eo-core)" opacity={Math.min(1, 0.4 + bright)} />
          </g>
        )}
        <rect width={W} height={H} fill={C.fg} opacity={flash} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 56,
  name: "能量球蓄力爆发",
  group: "特效",
  desc: "四周的光点拖着尾巴被吸向中心，越近越快；中间的能量球越长越大越亮、抖得越来越厉害，蓄满时猛地一缩，然后炸开两圈冲击波和一圈碎光，碎光减速散尽，画面回落到暗",
  tech: "光点距离按 (1-p)² 收向中心（越近越快）并带一点旋转；蓄力用 ease.in，抖动幅度跟蓄力平方；冲击波半径 1-e^{-t/9} 减速扩大、线宽和透明度指数衰减；碎光带空气阻力；整屏闪白 2.5 帧时间常数衰减；SVG 高斯模糊做辉光",
  frames: FRAMES,
  component: Scene,
};
export default effect;
