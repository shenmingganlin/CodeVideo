import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一行粗大的镀铬字：上半截亮、地平线处一道暗带、下半截反着亮（像金属映着天和地）。
// 一道斜高光带从左到右扫过字面，先慢后快再慢；扫到哪个字，那个字的笔画尖上闪一下星芒。
// 一个循环扫两次：一次大、一次快而淡
const FRAMES = 150;
const TEXT = Array.from("镀铬金属");
const SIZE = 250;
const STEP = 270;
const X0 = (W - STEP * (TEXT.length - 1)) / 2; // 第一个字的中心
const BASE = H / 2 + SIZE * 0.36; // 字的基线
const TOPY = BASE - SIZE * 0.88;
const BOT = BASE + SIZE * 0.12;
const BAND = 170; // 高光带的宽度（沿水平方向）
const SLANT = 0.45; // 高光带每往下 1px 往左偏多少
// 两次扫光：从第几帧到第几帧、强度
const SWEEPS = [
  { f0: 14, f1: 66, k: 1 },
  { f0: 92, f1: 122, k: 0.75 },
];
const X_FROM = X0 - STEP * 0.5 - BAND * 2;
const X_TO = X0 + STEP * (TEXT.length - 0.5) + BAND * 2;
// 每个字闪星芒的位置（相对字中心、基线，按笔画大致落点挑的）
const GLINT = [
  { dx: -78, dy: -190 },
  { dx: 70, dy: -170 },
  { dx: -10, dy: -205 },
  { dx: 60, dy: -120 },
];

const sweepAt = (f: number) => {
  for (const s of SWEEPS) {
    if (f >= s.f0 && f <= s.f1) {
      const t = ease.inOut(clamp01((f - s.f0) / (s.f1 - s.f0)));
      return { x: lerp(X_FROM, X_TO, t), k: s.k };
    }
  }
  return null;
};

