import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ZoomThrough } from "../../shared/motion/transitions";
import { C, H, Stage, W, loop, type GalleryEffect } from "../kit";

// 画面中间有一扇圆窗，窗里是下一场的缩小版。镜头推进穿过窗口进入下一场，
// 下一场中间又有一扇窗，里面是第一场，再推穿就回到开头
const FRAMES = 120;
const PUSH_1 = [15, 55] as const;
const PUSH_2 = [75, 115] as const;
const CENTER = { x: W / 2, y: H / 2 };
const MAX = 9; // 推到窗口放大 9 倍时换场
const SWAP = 0.6;
const IN_FROM = 1.8; // 新场景从 1.8 倍落回 1 倍
// 窗口半径：放大 MAX 倍时正好盖住画面四角
const R = Math.hypot(W / 2, H / 2) / MAX * 1.02;
// 窗里的下一场按 IN_FROM / MAX 缩小，换场那一帧就和放大后的窗口对上
const MINI = IN_FROM / MAX;

type Kind = "a" | "b";
const BG: Record<Kind, string> = { a: C.bg, b: C.cool };
const INK: Record<Kind, string> = { a: C.accent, b: C.bg };

const Scene: React.FC<{ kind: Kind; spin: number; depth: number }> = ({
  kind,
  spin,
  depth,
}) => {
  const other: Kind = kind === "a" ? "b" : "a";
  const rings = [260, 380, 500];
  return (
    <AbsoluteFill style={{ background: BG[kind] }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {rings.map((rr, k) =>
          Array.from({ length: 12 + k * 6 }, (_, i) => {
            const n = 12 + k * 6;
            const a = (i / n) * Math.PI * 2 + spin * (k % 2 ? -1 : 1) * (Math.PI * 2) / n;
            return (
              <rect
                key={`${k}-${i}`}
                x={CENTER.x + Math.cos(a) * rr - 9}
                y={CENTER.y + Math.sin(a) * rr - 9}
                width={18}
                height={18}
                rx={kind === "a" ? 9 : 2}
                fill={INK[kind]}
                opacity={0.9 - k * 0.25}
                transform={`rotate(${(a * 180) / Math.PI} ${CENTER.x + Math.cos(a) * rr} ${CENTER.y + Math.sin(a) * rr})`}
              />
            );
          }),
        )}
      </svg>
      {/* 圆窗：里面是下一场，按 MINI 缩小 */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x - R,
          top: CENTER.y - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          overflow: "hidden",
          background: BG[other],
        }}
      >
        {depth < 3 ? (
          <div
            style={{
              position: "absolute",
              left: R - CENTER.x,
              top: R - CENTER.y,
              width: W,
              height: H,
              transformOrigin: `${CENTER.x}px ${CENTER.y}px`,
              transform: `scale(${MINI})`,
            }}
          >
            <Scene kind={other} spin={spin} depth={depth + 1} />
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: CENTER.x - R - 6,
          top: CENTER.y - R - 6,
          width: R * 2 + 12,
          height: R * 2 + 12,
          borderRadius: "50%",
          border: `6px solid ${INK[kind]}`,
        }}
      />
    </AbsoluteFill>
  );
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 环一直在转，一圈刚好一个循环
  const spin = loop(frame, FRAMES) * 6;
  const a = <Scene kind="a" spin={spin} depth={0} />;
  const b = <Scene kind="b" spin={spin} depth={0} />;
  const first = frame < (PUSH_1[1] + PUSH_2[0]) / 2;
  return (
    <Stage>
      <ZoomThrough
        frame={frame}
        start={first ? PUSH_1[0] : PUSH_2[0]}
        end={first ? PUSH_1[1] : PUSH_2[1]}
        focus={CENTER}
        maxScale={MAX}
        swapAt={SWAP}
        inFrom={IN_FROM}
        outgoing={first ? a : b}
        incoming={first ? b : a}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 16,
  name: "推镜穿过圆窗",
  group: "转场",
  desc: "镜头推进穿过画面中间的圆窗，窗里就是下一场；下一场中间又有一扇窗，推穿回到第一场",
  tech: "ZoomThrough（maxScale 9、swapAt 0.6、inFrom 1.8，ease.whip）；窗里的下一场按 1.8/9 缩小，换场那一帧对得上",
  frames: FRAMES,
  component: Effect,
};
export default effect;
