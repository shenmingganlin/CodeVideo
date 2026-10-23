import { useCurrentFrame } from "remotion";
import { clamp01, colorRamp, mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 三道激光轮流从画外打下来，击点在地面上扫过：一下加速扫进、减速停住、停一会儿再熄灭；
// 扫过的地方留下一道灼痕，从白热退到橙红再到暗红慢慢冷掉，击点一路往外喷火星
const FRAMES = 150;
const HORIZON = 600;
const SPARK_LIFE = 18;
const COOL = 70; // 灼痕从白热冷到看不见用几帧
const BURN = ["#FFFFFF", mixColor(C.accent, "#FFFFFF", 0.4), C.accent, "#B8401E", "#3A1810"];

// 每道激光：发射点（画外）、开始帧、扫多久、停多久、击点从哪扫到哪、颜色
const LASERS = [
  { e: { x: -200, y: -150 }, f0: 4, sweep: 30, hold: 10, a: { x: 260, y: 980 }, b: { x: 1240, y: 760 }, c: C.accent },
  { e: { x: W + 200, y: -100 }, f0: 52, sweep: 28, hold: 9, a: { x: 1720, y: 1010 }, b: { x: 640, y: 840 }, c: C.cool },
  { e: { x: W * 0.55, y: -260 }, f0: 98, sweep: 26, hold: 8, a: { x: 420, y: 700 }, b: { x: 1500, y: 930 }, c: mixColor(C.accent, "#FF4A6A", 0.55) },
];
type Laser = (typeof LASERS)[number];
const RAMP = 3; // 点亮、熄灭各用几帧

// 帧号距这道激光开始过了多少帧，按循环折回来，所以末尾的灼痕会接着冷到下一圈的开头
const since = (frame: number, l: Laser) => (((frame - l.f0) % FRAMES) + FRAMES) % FRAMES;

// 击点：smootherstep 加速扫进、减速停住；路径微微往上拱一点，像手腕甩出的弧
const hitAt = (l: Laser, t: number) => {
  const p = clamp01(t / l.sweep);
  const s = p * p * p * (p * (p * 6 - 15) + 10);
  const bow = Math.sin(Math.PI * s) * 70;
  const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
  const len = Math.hypot(dx, dy);
  return { x: l.a.x + dx * s + (dy / len) * bow, y: l.a.y + dy * s - (Math.abs(dx) / len) * bow };
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;

  const layers = LASERS.map((l, li) => {
    const t = since(frame, l);
    const end = l.sweep + l.hold;
    const on = t <= end + RAMP;
    // 点亮：光束从发射点往下 RAMP 帧打到地面；熄灭：越来越细、闪两下灭掉
    const reach = clamp01((t + 1) / RAMP);
    const off = clamp01((t - end) / RAMP);
    const width = on ? (1 - off) * (1 - off) * (off > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 2.7)) : 1) : 0;
    const hit = hitAt(l, Math.min(t, l.sweep));
    const jitter = t > l.sweep && on ? Math.sin(t * 1.9 + li) * 2.5 : 0;
    const hx = hit.x + jitter;
    const hy = hit.y;
    const bx = l.e.x + (hx - l.e.x) * reach;
    const by = l.e.y + (hy - l.e.y) * reach;
    const lit = on && reach >= 1 ? 1 - off : 0;

    // 灼痕：取过去每一帧的击点连起来，每小段按它被烧到后过了多久上色
    const scars: React.ReactNode[] = [];
    const last = Math.min(t, end);
    for (let k = 1; k <= last; k++) {
      const age = t - k; // 这一段烧上去已经多少帧
      if (age > COOL) continue;
      const p0 = hitAt(l, Math.min(k - 1, l.sweep));
      const p1 = hitAt(l, Math.min(k, l.sweep));
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.2) continue;
      const heat = 1 - age / COOL;
      const persp = 0.5 + 0.5 * ((p1.y - HORIZON) / (H - HORIZON)); // 越近越粗
      scars.push(
        <line
          key={k}
          x1={p0.x}
          y1={p0.y}
          x2={p1.x}
          y2={p1.y}
          stroke={colorRamp(BURN, 1 - heat)}
          strokeWidth={(4 + 9 * heat) * persp}
          strokeLinecap="round"
          opacity={Math.min(1, heat * 1.6)}
        />,
      );
    }
    // 停住的那一点烧得最久，冷却从熄灭那一刻算
    const dwellAge = t - end;
    const dwellHeat = t >= l.sweep ? (dwellAge <= 0 ? 1 : Math.max(0, 1 - dwellAge / COOL)) : 0;

    // 火星：每帧从击点喷出几颗，带重力往下掉，只算还活着的
    const sparks: React.ReactNode[] = [];
    for (let b = Math.max(0, t - SPARK_LIFE); b <= Math.min(t, end); b++) {
      const hp = hitAt(l, Math.min(b, l.sweep));
      const vel = hitAt(l, Math.min(b + 0.5, l.sweep));
      const mvx = vel.x - hitAt(l, Math.min(b - 0.5, l.sweep)).x;
      const n = b > l.sweep ? 2 : 4;
      for (let k = 0; k < n; k++) {
        const seed = li * 9000 + b * 31 + k * 7;
        const age = t - b + rand(seed) * 0.9;
        const life = 10 + rand(seed + 1) * 8;
        if (age > life || age < 0) continue;
        // 往上、往扫过的反方向喷
        const ang = -Math.PI / 2 + (rand(seed + 2) - 0.5) * 2.4 - Math.sign(mvx) * 0.5;
        const sp = 9 + rand(seed + 3) * 15;
        const vx = Math.cos(ang) * sp - mvx * 0.3;
        const vy = Math.sin(ang) * sp;
        const g = 1.1;
        const drag = 0.92;
        const k1 = (1 - drag ** age) / (1 - drag); // 有空气阻力的位移
        const x = hp.x + vx * k1;
        const y = hp.y + vy * k1 + 0.5 * g * age * age;
        const k0 = (1 - drag ** Math.max(0, age - 1.2)) / (1 - drag);
        const px = hp.x + vx * k0;
        const py = hp.y + vy * k0 + 0.5 * g * Math.max(0, age - 1.2) ** 2;
        const fade = 1 - age / life;
        sparks.push(
          <line
            key={`${b}-${k}`}
            x1={px}
            y1={py}
            x2={x}
            y2={y}
            stroke={colorRamp(BURN, 1 - fade)}
            strokeWidth={1.5 + 2 * fade}
            strokeLinecap="round"
            opacity={fade}
          />,
        );
      }
    }

    return (
      <g key={li}>
        <g style={{ mixBlendMode: "screen" }}>
          <g filter="url(#ls-soft)">{scars}</g>
          {scars}
          {dwellHeat > 0 && (
            <circle cx={hit.x} cy={hit.y} r={10 + 8 * dwellHeat} fill={colorRamp(BURN, 1 - dwellHeat)} opacity={Math.min(1, dwellHeat * 1.5)} filter="url(#ls-soft)" />
          )}
          {/* 击点照亮地面 */}
          {lit > 0 && (
            <>
              <ellipse cx={hx} cy={hy} rx={260} ry={90} fill={l.c} opacity={0.22 * lit} filter="url(#ls-wide)" />
              <circle cx={hx} cy={hy} r={34} fill="#FFFFFF" opacity={0.85 * lit} filter="url(#ls-soft)" />
            </>
          )}
          {width > 0 && (
            <>
              <line x1={l.e.x} y1={l.e.y} x2={bx} y2={by} stroke={l.c} strokeWidth={34 * width} strokeLinecap="round" opacity={0.55} filter="url(#ls-soft)" />
              <line x1={l.e.x} y1={l.e.y} x2={bx} y2={by} stroke={mixColor(l.c, "#FFFFFF", 0.4)} strokeWidth={10 * width} strokeLinecap="round" opacity={0.9} />
              <line x1={l.e.x} y1={l.e.y} x2={bx} y2={by} stroke="#FFFFFF" strokeWidth={3.2 * width} strokeLinecap="round" />
            </>
          )}
          {sparks}
        </g>
      </g>
    );
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="ls-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#101217" />
            <stop offset="1" stopColor={C.bg2} />
          </linearGradient>
          <filter id="ls-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
          <filter id="ls-wide" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={40} />
          </filter>
        </defs>
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill="url(#ls-floor)" />
        {/* 地面上几条往远处收的透视线，给"打在地上"一个参照 */}
        {Array.from({ length: 13 }, (_, i) => {
          const x = (i - 6) * 420 + W / 2;
          return <line key={i} x1={W / 2 + (x - W / 2) * 0.12} y1={HORIZON} x2={x} y2={H} stroke={C.dim} strokeWidth={1} opacity={0.18} />;
        })}
        <line x1={0} y1={HORIZON} x2={W} y2={HORIZON} stroke={C.dim} strokeWidth={1} opacity={0.3} />
        {layers}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 70,
  name: "激光扫射",
  group: "特效",
  desc: "三道激光轮流从画外打到地面，击点加速扫进、减速停住、停一会儿闪两下熄灭；光束是亮白芯加彩色外辉，扫过的地方留下一道灼痕，从白热退到橙红再到暗红慢慢冷掉，击点一路喷出带重力的火星",
  tech: "击点轨迹用 smootherstep 加一点上拱；灼痕是逐帧击点连成的小段，按烧上去后过了几帧沿 白→橙→暗红 的 OKLab 色带上色、变细变淡，开始帧按循环折算，末尾的灼痕接着冷到下一圈开头；火星每帧按种子出生，带空气阻力和重力的解析位移，画成短拖尾；SVG 模糊 + screen 叠加",
  frames: FRAMES,
  component: Scene,
};
export default effect;
