import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, ease, lerp } from "../../shared/motion/motion";
import { FloodReveal } from "../../shared/motion/transitions";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 按钮按下去，它的颜色从按钮里涌出来铺满画面，就是下一场的底色。
// 下一场也有一个按钮，颜色是第一场的底色，再按一下涌回第一场
const FRAMES = 150;
const R0 = 70; // 按钮半径
const FLOODS = [
  { start: 30, end: 66, from: "a" as const },
  { start: 105, end: 141, from: "b" as const },
];
const PRESS = 8; // 按下去的帧数，按到底的那一帧开始涌
const CONTENT_LEAD = 6; // 涌到头前几帧，下一场的版面开始进
const CONTENT_IN = 14;

type Kind = "a" | "b";
const SCENE: Record<Kind, { bg: string; ink: string; button: string; at: { x: number; y: number } }> = {
  a: { bg: C.bg, ink: C.fg, button: C.accent, at: { x: 1440, y: 700 } },
  b: { bg: C.accent, ink: C.bg, button: C.bg, at: { x: 480, y: 380 } },
};

// 按钮在 start 前 PRESS 帧缩一下，start 那帧回到 R0，正好接上涌出的形状
const buttonRadius = (frame: number) => {
  for (const f of FLOODS) {
    const dt = frame - (f.start - PRESS);
    if (dt >= 0 && dt < PRESS) return lerp(R0, R0 * 0.86, Math.sin((dt / PRESS) * Math.PI));
  }
  return R0;
};

const Scene: React.FC<{ kind: Kind; frame: number }> = ({ kind, frame }) => {
  const s = SCENE[kind];
  const r = buttonRadius(frame);
  // 按钮外圈一直有一道呼吸的光环，提示"按这里"，50 帧一圈
  const pulse = (frame % 50) / 50;
  const left = kind === "a" ? 160 : W - 160 - 640;
  return (
    <AbsoluteFill style={{ background: s.bg }}>
      <svg width={W} height={H}>
        {/* 占位的版面：一个大标题条和几行字 */}
        <rect x={left} y={170} width={640} height={64} rx={10} fill={s.ink} opacity={0.9} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={left} y={280 + i * 50} width={[560, 600, 380][i]} height={18} rx={9} fill={s.ink} opacity={0.35} />
        ))}
        <circle
          cx={s.at.x}
          cy={s.at.y}
          r={R0 + 10 + pulse * 50}
          fill="none"
          stroke={s.button}
          strokeWidth={4}
          opacity={(1 - pulse) * 0.6}
        />
        <circle cx={s.at.x} cy={s.at.y} r={r} fill={s.button} />
        <text
          x={s.at.x}
          y={s.at.y + 14}
          textAnchor="middle"
          fill={s.bg}
          fontFamily={FONT}
          fontSize={40}
          fontWeight={700}
        >
          {kind === "a" ? "→" : "←"}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 第二次涌完、内容也进完（149 帧起）画面就是第一场，和第 0 帧一样
  const active = frame < (FLOODS[0].end + FLOODS[1].start) / 2 ? FLOODS[0] : FLOODS[1];
  const done = frame >= FLOODS[1].end + CONTENT_IN - CONTENT_LEAD;
  const out: Kind = done ? "a" : active.from;
  const inc: Kind = out === "a" ? "b" : "a";
  // 下一场的内容等涌过去再出来，别让两场的字在边缘碰上
  const contentIn = ease.out(clamp01((frame - active.end + CONTENT_LEAD) / CONTENT_IN));
  return (
    <Stage>
      <Scene kind={out} frame={frame} />
      {!done ? (
        <FloodReveal
          frame={frame}
          start={active.start}
          end={active.end}
          origin={SCENE[active.from].at}
          r0={R0}
          width={W}
          height={H}
        >
          <AbsoluteFill style={{ background: SCENE[inc].bg }}>
            <AbsoluteFill style={{ opacity: contentIn, transform: `translateY(${(1 - contentIn) * 24}px)` }}>
              <Scene kind={inc} frame={frame} />
            </AbsoluteFill>
          </AbsoluteFill>
        </FloodReveal>
      ) : null}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 18,
  name: "颜色从按钮里涌出",
  group: "转场",
  desc: "按钮按下去，它的颜色从按钮里涌出来铺满画面成了下一场；下一场的按钮再把第一场涌回来",
  tech: "FloodReveal（r0 = 按钮半径，ease.expand，36 帧）；下一场的底色就是按钮色，第一帧和按钮对得上；新场景的内容等边缘过去再进",
  frames: FRAMES,
  component: Effect,
};
export default effect;
