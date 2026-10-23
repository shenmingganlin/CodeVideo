import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 花瓣分远中近三层往下飘，边落边自转、翻面（scaleX 随 cos 变），左右正弦摆；远的小、慢、暗
const FRAMES = 150;
const N = 48;
const TAU = Math.PI * 2;
// 每层一个循环里落几趟、摆几次、转几圈都是整数，第 FRAMES 帧回到原样
const LAYERS = [
  { size: 16, laps: 1, sway: 1, amp: 40, light: 0.55, alpha: 0.45 },
  { size: 26, laps: 1, sway: 2, amp: 70, light: 0.75, alpha: 0.75 },
  { size: 40, laps: 2, sway: 2, amp: 110, light: 0.9, alpha: 1 },
];
// 一片瓣：圆头、尖底，顶端一个小缺口
const PETAL = "M0,-1 C0.25,-1.15 0.6,-0.95 0.62,-0.45 C0.62,0.1 0.25,0.65 0,1 C-0.25,0.65 -0.62,0.1 -0.62,-0.45 C-0.6,-0.95 -0.25,-1.15 0,-1 L0,-0.78 Z";

const petals = Array.from({ length: N }, (_, i) => {
  const layer = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
  return {
    layer,
    x0: rand(i * 7 + 1) * (W + 200) - 100,
    phase: rand(i * 7 + 2),
    swayPh: rand(i * 7 + 3),
    flipPh: rand(i * 7 + 4),
    rot0: rand(i * 7 + 5) * 360,
    spin: (rand(i * 7 + 6) < 0.5 ? -1 : 1) * (1 + Math.floor(rand(i * 7 + 7) * 2)),
    tint: rand(i * 7 + 8),
  };
});

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  // 先画远层再画近层
  const sorted = [...petals].sort((a, b) => a.layer - b.layer);
  return (
    <Stage>
      <svg width={W} height={H}>
        {sorted.map((p, i) => {
          const L = LAYERS[p.layer];
          const fall = (p.phase + u * L.laps) % 1;
          const y = fall * (H + 200) - 100;
          const x = p.x0 + L.amp * Math.sin(TAU * (u * L.sway + p.swayPh));
          const rot = p.rot0 + 360 * u * p.spin + 25 * Math.sin(TAU * (u * L.sway + p.swayPh));
          const flip = Math.cos(TAU * (u * 2 + p.flipPh));
          // 翻到背面时稍暗，像光照在瓣面上
          const face = 0.75 + 0.25 * Math.abs(flip);
          const base = mixColor(C.accent, C.fg, L.light - 0.15 + p.tint * 0.3);
          const fill = mixColor(C.bg, base, face * L.alpha + (1 - L.alpha) * 0.3);
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${rot}) scale(${L.size * Math.max(0.08, Math.abs(flip))},${L.size})`}>
              <path d={PETAL} fill={fill} />
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 27,
  name: "樱花飘落",
  group: "粒子",
  desc: "四十多片花瓣分远中近三层往下飘，边落边自转、翻面，左右轻轻摆；远处的小、慢、暗，近处的大、快、亮",
  tech: "SVG 花瓣路径；竖直位置 (相位 + 进度×整数趟) 取模，摆动和翻面用整数周期的正弦，首尾无缝；翻面是 scaleX 随 cos 变。创意参考 remotion-scenes 的 ParticleSakura",
  frames: FRAMES,
  component: Scene,
};
export default effect;
