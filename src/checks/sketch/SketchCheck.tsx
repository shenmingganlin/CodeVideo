import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SANS_FAMILY } from "../../shared/fonts";
import { ShotSketches } from "../../shared/sketch";

// 分镜草图的用法示例：两个镜头各画各的，s2 出两张（落水前、涟漪推开）。
// npm run sketch -- src/checks/sketch 出到 out/board/sketch/，board/board.json 里挂好了
// 草图就画到这个程度：构图、主体、配色看得出来就停

const BG = "#1B2433";
const INK = "#E8E2D4";
const ACCENT = "#E0A458";

const Label: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 60, top: 48, fontFamily: SANS_FAMILY, fontSize: 40, color: INK, opacity: 0.7 }}>{text}</div>
);

const S1: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <svg width={1920} height={1080}>
      {Array.from({ length: 12 * 7 }, (_, i) => (
        <rect key={i} x={240 + (i % 12) * 122} y={170 + Math.floor(i / 12) * 112} width={96} height={86} rx={8} fill={INK} opacity={0.18} />
      ))}
      <ellipse cx={960} cy={150} rx={22} ry={34} fill={ACCENT} />
    </svg>
    <Label text="s1 水滴在格子上方" />
  </AbsoluteFill>
);

const S2: React.FC = () => {
  // 第 0 帧是刚落水，第 1 帧是涟漪推开：两个状态，不是动画
  const open = useCurrentFrame() > 0;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg width={1920} height={1080}>
        {(open ? [120, 260, 400] : [40]).map((r) => (
          <circle key={r} cx={960} cy={560} r={r} fill="none" stroke={ACCENT} strokeWidth={6} opacity={open ? 1 - r / 520 : 1} />
        ))}
      </svg>
      <Label text={open ? "s2 涟漪推开" : "s2 落水"} />
    </AbsoluteFill>
  );
};

export const SketchCheck: React.FC = () => (
  <ShotSketches prefix="SketchCheck" width={1920} height={1080} shots={{ s1: { component: S1 }, s2: { component: S2, stills: [0, 1] } }} />
);
