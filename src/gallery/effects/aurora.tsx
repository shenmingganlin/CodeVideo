import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 几条彩色光带在夜空里慢慢起伏、交叠，从上沿往下渐隐，竖向有一缕缕帘幕状的光柱；下方一道黑色山脊做参照
const FRAMES = 150;
const TAU = Math.PI * 2;
const SKY = "#080A10";
const STEP = 12; // 光柱间距（px）

// 每条带：基准高度、帘幕长度、颜色、几组 (空间频率, 时间圈数, 振幅) 叠起来的上沿
const BANDS = [
  { y: 300, len: 420, color: mixColor(C.cool, "#3FE0A0", 0.6), waves: [[1.3, 1, 70], [3.1, -2, 28], [6.7, 3, 10]] },
  { y: 220, len: 360, color: C.cool, waves: [[0.9, -1, 60], [2.4, 2, 34], [5.3, -3, 12]] },
  { y: 380, len: 300, color: mixColor(C.cool, "#B26BFF", 0.65), waves: [[1.7, 1, 50], [4.2, -1, 22], [7.9, 2, 8]] },
  { y: 260, len: 260, color: C.accent, waves: [[1.1, 2, 40], [2.9, -1, 26], [6.1, 1, 10]] },
] as const;

const topY = (b: (typeof BANDS)[number], x: number, u: number, ph: number) =>
  b.y + b.waves.reduce((s, [k, t, a], j) => s + a * Math.sin(TAU * (k * (x / W) + t * u) + ph * (j + 1)), 0);

const stars = Array.from({ length: 140 }, (_, i) => ({
  x: rand(i * 3 + 1) * W,
  y: rand(i * 3 + 2) * H * 0.75,
  r: 0.6 + rand(i * 3 + 3) * 1.2,
}));

// 山脊：几组正弦叠出来的剪影，静止
const RIDGE = (() => {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 20) {
    const y = 900 - 60 * Math.sin(x / 260) - 35 * Math.sin(x / 97 + 1.3) - 18 * Math.sin(x / 41 + 0.4) - 70 * Math.exp(-(((x - 1300) / 220) ** 2));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M0,${H} L${pts.join(" L")} L${W},${H} Z`;
})();

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  return (
    <Stage bg={SKY}>
      <svg width={W} height={H}>
        <defs>
          {BANDS.map((b, i) => (
            <linearGradient key={i} id={`aurora-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={b.color} stopOpacity={0.95} />
              <stop offset="0.35" stopColor={b.color} stopOpacity={0.45} />
              <stop offset="1" stopColor={b.color} stopOpacity={0} />
            </linearGradient>
          ))}
          <filter id="aurora-soft" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation={18} />
          </filter>
          <filter id="aurora-ray" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3 10" />
          </filter>
        </defs>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.fg} opacity={0.35} />
        ))}
        {BANDS.map((b, i) => {
          const ph = i * 1.7;
          // 柔和的底色光带：上沿曲线往下 len 的区域
          const top: string[] = [];
          for (let x = -40; x <= W + 40; x += 40) top.push(`${x},${topY(b, x, u, ph).toFixed(1)}`);
          const bottom = [...top].reverse().map((p) => {
            const [x, y] = p.split(",").map(Number);
            return `${x},${(y + b.len).toFixed(1)}`;
          });
          const base = `M${top.join(" L")} L${bottom.join(" L")} Z`;
          // 帘幕光柱：沿上沿每 STEP 一根，亮度和长度随 x 和时间起伏（整数圈，首尾无缝）
          const rays = [];
          for (let x = 0; x <= W; x += STEP) {
            const y0 = topY(b, x, u, ph);
            const n = x / W;
            const lum = 0.5 + 0.5 * Math.sin(TAU * (9 * n - 2 * u) + ph) * Math.sin(TAU * (23 * n + 3 * u) + ph * 2);
            const len = b.len * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(TAU * (5 * n + u) + ph)));
            rays.push(
              <rect key={x} x={x - STEP * 0.3} y={y0 - 10} width={STEP * 0.6} height={len} fill={`url(#aurora-g${i})`} opacity={0.15 + 0.75 * lum * lum} />,
            );
          }
          return (
            <g key={i} style={{ mixBlendMode: "screen" }}>
              <path d={base} fill={`url(#aurora-g${i})`} filter="url(#aurora-soft)" opacity={0.55} />
              <g filter="url(#aurora-ray)">{rays}</g>
            </g>
          );
        })}
        <path d={RIDGE} fill="#030406" />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 45,
  name: "极光流动",
  group: "背景",
  desc: "四条青绿、蓝、紫、橙的光带在夜空里慢慢起伏交叠，从上沿往下渐隐，里面一缕缕帘幕状的光柱忽明忽暗，下方一道黑色山脊",
  tech: "SVG：每条带的上沿是三组正弦叠加（时间走整数圈）；底色是上沿往下的渐变面加 18px 模糊，帘幕是每 12px 一根渐变竖条、亮度两组正弦相乘、横 3 竖 10 的各向异性模糊；mix-blend-mode: screen 叠加。创意参考 remotion-scenes 的 BackgroundAurora",
  frames: FRAMES,
  component: Scene,
};
export default effect;
