import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, lerp, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 相机光圈：八片叶片从四周旋转着收拢到全黑，黑的那一下换场，再旋转张开露出另一场；
// 停一会儿，再合一次换回来
const FRAMES = 150;
// 每次转场：[开始收, 全黑, 张开完]
const SHOTS = [
  [22, 38, 56],
  [97, 113, 131],
] as const;
const CX = W / 2;
const CY = H / 2;
const R = Math.hypot(W, H) / 2 + 30; // 光圈外缘盖得住四个角
const BLADES = 8;

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

// 叶片：每片从中间孔的一条边出发，沿切线方向伸到外缘以外。
// open 1 = 全开（孔比画面还大），0 = 全合；合的时候叶片整体转 70°
const Iris: React.FC<{ open: number }> = ({ open }) => {
  const hole = R * open;
  const rot = (1 - open) * ((70 * Math.PI) / 180);
  const L = R * 3;
  const blades = Array.from({ length: BLADES }, (_, i) => {
    const a0 = rot + (i / BLADES) * Math.PI * 2;
    const a1 = rot + ((i + 1) / BLADES) * Math.PI * 2;
    const p0 = [CX + Math.cos(a0) * hole, CY + Math.sin(a0) * hole];
    const p1 = [CX + Math.cos(a1) * hole, CY + Math.sin(a1) * hole];
    const t = a1 + Math.PI / 2 - Math.PI / BLADES;
    const q1 = [p1[0] + Math.cos(t) * L, p1[1] + Math.sin(t) * L];
    const t0 = a0 + Math.PI / 2 - Math.PI / BLADES;
    const q0 = [p0[0] + Math.cos(t0) * L, p0[1] + Math.sin(t0) * L];
    return { pts: [p0, p1, q1, q0].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), edge: [p0, p1] };
  });
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="iris-blade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mixColor(C.bg2, C.dim, 0.35)} />
          <stop offset="1" stopColor={mixColor(C.bg, "#000000", 0.5)} />
        </linearGradient>
      </defs>
      {blades.map((b, i) => (
        <polygon key={i} points={b.pts} fill="url(#iris-blade)" stroke="#000" strokeWidth={2} />
      ))}
      {/* 孔沿的高光：每片叶片朝里的那条边 */}
      {open > 0.01
        ? blades.map((b, i) => (
            <line
              key={`e${i}`}
              x1={b.edge[0][0]}
              y1={b.edge[0][1]}
              x2={b.edge[1][0]}
              y2={b.edge[1][1]}
              stroke={C.fg}
              strokeOpacity={0.35}
              strokeWidth={3}
            />
          ))
        : null}
    </svg>
  );
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const k = frame < (SHOTS[0][2] + SHOTS[1][0]) / 2 ? 0 : 1;
  const [s, m, e] = SHOTS[k];
  // 收拢：ease.in 越合越快；张开：ease.out 一下弹开
  const open = frame < m ? 1 - prog(frame, s, m, ease.in) : prog(frame, m, e, ease.out);
  const before = k === 0 ? <SceneA /> : <SceneB />;
  const after = k === 0 ? <SceneB /> : <SceneA />;
  const scene = frame < m ? before : after;
  // 新场张开时从 1.08 收到 1，像镜头刚对上焦
  const zoom = frame >= m ? lerp(1.08, 1, prog(frame, m, e, ease.out)) : 1;
  const closing = frame >= s && frame < e;
  return (
    <Stage>
      <AbsoluteFill style={{ transform: `scale(${zoom.toFixed(4)})` }}>{scene}</AbsoluteFill>
      {closing && open < 0.999 ? <Iris open={open} /> : null}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 54,
  name: "光圈快门开合",
  group: "转场",
  desc: "八片光圈叶片从四周旋转着收拢到全黑，黑的那一下换场，再旋转张开露出下一场，停一会儿再合一次换回来",
  tech: "SVG：叶片从中间正八边形孔的每条边沿切线伸出去，孔半径随 open 缩放、整体转 70°；收拢 16 帧 ease.in，张开 18 帧 ease.out，新场 1.08→1 缩放；创意参考 remotion-scenes 的 TransitionShutter",
  frames: FRAMES,
  component: Effect,
};
export default effect;
