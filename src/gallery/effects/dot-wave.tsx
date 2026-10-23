import { useCurrentFrame } from "remotion";
import { mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 斜着铺的点阵，一道道波峰从左下往右上滚过，再叠一圈从中心往外的慢波；点在波峰上抬起、变大、变亮
const FRAMES = 120;
const PITCH = 40;
const COLS = Math.ceil(W / PITCH) + 1;
const ROWS = Math.ceil(H / PITCH) + 1;
const TAU = Math.PI * 2;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  const dots = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * PITCH + (W - (COLS - 1) * PITCH) / 2;
      const y = r * PITCH + (H - (ROWS - 1) * PITCH) / 2;
      // 斜向的波每圈走 2 个周期，径向的走 1 个周期，所以第 FRAMES 帧回到原样
      const diag = Math.sin(((x * 0.8 - y * 0.6) / 520) * TAU - u * TAU * 2);
      const radial = Math.sin((Math.hypot(x - W / 2, y - H / 2) / 700) * TAU - u * TAU);
      const v = 0.65 * diag + 0.35 * radial; // -1..1
      const crest = Math.pow(Math.max(0, v), 2.2); // 波峰收窄，读成一道一道
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x}
          cy={y - crest * 16}
          r={2.6 + crest * 7}
          fill={crest > 0.5 ? mixColor(C.cool, C.accent, (crest - 0.5) * 2) : mixColor(C.dim, C.cool, crest * 2)}
        />,
      );
    }
  return (
    <Stage>
      <svg width={W} height={H}>
        {dots}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 15,
  name: "点阵波浪",
  group: "线条",
  desc: "满屏点阵上一道道波峰斜着滚过，再叠一圈从中心荡开的慢波，点在波峰上抬起、变大、从灰变亮",
  tech: "SVG 点阵 + 两道行进正弦（每圈整数个周期，首尾无缝）；波峰取 max(0,v)^2.2 收窄，颜色在 OKLab 里混",
  frames: FRAMES,
  component: Scene,
};
export default effect;
