import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand } from "../../shared/motion/motion";
import { RgbSplit } from "../../shared/motion/creative";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 平时干干净净，切场前后的 9 帧里画面坏掉：横条乱错位、红蓝分开、个别条反色、蹦出噪块，
// 正中那一帧硬切到下一场，然后故障平息；停一会儿再坏一次切回来
const FRAMES = 120;
const CUTS = [36, 96]; // 硬切的帧，前后各 4 帧是故障
const REACH = 4;
const K = 12; // 横条数

const SceneA: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H}>
      <circle cx={W / 2} cy={H / 2} r={230} fill={C.accent} />
      <text x={120} y={150} fill={C.fg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        01
      </text>
    </svg>
  </AbsoluteFill>
);

const SceneB: React.FC = () => (
  <AbsoluteFill style={{ background: C.accent }}>
    <svg width={W} height={H}>
      <rect
        x={W / 2 - 200}
        y={H / 2 - 200}
        width={400}
        height={400}
        rx={36}
        fill={C.bg}
        transform={`rotate(45 ${W / 2} ${H / 2})`}
      />
      <text x={120} y={150} fill={C.bg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        02
      </text>
    </svg>
  </AbsoluteFill>
);

const BLOCK_COLORS = [C.fg, C.cool, C.accent, C.dim];

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 现在是哪一场：两次硬切之间是第二场
  const onB = frame >= CUTS[0] && frame < CUTS[1];
  const near = CUTS.find((c) => Math.abs(frame - c) <= REACH);
  // 故障强度：切点那一帧最强，往两边掉
  const g = near === undefined ? 0 : 1 - (Math.abs(frame - near) / (REACH + 1)) ** 2;
  if (g === 0) return <Stage>{onB ? <SceneB /> : <SceneA />}</Stage>;

  const seed = frame * 97;
  const weights = Array.from({ length: K }, (_, k) => 0.25 + rand(seed + k));
  const total = weights.reduce((a, b) => a + b, 0);
  let y = 0;
  const bands = weights.map((w, k) => {
    const h = (w / total) * H;
    const top = y;
    y += h;
    const big = rand(seed + 40 + k) < 0.55;
    const dx = (rand(seed + 60 + k) - 0.5) * 2 * (big ? 280 : 40) * g;
    const other = rand(seed + 80 + k) < 0.35 * g; // 这一条露出另一场
    const invert = rand(seed + 100 + k) < 0.14 * g;
    return { top, h, dx, b: other ? !onB : onB, invert };
  });
  const blocks = Array.from({ length: Math.round(7 * g) }, (_, k) => ({
    x: rand(seed + 200 + k) * W,
    y: rand(seed + 220 + k) * H,
    w: 40 + rand(seed + 240 + k) * 300,
    h: 6 + rand(seed + 260 + k) * 36,
    c: BLOCK_COLORS[Math.floor(rand(seed + 280 + k) * BLOCK_COLORS.length)],
  }));
  return (
    <Stage>
      <RgbSplit amount={26 * g} id="glitch-rgb">
        {bands.map((b, k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 0,
              top: b.top,
              width: W,
              height: Math.ceil(b.h) + 1,
              overflow: "hidden",
              filter: b.invert ? "invert(1)" : undefined,
            }}
          >
            <div style={{ position: "absolute", left: b.dx, top: -b.top, width: W, height: H }}>
              {b.b ? <SceneB /> : <SceneA />}
            </div>
          </div>
        ))}
        {blocks.map((b, k) => (
          <div
            key={`blk${k}`}
            style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: b.c }}
          />
        ))}
      </RgbSplit>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 33,
  name: "故障闪切",
  group: "转场",
  desc: "画面突然坏掉，横条乱错位、红蓝分开、蹦出噪块，正中一帧硬切到下一场，然后恢复干净",
  tech: "切点前后各 4 帧：12 条随机高度的横条各自水平错位（rand 按帧换种子），35% 的条露出另一场、14% 反色，RgbSplit 最大 26px，叠几个色块；其余帧不加任何效果；创意参考 lifeprompt-team/remotion-scenes 的 TransitionGlitch",
  frames: FRAMES,
  component: Effect,
};
export default effect;
