import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 雪花分远中近三层往下飘：远层是小点、慢、暗、轻模糊；近层是大的六角雪花、快、明显虚焦（景深）
const FRAMES = 150;
const TAU = Math.PI * 2;
// 每层一个循环里落几趟、摆几次都是整数，第 FRAMES 帧回到原样
const LAYERS = [
  { n: 90, size: 3, laps: 1, sway: 1, amp: 18, alpha: 0.45, blur: 0.8, flake: false },
  { n: 45, size: 7, laps: 1, sway: 2, amp: 40, alpha: 0.75, blur: 0, flake: false },
  { n: 14, size: 34, laps: 2, sway: 1, amp: 70, alpha: 0.9, blur: 3.5, flake: true },
];

// 六角雪花：六根主枝，每根两对小分叉
const ARM = "M0,0 L0,-1 M0,-0.55 L0.22,-0.75 M0,-0.55 L-0.22,-0.75 M0,-0.3 L0.15,-0.45 M0,-0.3 L-0.15,-0.45";

const flakes = LAYERS.flatMap((L, layer) =>
  Array.from({ length: L.n }, (_, i) => {
    const s = layer * 1000 + i * 7;
    return {
      layer,
      x0: rand(s + 1) * (W + 160) - 80,
      phase: rand(s + 2),
      swayPh: rand(s + 3),
      rot0: rand(s + 4) * 60,
      spin: rand(s + 5) < 0.5 ? -1 : 1,
      k: 0.7 + rand(s + 6) * 0.6,
    };
  }),
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          {LAYERS.map((L, i) =>
            L.blur > 0 ? (
              <filter key={i} id={`snow-blur-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={L.blur} />
              </filter>
            ) : null,
          )}
        </defs>
        {LAYERS.map((L, layer) => (
          <g key={layer} filter={L.blur > 0 ? `url(#snow-blur-${layer})` : undefined}>
            {flakes
              .filter((f) => f.layer === layer)
              .map((f, i) => {
                const fall = (f.phase + u * L.laps) % 1;
                const y = fall * (H + 120) - 60;
                const x = f.x0 + L.amp * Math.sin(TAU * (u * L.sway + f.swayPh));
                const color = mixColor(C.bg, C.fg, L.alpha);
                const size = L.size * f.k;
                if (!L.flake) return <circle key={i} cx={x} cy={y} r={size} fill={color} />;
                // 六重对称，转 60° 就和原样重合：一个循环转 60° 整数倍
                const rot = f.rot0 + 60 * u * f.spin;
                return (
                  <g key={i} transform={`translate(${x},${y}) rotate(${rot}) scale(${size})`}>
                    {[0, 1, 2, 3, 4, 5].map((k) => (
                      <path
                        key={k}
                        d={ARM}
                        transform={`rotate(${k * 60})`}
                        stroke={color}
                        strokeWidth={0.09}
                        strokeLinecap="round"
                        fill="none"
                      />
                    ))}
                  </g>
                );
              })}
          </g>
        ))}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 43,
  name: "雪花飘落",
  group: "粒子",
  desc: "一百多片雪花分远中近三层往下飘，左右轻轻摆；远处是暗淡的小点，近处是虚焦的大六角雪花，边落边慢转",
  tech: "SVG：远中层是圆点，近层是六根带分叉的主枝；每层一个 feGaussianBlur 做景深；竖直位置 (相位 + 进度×整数趟) 取模，摆动用整数周期正弦，近层每循环转 60°（六重对称）首尾无缝。创意参考 remotion-scenes 的 ParticleSnow",
  frames: FRAMES,
  component: Scene,
};
export default effect;
