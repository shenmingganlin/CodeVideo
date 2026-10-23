import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 老电影片头倒数：3、2、1 每秒一个，扇形从正上方顺时针扫一圈，扫过的地方变亮；十字准线、两道同心圆。
// 整幅带胶片颗粒、竖划痕、灰尘点、明暗闪烁和上下轻跳（gate weave），四角压暗；数到 1 扫完闪白，白里切回 3
const FRAMES = 90; // 正好 3 秒
const SEC = 30;
const CX = W / 2;
const CY = H / 2;
const R_IN = 360;
const R_OUT = 430;
const BASE = mixColor(C.bg2, C.dim, 0.35); // 片头底色是灰，不是黑
const SWEPT = mixColor(C.dim, C.fg, 0.35);

// 闪白：中心正好在循环接缝上（第 89.5 帧），从第 83 帧起涨、到第 6 帧落完，
// 第 89 帧和第 0 帧都在最白处，"1"切回"3"藏在白光里
const flashAt = (f: number) => {
  const d = Math.abs((((f - 89.5) % FRAMES) + FRAMES * 1.5) % FRAMES - FRAMES / 2);
  return clamp01(1 - d / 7) ** 1.6;
};

// 扇形：从正上方顺时针扫到 a（弧度）
const wedge = (a: number, r: number) => {
  if (a <= 0.001) return "";
  if (a >= Math.PI * 2 - 0.001) return `M ${CX} ${CY - r} A ${r} ${r} 0 1 1 ${CX - 0.01} ${CY - r} Z`;
  const x = CX + Math.sin(a) * r;
  const y = CY - Math.cos(a) * r;
  return `M ${CX} ${CY} L ${CX} ${CY - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
};

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const n = 3 - Math.floor(f / SEC);
  const t = (f % SEC) / SEC;
  // 片头的转盘是机械匀速的，这里匀速是对的
  const sweep = t * Math.PI * 2;
  const flash = flashAt(f);
  // gate weave：片子在片门里上下轻跳、左右微漂，每帧一个随机量加一点慢的整周期摆
  const wy = (rand(f * 13 + 1) - 0.5) * 7 + Math.sin((f / FRAMES) * Math.PI * 4) * 3;
  const wx = (rand(f * 13 + 2) - 0.5) * 2.5;
  // 明暗闪烁：每帧亮度差一点
  const flicker = (rand(f * 13 + 3) - 0.5) * 0.12;
  // 数字刚切进来的几帧略大一点再落定，像片子被放映机拽住
  const pop = 1 + 0.035 * Math.exp(-(f % SEC) / 2.5);
  // 竖划痕：一两根，位置每帧跳一点，偶尔整根消失
  const scratches = [0, 1].map((k) => ({
    x: 300 + rand(Math.floor(f / 6) * 7 + k * 101) * (W - 600) + (rand(f * 5 + k) - 0.5) * 10,
    on: rand(f * 3 + k * 17) < 0.7,
    w: 1.5 + rand(f * 11 + k) * 2,
  }));
  const specks = Array.from({ length: 7 }, (_, k) => ({
    x: rand(f * 29 + k * 3) * W,
    y: rand(f * 29 + k * 3 + 1) * H,
    r: 2 + rand(f * 29 + k * 3 + 2) * 5,
    dark: rand(f * 31 + k) < 0.6,
  }));
  return (
    <Stage bg="#0B0C0E">
      <AbsoluteFill style={{ transform: `translate3d(${wx.toFixed(2)}px, ${wy.toFixed(2)}px, 0)` }}>
        <svg width={W} height={H}>
          <defs>
            <filter id="cl-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={(f % FRAMES) + 1} />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.55" />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect x={-20} y={-20} width={W + 40} height={H + 40} fill={BASE} />
          {/* 扇形半径够大，扫过整幅画面，和真片头一样 */}
          <path d={wedge(sweep, 1300)} fill={SWEPT} opacity={0.55} />
          <line x1={0} y1={CY} x2={W} y2={CY} stroke={C.bg} strokeWidth={4} />
          <line x1={CX} y1={0} x2={CX} y2={H} stroke={C.bg} strokeWidth={4} />
          <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke={C.fg} strokeOpacity={0.85} strokeWidth={10} />
          <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke={C.fg} strokeOpacity={0.85} strokeWidth={6} />
          <g transform={`translate(${CX} ${CY}) scale(${pop.toFixed(4)})`}>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={FONT}
              fontSize={520}
              fontWeight={800}
              fill={C.bg}
            >
              {n}
            </text>
          </g>
          {scratches.map((s, k) =>
            s.on ? <rect key={k} x={s.x} y={0} width={s.w} height={H} fill={k ? "#000" : C.fg} opacity={0.35} /> : null,
          )}
          {specks.map((s, k) => (
            <circle key={k} cx={s.x} cy={s.y} r={s.r} fill={s.dark ? "#000" : C.fg} opacity={0.55} />
          ))}
          <rect x={0} y={0} width={W} height={H} filter="url(#cl-grain)" opacity={0.32} style={{ mixBlendMode: "overlay" }} />
          <text x={120} y={H - 90} fontFamily={FONT} fontSize={30} letterSpacing={8} fill={C.fg} opacity={0.5}>
            PICTURE START
          </text>
        </svg>
      </AbsoluteFill>
      {/* 暗角、闪烁、闪白不跟着片子跳：它们是放映出来的光，不是片上的画 */}
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="cl-vig" cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.85} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#cl-vig)" />
      </svg>
      <AbsoluteFill style={{ background: flicker > 0 ? "#FFFFFF" : "#000", opacity: Math.abs(flicker) }} />
      <AbsoluteFill style={{ background: "#FFFBF0", opacity: flash }} />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 86,
  name: "胶片倒计时",
  group: "质感",
  desc: "老电影片头 3、2、1 倒数，扇形顺时针扫过表盘，扫过的地方变亮；带颗粒、划痕、灰尘、明暗闪烁和上下轻跳，数到 1 闪白再回到 3",
  tech: "SVG 扇形 path 匀速扫，feTurbulence 每帧换 seed 做颗粒，划痕和灰尘用 rand(帧号) 摆；gate weave 是整幅 translate3d 小抖；闪白按到第 89.5 帧的环形距离算，跨过循环接缝。创意参考 vivmagarwal/remotion-effects-library 的 Countdown Leader",
  frames: FRAMES,
  component: Effect,
};
export default effect;
