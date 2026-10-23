import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand } from "../../shared/motion/motion";
import { C, H, Stage, W, loop, type GalleryEffect } from "../kit";

// 远山、中景楼群、近处的柱子三层往左走，越近越快；镜头跟着中间的光球往右飞，
// 同时慢慢推近再退回（近景推得最多），景深靠速度差和近景的虚化
const FRAMES = 150;

// 每层的花纹周期 P 和一个循环里走过的距离（P 的整数倍，首尾才接得上）
const FAR = { P: 640, shift: 640, push: 0.02 };
const MID = { P: 480, shift: 1920, push: 0.05 };
const NEAR = { P: 960, shift: 3840, push: 0.1 };

// 把一层的花纹沿横向铺满画面：tile(i) 画第 i 块，x 从 0 到 P
const Tiled: React.FC<{ P: number; offset: number; tile: (key: number) => React.ReactNode }> = ({ P, offset, tile }) => {
  const shift = offset % P;
  const n = Math.ceil(W / P) + 2;
  return (
    <>
      {Array.from({ length: n }, (_, j) => (
        <g key={j} transform={`translate(${(j - 1) * P - shift} 0)`}>
          {tile(j)}
        </g>
      ))}
    </>
  );
};

const Layer: React.FC<{ scale: number; blur?: number; children: React.ReactNode }> = ({ scale, blur = 0, children }) => (
  <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 50%", filter: blur ? `blur(${blur}px)` : undefined }}>
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {children}
    </svg>
  </AbsoluteFill>
);

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const t = loop(frame, FRAMES);
  // 推近再退回：0 → 1 → 0，起止速度都是 0
  const push = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
  const off = (layer: { shift: number }) => t * layer.shift;

  // 远山：一条横跨画面的山脊线，周期 FAR.P
  const ridge = (o: number) => {
    const pts = [];
    for (let x = -60; x <= W + 60; x += 16) {
      const u = ((x + o) / FAR.P) * Math.PI * 2;
      pts.push(`${x},${H * 0.6 + 56 * Math.sin(u) + 22 * Math.sin(u * 2 + 1)}`);
    }
    return `M -60 ${H + 60} L ${pts.join(" L ")} L ${W + 60} ${H + 60} Z`;
  };

  const glider = { x: W * 0.44, y: H * 0.42 + 18 * Math.sin(t * Math.PI * 2 * 3) };

  return (
    <Stage>
      <Layer scale={1 + FAR.push * push}>
        <Tiled
          P={FAR.P}
          offset={off(FAR)}
          tile={() =>
            Array.from({ length: 7 }, (_, i) => (
              <circle key={i} cx={rand(i * 3.1 + 1) * FAR.P} cy={60 + rand(i * 5.3 + 2) * H * 0.4} r={1.5 + rand(i * 7.7) * 2} fill={C.fg} opacity={0.5} />
            ))
          }
        />
        <path d={ridge(off(FAR))} fill={C.bg2} />
      </Layer>
      <Layer scale={1 + MID.push * push}>
        <Tiled
          P={MID.P}
          offset={off(MID)}
          tile={() =>
            [0, 1, 2].map((i) => {
              const w = 90 + rand(i * 2.7 + 4) * 60;
              const h = 200 + rand(i * 4.1 + 9) * 260;
              const x = i * 160 + rand(i * 1.9) * 40;
              return (
                <g key={i}>
                  <rect x={x} y={H - h} width={w} height={h + 40} rx={6} fill={C.dim} opacity={0.55} />
                  {/* 窗户 */}
                  {Array.from({ length: Math.floor(h / 70) }, (_, k) => (
                    <rect key={k} x={x + 20} y={H - h + 30 + k * 70} width={w - 40} height={14} rx={4} fill={C.bg} opacity={0.5} />
                  ))}
                </g>
              );
            })
          }
        />
      </Layer>
      {/* 焦点：光球和它身后的速度线 */}
      <Layer scale={1 + MID.push * push}>
        {[0, 1, 2, 3].map((i) => {
          const len = 120 + 80 * Math.sin(t * Math.PI * 2 * 5 + i * 1.7);
          return (
            <line
              key={i}
              x1={glider.x - 70 - len}
              x2={glider.x - 70}
              y1={glider.y - 30 + i * 20}
              y2={glider.y - 30 + i * 20}
              stroke={C.accent}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.25 + i * 0.1}
            />
          );
        })}
        <circle cx={glider.x} cy={glider.y} r={70} fill={C.accent} opacity={0.18} />
        <circle cx={glider.x} cy={glider.y} r={46} fill={C.accent} />
      </Layer>
      <Layer scale={1 + NEAR.push * push} blur={7}>
        <Tiled
          P={NEAR.P}
          offset={off(NEAR)}
          tile={() =>
            [0, 1].map((i) => {
              const x = i * 480 + rand(i * 6.1 + 3) * 200;
              const w = 80 + rand(i * 3.3 + 5) * 50;
              return <rect key={i} x={x} y={H - 300 - rand(i * 8.8) * 120} width={w} height={600} rx={w / 2} fill="#0A0B0E" />;
            })
          }
        />
      </Layer>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 22,
  name: "三层视差推镜",
  group: "镜头",
  desc: "远山、楼群、近处柱子三层往左走，越近越快；镜头跟着光球往前飞，同时慢慢推近再退回，近景虚化",
  tech: "三层 SVG 横向平铺，速度比 1 : 3 : 6；每层走过的距离是花纹周期的整数倍（首尾无缝）；推镜每层放大不同（2% / 5% / 10%），近景 blur 7px",
  frames: FRAMES,
  component: Effect,
};
export default effect;
