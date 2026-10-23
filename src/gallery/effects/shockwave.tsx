import { useCurrentFrame } from "remotion";
import { clamp01, ease, prog } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 中心的光核先往里缩、越抖越厉害（蓄力），猛地一击：一圈空气扭曲的环往外扩，
// 环经过的地方网格被挤弯；画面跟着震、往前顶一下再衰减，后面还跟一圈弱一点的余波
const FRAMES = 120;
const CHARGE = [8, 30];
const HIT = 30;

const CX = W / 2;
const CY = H / 2;
const STEP = 60; // 网格间距
const SAMPLE = 12; // 网格线每隔多少像素取一个点，弯得才圆
const PAD = 120; // 网格比画面大一圈，震屏时不露边

type Ring = { r: number; amp: number; w: number };

// 两圈波：主波和晚 9 帧的余波。半径指数趋近（先快后慢），幅度随时间衰减
const rings = (t: number): Ring[] => {
  const ring = (tt: number, reach: number, amp0: number): Ring | null => {
    if (tt < 0) return null;
    const r = reach * (1 - Math.exp(-tt / 16));
    return { r, amp: amp0 * Math.exp(-tt / 22) * clamp01(tt / 2), w: 26 + r * 0.06 };
  };
  return [ring(t, 1500, 46), ring(t - 9, 1100, 20)].filter((x): x is Ring => x !== null);
};

// 一个点被波推了多少：高斯导数的形状，环前面的点往外推、后面的往里拉，环上挤成一道密带
const displace = (x: number, y: number, rs: Ring[]) => {
  const dx = x - CX;
  const dy = y - CY;
  const d = Math.hypot(dx, dy) || 1;
  let push = 0;
  for (const g of rs) {
    const u = (d - g.r) / g.w;
    push += -g.amp * u * Math.exp(0.5 - 0.5 * u * u);
  }
  return [x + (dx / d) * push, y + (dy / d) * push];
};

const gridPath = (rs: Ring[]) => {
  const parts: string[] = [];
  const line = (pts: number[][]) =>
    parts.push("M" + pts.map((p) => {
      const [x, y] = displace(p[0], p[1], rs);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("L"));
  const x0 = CX - Math.ceil((CX + PAD) / STEP) * STEP;
  const y0 = CY - Math.ceil((CY + PAD) / STEP) * STEP;
  for (let y = y0; y <= H + PAD; y += STEP) {
    const pts: number[][] = [];
    for (let x = -PAD; x <= W + PAD; x += SAMPLE) pts.push([x, y]);
    line(pts);
  }
  for (let x = x0; x <= W + PAD; x += STEP) {
    const pts: number[][] = [];
    for (let y = -PAD; y <= H + PAD; y += SAMPLE) pts.push([x, y]);
    line(pts);
  }
  return parts.join("");
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const t = frame - HIT;
  const rs = rings(t);

  // 光核：平时轻轻呼吸；蓄力时往里缩、越抖越快；一击炸大，再阻尼弹回原大小
  const breathe = 60 + 4 * Math.sin((frame / FRAMES) * Math.PI * 4);
  const charge = prog(frame, CHARGE[0], CHARGE[1], ease.in);
  const jitter = charge * charge * 6 * Math.sin(frame * 2.7);
  const burst = t >= 0 ? 58 * Math.exp(-t / 5) * Math.cos(t / 3) : 0;
  const coreR = t >= 0 ? breathe + burst : breathe - 22 * charge + jitter;
  const coreHot = t >= 0 ? Math.exp(-t / 6) : charge;

  // 震屏和往前顶的一下（放大再回来），都是衰减的
  const shakeX = t >= 0 ? 22 * Math.exp(-t / 5) * Math.sin(t * 2.3) : charge * charge * 2 * Math.sin(frame * 3.3);
  const shakeY = t >= 0 ? 14 * Math.exp(-t / 5) * Math.cos(t * 2.9) : 0;
  const punch = t >= 0 ? 0.045 * Math.exp(-t / 6) * Math.cos(t / 4) : -0.012 * charge;
  const flash = t >= 0 ? 0.4 * Math.exp(-t / 2) : 0;

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="sw-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={18} />
          </filter>
          <filter id="sw-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={4} />
          </filter>
          <radialGradient id="sw-core">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.45" stopColor={C.accent} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={`translate(${(CX + shakeX).toFixed(2)} ${(CY + shakeY).toFixed(2)}) scale(${(1 + punch).toFixed(4)}) translate(${-CX} ${-CY})`}>
          <path d={gridPath(rs)} fill="none" stroke={C.dim} strokeWidth={2} opacity={0.55} />
          {/* 环本身：一圈宽的模糊白光，外沿暖、内沿冷，像折射出来的色边 */}
          {rs.map((g, i) => {
            const o = clamp01(g.amp / 46);
            return (
              <g key={i}>
                <circle cx={CX} cy={CY} r={g.r} fill="none" stroke={C.fg} strokeWidth={g.w * 1.6} opacity={0.16 * o} filter="url(#sw-blur)" />
                <circle cx={CX} cy={CY} r={g.r + g.w * 0.25} fill="none" stroke={C.accent} strokeWidth={3} opacity={0.7 * o} filter="url(#sw-soft)" />
                <circle cx={CX} cy={CY} r={Math.max(1, g.r - g.w * 0.25)} fill="none" stroke={C.cool} strokeWidth={3} opacity={0.7 * o} filter="url(#sw-soft)" />
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={coreR * 2.4} fill="url(#sw-core)" opacity={0.25 + 0.5 * coreHot} />
          <circle cx={CX} cy={CY} r={coreR} fill={C.accent} />
          <circle cx={CX} cy={CY} r={coreR * (0.45 + 0.35 * coreHot)} fill="#FFFFFF" opacity={0.35 + 0.65 * coreHot} />
        </g>
        <rect x={0} y={0} width={W} height={H} fill={C.fg} opacity={flash} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 60,
  name: "冲击波震屏",
  group: "特效",
  desc: "中心的光核先缩紧、越抖越快，猛地一击：一圈空气扭曲的环往外扩，经过的网格被挤弯成一道密带，后面跟着一圈弱一点的余波；画面跟着震、往前顶一下再衰减",
  tech: "网格线每 12 像素取一个点，按到中心的距离做径向位移（高斯导数形状：环前推、环后拉），半径指数趋近、幅度指数衰减；环上叠模糊白光和冷暖两道细边模拟折射色散；震屏、放大回弹、光核都是阻尼余弦",
  frames: FRAMES,
  component: Effect,
};
export default effect;
