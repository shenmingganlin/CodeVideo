import { useCurrentFrame } from "remotion";
import { C, H, Stage, W, loop, type GalleryEffect } from "../kit";

// 一块 30° 的楔形里放几个彩色形状，形状在里面慢慢游走、自转；楔形复制 12 份，单数份镜像，
// 拼成六重对称的花样，整体再慢慢转 60°（花样转 60° 和原来一样，所以首尾接得上）
const FRAMES = 150;
const CX = W / 2;
const CY = H / 2;
const R = 1150; // 楔形半径，盖住画面四角
const WEDGE = 30;

const TAU = Math.PI * 2;

// 每个形状：极坐标位置 (r, a°) 绕一个基准点摆动，频率都是整数圈，循环接得上
type Shape = {
  kind: "circle" | "tri" | "line";
  r: number;
  a: number;
  dr: number;
  da: number;
  f: number;
  ph: number;
  size: number;
  color: string;
  spin: number; // 一个循环自转几圈（整数）
};
const SHAPES: Shape[] = [
  { kind: "circle", r: 150, a: 14, dr: 70, da: 10, f: 1, ph: 0, size: 70, color: C.accent, spin: 0 },
  { kind: "tri", r: 330, a: 10, dr: 90, da: 12, f: 1, ph: 2, size: 90, color: C.cool, spin: 1 },
  { kind: "circle", r: 520, a: 20, dr: 110, da: 8, f: 2, ph: 1, size: 46, color: C.fg, spin: 0 },
  { kind: "line", r: 420, a: 18, dr: 120, da: 10, f: 1, ph: 4, size: 260, color: C.accent, spin: -1 },
  { kind: "tri", r: 700, a: 16, dr: 130, da: 10, f: 1, ph: 3, size: 150, color: C.dim, spin: -1 },
  { kind: "circle", r: 860, a: 8, dr: 120, da: 6, f: 2, ph: 5, size: 110, color: C.cool, spin: 0 },
  { kind: "line", r: 240, a: 6, dr: 60, da: 6, f: 2, ph: 1.5, size: 180, color: C.fg, spin: 1 },
];

const ShapeEl: React.FC<{ s: Shape; u: number }> = ({ s, u }) => {
  const ph = u * TAU * s.f + s.ph;
  const r = s.r + s.dr * Math.sin(ph);
  const a = ((s.a + s.da * Math.cos(ph)) * Math.PI) / 180;
  const x = r * Math.cos(a);
  const y = r * Math.sin(a);
  const rot = u * 360 * s.spin + s.ph * 40;
  const t = `translate(${x} ${y}) rotate(${rot})`;
  if (s.kind === "circle") return <circle cx={x} cy={y} r={s.size} fill={s.color} opacity={0.9} />;
  if (s.kind === "tri") {
    const k = s.size;
    return (
      <polygon
        transform={t}
        points={`0,${-k} ${k * 0.87},${k * 0.5} ${-k * 0.87},${k * 0.5}`}
        fill={s.color}
        opacity={0.85}
      />
    );
  }
  return <line transform={t} x1={-s.size / 2} y1={0} x2={s.size / 2} y2={0} stroke={s.color} strokeWidth={10} strokeLinecap="round" />;
};

// 楔形：从 0° 到 30°，两边各多给 0.3° 盖住拼缝
const wedgePath = (() => {
  const a0 = (-0.3 * Math.PI) / 180;
  const a1 = ((WEDGE + 0.3) * Math.PI) / 180;
  return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
})();

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const u = loop(frame, FRAMES);
  const turn = u * 60;
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <clipPath id="kal-wedge">
            <path d={wedgePath} />
          </clipPath>
          <g id="kal-tile">
            <g clipPath="url(#kal-wedge)">
              <path d={wedgePath} fill={C.bg2} />
              {SHAPES.map((s, i) => (
                <ShapeEl key={i} s={s} u={u} />
              ))}
            </g>
          </g>
          <radialGradient id="kal-vig" cx="50%" cy="50%" r="60%">
            <stop offset="55%" stopColor={C.bg} stopOpacity={0} />
            <stop offset="100%" stopColor={C.bg} stopOpacity={0.85} />
          </radialGradient>
        </defs>
        <g transform={`translate(${CX} ${CY}) rotate(${turn})`}>
          {/* 第 k 份：偶数份转 k·30°；奇数份先沿 x 轴镜像成 [−30°, 0]，再转 (k+1)·30°，落在 [k·30°, (k+1)·30°] */}
          {Array.from({ length: 12 }, (_, k) => (
            <use
              key={k}
              href="#kal-tile"
              transform={k % 2 === 0 ? `rotate(${k * WEDGE})` : `rotate(${(k + 1) * WEDGE}) scale(1 -1)`}
            />
          ))}
          <circle r={26} fill={C.fg} />
        </g>
        <rect width={W} height={H} fill="url(#kal-vig)" />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 38,
  name: "万花筒",
  group: "质感",
  desc: "一块楔形里的圆、三角和线条慢慢游走、自转，被镜像复制成十二瓣，拼成六重对称的花样，整体缓缓转动",
  tech: "SVG：形状画在 30° 楔形 clipPath 里，<use> 复制 12 份，奇数份 scale(1 −1) 镜像再转；形状位置按整数圈正弦摆动，整体每循环转 60°（六重对称，转完和起点一样）。创意参考 remotion-scenes 的 EffectKaleidoscope",
  frames: FRAMES,
  component: Scene,
};
export default effect;
