import { useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 漫画的集中线：一根根尖楔从画面四周往中心戳进来，戳到底就从外头缩走，粗细长短各不同、此起彼伏；
// 中间的球像在高速冲向镜头：一直在抖，每隔一拍猛地往前一顶，这时线也变密、戳得更深
const FRAMES = 90;
const N = 150; // 线的根数
const CX = W / 2;
const CY = H / 2;
const FAR = Math.hypot(W, H) / 2 + 60; // 线的外端在画外

// 每根线一个固定的角度、粗细、寿命和起始相位；寿命整除循环长度，首尾才接得上
const LIVES = [6, 9, 10, 15];
const LINES = Array.from({ length: N }, (_, i) => ({
  a: ((i + rand(i * 7 + 1) * 0.8) / N) * Math.PI * 2,
  w: 4 + rand(i * 7 + 2) ** 2 * 26, // 角宽（像素），大多数细，少数粗
  reach: 0.28 + rand(i * 7 + 3) * 0.32, // 最深戳到离中心多远（占 FAR 的比例）
  life: LIVES[Math.floor(rand(i * 7 + 4) * LIVES.length)],
  phase: rand(i * 7 + 5),
}));

// 往前顶：一个循环两次，快速顶上去再指数回落
const surgeAt = (f: number) => {
  const s = (f % 45) / 45;
  const rise = clamp01(s / 0.08);
  return ease.out(rise) * Math.exp(-Math.max(0, s - 0.08) * 7);
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const surge = surgeAt(frame);

  // 抖动：几个整除循环长度的正弦叠起来，快但连续
  const wob = (k: number) => Math.sin(((frame * k) / FRAMES) * Math.PI * 2);
  const amp = 5 + 12 * surge;
  const jx = amp * (0.6 * wob(23) + 0.4 * wob(37));
  const jy = amp * (0.6 * wob(29) + 0.4 * wob(41));
  const scale = 1 + 0.16 * surge + 0.015 * wob(2);

  const wedges = LINES.map((l, i) => {
    const p = ((frame / l.life + l.phase) % 1 + 1) % 1; // 这根线活到哪了
    // 尖头加速戳进来，后半段尾巴从外头追上来把线收走
    const deep = l.reach * (1 - 0.35 * surge);
    const tip = 1 - (1 - deep) * ease.out(clamp01(p / 0.55));
    const tail = 1 - (1 - deep) * ease.in(clamp01((p - 0.45) / 0.55)); // 寿命结束时尾巴正好追到尖头
    if (tail <= tip + 0.01) return null;
    const half = (l.w * (1 + 0.6 * surge)) / 2 / (FAR * tail);
    const r0 = FAR * tip;
    const r1 = FAR * tail;
    const pt = (r: number, a: number) => `${(CX + Math.cos(a) * r).toFixed(1)},${(CY + Math.sin(a) * r).toFixed(1)}`;
    return <polygon key={i} points={`${pt(r0, l.a)} ${pt(r1, l.a - half)} ${pt(r1, l.a + half)}`} />;
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <radialGradient id="sl-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor={C.bg2} />
            <stop offset="1" stopColor={C.bg} />
          </radialGradient>
          <radialGradient id="sl-halo">
            <stop offset="0" stopColor={C.accent} stopOpacity={0.55} />
            <stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
          <filter id="sl-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#sl-bg)" />
        <g fill={C.fg} opacity={0.85 + 0.15 * surge}>
          {wedges}
        </g>
        <g transform={`translate(${(CX + jx).toFixed(2)} ${(CY + jy).toFixed(2)}) scale(${scale.toFixed(4)})`}>
          <circle r={330} fill="url(#sl-halo)" opacity={0.6 + 0.4 * surge} />
          {/* 冲过来的残影：几个缩小、变淡的轮廓留在后面 */}
          {[0.72, 0.84].map((s, i) => (
            <circle key={i} r={170 * s} fill="none" stroke={C.accent} strokeWidth={10} opacity={(0.18 + 0.3 * surge) * (i + 1) * 0.5} />
          ))}
          <circle r={170} fill={C.accent} />
          <circle r={170} fill="none" stroke={C.bg} strokeWidth={12} />
          <ellipse cx={-55} cy={-62} rx={52} ry={30} fill="#FFFFFF" opacity={0.5} transform="rotate(-35 -55 -62)" filter="url(#sl-blur)" />
          <text y={70} textAnchor="middle" fill={C.bg} fontFamily={FONT} fontSize={200} fontWeight={900}>
            冲
          </text>
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 61,
  name: "漫画速度线",
  group: "特效",
  desc: "一根根尖楔从四周往中心戳进来又从外头缩走，粗细长短各不同、此起彼伏；中间的球一直在抖，每 1.5 秒猛地往前一顶，这时线变粗、戳得更深",
  tech: "150 根 SVG 三角楔，每根有固定角度、角宽、深度和寿命（6/9/10/15 帧，整除 90 帧循环）；尖头 ease.out 戳进、尾巴 ease.in 收走；抖动是几个整周期正弦叠加，前顶是快升指数落的脉冲，线和球同步跟着它",
  frames: FRAMES,
  component: Effect,
};
export default effect;
