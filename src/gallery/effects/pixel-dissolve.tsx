import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, ease, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 画面 A 碎成一格格方块，从中心往外、带一点云团状的乱序一格格消失：每格先亮一下再加速缩没，
// 边缩边往上飘一点，露出底下的画面 B；停一会儿，B 再从外往里溶回 A
const FRAMES = 150;
const CELL = 40;
const COLS = W / CELL;
const ROWS = Math.ceil(H / CELL);
const SPAN = 30; // 整屏溶完用几帧（最后一格的起点）
const DUR = 11; // 每格缩没用几帧
const P1 = 18; // A → B
const P2 = 92; // B → A

// 粗格子上的值噪声，双线性 + smoothstep 插值，让消失的顺序成团而不是撒盐
const NX = 7;
const NY = 5;
const lattice = Array.from({ length: (NX + 1) * (NY + 1) }, (_, i) => rand(i * 19 + 7));
const noise = (u: number, v: number) => {
  const x = u * NX;
  const y = v * NY;
  const i = Math.min(NX - 1, Math.floor(x));
  const j = Math.min(NY - 1, Math.floor(y));
  const sx = (x - i) ** 2 * (3 - 2 * (x - i));
  const sy = (y - j) ** 2 * (3 - 2 * (y - j));
  const g = (a: number, b: number) => lattice[b * (NX + 1) + a];
  const top = g(i, j) + (g(i + 1, j) - g(i, j)) * sx;
  const bot = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * sx;
  return top + (bot - top) * sy;
};

const MAXD = Math.hypot(W / 2, H / 2);
const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
  const c = n % COLS;
  const r = Math.floor(n / COLS);
  const x = c * CELL;
  const y = r * CELL;
  const d = Math.hypot(x + CELL / 2 - W / 2, y + CELL / 2 - H / 2) / MAXD;
  const nz = noise((x + CELL / 2) / W, (y + CELL / 2) / H);
  const jitter = rand(n * 3 + 1) * 0.08;
  return {
    x,
    y,
    out: clamp01(0.62 * d + 0.38 * nz + jitter - 0.04), // 从中心往外
    in: clamp01(0.62 * (1 - d) + 0.38 * (1 - nz) + jitter - 0.04), // 从外往里
  };
});

const SceneA: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H}>
      {[420, 330, 240, 150].map((r, i) => (
        <circle key={r} cx={W / 2} cy={H / 2} r={r} fill="none" stroke={i % 2 ? C.fg : C.accent} strokeWidth={34} />
      ))}
      <circle cx={W / 2} cy={H / 2} r={70} fill={C.accent} />
      <text x={120} y={150} fill={C.fg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        01
      </text>
    </svg>
  </AbsoluteFill>
);

const SceneB: React.FC = () => (
  <AbsoluteFill style={{ background: C.cool }}>
    <svg width={W} height={H}>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={-200 + i * 260} y={-200} width={110} height={H + 400} fill={C.bg2} opacity={0.18} transform={`rotate(20 ${W / 2} ${H / 2})`} />
      ))}
      <rect x={W / 2 - 260} y={H / 2 - 260} width={520} height={520} rx={60} fill={C.bg} transform={`rotate(12 ${W / 2} ${H / 2})`} />
      <rect x={W / 2 - 120} y={H / 2 - 120} width={240} height={240} rx={30} fill={C.fg} transform={`rotate(12 ${W / 2} ${H / 2})`} />
      <text x={120} y={150} fill={C.bg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        02
      </text>
    </svg>
  </AbsoluteFill>
);

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  // 前半 A 在上面被溶掉，后半 B 在上面被溶掉
  const second = f >= (P1 + SPAN + DUR + P2) / 2;
  const P = second ? P2 : P1;
  const Top = second ? SceneB : SceneA;
  const Bottom = second ? SceneA : SceneB;

  const live = cells.map((c) => {
    const start = P + (second ? c.in : c.out) * SPAN;
    const p = clamp01((f - start) / DUR);
    return { ...c, p, s: 1 - ease.in(p) };
  });
  const box = (c: (typeof live)[number]) => {
    const z = CELL * c.s;
    return { x: c.x + (CELL - z) / 2, y: c.y + (CELL - z) / 2 - 8 * c.p, z };
  };
  const clip = live
    .filter((c) => c.s > 0.001)
    .map((c) => {
      const b = box(c);
      return `M${b.x.toFixed(1)} ${b.y.toFixed(1)}h${b.z.toFixed(1)}v${b.z.toFixed(1)}h${(-b.z).toFixed(1)}Z`;
    })
    .join("");

  return (
    <Stage>
      <Bottom />
      {/* 还在的格子拼成一条多子路径，用 clip-path 只露出上面那张的这些格子 */}
      {clip ? (
        <AbsoluteFill style={{ clipPath: live.every((c) => c.p <= 0) ? undefined : `path("${clip}")` }}>
          <Top />
        </AbsoluteFill>
      ) : null}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* 正在缩的格子先亮一下 */}
        {live.map((c, n) =>
          c.p <= 0 || c.p >= 1 ? null : (
            <rect
              key={n}
              x={box(c).x}
              y={box(c).y}
              width={box(c).z}
              height={box(c).z}
              fill={C.fg}
              opacity={(0.55 * Math.sin(Math.PI * Math.min(1, c.p * 1.6))).toFixed(3)}
            />
          ),
        )}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 81,
  name: "像素溶解",
  group: "转场",
  desc: "画面碎成一格格方块，从中心往外成团地消失，每格先亮一下再加速缩没、往上飘一点，露出下一张；停一会儿再从外往里溶回来",
  tech: "48×27 个 40px 格子拼成一条多子路径的 CSS clip-path，每格的起点 = 0.62×到中心距离 + 0.38×值噪声（7×5 粗格双线性）+ 抖动，30 帧溶完、每格 11 帧 ease.in 缩没并上飘 8px，缩的过程叠一层白色闪亮；回程用反向距离从外往里；创意参考 vivmagarwal/remotion-effects-library 的 Pixel Dissolve Reveal 和 DavidHDev/react-bits 的 PixelTransition",
  frames: FRAMES,
  component: Effect,
};
export default effect;
