import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RgbSplit } from "../../shared/motion/creative";
import { clamp01, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 老录像带回放：画面带扫描线和颗粒，红蓝通道左右错开，整幅轻轻横抖；
// 底部几行被拉扯着左右错位，中段一条亮的跟踪噪条从下往上滚过，噪条经过时故障加重一下
const FRAMES = 120;
const BAR0 = 34; // 跟踪噪条从底下进来
const BAR1 = 94; // 从顶上出去
const BAR_H = 90;

const pad = (n: number) => String(n).padStart(2, "0");

// 被故障处理的那块画面：左上角 PLAY，中间大字，右下角时间码
const Screen: React.FC<{ frame: number }> = ({ frame }) => {
  // 时间码跟着帧走，一圈循环回到 01:23:45:00
  const sec = 45 + Math.floor(frame / 30);
  const tc = `01:23:${pad(sec)}:${pad(frame % 30)}`;
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.fg, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 120, top: 96, fontSize: 64, fontWeight: 700, letterSpacing: 6 }}>
        PLAY <span style={{ opacity: blink ? 1 : 0.25 }}>▶</span>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 240,
          fontWeight: 900,
          letterSpacing: 24,
        }}
      >
        录像带
      </div>
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: 150,
          fontSize: 56,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 4,
        }}
      >
        {tc}
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 150, fontSize: 56, fontWeight: 700, color: C.cool }}>SP</div>
    </AbsoluteFill>
  );
};

// 一条横带：同一块画面只露出 [y, y+h)，再整条往旁边错开
const Strip: React.FC<{ frame: number; y: number; h: number; dx: number }> = ({ frame, y, h, dx }) => (
  <AbsoluteFill style={{ clipPath: `inset(${y}px 0 ${H - y - h}px 0)` }}>
    <AbsoluteFill style={{ transform: `translateX(${dx}px)` }}>
      <Screen frame={frame} />
    </AbsoluteFill>
  </AbsoluteFill>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const r = (k: number) => rand(frame * 31 + k * 7);
  // 噪条的位置和"经过时有多强"
  const barT = clamp01((frame - BAR0) / (BAR1 - BAR0));
  const barOn = frame >= BAR0 && frame <= BAR1;
  const barY = H + 20 - barT * (H + BAR_H + 40);
  const hit = barOn ? Math.sin(barT * Math.PI) : 0;
  // 色差平时 2–4px，噪条经过中间时最多到 8px；横抖平时 ±2px
  const split = 2 + 2 * r(1) + 4 * hit;
  const jitter = (r(2) - 0.5) * (4 + 16 * hit);
  // 底部 6 条，越往下拉得越狠
  const strips = Array.from({ length: 6 }, (_, k) => ({
    y: H - 132 + k * 22,
    h: 22,
    dx: (r(10 + k) - 0.35) * (12 + k * 14),
  }));
  return (
    <Stage>
      <AbsoluteFill style={{ transform: `translateX(${jitter}px)` }}>
        <RgbSplit amount={split} id="vhs-rgb">
          <Screen frame={frame} />
          {strips.map((s, k) => (
            <Strip key={k} frame={frame} {...s} />
          ))}
          {barOn && <Strip frame={frame} y={Math.max(0, barY)} h={BAR_H} dx={(r(30) - 0.5) * 70} />}
        </RgbSplit>
      </AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="vhs-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={1} seed={frame} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="vhs-track" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6 0.03" numOctaves={2} seed={frame + 200} />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.4 0 0 0 -1.1" />
          </filter>
        </defs>
        <rect width={W} height={H} filter="url(#vhs-grain)" opacity={0.09} style={{ mixBlendMode: "screen" }} />
        {barOn && (
          <rect x={0} y={barY} width={W} height={BAR_H} filter="url(#vhs-track)" opacity={0.75} />
        )}
        {/* 底部拉扯区也带一层亮噪 */}
        <rect x={0} y={H - 132} width={W} height={132} filter="url(#vhs-track)" opacity={0.28} />
      </svg>
      {/* 扫描线：每 4 像素一条暗线 */}
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.32) 0 2px, transparent 2px 4px)",
        }}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 37,
  name: "录像带色差故障",
  group: "质感",
  desc: "老录像带回放：扫描线、颗粒、红蓝通道错开、整幅轻抖，底部几行被扯得左右错位，一条亮噪条从下往上滚过时故障加重",
  tech: "RgbSplit（feColorMatrix 拆 RGB + feOffset）错开 2–8px；底部和噪条处把同一块画面用 clip-path 切成横带再 translateX；颗粒和噪条是每帧换 seed 的 feTurbulence，抖动用 rand(帧号)。创意参考 remotion-scenes 的 EffectVHS",
  frames: FRAMES,
  component: Scene,
};
export default effect;