const Star: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} style={{ mixBlendMode: "screen" }}>
    <circle r={26} fill="url(#sh-star)" />
    <path d="M0 -70 L5 -5 L70 0 L5 5 L0 70 L-5 5 L-70 0 L-5 -5 Z" fill="#FFFFFF" opacity={0.95} />
    <path
      d="M0 -30 L3 -3 L30 0 L3 3 L0 30 L-3 3 L-30 0 L-3 -3 Z"
      fill="#FFFFFF"
      transform="rotate(45)"
      opacity={0.7}
    />
  </g>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const sw = sweepAt(frame);
  // 地平线暗带随着整段轻轻上下晃，像金属映着的环境在动；整周期正弦，首尾对上
  const wob = Math.sin((frame / FRAMES) * Math.PI * 2) * 0.025;
  const hz = 0.52 + wob;
  const bandX = sw ? sw.x : X_FROM;
  const bandK = sw ? sw.k : 0;
  const midY = (TOPY + BOT) / 2;

  const glyphs = (fill: string, extra?: React.SVGProps<SVGTextElement>) =>
    TEXT.map((ch, i) => (
      <text
        key={i}
        x={X0 + i * STEP}
        y={BASE}
        textAnchor="middle"
        fontFamily={FONT}
        fontWeight={900}
        fontSize={SIZE}
        fill={fill}
        {...extra}
      >
        {ch}
      </text>
    ));

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          {/* 镀铬：上亮、往下暗、地平线一道深色、再往下反光亮回来 */}
          <linearGradient id="sh-chrome" gradientUnits="userSpaceOnUse" x1={0} y1={TOPY} x2={0} y2={BOT}>
            <stop offset={0} stopColor="#E3E6EB" />
            <stop offset={hz * 0.45} stopColor="#A4ACB8" />
            <stop offset={hz - 0.02} stopColor="#7C8593" />
            <stop offset={hz} stopColor="#2A2F38" />
            <stop offset={hz + 0.06} stopColor="#5D6573" />
            <stop offset={0.86} stopColor="#BCC2CB" />
            <stop offset={1} stopColor="#9AA2AE" />
          </linearGradient>
          {/* 拉丝纹：很细的横向明暗条 */}
          <pattern id="sh-brush" width={8} height={3} patternUnits="userSpaceOnUse">
            <rect width={8} height={1} fill="#FFFFFF" opacity={0.07} />
          </pattern>
          {/* 斜高光带：中间一道亮芯，两边淡出；整条带随扫光的 x 平移 */}
          <linearGradient
            id="sh-band"
            gradientUnits="userSpaceOnUse"
            x1={bandX - BAND}
            y1={midY - BAND * SLANT}
            x2={bandX + BAND}
            y2={midY + BAND * SLANT}
          >
            <stop offset={0} stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset={0.38} stopColor="#FFFFFF" stopOpacity={0.25 * bandK} />
            <stop offset={0.5} stopColor="#FFFFFF" stopOpacity={0.95 * bandK} />
            <stop offset={0.62} stopColor="#FFFFFF" stopOpacity={0.25 * bandK} />
            <stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
          </linearGradient>
          <radialGradient id="sh-star">
            <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.9} />
            <stop offset={1} stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          <filter id="sh-shadow" x="-10%" y="-10%" width="120%" height="140%">
            <feGaussianBlur stdDeviation={14} />
          </filter>
          <linearGradient id="sh-floor" x1={0} y1={0} x2={0} y2={1}>
            <stop offset={0} stopColor={C.bg2} />
            <stop offset={1} stopColor={C.bg} />
          </linearGradient>
        </defs>
        <rect y={BOT + 10} width={W} height={H - BOT} fill="url(#sh-floor)" />
        {/* 投在地上的影子 */}
        <g filter="url(#sh-shadow)" opacity={0.6} transform={`translate(0 ${BOT + 30}) scale(1 0.12) translate(0 ${-BASE})`}>
          {glyphs("#000000")}
        </g>
        {/* 厚度：往右下错开一点的暗色字，像金属的倒角侧面 */}
        <g transform="translate(5 7)">{glyphs("#3A404B")}</g>
        <g transform="translate(2 3)">{glyphs("#6B7380")}</g>
        {glyphs("url(#sh-chrome)")}
        {glyphs("url(#sh-brush)")}
        {/* 高光带只画在字上 */}
        {bandK > 0 && glyphs("url(#sh-band)", { style: { mixBlendMode: "screen" } })}
        {/* 顶边一线亮：金属倒角接住天光 */}
        {glyphs("none", { stroke: "#FFFFFF", strokeOpacity: 0.18, strokeWidth: 2 })}
        {/* 星芒：高光带的亮芯扫到笔画尖时闪一下 */}
        {sw &&
          TEXT.map((_, i) => {
            const gx = X0 + i * STEP + GLINT[i].dx;
            const gy = BASE + GLINT[i].dy;
            // 亮芯在这一高度上的 x：带是斜的，越往下越靠左
            const coreX = bandX - (gy - midY) * SLANT;
            const d = (gx - coreX) / 70;
            const s = Math.exp(-d * d) * sw.k;
            if (s < 0.02) return null;
            return <Star key={i} x={gx} y={gy} s={s * 0.9} />;
          })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 72,
  name: "金属光扫过字面",
  group: "文字",
  desc: "一行粗大的镀铬字，上亮下暗、地平线一道深色反光；一道斜高光带从左到右扫过字面，先慢后快再慢，扫到哪个字，那个字的笔画尖上闪一下星芒；一个循环扫一大一小两次",
  tech: "SVG text：镀铬用竖直渐变（地平线暗带随整周期正弦微晃），拉丝是 3px 的横纹 pattern，厚度是两层往右下错开的暗色字；高光带是 userSpaceOnUse 的斜向渐变，填在同一组字上、screen 叠加，x 按 ease.inOut 从左扫到右；星芒强度是笔画尖到亮芯距离的高斯。创意参考 DavidHDev/react-bits 的 ShinyText",
  frames: FRAMES,
  component: Scene,
};
export default effect;
