import { useCurrentFrame } from "remotion";
import { mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 满屏六边形格子，从中心一圈圈点亮：格子先亮成强调色、微微鼓起，再退成辅色的余辉慢慢熄掉；
// 一道波还没散完下一道就跟上来，像脉冲往外扩散
const FRAMES = 150;
const PERIOD = 75; // 两道波相隔的帧数，整除循环长度
const SPEED = 16; // 波每帧走多少像素
const SIZE = 54; // 六边形外接圆半径（尖顶）
const HW = Math.sqrt(3) * SIZE; // 横向间距
const VH = 1.5 * SIZE; // 纵向间距
const CX = W / 2;
const CY = H / 2;

const cells: { x: number; y: number; d: number }[] = [];
for (let r = -Math.ceil(CY / VH) - 1; r <= Math.ceil(CY / VH) + 1; r++) {
  for (let q = -Math.ceil(CX / HW) - 1; q <= Math.ceil(CX / HW) + 1; q++) {
    const x = CX + q * HW + (Math.abs(r) % 2 === 1 ? HW / 2 : 0);
    const y = CY + r * VH;
    cells.push({ x, y, d: Math.hypot(x - CX, y - CY) });
  }
}

const hexPath = (s: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    return `${(Math.cos(a) * s).toFixed(2)},${(Math.sin(a) * s).toFixed(2)}`;
  }).join(" ");

// 波过去之后第 age 帧的亮度：3 帧冲到顶，再按指数衰减，到下一道波前基本灭了
const pulse = (age: number) => {
  if (age < 3) return age / 3;
  return Math.exp(-(age - 3) / 11);
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  return (
    <Stage>
      <svg width={W} height={H}>
        {cells.map((c, i) => {
          const age = (((frame - c.d / SPEED) % PERIOD) + PERIOD) % PERIOD;
          const k = pulse(age);
          // 亮的时候是强调色，退下来变成辅色的余辉
          const hot = Math.max(0, (k - 0.45) / 0.55);
          const fill = mixColor(mixColor(C.bg2, C.cool, Math.min(1, k * 1.6) * 0.75), C.accent, hot);
          const s = (SIZE - 5) * (1 + 0.1 * hot);
          return (
            <polygon
              key={i}
              points={hexPath(s)}
              transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}
              fill={fill}
              stroke={C.bg}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 50,
  name: "蜂巢格依次点亮",
  group: "形状",
  desc: "满屏六边形格子从中心一圈圈点亮，亮成强调色时微微鼓起，再退成辅色余辉熄掉；一道波没散完下一道就跟上来",
  tech: "自己画 SVG 尖顶六边形网格（横距 √3·r、纵距 1.5·r、奇数行错半格）；每格的相位 = 帧号 − 到中心距离/16，按 75 帧取模（整除循环），亮度 3 帧冲顶再指数衰减；颜色在 OKLab 里从暗格混到辅色再到强调色。创意参考 remotion-scenes 的 ShapeHexGrid",
  frames: FRAMES,
  component: Effect,
};
export default effect;
