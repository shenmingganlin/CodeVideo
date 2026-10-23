import { Easing, useCurrentFrame } from "remotion";
import { prog, smoothTrack } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 画面中间一颗水滴形的果子，顺着身上那道缝裂成两半、从底部往两边翻开。
// 缝里一直看得见缩小的下一场（同一个构图，换了颜色），镜头以果子中心为支点推进 10 倍，
// 推到头缩小的下一场正好铺满画面。下一场的果子再裂开推回第一场，首尾接上
const FRAMES = 150;
const HALF = FRAMES / 2;
// 每一半：停 → 第 SPLIT 帧裂开 → PUSH 到 THROUGH 推进
const SPLIT = 14;
const PUSH = 30;
const THROUGH = 66;
const Z_END = 10;
const S = 1.6; // 果子的大小
const CENTER = { x: W / 2, y: H / 2 - 20 };
// 两半绕底部转：果子局部坐标里底在 (0, 110)
const PIVOT = { x: CENTER.x, y: CENTER.y + 110 * S };

// 水滴形，尖朝上，原点在中心，y 从 -95 到 110；缝从尖顺着一条弧线到底
const R_HALF = "M 0 -95 L 2 -70 Q 14 15 0 100 L 0 110 A 72 72 0 0 0 72 38 C 72 -5 40 -45 0 -95 Z";
const L_HALF = "M 0 -95 L 2 -70 Q 14 15 0 100 L 0 110 A 72 72 0 0 1 -72 38 C -72 -5 -40 -45 0 -95 Z";
const CUT = "M 0 -95 L 2 -70 Q 14 15 0 100 L 0 110";
// 缝在局部坐标里的折线：尖往上延长到很远，底往下延长到很远（裂开后两条切线中间就是缝）
const SEAM_PTS = [
  { x: 0, y: -40000 },
  { x: 0, y: -95 },
  { x: 2, y: -70 },
  ...Array.from({ length: 12 }, (_, k) => {
    const t = (k + 1) / 12;
    const u = 1 - t;
    return { x: u * u * 2 + 2 * u * t * 14, y: u * u * -70 + 2 * u * t * 15 + t * t * 100 };
  }),
  { x: 0, y: 110 },
];

type Kind = "a" | "b";
const LOOK: Record<Kind, { bg: string; pod: string; dot: string; seam: string }> = {
  a: { bg: C.bg, pod: C.accent, dot: C.dim, seam: C.fg },
  b: { bg: C.cool, pod: C.bg2, dot: C.fg, seam: C.accent },
};

// 一场：底色、两圈慢慢转的点、中间的果子（两半合着就是一整颗）
const Scene: React.FC<{ kind: Kind; frame: number; angle?: number; seeds?: number }> = ({ kind, frame, angle = 0, seeds = 0 }) => {
  const look = LOOK[kind];
  return (
    <g>
      <rect x={-40000} y={-40000} width={80000} height={80000} fill={look.bg} />
      {[
        { r: 330, n: 24, dir: 1 },
        { r: 470, n: 36, dir: -1 },
      ].map(({ r, n, dir }) =>
        Array.from({ length: n }, (_, i) => {
          // 一个循环正好转过一个点的间距，首尾接上
          const a = ((i + (dir * frame) / FRAMES) / n) * Math.PI * 2;
          return <circle key={`${r}-${i}`} cx={CENTER.x + Math.cos(a) * r} cy={CENTER.y + Math.sin(a) * r * 0.62} r={r > 400 ? 6 : 8} fill={look.dot} />;
        }),
      )}
      <Pod kind={kind} angle={angle} seeds={seeds} />
    </g>
  );
};

const Pod: React.FC<{ kind: Kind; angle: number; seeds: number }> = ({ kind, angle, seeds }) => {
  const look = LOOK[kind];
  return (
    <g transform={`translate(${CENTER.x} ${CENTER.y}) scale(${S})`}>
      {[
        { d: R_HALF, dir: 1, ys: [-50, -10, 30, 70] },
        { d: L_HALF, dir: -1, ys: [-30, 10, 50] },
      ].map(({ d, dir, ys }) => (
        <g key={dir} transform={`translate(0 110) rotate(${dir * angle}) translate(0 -110)`}>
          <path d={d} fill={look.pod} />
          {seeds > 0 && ys.map((y, k) => <ellipse key={y} cx={dir * (22 + (k % 2) * 10)} cy={y} rx={9 * seeds} ry={13 * seeds} fill={look.bg} />)}
          <path d={CUT} stroke={look.seam} strokeWidth={5} strokeLinecap="round" fill="none" />
        </g>
      ))}
    </g>
  );
};

