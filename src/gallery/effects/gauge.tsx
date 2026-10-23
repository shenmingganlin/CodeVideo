import { useCurrentFrame } from "remotion";
import { clamp01, colorRamp, ease, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 半圆仪表：指针从 0 甩到 78，冲过头到 85 左右再阻尼回稳，扫过的刻度依次点亮，中间的数字跟着滚；
// 停一会儿，指针缓缓回到 0，刻度跟着熄灭
const FRAMES = 150;
const CX = W / 2;
const CY = 700;
const R = 460;
const TARGET = 78;
const SWING = 8; // 开始甩
const BACK0 = 96; // 开始回 0
const BACK1 = 136;
// 欠阻尼弹簧：1 - e^(-kt)(cos ωt + k/ω sin ωt)，起步速度为 0；第一个峰 = 1 + e^(-kπ/ω) ≈ 1.09（78 → 85）
const OMEGA = 0.16;
const K = 0.123;

const needleAt = (frame: number) => {
  if (frame < SWING) return 0;
  const t = frame - SWING;
  const settle = 1 - Math.exp(-K * t) * (Math.cos(OMEGA * t) + (K / OMEGA) * Math.sin(OMEGA * t));
  return TARGET * settle * (1 - prog(frame, BACK0, BACK1, ease.inOut));
};

// 读数 v（0–100）对应的角度：0 在左边，100 在右边
const angle = (v: number) => Math.PI - (v / 100) * Math.PI;
const pt = (v: number, r: number) => ({ x: CX + Math.cos(angle(v)) * r, y: CY - Math.sin(angle(v)) * r });
const ramp = (v: number) => colorRamp([C.cool, C.accent], v / 100);

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const v = needleAt(frame);
  const ticks = Array.from({ length: 51 }, (_, i) => i * 2);
  // 色带：分成 50 小段，指针扫过的点亮
  const bands = Array.from({ length: 50 }, (_, i) => i * 2);
  const tip = pt(v, R - 70);
  const left = { x: CX, y: CY };
  const nx = Math.cos(angle(v) + Math.PI / 2) * 14;
  const ny = -Math.sin(angle(v) + Math.PI / 2) * 14;
  return (
    <Stage>
      <svg width={W} height={H}>
        {bands.map((b) => {
          const a = pt(b + 0.3, R + 40);
          const z = pt(b + 1.7, R + 40);
          const lit = clamp01(v - b);
          return (
            <path
              key={b}
              d={`M ${a.x} ${a.y} A ${R + 40} ${R + 40} 0 0 1 ${z.x} ${z.y}`}
              stroke={lit > 0 ? ramp(b) : C.bg2}
              strokeOpacity={0.25 + 0.75 * lit}
              strokeWidth={26}
              fill="none"
            />
          );
        })}
        {ticks.map((t) => {
          const long = t % 10 === 0;
          const a = pt(t, R);
          const b = pt(t, R - (long ? 46 : 22));
          const lit = clamp01((v - t + 1) / 2);
          return (
            <line
              key={t}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit > 0 ? ramp(t) : C.dim}
              strokeOpacity={0.35 + 0.65 * lit}
              strokeWidth={long ? 6 : 3}
              strokeLinecap="round"
            />
          );
        })}
        {[0, 20, 40, 60, 80, 100].map((t) => {
          const p = pt(t, R - 96);
          return (
            <text key={t} x={p.x} y={p.y + 12} textAnchor="middle" fill={v >= t ? C.fg : C.dim} fontFamily={FONT} fontSize={34}>
              {t}
            </text>
          );
        })}
        <polygon points={`${left.x + nx},${left.y + ny} ${tip.x},${tip.y} ${left.x - nx},${left.y - ny}`} fill={C.fg} />
        <circle cx={CX} cy={CY} r={34} fill={C.bg2} stroke={C.fg} strokeWidth={6} />
        <circle cx={CX} cy={CY} r={10} fill={ramp(v)} />
        <text
          x={CX}
          y={CY + 200}
          textAnchor="middle"
          fill={C.fg}
          fontFamily={FONT}
          fontSize={150}
          fontWeight={800}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(v)}
        </text>
        <text x={CX + 150} y={CY + 200} fill={C.dim} fontFamily={FONT} fontSize={40}>
          分
        </text>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 47,
  name: "仪表盘指针摆动",
  group: "数据",
  desc: "指针从 0 甩到 78，冲过头到 85 再晃两下停稳，扫过的刻度和色带依次点亮，中间的数字跟着滚；停一会儿再缓缓回 0",
  tech: "自己画 SVG；指针是起步速度为 0 的欠阻尼弹簧解析式（ω=0.16、k=0.123，第一个峰 1.09 倍），回 0 用 ease.inOut；刻度亮度 = 指针读数减刻度值，色带用 colorRamp 从辅色渐到强调色。创意参考 remotion-scenes 的 DataGauge",
  frames: FRAMES,
  component: Effect,
};
export default effect;
