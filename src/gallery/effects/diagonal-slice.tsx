import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一道斜光一闪划过画面，画面顺着这条线劈成两半，往两边滑开，露出底下的下一场；
// 停一会儿，两半从画外合拢回来，合上的一下光线再闪一次
const FRAMES = 150;
const DRAW = [18, 26]; // 光线从左下划到右上
const SPLIT = [26, 54]; // 两半滑开
const CLOSE = [90, 116]; // 两半合拢
const FLASH = [116, 130]; // 合上时光线闪一下再褪掉

const CX = W / 2;
const CY = H / 2;
const A = (-24 * Math.PI) / 180; // 切线的角度，往右上斜
const D = { x: Math.cos(A), y: Math.sin(A) }; // 沿切线
const NRM = { x: -D.y, y: D.x }; // 垂直切线，指向右下那一半
const HALF = Math.hypot(W, H) / 2; // 中心到角的距离，光线这么长就够贯穿画面
const OFF = HALF + 80; // 滑开的距离：最远的角也出了画面

const SceneA: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H}>
      <circle cx={CX} cy={CY} r={230} fill={C.accent} />
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
        x={CX - 200}
        y={CY - 200}
        width={400}
        height={400}
        rx={36}
        fill={C.bg}
        transform={`rotate(45 ${CX} ${CY})`}
      />
      <text x={120} y={150} fill={C.bg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        02
      </text>
    </svg>
  </AbsoluteFill>
);

// 切线一侧（side = 1 右下，-1 左上）的半张画面
const halfClip = (side: number) => {
  const L = 4000;
  const pts = [
    [CX + D.x * L, CY + D.y * L],
    [CX - D.x * L, CY - D.y * L],
    [CX - D.x * L + side * NRM.x * L, CY - D.y * L + side * NRM.y * L],
    [CX + D.x * L + side * NRM.x * L, CY + D.y * L + side * NRM.y * L],
  ];
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 0 = 合着，1 = 完全滑开
  const open = prog(frame, SPLIT[0], SPLIT[1], ease.out) * (1 - prog(frame, CLOSE[0], CLOSE[1], ease.inOut));
  const off = open * OFF;
  // 光线：划过时从一头长到另一头；滑开的前半段褪掉；合上时闪一下
  const draw = prog(frame, DRAW[0], DRAW[1], ease.out);
  const fadeSplit = 1 - clamp01((frame - SPLIT[0]) / 12);
  const flash = frame >= FLASH[0] ? 1 - prog(frame, FLASH[0], FLASH[1], ease.out) : 0;
  const lineAlpha = frame >= DRAW[0] && frame < SPLIT[1] ? Math.min(1, draw * 3) * fadeSplit : flash;
  const lineLen = frame < FLASH[0] ? draw : 1;
  const x0 = CX - D.x * HALF;
  const y0 = CY - D.y * HALF;
  const x1 = lerp(x0, CX + D.x * HALF, lineLen);
  const y1 = lerp(y0, CY + D.y * HALF, lineLen);
  const width = 6 + 10 * flash;
  return (
    <Stage>
      <SceneB />
      {off === 0 ? (
        // 合着的时候画整张，免得两半的抗锯齿边在切线上漏出一道缝
        <SceneA />
      ) : off < OFF - 1
        ? [1, -1].map((side) => (
            <AbsoluteFill
              key={side}
              style={{
                clipPath: halfClip(side),
                // 垂直切线滑开，再顺着切线错一点，读起来是被劈开
                transform: `translate(${(side * NRM.x + side * D.x * 0.25) * off}px, ${(side * NRM.y + side * D.y * 0.25) * off}px)`,
              }}
            >
              <SceneA />
            </AbsoluteFill>
          ))
        : null}
      {lineAlpha > 0.01 ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="slice-glow" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation={14} />
            </filter>
          </defs>
          <g opacity={lineAlpha}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.accent} strokeWidth={width * 5} filter="url(#slice-glow)" />
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.fg} strokeWidth={width} strokeLinecap="round" />
          </g>
        </svg>
      ) : null}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 32,
  name: "斜切两半",
  group: "转场",
  desc: "一道斜光划过，画面顺着它劈成两半往两边滑开，露出下一场；再从两边合拢回来，合上时光又闪一下",
  tech: "同一场画两份，各用 clip-path polygon 切出切线一侧，沿法线（加 0.25 倍切线方向）平移，ease.out 28 帧滑开、ease.inOut 26 帧合拢；光线是 SVG 线 + feGaussianBlur 辉光；创意参考 lifeprompt-team/remotion-scenes 的 TransitionDiagonalSlice",
  frames: FRAMES,
  component: Effect,
};
export default effect;
