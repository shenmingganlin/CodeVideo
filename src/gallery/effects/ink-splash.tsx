import { useCurrentFrame } from "remotion";
import { clamp01, ease, prog, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一团墨从左上方甩过来砸在纸上：几帧之内炸开，中心一大团不规则的墨，
// 顺着甩来的方向喷出大小墨点和细长飞丝；之后墨慢慢洇开一点，停住，纸再淡回白
const FRAMES = 150;
const HIT = 20; // 砸到纸上那一帧
const CX = W * 0.52;
const CY = H * 0.54;
const DIR = (18 * Math.PI) / 180; // 甩来的方向：从左上往右下
const PAPER = C.fg;
const INK = C.bg;

// 飞来的墨：第 FLY0 帧从左上角画外出发，ease.in 加速，路径向下微弯（像被甩出来带着下坠）。
// r 是墨块大小：远处小、砸到纸上时和墨团一样大
const FLY0 = 2;
const flyAt = (fr: number) => {
  const p = Math.min(1, Math.max(0, (fr - FLY0) / (HIT - FLY0)));
  const e = p * p; // 匀加速：画面里能看到大约 14 帧由慢到快
  const d = 1150 * (1 - e);
  const sag = 160 * Math.sin(Math.PI * e) * (1 - e); // 弧线：中段往下鼓
  return {
    p,
    x: CX - Math.cos(DIR) * d - Math.sin(DIR) * sag,
    y: CY - Math.sin(DIR) * d + Math.cos(DIR) * sag,
    r: 26 + 34 * e,
  };
};

// 中心墨团：十几个圆挤在一起，再用 gooey 滤镜粘成一块
const CORE = Array.from({ length: 16 }, (_, i) => {
  const a = rand(i + 1) * Math.PI * 2;
  const d = rand(i + 21) ** 0.7 * 150;
  return { x: Math.cos(a) * d * 1.25, y: Math.sin(a) * d * 0.85, r: 50 + rand(i + 41) * 70 };
});

// 喷出去的墨点：大多数顺着方向，夹角越大飞得越近
const SPRAY = Array.from({ length: 70 }, (_, i) => {
  const spread = (rand(i + 101) - 0.5) * 2; // -1..1
  const a = DIR + spread * spread * Math.sign(spread) * 1.6;
  const reach = (1 - 0.6 * Math.abs(spread)) * (220 + rand(i + 201) * 620);
  const r = 4 + rand(i + 301) ** 3 * 34;
  const streak = rand(i + 401) < 0.3; // 三成是细长的飞丝
  return { a, reach, r, streak, delay: rand(i + 501) * 3 };
});

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const t = f - HIT;
  const fade = 1 - prog(f, 118, 146, ease.inOut);
  // 墨在空中飞来：沿一条微弯的弧线越飞越快，身后拖一串小墨滴，和墨团粘成彗星形；
  // 离纸越近越大（朝镜头落下），纸上的影子从侧下方迎上来，砸中那一刻和墨团重合
  // 砸中那一帧墨块还在，和刚开始炸开的墨团叠着，不会闪一下变小
  const fly = f >= FLY0 && f <= HIT;
  const head = flyAt(f);
  const prev = flyAt(f - 0.5);
  const next = flyAt(f + 0.5);
  const vx = next.x - prev.x;
  const vy = next.y - prev.y;
  const speed = Math.hypot(vx, vy);
  const stretch = Math.min(0.9, speed / 110);
  const vdeg = (Math.atan2(vy, vx) * 180) / Math.PI;
  // 炸开：几帧冲出去，略冲过头再收回一点，像液体
  const burst = t >= 0 ? 1 - Math.exp(-t / 3) * Math.cos(t / 3.2) : 0;
  const bleed = t >= 0 ? clamp01(t / 70) : 0;
  const spread = 1 + 0.06 * bleed;

  return (
    <Stage bg={PAPER}>
      <svg width={W} height={H}>
        <defs>
          <filter id="ink-goo" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={7} result="n" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={18} result="b" />
            <feDisplacementMap in="b" in2="n" scale={60} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -12" />
          </filter>
          <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={3} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={6 + 8 * bleed} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ink-shadow">
            <feGaussianBlur stdDeviation={14} />
          </filter>
        </defs>
        {fly ? (
          <>
            <circle
              cx={head.x + 70 * (1 - head.p)}
              cy={head.y + 110 * (1 - head.p)}
              r={head.r * 1.1}
              fill={INK}
              opacity={0.05 + 0.12 * head.p}
              filter="url(#ink-shadow)"
            />
            <g filter="url(#ink-goo)">
              {[1, 2, 3, 4, 5, 6].map((k) => {
                const q = flyAt(f - k * 0.45);
                if (q.p <= 0) return null;
                return <circle key={k} cx={q.x} cy={q.y} r={head.r * (0.62 - k * 0.08)} fill={INK} />;
              })}
              <ellipse
                cx={head.x}
                cy={head.y}
                rx={head.r * (1 + stretch)}
                ry={head.r / Math.sqrt(1 + stretch)}
                fill={INK}
                transform={`rotate(${vdeg} ${head.x} ${head.y})`}
              />
            </g>
          </>
        ) : null}
        {t >= 0 ? (
          <g opacity={fade}>
            <g filter="url(#ink-goo)">
              {CORE.map((c, i) => (
                <circle
                  key={i}
                  cx={CX + c.x * burst * spread}
                  cy={CY + c.y * burst * spread}
                  r={c.r * (0.4 + 0.6 * burst) * spread}
                  fill={INK}
                />
              ))}
            </g>
            <g filter="url(#ink-edge)">
              {SPRAY.map((s, i) => {
                const p = t >= s.delay ? prog(t - s.delay, 0, 8, ease.out) : 0;
                if (p <= 0) return null;
                const d = 120 + s.reach * p * spread;
                const x = CX + Math.cos(s.a) * d;
                const y = CY + Math.sin(s.a) * d;
                const deg = (s.a * 180) / Math.PI;
                // 飞丝飞的时候拉得更长，落定后留一条细长的痕
                const len = s.streak ? s.r * (3 + 5 * (1 - p) + 3) : s.r * (1 + 1.5 * (1 - p));
                const wid = s.streak ? Math.max(2, s.r * 0.35) : s.r;
                return (
                  <ellipse
                    key={i}
                    cx={x}
                    cy={y}
                    rx={len * (0.9 + 0.1 * spread)}
                    ry={wid * spread}
                    fill={INK}
                    transform={`rotate(${deg} ${x} ${y})`}
                  />
                );
              })}
            </g>
          </g>
        ) : null}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 52,
  name: "墨点溅开",
  group: "水墨",
  desc: "一团墨拖着一串小墨滴沿弧线越飞越快，朝纸面落下时越来越大、影子迎上来，砸中后炸开略冲过头再收回，顺着方向喷出墨点和飞丝，慢慢洇开，最后纸淡回白",
  tech: "SVG：飞行段沿下垂弧线 ease 三次方加速，墨块顺速度拉长 + 6 颗拖尾小滴一起过 gooey 滤镜成彗星形，模糊影子从侧下方汇合；砸中后墨团按 1−e^(−t/3)·cos(t/3.2) 阻尼过冲炸开；中心 16 个圆 + feDisplacementMap 毛边，70 个墨点锥形分布、三成拉成飞丝；创意参考 remotion-scenes 的 LiquidInkSplash",
  frames: FRAMES,
  component: Scene,
};
export default effect;
