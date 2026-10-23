import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 星空先慢慢往前漂，然后猛地加速，星星被拉成越来越长的光线朝镜头冲，峰值时整屏一闪，再减速回到点状星空
const FRAMES = 150;
const TAU = Math.PI * 2;
const CX = W / 2;
const CY = H / 2;
const F = 760; // 焦距：屏幕坐标 = 中心 + F * 世界坐标 / z
const DEPTH = 6000; // 星星在 z ∈ (0, DEPTH] 里循环往前
const LAPS = 6; // 一个循环整片星场往前走几趟 DEPTH（整数，首尾无缝）
const N = 720;
const PEAK = 0.52; // 速度峰值在循环里的位置

// 速度曲线：底速 + 一个两头导数为零的鼓包（cos 窗的四次方，起步缓、冲得猛、收得也缓）
const speedShape = (u: number) => {
  const d = (u - PEAK) / 0.36;
  const bump = Math.abs(d) < 1 ? Math.cos((d * Math.PI) / 2) ** 4 : 0;
  return 0.06 + bump;
};
// 按速度累加出每帧走过的距离，再整体缩放到正好 LAPS 趟 DEPTH
const SUB = 8;
const DIST: number[] = (() => {
  const raw = [0];
  let s = 0;
  for (let f = 0; f < FRAMES; f++) {
    for (let k = 0; k < SUB; k++) s += speedShape((f + (k + 0.5) / SUB) / FRAMES) / SUB;
    raw.push(s);
  }
  return raw.map((v) => (v / s) * DEPTH * LAPS);
})();
const distAt = (fr: number) => {
  const i = Math.floor(fr);
  return DIST[i] + (DIST[i + 1] - DIST[i]) * (fr - i);
};
const PEAK_V = DIST[Math.round(PEAK * FRAMES) + 1] - DIST[Math.round(PEAK * FRAMES)];

const stars = Array.from({ length: N }, (_, i) => {
  // 离中轴至少 90，不然星星一直贴在消失点上
  const a = rand(i * 5 + 1) * TAU;
  const r = 90 + Math.sqrt(rand(i * 5 + 2)) * 2600;
  const tint = rand(i * 5 + 4);
  return {
    x: Math.cos(a) * r * 1.4,
    y: Math.sin(a) * r * 0.9,
    z0: rand(i * 5 + 3) * DEPTH,
    color: tint < 0.18 ? mixColor(C.fg, C.accent, 0.45) : tint < 0.6 ? mixColor(C.fg, C.cool, 0.5) : C.fg,
  };
});

const zAt = (z0: number, d: number) => DEPTH - ((((DEPTH - z0 + d) % DEPTH) + DEPTH) % DEPTH);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  const d = distAt(frame);
  const v = DIST[frame + 1] - DIST[frame]; // 这一帧的速度
  const warp = Math.min(1, v / PEAK_V); // 0–1
  // 拖尾用一小段时间内走过的路：快门 1.6 帧
  const trail = v * 1.6;
  const flash = Math.exp(-(((u - PEAK) / 0.025) ** 2));
  // 峰值附近镜头轻微抖
  const shake = warp ** 3 * 5;
  const sx = shake * (Math.sin(TAU * 37 * u) + 0.5 * Math.sin(TAU * 61 * u));
  const sy = shake * (Math.sin(TAU * 43 * u + 1) + 0.5 * Math.sin(TAU * 71 * u));
  const lines = [];
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    const z = zAt(s.z0, d);
    if (z < 30) continue;
    const zt = Math.min(DEPTH, z + trail);
    const x1 = CX + (F * s.x) / z;
    const y1 = CY + (F * s.y) / z;
    if (x1 < -400 || x1 > W + 400 || y1 < -400 || y1 > H + 400) continue;
    const x0 = CX + (F * s.x) / zt;
    const y0 = CY + (F * s.y) / zt;
    // 远处淡入、太近淡出，换趟的瞬间看不见
    const fade = Math.min(1, (DEPTH - z) / 1200) * Math.min(1, (z - 30) / 120);
    const near = Math.min(1, 900 / z);
    const w = 1 + near * (2.2 + warp * 1.5);
    const color = mixColor(s.color, C.cool, warp * 0.55);
    lines.push(
      <line
        key={i}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1 + 0.01}
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        opacity={fade * (0.35 + 0.65 * near) * (0.75 + 0.25 * warp)}
      />,
    );
  }
  return (
    <Stage bg="#07080C">
      <svg width={W} height={H}>
        <defs>
          <radialGradient id="hs-core" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={mixColor(C.fg, C.cool, 0.25)} stopOpacity={1} />
            <stop offset="0.25" stopColor={C.cool} stopOpacity={0.45} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </radialGradient>
          <filter id="hs-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={4} />
          </filter>
        </defs>
        <g transform={`translate(${sx} ${sy})`}>
          {/* 消失点的蓝白光：速度越快越大越亮 */}
          <ellipse cx={CX} cy={CY} rx={140 + warp * 520} ry={100 + warp * 360} fill="url(#hs-core)" opacity={0.12 + warp * 0.6} />
          <g style={{ mixBlendMode: "screen" }} filter="url(#hs-glow)" opacity={0.25 + warp * 0.5}>
            {lines}
          </g>
          <g style={{ mixBlendMode: "screen" }}>{lines}</g>
        </g>
        <rect width={W} height={H} fill={mixColor(C.fg, C.cool, 0.3)} opacity={flash * 0.35} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 75,
  name: "光速跃迁",
  group: "背景",
  desc: "星空先慢慢往前漂，然后越来越快，星星被拉成长长的光线朝镜头冲，中心泛起蓝白光、镜头轻抖，峰值整屏一闪，再减速回到点状星空",
  tech: "SVG：720 颗星在 3D 里沿 z 往前循环、透视投影；速度是底速加 cos⁴ 鼓包，按帧累加后缩放到正好 6 趟深度（首尾无缝），拖尾长度 = 1.6 帧走过的路；远处淡入、近处淡出；一层 4px 模糊叠 screen 做辉光。创意参考 DavidHDev/react-bits 的 Hyperspeed",
  frames: FRAMES,
  component: Scene,
};
export default effect;
