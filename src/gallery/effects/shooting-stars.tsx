import { useCurrentFrame } from "remotion";
import { clamp01, lerp, mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 星空里几百颗星各自微微闪；一个循环里四颗流星在不同时间、不同位置斜着划过，亮头拖着渐细渐隐的长尾
const FRAMES = 150;
const TAU = Math.PI * 2;
const SKY = "#0B0D12";

const stars = Array.from({ length: 320 }, (_, i) => ({
  x: rand(i * 5 + 1) * W,
  y: rand(i * 5 + 2) * H,
  r: 0.6 + rand(i * 5 + 3) ** 3 * 2.2,
  ph: rand(i * 5 + 4),
  // 闪烁周期整除 FRAMES：一个循环闪 1、2、3 或 5 次
  k: [1, 2, 3, 5][Math.floor(rand(i * 5 + 5) * 4)],
}));

// 流星：起帧、起点、方向角（度，向右下为正）、划过长度。全部在 [8, 140] 帧内划完，首尾没有流星
const METEORS = [
  { s: 8, x: 1350, y: 90, ang: 152, len: 760 },
  { s: 44, x: 620, y: 60, ang: 145, len: 560 },
  { s: 78, x: 1750, y: 260, ang: 158, len: 900 },
  { s: 112, x: 980, y: 140, ang: 148, len: 640 },
];
const TRAVEL = 16; // 头划完全程的帧数
const TAIL = 0.42; // 尾巴长度（占全程的比例）；头到终点后尾巴再追 TAIL×TRAVEL 帧才消失

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  return (
    <Stage bg={SKY}>
      <svg width={W} height={H}>
        <defs>
          <filter id="meteor-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={6} />
          </filter>
          {METEORS.map((m, i) => {
            const a = (m.ang * Math.PI) / 180;
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            const t = (frame - m.s) / TRAVEL;
            const head = clamp01(t);
            const tail = clamp01(t - TAIL);
            return (
              <linearGradient
                key={i}
                id={`meteor-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={m.x + dx * m.len * head}
                y1={m.y + dy * m.len * head}
                x2={m.x + dx * m.len * tail}
                y2={m.y + dy * m.len * tail}
              >
                <stop offset="0" stopColor={C.fg} stopOpacity={1} />
                <stop offset="0.25" stopColor={C.cool} stopOpacity={0.7} />
                <stop offset="1" stopColor={C.cool} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        {stars.map((s, i) => {
          const tw = 0.55 + 0.45 * Math.sin(TAU * (u * s.k + s.ph));
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={mixColor(SKY, C.fg, 0.35 + 0.6 * tw)} />;
        })}
        {METEORS.map((m, i) => {
          const t = (frame - m.s) / TRAVEL;
          if (t <= 0 || t >= 1 + TAIL) return null;
          const a = (m.ang * Math.PI) / 180;
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          const head = clamp01(t);
          const tail = clamp01(t - TAIL);
          const hx = m.x + dx * m.len * head;
          const hy = m.y + dy * m.len * head;
          const tx = m.x + dx * m.len * tail;
          const ty = m.y + dy * m.len * tail;
          // 头到终点后变暗，尾巴缩回去
          const fade = t <= 1 ? 1 : 1 - (t - 1) / TAIL;
          const w = lerp(1.5, 4, fade);
          // 渐细的尾巴：头端宽、尾端尖的三角形
          const nx = -dy;
          const ny = dx;
          const tri = `M${hx + nx * w},${hy + ny * w} L${hx - nx * w},${hy - ny * w} L${tx},${ty} Z`;
          return (
            <g key={i} opacity={fade}>
              <path d={tri} fill={`url(#meteor-${i})`} filter="url(#meteor-glow)" opacity={0.8} />
              <path d={tri} fill={`url(#meteor-${i})`} />
              <circle cx={hx} cy={hy} r={w * 1.3} fill={C.fg} />
              <circle cx={hx} cy={hy} r={w * 4} fill={C.cool} opacity={0.35} filter="url(#meteor-glow)" />
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 44,
  name: "流星划过",
  group: "粒子",
  desc: "满天星星各自微微闪烁，四颗流星先后在不同位置斜着划过，亮头拖一条渐细渐隐的长尾，划完尾巴追上来消散",
  tech: "SVG：星星闪烁周期整除循环长度；流星尾巴是头宽尾尖的三角形，填 userSpaceOnUse 的 linearGradient（头白、尾透明），叠一层 feGaussianBlur 辉光；头 16 帧划完，尾巴再追 7 帧，四颗都在 8–140 帧内，首尾无流星。创意参考 remotion-scenes 的 ParticleShootingStars",
  frames: FRAMES,
  component: Scene,
};
export default effect;
