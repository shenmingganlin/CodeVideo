import { useCurrentFrame } from "remotion";
import { ease } from "../../shared/motion/motion";
import { WhipPan } from "../../shared/motion/transitions";
import { C, FONT, H, Stage, W, loop, type GalleryEffect } from "../kit";

// 三场排在同一条横带上，底下是同一张点阵。镜头往右甩到下一场，速度最快时沿横向糊开，
// 第三场再甩一下回到第一场
const FRAMES = 150;
const WHIPS = [
  [30, 48],
  [80, 98],
  [130, 148],
] as const;
const PITCH = 60; // 点阵间距，W 是它的整数倍，三场的点阵接得上

const Grid: React.FC = () => {
  const dots = [];
  for (let y = PITCH / 2; y < H; y += PITCH)
    for (let x = PITCH / 2; x < W; x += PITCH)
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill={C.dim} opacity={0.6} />);
  return <>{dots}</>;
};

const Scene: React.FC<{ index: number; t: number }> = ({ index, t }) => {
  const cx = W / 2;
  const cy = H / 2;
  const s = 260;
  // 每场自己的小动作：圆呼吸、方块转 90°、三角转 120°，一个循环正好回到原样
  const shape =
    index === 0 ? (
      <circle cx={cx} cy={cy} r={s * (0.5 + 0.04 * Math.sin(t * Math.PI * 4))} fill={C.accent} />
    ) : index === 1 ? (
      <rect
        x={cx - s / 2}
        y={cy - s / 2}
        width={s}
        height={s}
        rx={24}
        fill={C.cool}
        transform={`rotate(${ease.inOut(t) * 90} ${cx} ${cy})`}
      />
    ) : (
      <polygon
        points={[0, 1, 2]
          .map((k) => {
            const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
            return `${cx + Math.cos(a) * s * 0.62},${cy + 30 + Math.sin(a) * s * 0.62}`;
          })
          .join(" ")}
        fill={C.fg}
        transform={`rotate(${ease.inOut(t) * 120} ${cx} ${cy + 30})`}
      />
    );
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, background: C.bg }}>
      <Grid />
      {shape}
      <text x={120} y={150} fill={C.fg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        {`0${index + 1}`}
      </text>
    </svg>
  );
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const t = loop(frame, FRAMES);
  // 当前在哪一段甩镜：第 k 次甩镜从第 k 场甩到第 k+1 场
  const k = frame < (WHIPS[0][1] + WHIPS[1][0]) / 2 ? 0 : frame < (WHIPS[1][1] + WHIPS[2][0]) / 2 ? 1 : 2;
  const [start, end] = WHIPS[k];
  return (
    <Stage>
      <WhipPan
        frame={frame}
        start={start}
        end={end}
        direction="left"
        width={W}
        height={H}
        id={`whip-${k}`}
        outgoing={<Scene index={k} t={t} />}
        incoming={<Scene index={(k + 1) % 3} t={t} />}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 17,
  name: "甩镜到下一场",
  group: "转场",
  desc: "镜头往右猛甩到下一场，最快的几帧沿横向糊开，三场甩一圈回到开头",
  tech: "WhipPan（direction left，ease.whip，18 帧）+ MotionBlur 按真实速度给横向模糊；三场共用一张点阵底，读起来是镜头在动",
  frames: FRAMES,
  component: Effect,
};
export default effect;
