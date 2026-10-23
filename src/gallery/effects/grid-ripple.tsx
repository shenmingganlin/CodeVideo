import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 俯视的水面是一张点阵。方块从镜头这边落下去，落水那一帧整片点阵泛起一圈圈涟漪
const FRAMES = 120;
const PITCH = 48;
const COLS = Math.ceil(W / PITCH) + 1;
const ROWS = Math.ceil(H / PITCH) + 1;
const FALL = 18; // 下落用的帧数
const SPEED = 13; // 波前每帧走多少像素
const WAVE = 70; // 波长
const DECAY = 38; // 振幅衰减的时间常数（帧）

const DROPS = [
  { f: 24, x: 780, y: 470, color: C.accent },
  { f: 84, x: 1220, y: 640, color: C.cool },
];

// 第 f 帧、距落点 d 处的水面高度。上一轮的落水也算进来，首尾才接得上
const height = (f: number, x: number, y: number) => {
  let h = 0;
  for (const drop of DROPS)
    for (const shift of [0, -FRAMES]) {
      const dt = f - drop.f - shift;
      if (dt <= 0) continue;
      const d = Math.hypot(x - drop.x, y - drop.y);
      const behind = SPEED * dt - d; // 在波前后面多远
      if (behind < 0) continue;
      h +=
        Math.sin((behind / WAVE) * Math.PI * 2) *
        Math.exp(-dt / DECAY) *
        Math.exp(-behind / (WAVE * 2.5));
    }
  return h;
};

const Tile: React.FC<{ frame: number; drop: (typeof DROPS)[number] }> = ({
  frame,
  drop,
}) => {
  const dt = frame - drop.f;
  if (dt < -FALL || dt > 26) return null;
  const size = 92;
  if (dt <= 0) {
    // 下落：从近处的大方块缩到水面大小，影子跟着变实
    const t = ease.in(clamp01((dt + FALL) / FALL));
    const s = lerp(3.2, 1, t);
    return (
      <>
        <rect
          x={drop.x - size / 2 + 14}
          y={drop.y - size / 2 + 18}
          width={size}
          height={size}
          rx={10}
          fill="#000"
          opacity={0.45 * t}
        />
        <rect
          x={drop.x - (size * s) / 2}
          y={drop.y - (size * s) / 2}
          width={size * s}
          height={size * s}
          rx={10 * s}
          fill={drop.color}
          opacity={clamp01((dt + FALL) / 5)}
        />
      </>
    );
  }
  // 入水：往下沉，颜色被水吃掉
  const t = ease.out(clamp01(dt / 26));
  const s = lerp(1, 0.7, t);
  return (
    <rect
      x={drop.x - (size * s) / 2}
      y={drop.y - (size * s) / 2}
      width={size * s}
      height={size * s}
      rx={10 * s}
      fill={mixColor(drop.color, C.bg2, t)}
      opacity={1 - t}
    />
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const dots = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * PITCH + (W - (COLS - 1) * PITCH) / 2;
      const y = r * PITCH + (H - (ROWS - 1) * PITCH) / 2;
      const h = height(frame, x, y);
      const lift = clamp01(Math.abs(h));
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x}
          cy={y - h * 9}
          r={3 + h * 2.6 + lift * 1.5}
          fill={mixColor(C.dim, h > 0 ? C.fg : C.cool, lift)}
        />,
      );
    }
  return (
    <Stage>
      <svg width={W} height={H}>
        {dots}
        {DROPS.map((drop) => {
          // 落水那一下溅开的一圈
          const dt = frame - drop.f;
          if (dt < 0 || dt > 20) return null;
          const t = ease.out(dt / 20);
          return (
            <circle
              key={drop.f}
              cx={drop.x}
              cy={drop.y}
              r={lerp(50, 210, t)}
              fill="none"
              stroke={drop.color}
              strokeWidth={lerp(6, 1, t)}
              opacity={1 - t}
            />
          );
        })}
        {DROPS.map((drop) => (
          <Tile key={drop.f} frame={frame} drop={drop} />
        ))}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 1,
  name: "格子落水泛涟漪",
  group: "水墨",
  desc: "方块从镜头这边落进点阵水面，落水那一帧一圈圈涟漪推开，点跟着起伏变亮",
  tech: "SVG 点阵 + 衰减波函数（波速、波长、衰减可调）；上一轮的落水也叠进来，首尾无缝",
  frames: FRAMES,
  component: Scene,
};
export default effect;
