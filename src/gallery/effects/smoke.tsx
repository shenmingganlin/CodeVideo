import { useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一炷香头上冒烟：刚出来是几根细丝，往上走越走越慢、越扭越大，扭成一卷卷的，慢慢散开变淡，飘出画面
const FRAMES = 150;
const TAU = Math.PI * 2;
const SX = W / 2;
const SY = H * 0.86;

const frac = (x: number) => x - Math.floor(x);

// 整团烟柱的弯：高度越高摆得越大，相位 = 时间 − 高度，弯会顺着烟往上走；时间项都是整数圈，首尾无缝
const meander = (h: number, f: number, ph = 0) => {
  const t = (TAU * f) / FRAMES;
  const g = Math.pow(h, 1.3);
  return g * (150 * Math.sin(t - h * 4.2 + ph) + 70 * Math.sin(2 * t - h * 7.5 + 1.3 + ph * 1.7) + 30 * Math.sin(3 * t - h * 12 + 2.1));
};

// 上升：一开始冲得快，越往上越慢（热气凉下来），h = 1 − (1−a)^1.8
const rise = (a: number) => 1 - Math.pow(1 - a, 1.8);
const TOP = SY + 120; // 烟走完全程的高度（从源头往上，超出画面顶）

// 细丝：一根根从源头往上的线，各自的相位不同，被位移滤镜扭成丝缕
const STRANDS = Array.from({ length: 7 }, (_, i) => ({ ph: (rand(i * 11 + 1) - 0.5) * 1.6, w: 2 + rand(i * 11 + 2) * 3, op: 0.35 + rand(i * 11 + 3) * 0.3 }));

// 烟团：一个循环走 1 或 2 轮，越往上越大越淡
const PUFFS = Array.from({ length: 110 }, (_, i) => {
  const r = (j: number) => rand(400 + i * 17 + j * 3);
  return { k: r(1) < 0.55 ? 1 : 2, off: r(2), side: (r(3) - 0.5) * 2, size: 0.7 + r(4) * 0.6, ph: (r(5) - 0.5) * 1.2, tone: r(6) };
});

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;

  const strands = STRANDS.map((s, i) => {
    const pts: string[] = [];
    // 细丝只画下半段，往上就交给烟团
    for (let j = 0; j <= 40; j++) {
      const h = (j / 40) * 0.55;
      pts.push(`${(SX + meander(h, f, s.ph) * 0.9 + Math.sin(h * 30 + s.ph * 4 + (TAU * f) / FRAMES * 3) * 10 * h).toFixed(1)},${(SY - h * TOP).toFixed(1)}`);
    }
    return <polyline key={`l${i}`} points={pts.join(" ")} fill="none" stroke={C.fg} strokeWidth={s.w} strokeLinecap="round" opacity={s.op} />;
  });

  const puffs = PUFFS.map((p, i) => {
    const a = frac((f * p.k) / FRAMES + p.off);
    const h = rise(a);
    const spread = 30 + 260 * Math.pow(h, 1.4);
    const x = SX + meander(h, f, p.ph) + p.side * spread * 0.5;
    const y = SY - h * TOP;
    const r = (14 + 150 * Math.pow(h, 1.1)) * p.size;
    // 刚出来很淡、中段最浓、最后散成看不见
    const op = clamp01(a / 0.12) * Math.pow(1 - a, 1.6) * 0.16;
    if (op < 0.003) return null;
    return (
      <ellipse
        key={`p${i}`}
        cx={x}
        cy={y}
        rx={r}
        ry={r * (1.25 - 0.4 * h)}
        fill={mixColor(C.fg, C.dim, p.tone * 0.6 + h * 0.4)}
        opacity={op}
      />
    );
  });

  const glow = 0.75 + 0.25 * Math.sin((TAU * f * 3) / FRAMES);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          {/* 固定的噪声场把经过的线和烟团扭成丝缕：烟往上穿过它，每处扭法不同，看起来在翻滚 */}
          <filter id="smoke-silk" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves={3} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={90} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feGaussianBlur in="d" stdDeviation={2.5} />
          </filter>
          <filter id="smoke-puff" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={22} result="b" />
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.009" numOctaves={2} seed={3} result="n" />
            <feDisplacementMap in="b" in2="n" scale={140} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="smoke-ember">
            <stop offset="0%" stopColor="#FFE2A8" />
            <stop offset="45%" stopColor={C.accent} stopOpacity={0.7} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g filter="url(#smoke-puff)">{puffs}</g>
        <g filter="url(#smoke-silk)">{strands}</g>
        {/* 香和香头的火光 */}
        <rect x={SX - 4} y={SY + 6} width={8} height={H - SY} fill={C.dim} />
        <circle cx={SX} cy={SY + 6} r={36} fill="url(#smoke-ember)" opacity={glow * 0.6} />
        <circle cx={SX} cy={SY + 6} r={6} fill={C.accent} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 66,
  name: "烟雾升腾",
  group: "特效",
  desc: "一炷香头上冒烟，刚出来是几根细丝，往上越走越慢、越扭越大，卷成一团团的，慢慢散开变淡，飘出画面",
  tech: "SVG：下半段是 7 根细线，上面是 110 个烟团椭圆；烟柱的弯是相位 = 时间 − 高度的上行波，上升 h = 1−(1−a)^1.8 先快后慢，烟团越高越大越淡。两层各过一道固定的 feTurbulence + feDisplacementMap（烟团先模糊 22），烟穿过不动的噪声场被扭成丝缕。烟团一个循环走 1 或 2 轮，时间项都是整数圈，首尾无缝",
  frames: FRAMES,
  component: Scene,
};
export default effect;
