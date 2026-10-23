import { useCurrentFrame } from "remotion";
import { rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 空中立着一个发光的椭圆漩涡：螺旋臂一圈圈往中心卷，光点顺着螺旋被吸进去、越近越快；
// 边缘一圈光环在呼吸、轮廓微微起伏，几道电弧在边上跳一下就灭
const FRAMES = 120;
const CX = W / 2;
const CY = H / 2 - 20;
const RX = 300;
const RY = 400;
const TAU = Math.PI * 2;
const ARMS = 6;
const SPIN_TURNS = 1; // 一个循环转一整圈，接缝无痕

// 边缘轮廓：几个整周期的正弦叠在一起，相位按帧走、每个循环正好走整数圈
const rimR = (th: number, f: number) => {
  const p = (f / FRAMES) * TAU;
  return 1 + 0.025 * Math.sin(5 * th + 2 * p) + 0.018 * Math.sin(9 * th - 3 * p) + 0.012 * Math.sin(14 * th + 5 * p);
};
const rimPath = (f: number, scale: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * TAU;
    const r = rimR(th, f) * scale;
    pts.push(`${(CX + Math.cos(th) * RX * r).toFixed(1)},${(CY + Math.sin(th) * RY * r).toFixed(1)}`);
  }
  return "M" + pts.join("L") + "Z";
};

// 对数螺旋臂：半径从边缘往里按 e^{-k·θ} 收，越往里卷得越紧
const armPath = (base: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const th = base + u * TAU * 1.6;
    const r = 0.95 * Math.exp(-2.6 * u);
    pts.push(`${(Math.cos(th) * RX * r).toFixed(1)},${(Math.sin(th) * RY * r).toFixed(1)}`);
  }
  return "M" + pts.join("L");
};
const ARM_D = Array.from({ length: ARMS }, (_, i) => armPath((i / ARMS) * TAU));

// 吸入的光点：沿螺旋从边缘走到中心，寿命 40 帧（整除 120）
const MOTES = 70;
const LIFE = 40;

