import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, rand } from "../../shared/motion/motion";
import { C, H, W, Stage, type GalleryEffect } from "../kit";

// 一块玻璃板被敲了一下：击点一闪，蛛网裂纹一根根飞快地放射出去，再连成一圈圈环纹；停一拍，
// 整块碎成几十片，从击点附近开始往外崩、往下掉，各自在空中翻转、边上闪光；落干净后新的一块淡回原位
const FRAMES = 150;
const PW = 1000;
const PH = 620;
const PX = (W - PW) / 2;
const PY = (H - PH) / 2;
const P = { x: PX + PW * 0.58, y: PY + PH * 0.42 }; // 击点
const HIT = 10;
const CRACK1 = 26; // 裂纹长完
const BREAK = 40; // 碎开
const BACK0 = 112;
const BACK1 = 140;
const N = 14; // 放射裂纹根数
const RINGS = [0.18, 0.4, 0.66];
const GRAV = 0.9;
const TAU = Math.PI * 2;

type Pt = { x: number; y: number };

// 从击点朝 th 方向射到板边的距离
const toEdge = (th: number) => {
  const c = Math.cos(th), s = Math.sin(th);
  const tx = c > 0 ? (PX + PW - P.x) / c : c < 0 ? (PX - P.x) / c : Infinity;
  const ty = s > 0 ? (PY + PH - P.y) / s : s < 0 ? (PY - P.y) / s : Infinity;
  return Math.min(tx, ty);
};

const THETA = Array.from({ length: N }, (_, i) => ((i + 0.5 + (rand(i * 3 + 1) - 0.5) * 0.55) / N) * TAU);
const EDGE = THETA.map(toEdge);
// 每根放射裂纹在每道环上的点（带一点横向抖动），最后一个点落在板边上
const RAY: Pt[][] = THETA.map((th, i) => {
  const pts: Pt[] = [P];
  RINGS.forEach((g, j) => {
    const r = EDGE[i] * (g + (rand(i * 41 + j * 5) - 0.5) * 0.06);
    const side = (rand(i * 41 + j * 5 + 2) - 0.5) * 0.08;
    pts.push({ x: P.x + Math.cos(th + side) * r, y: P.y + Math.sin(th + side) * r });
  });
  pts.push({ x: P.x + Math.cos(th) * EDGE[i], y: P.y + Math.sin(th) * EDGE[i] });
  return pts;
});

// 两根放射裂纹之间、板边上要补上的板角
const CORNERS: Pt[] = [
  { x: PX, y: PY }, { x: PX + PW, y: PY }, { x: PX + PW, y: PY + PH }, { x: PX, y: PY + PH },
];
const angOf = (p: Pt) => (Math.atan2(p.y - P.y, p.x - P.x) + TAU) % TAU;
const cornersBetween = (a: number, b: number) => {
  const span = (b - a + TAU) % TAU;
  return CORNERS.map((c) => ({ c, d: (angOf(c) - a + TAU) % TAU })).filter((o) => o.d > 0 && o.d < span).sort((u, v) => u.d - v.d).map((o) => o.c);
};

// 碎片：相邻两根放射裂纹 × 相邻两道环围成一块；最外一圈连到板边
type Piece = { poly: Pt[]; c: Pt; band: number; delay: number; v: Pt; vz: number; spin: number[] };
const PIECES: Piece[] = [];
for (let i = 0; i < N; i++) {
  const a = RAY[i], b = RAY[(i + 1) % N];
  for (let j = 0; j <= RINGS.length; j++) {
    let poly: Pt[];
    if (j === 0) poly = [P, a[1], b[1]];
    else if (j < RINGS.length) poly = [a[j], a[j + 1], b[j + 1], b[j]];
    else poly = [a[j], a[j + 1], ...cornersBetween(THETA[i], THETA[(i + 1) % N]), b[j + 1], b[j]];
    const c = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
    const seed = i * 97 + j * 13;
    const dir = Math.atan2(c.y - P.y, c.x - P.x);
    const kick = (4.2 - j * 0.8) * (0.7 + 0.6 * rand(seed + 1));
    PIECES.push({
      poly, c, band: j,
      delay: j * 3 + rand(seed + 2) * 3,
      v: { x: Math.cos(dir) * kick, y: Math.sin(dir) * kick - 3 - rand(seed + 3) * 3 },
      vz: (6 - j) * (0.6 + 0.8 * rand(seed + 4)),
      spin: [(rand(seed + 5) - 0.5) * 9, (rand(seed + 6) - 0.5) * 9, (rand(seed + 7) - 0.5) * 5],
    });
  }
}

