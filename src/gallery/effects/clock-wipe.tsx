import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, ease, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 画面中心伸出一根指针，从 12 点顺时针扫一整圈，扫过的扇形换成下一场；
// 停一会儿，再扫一圈换回第一场
const FRAMES = 150;
const SWEEPS = [
  [20, 60],
  [95, 135],
] as const;
const CX = W / 2;
const CY = H / 2;
const R = Math.hypot(W, H) / 2 + 20; // 扇形半径：盖得住四个角

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

// 从 12 点顺时针扫过 deg 度的扇形
const sector = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  const x = CX + R * Math.sin(a);
  const y = CY - R * Math.cos(a);
  const large = deg > 180 ? 1 : 0;
  return `path('M ${CX} ${CY} L ${CX} ${CY - R} A ${R} ${R} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z')`;
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 第几次扫：第一次把 A 扫成 B，第二次把 B 扫回 A
  const k = frame < (SWEEPS[0][1] + SWEEPS[1][0]) / 2 ? 0 : 1;
  const [s, e] = SWEEPS[k];
  const deg = 360 * prog(frame, s, e, ease.inOut);
  const sweeping = frame >= s && frame < e;
  const base = k === 0 ? (frame < e ? <SceneA /> : <SceneB />) : frame < e ? <SceneB /> : <SceneA />;
  const top = k === 0 ? <SceneB /> : <SceneA />;
  // 指针头尾各 4 帧淡入淡出
  const handAlpha = clamp01((frame - s) / 4) * clamp01((e - frame) / 4);
  const a = (deg * Math.PI) / 180;
  return (
    <Stage>
      {base}
      {sweeping && deg > 0.1 ? <AbsoluteFill style={{ clipPath: sector(deg) }}>{top}</AbsoluteFill> : null}
      {handAlpha > 0.01 ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} opacity={handAlpha}>
          <line
            x1={CX}
            y1={CY}
            x2={CX + R * Math.sin(a)}
            y2={CY - R * Math.cos(a)}
            stroke={C.fg}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={16} fill={C.fg} />
          <circle cx={CX} cy={CY} r={7} fill={C.cool} />
        </svg>
      ) : null}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 34,
  name: "时钟指针扫过",
  group: "转场",
  desc: "中心伸出一根指针顺时针扫一整圈，扫过的地方换成下一场，停一会儿再扫一圈换回来",
  tech: "clip-path: path() 画从 12 点起的扇形（大弧标志过 180° 翻），角度 0→360 走 40 帧 ease.inOut；指针是 SVG 线，头尾 4 帧淡入淡出；创意参考 reactvideoeditor/remotion-templates 的 Clock Wipe",
  frames: FRAMES,
  component: Effect,
};
export default effect;