// 电弧：每段在边缘某个角度跳 6 帧，形状每 2 帧换一次
const ARCS = Array.from({ length: 9 }, (_, i) => ({
  at: Math.floor(rand(i * 17 + 3) * FRAMES),
  th: rand(i * 17 + 5) * TAU,
  span: 0.35 + rand(i * 17 + 7) * 0.4,
}));
const arcPath = (th0: number, span: number, seed: number, f: number) => {
  const pts: string[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const th = th0 + (i / n - 0.5) * span;
    const env = Math.sin((i / n) * Math.PI); // 两头贴着边缘，中间往外跳
    const out = 1.02 + env * (0.05 + 0.1 * rand(seed + i * 3)) + (rand(seed + i * 5 + 1) - 0.5) * 0.04;
    const r = rimR(th, f) * out;
    pts.push(`${(CX + Math.cos(th) * RX * r).toFixed(1)},${(CY + Math.sin(th) * RY * r).toFixed(1)}`);
  }
  return "M" + pts.join("L");
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const spin = (frame / FRAMES) * 360 * SPIN_TURNS;
  // 呼吸：一个循环两次
  const breath = 0.5 + 0.5 * Math.sin((frame / FRAMES) * TAU * 2);

  const motes: React.ReactNode[] = [];
  for (let i = 0; i < MOTES; i++) {
    const off = Math.floor(rand(i * 7 + 1) * LIFE);
    const age = (frame + off) % LIFE;
    const cyc = Math.floor((frame + off) / LIFE) % (FRAMES / LIFE);
    const seed = i * 131 + cyc * 977;
    const u = (age / LIFE) ** 1.6; // 越往里越快
    const pos = (uu: number) => {
      const th = rand(seed) * TAU + uu * TAU * 1.6 + (frame / FRAMES) * TAU;
      const r = (1.05 + 0.2 * rand(seed + 1)) * Math.exp(-2.6 * uu);
      return { x: CX + Math.cos(th) * RX * r, y: CY + Math.sin(th) * RY * r };
    };
    const p = pos(u);
    const q = pos(Math.max(0, u - 0.05));
    const op = Math.min(1, (age / LIFE) * 6) * (1 - u);
    motes.push(
      <line key={i} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={i % 3 ? C.cool : C.fg} strokeWidth={3} strokeLinecap="round" opacity={op} />,
    );
  }

  const arcs: React.ReactNode[] = [];
  ARCS.forEach((a, i) => {
    const age = (((frame - a.at) % FRAMES) + FRAMES) % FRAMES;
    if (age >= 6) return;
    const flick = age < 2 ? 1 : age < 4 ? 0.6 : 0.3;
    const d = arcPath(a.th, a.span, i * 400 + Math.floor(age / 2) * 37, frame);
    arcs.push(
      <g key={i} opacity={flick}>
        <path d={d} fill="none" stroke={C.cool} strokeWidth={10} opacity={0.6} filter="url(#pt-blur)" />
        <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinejoin="round" />
      </g>,
    );
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="pt-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
          <filter id="pt-wide" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={40} />
          </filter>
          <radialGradient id="pt-inside">
            <stop offset="0" stopColor="#000000" />
            <stop offset="0.35" stopColor={C.bg} />
            <stop offset="0.8" stopColor="#1C4A5E" />
            <stop offset="1" stopColor={C.cool} />
          </radialGradient>
          <clipPath id="pt-clip">
            <path d={rimPath(frame, 1)} />
          </clipPath>
        </defs>
        {/* 外面一大团光晕 */}
        <ellipse cx={CX} cy={CY} rx={RX * 1.15} ry={RY * 1.15} fill={C.cool} opacity={0.2 + 0.12 * breath} filter="url(#pt-wide)" />
        {/* 漩涡内部：越往中心越暗越深 */}
        <path d={rimPath(frame, 1)} fill="url(#pt-inside)" />
        <g clipPath="url(#pt-clip)">
          <g transform={`translate(${CX} ${CY}) rotate(${spin})`}>
            {ARM_D.map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke={C.cool} strokeWidth={34} opacity={0.22} filter="url(#pt-blur)" />
                <path d={d} fill="none" stroke={i % 2 ? C.fg : C.cool} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
              </g>
            ))}
          </g>
          {motes}
          {/* 中心深处的一点微光 */}
          <ellipse cx={CX} cy={CY} rx={36} ry={48} fill={C.fg} opacity={0.15 + 0.1 * breath} filter="url(#pt-blur)" />
        </g>
        {/* 边缘光环：模糊的宽光 + 亮芯 */}
        <path d={rimPath(frame, 1)} fill="none" stroke={C.cool} strokeWidth={36 + 12 * breath} opacity={0.65} filter="url(#pt-blur)" />
        <path d={rimPath(frame, 1)} fill="none" stroke="#FFFFFF" strokeWidth={5 + 2 * breath} opacity={0.9} />
        {arcs}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 57,
  name: "传送门漩涡",
  group: "特效",
  desc: "空中立着一个发光的椭圆漩涡，六条螺旋臂一圈圈往中心卷，光点顺着螺旋被吸进去、越近越快；边缘光环在呼吸、轮廓微微起伏，几道电弧在边上跳一下就灭",
  tech: "对数螺旋 r=e^{-2.6u} 的 SVG 折线整体旋转，一个循环一圈；边缘轮廓是几个整周期正弦叠加，相位每循环走整数圈；光点沿同一条螺旋走、寿命 40 帧（整除 120），速度按 u^1.6 越来越快；电弧是边缘上随机抖动的折线，6 帧内闪灭；内部用径向渐变加 clipPath",
  frames: FRAMES,
  component: Scene,
};
export default effect;