// 小碎渣：碎开那一下从裂纹上崩出来
const CHIPS = Array.from({ length: 60 }, (_, i) => {
  const r = (k: number) => rand(5000 + i * 11 + k);
  const ray = RAY[Math.floor(r(1) * N)];
  const p = ray[1 + Math.floor(r(2) * RINGS.length)];
  const dir = Math.atan2(p.y - P.y, p.x - P.x) + (r(3) - 0.5) * 0.8;
  const sp = 5 + r(4) * 9;
  return { p, v: { x: Math.cos(dir) * sp, y: Math.sin(dir) * sp - 4 }, s: 3 + r(5) * 5, rot: r(6) * 360, spin: (r(7) - 0.5) * 30, ph: r(8) * TAU };
});

const ptsStr = (poly: Pt[]) => poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const segLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.y - pts[k].y), 0);

// 玻璃板本身：半透明冷色、一道斜高光、中间两个字。用全画面坐标，碎片按自己的 viewBox 裁出来
const PaneArt: React.FC = () => (
  <>
    <rect x={PX} y={PY} width={PW} height={PH} fill={C.cool} opacity={0.16} />
    <rect x={PX} y={PY} width={PW} height={PH} fill="url(#gs-sheen)" />
    <text x={PX + PW / 2} y={PY + PH / 2 + 70} textAnchor="middle" fontSize={210} fontWeight={800} fill={C.fg} opacity={0.88}>
      易碎
    </text>
    <rect x={PX + 1.5} y={PY + 1.5} width={PW - 3} height={PH - 3} fill="none" stroke={C.fg} strokeOpacity={0.5} strokeWidth={3} />
  </>
);

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const hit = f - HIT;
  // 敲中时板子震一下，衰减振动
  const shake = hit >= 0 && f < BREAK ? Math.exp(-hit / 5) * Math.sin(hit * 2.6) * 7 : 0;
  const back = ease.out(clamp01((f - BACK0) / (BACK1 - BACK0)));
  const intact = f < BREAK || f >= BACK0;

  // 裂纹：每根放射裂纹在 HIT..CRACK1 内错开着长出来，先快后慢
  const crackLines: React.ReactNode[] = [];
  if (f >= HIT && f < BREAK) {
    RAY.forEach((ray, i) => {
      const t0 = HIT + rand(i * 7 + 300) * 4;
      const p = ease.out(clamp01((f - t0) / (CRACK1 - t0 - 2)));
      const L = segLen(ray);
      crackLines.push(
        <polyline key={`r${i}`} points={ptsStr(ray)} fill="none" stroke={C.fg} strokeWidth={2.4} strokeDasharray={`${L} ${L}`} strokeDashoffset={L * (1 - p)} />,
      );
      // 环纹：两根放射裂纹都长过这道环以后才连上
      RINGS.forEach((g, j) => {
        const a = ray[j + 1], b = RAY[(i + 1) % N][j + 1];
        const need = g + 0.08;
        const q = clamp01((p - need) / 0.18);
        if (q <= 0) return;
        const m = { x: (a.x + b.x) / 2 + (rand(i * 9 + j) - 0.5) * 18, y: (a.y + b.y) / 2 + (rand(i * 9 + j + 50) - 0.5) * 18 };
        const pts = [a, m, b];
        const l = segLen(pts);
        crackLines.push(
          <polyline key={`g${i}-${j}`} points={ptsStr(pts)} fill="none" stroke={C.fg} strokeWidth={1.6} opacity={0.85} strokeDasharray={`${l} ${l}`} strokeDashoffset={l * (1 - ease.out(q))} />,
        );
      });
    });
  }

  const flash = hit >= 0 && hit < 10 ? 1 - hit / 10 : 0;
  const bt = f - BREAK;

  return (
    <Stage>
      {/* 背后一层格子，透过玻璃看得见 */}
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <pattern id="gs-grid" width={60} height={60} patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke={C.bg2} strokeWidth={2} />
          </pattern>
          <linearGradient id="gs-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.25" stopColor={C.fg} stopOpacity={0} />
            <stop offset="0.36" stopColor={C.fg} stopOpacity={0.22} />
            <stop offset="0.42" stopColor={C.fg} stopOpacity={0} />
            <stop offset="0.5" stopColor={C.fg} stopOpacity={0.1} />
            <stop offset="0.55" stopColor={C.fg} stopOpacity={0} />
          </linearGradient>
          <radialGradient id="gs-flash">
            <stop offset="0" stopColor="white" stopOpacity={1} />
            <stop offset="1" stopColor="white" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#gs-grid)" />
      </svg>

      {intact && (
        <svg
          width={W}
          height={H}
          style={{
            position: "absolute",
            opacity: f >= BACK0 ? back : 1,
            transform: f >= BACK0 ? `translateY(${(1 - back) * -30}px) scale(${lerp(0.97, 1, back)})` : `translateX(${shake}px)`,
          }}
        >
          <PaneArt />
          {crackLines}
          {f >= HIT && f < BREAK && (
            <>
              {Array.from({ length: 6 }, (_, k) => {
                const a = (k / 6) * TAU + 0.3;
                return <line key={k} x1={P.x} y1={P.y} x2={P.x + Math.cos(a) * 26} y2={P.y + Math.sin(a) * 26} stroke={C.fg} strokeWidth={2} />;
              })}
            </>
          )}
        </svg>
      )}

      {/* 碎片：每片一个 div，按自己的形心在 3D 里翻；内容是同一块玻璃按碎片的包围盒裁出来 */}
      {!intact &&
        PIECES.map((pc, k) => {
          const t = Math.max(0, bt - pc.delay);
          const xs = pc.poly.map((p) => p.x), ys = pc.poly.map((p) => p.y);
          const x0 = Math.min(...xs) - 2, y0 = Math.min(...ys) - 2;
          const bw = Math.max(...xs) - x0 + 2, bh = Math.max(...ys) - y0 + 2;
          // 裂开前一两帧先沿裂纹错开一点点，再往下掉
          const dx = pc.v.x * t * (1 - Math.exp(-t / 30)) * 1.4 + (bt >= 0 ? (pc.c.x - P.x) * 0.012 : 0);
          const dy = pc.v.y * t + 0.5 * GRAV * t * t + (bt >= 0 ? (pc.c.y - P.y) * 0.012 : 0);
          const dz = pc.vz * t * 1.3;
          if (pc.c.y + dy > H + 500) return null;
          const rx = pc.spin[0] * t, ry = pc.spin[1] * t, rz = pc.spin[2] * t;
          // 翻到某个角度时边上闪一下
          const glint = Math.pow(Math.max(0, Math.cos(((rx + ry) * Math.PI) / 180 * 1.3)), 8) * clamp01(t / 4);
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: x0,
                top: y0,
                width: bw,
                height: bh,
                transformOrigin: `${pc.c.x - x0}px ${pc.c.y - y0}px`,
                transform: `perspective(1400px) translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, ${dz.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`,
              }}
            >
              <svg width={bw} height={bh} viewBox={`${x0} ${y0} ${bw} ${bh}`}>
                <defs>
                  <clipPath id={`gs-c${k}`}>
                    <polygon points={ptsStr(pc.poly)} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#gs-c${k})`}>
                  <PaneArt />
                  <polygon points={ptsStr(pc.poly)} fill={C.fg} opacity={0.35 * glint} />
                </g>
                <polygon points={ptsStr(pc.poly)} fill="none" stroke={C.fg} strokeWidth={2} strokeOpacity={0.45 + 0.55 * glint} strokeLinejoin="round" />
              </svg>
            </div>
          );
        })}

      <svg width={W} height={H} style={{ position: "absolute", pointerEvents: "none" }}>
        {flash > 0 && <circle cx={P.x} cy={P.y} r={40 + (1 - flash) * 140} fill="url(#gs-flash)" opacity={flash * 0.9} />}
        {bt >= 0 &&
          bt < 46 &&
          CHIPS.map((ch, i) => {
            const x = ch.p.x + ch.v.x * bt;
            const y = ch.p.y + ch.v.y * bt + 0.5 * GRAV * bt * bt;
            const tw = 0.5 + 0.5 * Math.cos(bt * 0.9 + ch.ph);
            return (
              <polygon
                key={i}
                points={`0,${-ch.s} ${ch.s * 0.8},${ch.s * 0.6} ${-ch.s * 0.7},${ch.s * 0.5}`}
                fill={C.fg}
                opacity={(1 - bt / 46) * (0.35 + 0.65 * tw)}
                transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(ch.rot + ch.spin * bt).toFixed(1)})`}
              />
            );
          })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 63,
  name: "玻璃碎裂",
  group: "特效",
  desc: "一块玻璃板被敲中，击点一闪、板子一震，蛛网裂纹一根根放射出去再连成环纹；停一拍后碎成几十片，从击点附近开始崩开往下掉，各自在空中翻转、边上闪光，落干净后新的一块淡回原位",
  tech: "14 根放射裂纹 × 3 道环围出 56 片多边形（最外圈补上板角），裂纹用 strokeDashoffset 错开着长出；每片一个 div 用 perspective + translate3d + rotateX/Y/Z 绕形心翻，内容是同一块玻璃 SVG 按包围盒 viewBox 加 clipPath 裁出；位移按初速 + ½gt²，内圈先崩外圈后掉，闪光按翻转角的 cos⁸。击中时衰减振动 e^{−t/5}·sin",
  frames: FRAMES,
  component: Scene,
};
export default effect;
