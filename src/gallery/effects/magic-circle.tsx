import { useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 斜俯视的地面上，一圈符文阵先一笔笔描出来，外圈内圈反向转起来，越转越快越亮，往上冒光粒；最后笔画收回、光熄掉
const FRAMES = 150;
const CX = W / 2;
const CY = 720;
const TILT = 0.36; // 地面透视：竖直方向压扁
const R = 430;
const TAU = Math.PI * 2;
const RUNES = 20;

// 描线进度：0–40 帧描出来，112–146 帧收回去
const drawAt = (f: number) =>
  f < 112 ? ease.out(clamp01(f / 40)) : 1 - ease.inOut(clamp01((f - 112) / 34));
// 能量：30–92 帧慢慢充满，104–140 帧熄掉
const energyAt = (f: number) => {
  const m = ((f % FRAMES) + FRAMES) % FRAMES;
  return m < 104 ? ease.inOut(clamp01((m - 30) / 62)) : 1 - ease.inOut(clamp01((m - 104) / 36));
};

// 转速随能量加快（度/帧），累加成角度表，转起来有加速和减速
const SPIN: number[] = (() => {
  const out = [0];
  for (let f = 1; f <= FRAMES; f++) out.push(out[f - 1] + 0.12 + 1.5 * energyAt(f) ** 1.5);
  return out;
})();

// 一个符文：几笔折线，形状由种子定
const runePath = (seed: number) => {
  const pts: string[] = [];
  const n = 2 + Math.floor(rand(seed) * 3);
  for (let s = 0; s < n; s++) {
    const x0 = (rand(seed + s * 7 + 1) - 0.5) * 30;
    const y0 = (rand(seed + s * 7 + 2) - 0.5) * 30;
    const x1 = (rand(seed + s * 7 + 3) - 0.5) * 30;
    const y1 = (rand(seed + s * 7 + 4) - 0.5) * 30;
    pts.push(`M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`);
  }
  return pts.join("");
};
const RUNE_D = Array.from({ length: RUNES }, (_, i) => runePath(100 + i * 31));

// 正多边形 / 星形的顶点串
const poly = (n: number, r: number, step: number, rot = 0) => {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rot + ((i * step) % n) * (TAU / n);
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return "M" + pts.join("L");
};
const STAR = poly(8, 300, 3);
const HEX = poly(6, 300, 1);

// 光粒：从阵上某处升起，越飞越快（往上加速），寿命 50 帧；50 能整除 150，接缝处的光粒接得上
const MOTES = 60;
const LIFE = 50;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const d = drawAt(frame);
  const e = energyAt(frame);
  const spin = SPIN[frame];
  // pathLength=1 的描线：dashoffset 从 1 走到 0
  const dash = (k: number) => ({
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: 1 - clamp01(k),
  });
  const stroke = (w: number, color: string = C.accent) => ({
    fill: "none",
    stroke: color,
    strokeWidth: w,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  });

  // 各层描线错开一点：外圈先、星形后、符文最后
  const dOuter = clamp01(d * 1.25);
  const dInner = clamp01(d * 1.25 - 0.15);
  const dStar = clamp01(d * 1.4 - 0.4);
  const ring = (
    <>
      <g transform={`rotate(${spin})`}>
        <circle r={R} {...stroke(5)} {...dash(dOuter)} />
        <circle r={R - 34} {...stroke(2.5)} {...dash(dOuter)} />
        {RUNE_D.map((rd, i) => {
          const a = (i / RUNES) * 360;
          const k = clamp01(d * 2.2 - 1 - (i / RUNES) * 0.2);
          return (
            <g key={i} transform={`rotate(${a}) translate(${R - 17} 0) rotate(90)`} opacity={k}>
              <path d={rd} {...stroke(3.5)} />
            </g>
          );
        })}
      </g>
      <g transform={`rotate(${-spin * 1.6})`}>
        <circle r={318} {...stroke(3)} {...dash(dInner)} />
        <path d={STAR} {...stroke(3)} {...dash(dStar)} />
        <path d={HEX} {...stroke(2)} {...dash(dStar)} opacity={0.7} />
      </g>
      <g transform={`rotate(${spin * 2.4})`}>
        <circle r={150} {...stroke(3)} {...dash(dInner)} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={150} x2={128} y1={0} y2={0} transform={`rotate(${i * 30})`} {...stroke(3)} opacity={clamp01(d * 2 - 1)} />
        ))}
        <circle r={46} {...stroke(4)} {...dash(dStar)} />
      </g>
    </>
  );

  // 光粒用屏幕坐标画，不跟着地面压扁
  const motes: React.ReactNode[] = [];
  for (let i = 0; i < MOTES; i++) {
    const off = Math.floor(rand(i * 13 + 5) * LIFE);
    const age = (frame + off) % LIFE;
    const cyc = Math.floor((frame + off) / LIFE) % (FRAMES / LIFE);
    const strength = energyAt(frame - age); // 按出生那一刻的能量决定亮不亮
    if (strength < 0.03) continue;
    const seed = i * 97 + cyc * 7919;
    const a = rand(seed) * TAU;
    const rr = R * (0.2 + 0.8 * Math.sqrt(rand(seed + 1)));
    const t = age / LIFE;
    const rise = 40 + 520 * (0.4 * t + 0.6 * t * t) * (0.6 + 0.6 * rand(seed + 2)); // 往上加速
    const sway = Math.sin(age * 0.12 + i) * 14 * t;
    const x = CX + Math.cos(a) * rr + sway;
    const y = CY + Math.sin(a) * rr * TILT - rise;
    const op = strength * Math.sin(Math.PI * t) ** 0.8;
    motes.push(
      <circle key={i} cx={x} cy={y} r={2.5 + 3 * rand(seed + 3) * (1 - t)} fill={i % 3 ? C.accent : C.fg} opacity={op} />,
    );
  }

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="mc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
          <radialGradient id="mc-floor">
            <stop offset="0" stopColor={C.accent} stopOpacity={0.5} />
            <stop offset="0.6" stopColor={C.accent} stopOpacity={0.12} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="mc-column" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={C.accent} stopOpacity={0.28} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* 地面被阵照亮 */}
        <ellipse cx={CX} cy={CY} rx={R * 1.5} ry={R * 1.5 * TILT} fill="url(#mc-floor)" opacity={0.15 + 0.85 * e} />
        {/* 往上的光柱 */}
        <rect x={CX - R} y={CY - 700} width={R * 2} height={700} fill="url(#mc-column)" opacity={e * 0.7} />
        <g transform={`translate(${CX} ${CY}) scale(1 ${TILT})`}>
          {/* 辉光层：同一套线条模糊后叠在下面，亮度跟能量走 */}
          <g filter="url(#mc-glow)" opacity={0.25 + 0.75 * e}>
            {ring}
          </g>
          <g opacity={0.55 + 0.45 * e}>{ring}</g>
        </g>
        <g filter="url(#mc-glow)">{motes}</g>
        {motes}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 55,
  name: "魔法阵转起来亮起",
  group: "特效",
  desc: "斜俯视的地面上，一圈符文阵先一笔笔描出来，外圈和内圈反向转起来，越转越快、越来越亮，光粒从阵上往上加速飘起；最后笔画收回、光熄掉",
  tech: "SVG 圆、星形、符文折线放在 scale(1, 0.36) 的地面坐标里；描线用 pathLength=1 的 dashoffset；转速随能量加快、逐帧累加成角度表；同一套线条加高斯模糊当辉光；光粒寿命 50 帧（整除 150）按出生时的能量决定亮度",
  frames: FRAMES,
  component: Scene,
};
export default effect;
