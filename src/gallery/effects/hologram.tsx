import { useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 地上的投影台往上打光，一道扫描线从下往上扫，扫过的地方出现一个转动的青色线框二十面体和一圈轨道环，
// 带横纹、闪烁和偶尔的横向错位；停一会儿后扫描线从上往下扫回去，把它擦掉
const FRAMES = 150;
const CX = W / 2;
const OY = 450; // 物体中心
const SIZE = 165;
const CAM = 1100; // 透视的视距
const TOP = 170; // 扫描线最高到哪
const BOT = 860; // 投影台的高度
const TAU = Math.PI * 2;

// 扫描线位置：8–58 帧往上扫，108–146 帧扫回来，其余停在底下（全藏）或顶上（全显）
const scanAt = (f: number) => {
  if (f < 58) return BOT - (BOT - TOP) * ease.inOut(clamp01((f - 8) / 50));
  return TOP + (BOT - TOP) * ease.inOut(clamp01((f - 108) / 38));
};
// 扫描线自己亮不亮：只在移动时亮，两头淡入淡出
const scanGlow = (f: number) => {
  const a = clamp01((f - 8) / 50);
  const b = clamp01((f - 108) / 38);
  if (f < 70) return Math.sin(Math.PI * a) ** 0.4;
  return Math.sin(Math.PI * b) ** 0.4;
};

// 二十面体：顶点 (0,±1,±φ) 的循环排列，边长 2 的点对相连
const PHI = (1 + Math.sqrt(5)) / 2;
const VERTS: [number, number, number][] = [];
for (const a of [-1, 1]) for (const b of [-PHI, PHI]) VERTS.push([0, a, b], [a, b, 0], [b, 0, a]);
const EDGES: [number, number][] = [];
for (let i = 0; i < VERTS.length; i++)
  for (let j = i + 1; j < VERTS.length; j++) {
    const [x, y, z] = VERTS[i].map((v, k) => v - VERTS[j][k]);
    if (Math.abs(Math.hypot(x, y, z) - 2) < 1e-6) EDGES.push([i, j]);
  }
const NORM = Math.hypot(1, PHI);

type P = { x: number; y: number; z: number };
const project = (v: [number, number, number], ry: number, rx: number, scale: number): P => {
  const [x0, y0, z0] = v;
  const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
  const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
  const y2 = y0 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y0 * Math.sin(rx) + z1 * Math.cos(rx);
  const s = CAM / (CAM + z2 * scale);
  return { x: CX + x1 * scale * s, y: OY + y2 * scale * s, z: z2 };
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const ph = (frame / FRAMES) * TAU;
  const ry = ph; // 一个循环转一圈
  const rx = 0.42 + 0.12 * Math.sin(ph);
  const scanY = scanAt(frame);
  const shown = clamp01((BOT - scanY) / (BOT - TOP));

  // 闪烁：轻微的高频起伏，偶尔掉一下
  const dip = rand(frame * 7 + 3) < 0.07 ? 0.45 : 1;
  const flicker = (0.86 + 0.08 * Math.sin(frame * 1.9) + 0.06 * Math.sin(frame * 3.7)) * dip;
  // 错位：偶尔一帧一条横带往旁边跳
  const glitch = rand(frame * 13 + 1) < 0.12;
  const gy = TOP + rand(frame * 13 + 2) * (BOT - TOP - 200);
  const gh = 20 + rand(frame * 13 + 4) * 60;
  const gx = (rand(frame * 13 + 5) - 0.5) * 70;
  const jitter = rand(frame * 5 + 9) < 0.15 ? (rand(frame * 5 + 10) - 0.5) * 6 : 0;

  const pts = VERTS.map((v) => project(v.map((c) => c / NORM) as [number, number, number], ry, rx, SIZE));
  const depthOp = (z: number) => 0.35 + 0.65 * clamp01((1 - z) / 2); // 背后的线暗一些
  const ring = Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * TAU;
    return project([Math.cos(a) * 1.75, 0.15 * Math.sin(3 * a + ph), Math.sin(a) * 1.75], -ry * 0.5, rx + 0.12, SIZE);
  });

  const holo = (
    <g transform={`translate(${jitter} 0)`}>
      {EDGES.map(([i, j], k) => {
        const a = pts[i], b = pts[j];
        return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.cool} strokeWidth={3} opacity={depthOp((a.z + b.z) / 2)} />;
      })}
      {pts.map((p, k) => (
        <circle key={k} cx={p.x} cy={p.y} r={5} fill={C.fg} opacity={depthOp(p.z)} />
      ))}
      {ring.slice(0, -1).map((p, k) => {
        const q = ring[k + 1];
        return k % 2 ? null : <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.cool} strokeWidth={2.5} opacity={depthOp(p.z / 1.75) * 0.8} />;
      })}
      {/* 底座一圈刻度环 */}
      <g transform={`translate(${CX} ${OY + SIZE * 1.6}) scale(1 0.28) rotate(${(-ph * 180) / Math.PI})`}>
        <circle r={260} fill="none" stroke={C.cool} strokeWidth={6} strokeDasharray="22 14" opacity={0.7} />
        <circle r={300} fill="none" stroke={C.cool} strokeWidth={3} opacity={0.4} />
      </g>
    </g>
  );

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="hg-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={7} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hg-blur" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
          <linearGradient id="hg-cone" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={C.cool} stopOpacity={0.32} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="hg-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.cool} stopOpacity={0.35} />
            <stop offset="1" stopColor={C.cool} stopOpacity={0} />
          </linearGradient>
          {/* 横纹：6px 一条，慢慢往上爬，一个循环正好爬 10 条 */}
          <pattern id="hg-lines" width={8} height={6} patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${-((frame * 0.4) % 6)})`}>
            <rect width={8} height={2.5} fill={C.bg} />
          </pattern>
          <clipPath id="hg-shown">
            <rect x={0} y={scanY} width={W} height={H} />
          </clipPath>
          <clipPath id="hg-band-clip">
            <rect x={0} y={Math.max(gy, scanY)} width={W} height={gh} />
          </clipPath>
        </defs>
        {/* 投影台和往上的光锥 */}
        <path d={`M${CX - 160} ${BOT} L${CX - 560} ${TOP - 40} L${CX + 560} ${TOP - 40} L${CX + 160} ${BOT} Z`} fill="url(#hg-cone)" opacity={0.25 + 0.75 * shown} />
        <ellipse cx={CX} cy={BOT + 14} rx={190} ry={30} fill={C.bg2} />
        <ellipse cx={CX} cy={BOT} rx={170} ry={24} fill={C.cool} opacity={0.35 + 0.4 * shown} filter="url(#hg-blur)" />
        <ellipse cx={CX} cy={BOT} rx={150} ry={18} fill="none" stroke={C.cool} strokeWidth={3} opacity={0.8} />

        <g clipPath="url(#hg-shown)" opacity={flicker}>
          <g filter="url(#hg-glow)">{holo}</g>
          {glitch && (
            <g clipPath="url(#hg-band-clip)" transform={`translate(${gx} 0)`} opacity={0.8}>
              {holo}
            </g>
          )}
          <rect x={CX - 600} y={TOP - 40} width={1200} height={BOT - TOP + 40} fill="url(#hg-lines)" opacity={0.55} />
        </g>

        {/* 扫描线：亮线 + 下面一段刚扫出来的余光 */}
        <g opacity={scanGlow(frame)}>
          <rect x={CX - 560} y={scanY} width={1120} height={90} fill="url(#hg-band)" />
          <line x1={CX - 560} x2={CX + 560} y1={scanY} y2={scanY} stroke={C.cool} strokeWidth={14} filter="url(#hg-blur)" />
          <line x1={CX - 560} x2={CX + 560} y1={scanY} y2={scanY} stroke="#FFFFFF" strokeWidth={2.5} />
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 58,
  name: "全息投影扫描",
  group: "特效",
  desc: "地上的投影台往上打光，一道扫描线从下往上扫，扫过的地方出现一个转动的青色线框二十面体和一圈轨道环，带横纹、闪烁和偶尔的横向错位；停一会儿后扫描线从上往下扫回去把它擦掉",
  tech: "二十面体 12 个顶点手算透视投影（绕 Y 一圈/循环，X 轴微摆），背面的线按深度调暗；显示范围是扫描线以下的 clipPath；横纹用 SVG pattern，每循环爬整数条；错位是同一组图形裁一条横带横移叠上去；闪烁和错位用按帧号的确定性随机",
  frames: FRAMES,
  component: Scene,
};
export default effect;
