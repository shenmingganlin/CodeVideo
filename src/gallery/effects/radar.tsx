import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 圆形雷达屏：扫描线带着一片扇形余辉匀速转，一个循环转两圈；扫到的目标点一下亮起、外面爆一个小圈，
// 然后慢慢暗下去，等下一圈再被点亮。目标在循环里各自绕小圈漂移，屏上显示的是它上次被扫到时的位置
const FRAMES = 120;
const TURN = 60; // 转一圈的帧数，循环里正好两圈
const CX = W / 2;
const CY = H / 2;
const R = 420;
// 雷达屏偏青绿：C.cool 往绿里调了一半。写成 hex，扇形渐变要在后面拼透明度
const GREEN = "#68D6C2";

// 角度从正上方起、顺时针，单位是圈（0–1）
const sweepAt = (f: number) => f / TURN;

// 目标：初始位置（极坐标）、漂移小圈的半径和圈数（整数，才能在循环里回到原位）
const TARGETS = Array.from({ length: 9 }, (_, i) => ({
  a: rand(i * 31 + 3),
  r: 0.22 + rand(i * 31 + 5) * 0.68,
  drift: 14 + rand(i * 31 + 7) * 30,
  laps: rand(i * 31 + 9) < 0.5 ? 1 : -1,
  ph: rand(i * 31 + 11) * Math.PI * 2,
  big: rand(i * 31 + 13) < 0.3,
}));

const targetPos = (t: (typeof TARGETS)[number], f: number) => {
  const th = t.a * Math.PI * 2;
  const bx = CX + Math.sin(th) * t.r * R;
  const by = CY - Math.cos(th) * t.r * R;
  const ph = t.ph + (t.laps * f * Math.PI * 2) / FRAMES;
  return { x: bx + Math.cos(ph) * t.drift, y: by + Math.sin(ph) * t.drift * 0.7 };
};

// 上次被扫到是几帧前：扫描线的角度减去目标角度，取模到一圈
const ageOf = (angle: number, f: number) => {
  const d = (((sweepAt(f) - angle) % 1) + 1) % 1;
  return d * TURN;
};

// 底噪杂波：一圈圈固定的小点，扫过时微微亮
const CLUTTER = Array.from({ length: 160 }, (_, i) => {
  const a = rand(i * 7 + 101);
  const r = Math.sqrt(rand(i * 7 + 103)) * 0.96;
  return { a, x: CX + Math.sin(a * Math.PI * 2) * r * R, y: CY - Math.cos(a * Math.PI * 2) * r * R, s: 1 + rand(i * 7 + 105) * 2 };
});

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const deg = sweepAt(f) * 360;
  const rings = [0.25, 0.5, 0.75, 1];
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <Stage>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="rd-screen">
            <stop offset="0%" stopColor={mixColor(C.bg2, GREEN, 0.12)} />
            <stop offset="100%" stopColor={C.bg} />
          </radialGradient>
          <filter id="rd-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <circle cx={CX} cy={CY} r={R + 26} fill="none" stroke={C.dim} strokeWidth={3} />
        <circle cx={CX} cy={CY} r={R} fill="url(#rd-screen)" />
        {rings.map((k) => (
          <circle key={k} cx={CX} cy={CY} r={R * k} fill="none" stroke={GREEN} strokeOpacity={0.22} strokeWidth={2} />
        ))}
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke={GREEN} strokeOpacity={0.18} strokeWidth={2} />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke={GREEN} strokeOpacity={0.18} strokeWidth={2} />
        {ticks.map((t) => {
          const long = t % 30 === 0;
          const a = (t * Math.PI) / 180;
          const r0 = R + (long ? 4 : 10);
          return (
            <line
              key={t}
              x1={CX + Math.sin(a) * r0}
              y1={CY - Math.cos(a) * r0}
              x2={CX + Math.sin(a) * (R + 22)}
              y2={CY - Math.cos(a) * (R + 22)}
              stroke={C.dim}
              strokeWidth={long ? 3 : 2}
            />
          );
        })}
        {ticks
          .filter((t) => t % 30 === 0)
          .map((t) => {
            const a = (t * Math.PI) / 180;
            return (
              <text
                key={t}
                x={CX + Math.sin(a) * (R + 62)}
                y={CY - Math.cos(a) * (R + 62) + 10}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={26}
                fill={C.dim}
              >
                {String(t).padStart(3, "0")}
              </text>
            );
          })}
      </svg>
      {/* 扇形余辉：圆锥渐变从扫描线往回 70° 由亮到暗，整块跟着扫描角转 */}
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: CY - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          background: `conic-gradient(from ${deg - 70}deg, transparent 0deg, ${GREEN}10 30deg, ${GREEN}38 60deg, ${GREEN}66 70deg, transparent 70.2deg)`,
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute" }}>
        {CLUTTER.map((c, i) => {
          const age = ageOf(c.a, f);
          const lit = Math.exp(-age / 14);
          return <circle key={i} cx={c.x} cy={c.y} r={c.s} fill={GREEN} opacity={0.06 + 0.3 * lit} />;
        })}
        {/* 扫描线本身：一条亮线加辉光 */}
        <g transform={`rotate(${deg.toFixed(3)} ${CX} ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R} stroke={GREEN} strokeWidth={10} opacity={0.5} filter="url(#rd-glow)" />
          <line x1={CX} y1={CY} x2={CX} y2={CY - R} stroke={mixColor(GREEN, "#FFFFFF", 0.5)} strokeWidth={3} />
        </g>
        {TARGETS.map((t, i) => {
          const age = ageOf(t.a, f);
          // 显示的是被扫到那一刻的位置：扫过之后点停在原地，下一圈才跳到新位置
          const seen = targetPos(t, f - age);
          // 扫到那一下几乎是瞬间亮，再按指数慢慢衰减；最后几帧压到 0，下一次点亮前已经完全暗了
          const glow = Math.exp(-age / 22) * Math.min(1, (TURN - age) / 4);
          const ping = Math.min(1, age / 16);
          const size = t.big ? 13 : 9;
          return (
            <g key={i}>
              {age < 16 ? (
                <circle
                  cx={seen.x}
                  cy={seen.y}
                  r={size + ping * 46}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth={3 * (1 - ping) + 0.5}
                  opacity={(1 - ping) * 0.9}
                />
              ) : null}
              <circle cx={seen.x} cy={seen.y} r={size * 2.6} fill={GREEN} opacity={0.5 * glow} filter="url(#rd-glow)" />
              <circle cx={seen.x} cy={seen.y} r={size} fill={mixColor(GREEN, "#FFFFFF", 0.5 * glow)} opacity={0.12 + 0.88 * glow} />
              {t.big ? (
                <text x={seen.x + 24} y={seen.y - 18} fontFamily={FONT} fontSize={22} fill={GREEN} opacity={0.85 * glow}>
                  {`T${String(i + 1).padStart(2, "0")}  ${Math.round(t.r * 120)}km`}
                </text>
              ) : null}
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={7} fill={GREEN} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 84,
  name: "雷达扫描",
  group: "数据",
  desc: "圆形雷达屏上扫描线拖着一片扇形余辉转圈，扫到的目标点一下亮起、爆一个小圈，再慢慢暗下去，等下一圈重新点亮；目标在屏上缓缓漂移",
  tech: "conic-gradient 画扇形余辉跟着扫描角转；目标亮度 = exp(-距上次被扫到的帧数/22)，位置取被扫到那一刻的漂移位置；转一圈 60 帧，循环两圈。创意参考 DavidHDev/react-bits 的 Radar",
  frames: FRAMES,
  component: Effect,
};
export default effect;