// 两半张开的角度：裂开那一下先快后慢，推镜时一路翻到 70°，交接那帧正好停稳
const angleAt = (f: number) =>
  smoothTrack(f, [
    { f: SPLIT, v: 0 },
    { f: SPLIT + 5, v: 10 },
    { f: PUSH, v: 24 },
    { f: THROUGH, v: 70, hold: true },
  ]);
// 推近倍数：按对数匀速，两头慢、中间快
const zoomAt = (f: number) => Math.exp(Math.log(Z_END) * prog(f, PUSH, THROUGH, Easing.bezier(0.6, 0, 0.4, 1)));

// 缝在屏幕上的多边形：右半边的切线转 +θ，左半边的转 -θ，中间夹着的就是缝
const gap = (angle: number, z: number) => {
  const map = (p: { x: number; y: number }, deg: number) => {
    const a = (deg * Math.PI) / 180;
    const lx = p.x;
    const ly = p.y - 110;
    const x = CENTER.x + S * (lx * Math.cos(a) - ly * Math.sin(a));
    const y = PIVOT.y + S * (lx * Math.sin(a) + ly * Math.cos(a));
    return `${(CENTER.x + z * (x - CENTER.x)).toFixed(1)},${(CENTER.y + z * (y - CENTER.y)).toFixed(1)}`;
  };
  const right = SEAM_PTS.map((p) => map(p, angle));
  const left = [...SEAM_PTS].reverse().map((p) => map(p, -angle));
  return [...right, ...left].join(" ");
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const first = frame < HALF;
  const out: Kind = first ? "a" : "b";
  const inc: Kind = first ? "b" : "a";
  const f = frame % HALF;
  if (f < SPLIT || f >= THROUGH) {
    // 停着的时候就是一整场；推到头之后已经是下一场
    return (
      <Stage>
        <svg width={W} height={H}>
          <Scene kind={f < SPLIT ? out : inc} frame={frame} />
        </svg>
      </Stage>
    );
  }
  const angle = angleAt(f);
  const z = zoomAt(f);
  const k = z / Z_END;
  // 以果子中心为支点推近：底部（两半转的轴）被推出画面下方，两半跟着出去
  const push = `translate(${CENTER.x} ${CENTER.y}) scale(${z}) translate(${-CENTER.x} ${-CENTER.y})`;
  const mini = `translate(${CENTER.x} ${CENTER.y}) scale(${k}) translate(${-CENTER.x} ${-CENTER.y})`;
  const seeds = prog(f, SPLIT + 2, SPLIT + 16);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <clipPath id="crack-gap">
            <polygon points={gap(angle, z)} />
          </clipPath>
        </defs>
        <g transform={push}>
          <Scene kind={out} frame={frame} angle={angle} seeds={seeds} />
        </g>
        <g clipPath="url(#crack-gap)">
          <g transform={mini}>
            <Scene kind={inc} frame={frame} />
          </g>
        </g>
        {/* 两半画在缝上面，盖住缝的弧度 */}
        <g transform={push}>
          <Pod kind={out} angle={angle} seeds={seeds} />
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 90,
  name: "推进裂缝换场",
  group: "转场",
  desc: "果子顺着缝裂成两半往两边翻开，缝里是缩小的下一场；镜头推进裂缝 10 倍，推到头正好就是下一场，下一场的果子再裂开推回来",
  tech: "SVG：两半绕底部转 0→70°（smoothTrack），镜头以果子中心为支点按对数推近 10 倍（底部的转轴被推出画面，两半跟着出去）；缝用两条转开的切线围成多边形当 clipPath，缝里的下一场缩小 1/10 放在同一个支点上，推到头逐像素接上",
  frames: FRAMES,
  component: Effect,
};
export default effect;
