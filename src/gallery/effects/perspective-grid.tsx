import { useCurrentFrame } from "remotion";
import { mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 80 年代合成波：下半屏一张透视地面网格不停朝镜头涌来，竖线从消失点放射；上半屏一轮带横向切缝的落日，地平线一道辉光
const FRAMES = 150;
const CX = W / 2;
const HZ = 600; // 地平线
const K = H - HZ; // 投影常数：深度 z 的地面线落在 y = HZ + K / z，z = 1 正好是画面底边
const CELLS = 6; // 一个循环往前跑几格（整数，首尾无缝）
const ROWS = 48;
const PINK = mixColor(C.accent, "#FF4FA0", 0.75);
const SKY_TOP = "#0A0B14";
const SKY_LOW = mixColor(SKY_TOP, "#3A1846", 0.8);

const SUN = { x: CX, y: 400, r: 250 };
// 落日下半部的切缝：越往下越粗
const SLITS = Array.from({ length: 6 }, (_, i) => ({ y: SUN.y + 30 + i * 38, h: 4 + i * 4.5 }));

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const frac = ((frame / FRAMES) * CELLS) % 1;
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    const z = i + 1 - frac;
    if (z <= 0.05) continue;
    const y = HZ + K / z;
    if (y > H + 4) continue;
    // 远处的线暗、细，近处亮、粗
    const near = 1 / z;
    rows.push(<line key={i} x1={0} x2={W} y1={y} y2={y} stroke={C.cool} strokeWidth={0.8 + 3 * near} opacity={Math.min(1, 0.15 + 1.2 * near)} />);
  }
  const cols = [];
  for (let j = -22; j <= 22; j++) {
    cols.push(<line key={j} x1={CX} y1={HZ} x2={CX + K * j * 0.55} y2={H} stroke={C.cool} strokeWidth={2} />);
  }
  return (
    <Stage bg={SKY_TOP}>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="pg-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={SKY_TOP} />
            <stop offset="1" stopColor={SKY_LOW} />
          </linearGradient>
          <linearGradient id="pg-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mixColor(C.accent, "#FFE27A", 0.5)} />
            <stop offset="0.55" stopColor={C.accent} />
            <stop offset="1" stopColor={PINK} />
          </linearGradient>
          <mask id="pg-slits">
            <rect x={0} y={0} width={W} height={HZ} fill="white" />
            {SLITS.map((s, i) => (
              <rect key={i} x={0} y={s.y} width={W} height={s.h} fill="black" />
            ))}
          </mask>
          <linearGradient id="pg-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity={0} />
            <stop offset="0.12" stopColor="white" stopOpacity={0.5} />
            <stop offset="1" stopColor="white" stopOpacity={1} />
          </linearGradient>
          <mask id="pg-ground">
            <rect x={0} y={HZ} width={W} height={K} fill="url(#pg-fade)" />
          </mask>
          <filter id="pg-blur" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation={24} />
          </filter>
          <filter id="pg-line-glow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation={4} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={0} y={0} width={W} height={HZ} fill="url(#pg-sky)" />
        <circle cx={SUN.x} cy={SUN.y} r={SUN.r + 60} fill={PINK} opacity={0.18} filter="url(#pg-blur)" />
        <circle cx={SUN.x} cy={SUN.y} r={SUN.r} fill="url(#pg-sun)" mask="url(#pg-slits)" />
        <rect x={0} y={HZ} width={W} height={K} fill="#07070D" />
        <g mask="url(#pg-ground)" filter="url(#pg-line-glow)">
          {cols}
          {rows}
        </g>
        {/* 地平线辉光 */}
        <rect x={0} y={HZ - 14} width={W} height={28} fill={PINK} opacity={0.55} filter="url(#pg-blur)" />
        <line x1={0} x2={W} y1={HZ} y2={HZ} stroke={mixColor(PINK, C.fg, 0.4)} strokeWidth={2} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 46,
  name: "透视网格往前跑",
  group: "背景",
  desc: "80 年代合成波：下半屏一张透视地面网格不停朝镜头涌来，越近格子越大，竖线从消失点放射开；上半屏一轮被横缝切开的落日，地平线一道粉色辉光",
  tech: "SVG：横线按 y = 地平线 + K/z 投影，z 每帧减小、取模循环，一个循环正好跑 6 格首尾无缝；竖线从消失点连到底边；落日用 mask 切出越往下越粗的横缝；网格线 feMerge 叠一层模糊辉光，远处用渐变 mask 压暗。创意参考 remotion-scenes 的 BackgroundPerspectiveGrid",
  frames: FRAMES,
  component: Scene,
};
export default effect;
