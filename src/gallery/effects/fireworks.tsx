import { useCurrentFrame } from "remotion";
import { rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 三发烟花错开升空：光点拖着尾巴升到高处，炸成一圈火花，火花减速、下坠、变暗、拖短尾，最后散尽
const FRAMES = 150;
const RISE = 26; // 升空帧数
const LIFE = 64; // 火花寿命
const SPARKS = 72;
const G = 0.11; // 重力（像素/帧²）
const DRAG = 0.075; // 空气阻力
const TAU = Math.PI * 2;

const SHELLS = [
  { off: 0, x: W * 0.32, apex: H * 0.3, speed: 9.5, color: C.accent },
  { off: 50, x: W * 0.68, apex: H * 0.24, speed: 11, color: C.cool },
  { off: 100, x: W * 0.5, apex: H * 0.36, speed: 8.5, color: C.fg },
];

// 带阻力的位移：速度按 e^{-kt} 衰减
const travel = (v0: number, t: number) => (v0 * (1 - Math.exp(-DRAG * t))) / DRAG;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const out: React.ReactNode[] = [];
  SHELLS.forEach((s, si) => {
    // 发射时间取模：每发按 FRAMES 一圈，跨过循环接缝也接得上
    const local = (((frame - s.off) % FRAMES) + FRAMES) % FRAMES;
    if (local < RISE) {
      // 升空：先快后慢，到顶时几乎停住
      const at = (t: number) => {
        const k = Math.max(0, t) / RISE;
        return H + 30 - (H + 30 - s.apex) * (1 - (1 - k) * (1 - k));
      };
      const y = at(local);
      const wob = Math.sin(local * 0.9 + si) * 2;
      out.push(
        <line key={`r${si}`} x1={s.x + wob} y1={y} x2={s.x} y2={at(local - 5) + 6} stroke={s.color} strokeWidth={4} strokeLinecap="round" opacity={0.85} />,
        <circle key={`h${si}`} cx={s.x + wob} cy={y} r={5} fill={C.fg} />,
      );
      return;
    }
    const age = local - RISE;
    if (age >= LIFE) return;
    // 炸开的一瞬间一团亮光
    if (age < 8) out.push(<circle key={`f${si}`} cx={s.x} cy={s.apex} r={30 + age * 14} fill={s.color} opacity={0.35 * (1 - age / 8)} />);
    const fade = Math.pow(1 - age / LIFE, 1.4);
    for (let i = 0; i < SPARKS; i++) {
      const seed = si * 1000 + i;
      const a = (i / SPARKS) * TAU + (rand(seed) - 0.5) * 0.12;
      const v = s.speed * (0.75 + 0.35 * rand(seed + 500));
      const pos = (t: number) => ({
        x: s.x + Math.cos(a) * travel(v, t),
        y: s.apex + Math.sin(a) * travel(v, t) + 0.5 * G * t * t,
      });
      const p = pos(age);
      const q = pos(Math.max(0, age - 4));
      // 快散尽时火花一闪一闪
      const twinkle = age > LIFE * 0.6 ? (rand(seed * 3 + Math.floor(age / 2)) > 0.35 ? 1 : 0.25) : 1;
      out.push(
        <line key={`${si}-${i}`} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={s.color} strokeWidth={3.2} strokeLinecap="round" opacity={fade * twinkle} />,
      );
    }
  });
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="fw-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={6} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#fw-glow)">{out}</g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 28,
  name: "烟花炸开",
  group: "粒子",
  desc: "三发烟花错开升空，光点拖着尾巴升到高处炸成一圈火花，火花减速、往下坠、拖着短尾变暗，最后一闪一闪地散尽",
  tech: "SVG 线段火花 + 高斯模糊辉光；火花位移按指数阻力 v0(1−e^{−kt})/k 加重力 ½gt²，尾巴是 4 帧前到现在的连线；三发的发射时间按循环长度取模，首尾无缝。创意参考 remotion-scenes 的 ParticleFireworks",
  frames: FRAMES,
  component: Scene,
};
export default effect;
