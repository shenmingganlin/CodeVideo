import { useCurrentFrame } from "remotion";
import { clamp01, colorRamp, ease, lerp, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一张卡片从左下角着火：一圈参差不齐的火边越烧越快地吞过去，火边外面先焦黄，烧过的地方碎成灰屑，
// 被风吹着往右上飘、翻滚、变小、由红变灰；烧光以后卡片从右边一点点重新显出来
const FRAMES = 150;
const TAU = Math.PI * 2;
const CW = 820;
const CH = 560;
const X0 = (W - CW) / 2;
const Y0 = (H - CH) / 2;
const OX = X0 - 40; // 着火点在卡片左下角外面一点
const OY = Y0 + CH + 30;
const IGNITE = 8;
const BURNT = 100; // 这一帧烧完
const RMAX = Math.hypot(X0 + CW - OX, Y0 - OY) + 80;
const BACK0 = 108; // 从右往左重新显出来
const BACK1 = 146;

// 火边的参差：几组正弦叠在一起，固定不随时间变，再加一点很小的抖动
const WAVES = Array.from({ length: 6 }, (_, i) => ({ k: 3 + Math.floor(rand(i * 5 + 1) * 4) * (i + 1), ph: rand(i * 5 + 2) * TAU, amp: 1 / (i + 1.3) }));
const noise = (th: number) => WAVES.reduce((s, w) => s + w.amp * Math.sin(w.k * th + w.ph), 0) / 1.6;

// 火边推进的半径：先慢后快（火越烧越旺）
const radius = (f: number) => lerp(0, RMAX, Math.pow(clamp01((f - IGNITE) / (BURNT - IGNITE)), 1.35));
const edgeR = (th: number, R: number, f: number) => R + noise(th) * 46 + Math.sin(th * 23 + f * 0.9) * 4;

const blobPath = (R: number, f: number, grow = 0) => {
  if (R <= 0) return "";
  const pts: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const th = -Math.PI / 2 + (i / 160) * (Math.PI / 2); // 只要朝右上的四分之一圈就盖住整张卡
    const r = Math.max(0, edgeR(th, R, f) + grow);
    pts.push(`${(OX + Math.cos(th) * r).toFixed(1)},${(OY + Math.sin(th) * r).toFixed(1)}`);
  }
  // 往外绕一圈回到原点，围成扇形
  return `M${OX},${OY} L${pts.join(" L")} Z`;
};

// 灰屑：卡片上撒一片点，火边扫到它的那一帧它就脱落飞走
const ASH = Array.from({ length: 300 }, (_, i) => {
  const r = (j: number) => rand(2000 + i * 19 + j * 7);
  const x = X0 + r(1) * CW;
  const y = Y0 + r(2) * CH;
  const d = Math.hypot(x - OX, y - OY);
  const th = Math.atan2(y - OY, x - OX);
  // 反解火边到达这里的帧
  const R = d - noise(th) * 46;
  const tb = IGNITE + (BURNT - IGNITE) * Math.pow(clamp01(R / RMAX), 1 / 1.35);
  return {
    x, y, tb,
    life: lerp(36, 64, r(3)),
    wind: lerp(2.2, 5, r(4)),
    lift: lerp(0.08, 0.16, r(5)),
    size: lerp(5, 13, r(6)),
    spin: (r(7) - 0.5) * 0.5,
    flip: lerp(0.12, 0.3, r(8)),
    ph: r(9) * TAU,
    shape: [0, 1, 2, 3].map((k) => 0.6 + 0.4 * r(10 + k)),
  };
});

const CardArt: React.FC = () => (
  <>
    <rect x={X0} y={Y0} width={CW} height={CH} rx={18} fill={C.fg} />
    <rect x={X0 + 40} y={Y0 + 40} width={CW - 80} height={300} rx={10} fill={C.cool} />
    <circle cx={X0 + 190} cy={Y0 + 150} r={46} fill={C.accent} />
    <path d={`M${X0 + 40} ${Y0 + 340} L${X0 + 300} ${Y0 + 200} L${X0 + 470} ${Y0 + 300} L${X0 + 580} ${Y0 + 230} L${X0 + CW - 40} ${Y0 + 340} Z`} fill={C.bg2} />
    <rect x={X0 + 40} y={Y0 + 380} width={480} height={34} rx={8} fill={C.dim} />
    <rect x={X0 + 40} y={Y0 + 440} width={640} height={22} rx={6} fill={C.dim} opacity={0.6} />
    <rect x={X0 + 40} y={Y0 + 480} width={560} height={22} rx={6} fill={C.dim} opacity={0.6} />
  </>
);

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const R = radius(f);
  const burning = f >= IGNITE && f < BURNT + 4;
  const back = ease.inOut(clamp01((f - BACK0) / (BACK1 - BACK0)));
  const showCard = f < BURNT + 2 || f >= BACK0;
  // 重新显出来时卡片从右往左展开，边上一条冷色的亮线
  const revealX = lerp(X0 + CW + 60, X0 - 60, back);

  const ash = ASH.map((a, i) => {
    // 灰屑可能跨过循环接缝还在飞，按上一圈的时间也算一遍
    const age = f - a.tb >= 0 ? f - a.tb : f + FRAMES - a.tb;
    if (age < 0 || age > a.life) return null;
    const u = age / a.life;
    // 风往右上吹：先被热气托着往上加速，横向跟着风慢慢起速
    const x = a.x + a.wind * age * (1 - Math.exp(-age / 14)) * 1.6 + Math.sin(age * 0.18 + a.ph) * 14 * u;
    const y = a.y - 0.5 * a.lift * age * age - 2 * age;
    const s = a.size * (1 - 0.75 * u);
    const pts = a.shape.map((k, j) => {
      const ang = (j / 4) * TAU + 0.4;
      return `${(Math.cos(ang) * s * k).toFixed(1)},${(Math.sin(ang) * s * k).toFixed(1)}`;
    });
    return (
      <polygon
        key={i}
        points={pts.join(" ")}
        fill={colorRamp(["#FFE7A6", C.accent, "#7A2E18", C.dim, C.dim], u * 1.25)}
        opacity={Math.pow(1 - u, 1.2) * clamp01(age / 3)}
        transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((a.spin * age * 57.3) % 360).toFixed(1)}) scale(${Math.cos(age * a.flip + a.ph).toFixed(3)} 1)`}
      />
    );
  });

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <clipPath id="burn-card">
            <rect x={X0} y={Y0} width={CW} height={CH} rx={18} />
          </clipPath>
          {/* 卡片还剩下的部分 = 整张 − 烧过的扇形；重新显出时改用从右往左的软边擦除 */}
          <mask id="burn-left">
            {f < BACK0 ? (
              <>
                <rect x={0} y={0} width={W} height={H} fill="white" />
                {R > 0 && <path d={blobPath(R, f)} fill="black" />}
              </>
            ) : (
              <rect x={revealX} y={0} width={W} height={H} fill="url(#burn-soft)" />
            )}
          </mask>
          <linearGradient id="burn-soft" x1="0" x2="1" y1="0" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="black" />
            <stop offset="0.04" stopColor="white" />
          </linearGradient>
          <filter id="burn-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <filter id="burn-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={5} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {showCard && (
          <g mask="url(#burn-left)">
            <CardArt />
            {/* 火边外面一圈焦黄，越靠火边越黑 */}
            {burning && R > 0 && (
              <g clipPath="url(#burn-card)">
                <path d={blobPath(R, f, 70)} fill="#B8742E" opacity={0.45} filter="url(#burn-blur)" />
                <path d={blobPath(R, f, 24)} fill="#3A1D10" opacity={0.85} filter="url(#burn-blur)" />
              </g>
            )}
          </g>
        )}
        {/* 发亮的火边，只画在卡片范围内 */}
        {burning && R > 0 && (
          <g clipPath="url(#burn-card)" filter="url(#burn-glow)">
            <path d={blobPath(R, f)} fill="none" stroke={C.accent} strokeWidth={16} opacity={0.7} />
            <path d={blobPath(R, f)} fill="none" stroke="#FFE7A6" strokeWidth={4} />
          </g>
        )}
        {f >= BACK0 && back < 1 && (
          <rect x={revealX} y={Y0} width={3} height={CH} fill={C.cool} opacity={0.8 * Math.sin(Math.PI * back)} />
        )}
        <g filter="url(#burn-glow)">{ash}</g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 64,
  name: "烧成灰飘散",
  group: "特效",
  desc: "一张卡片从左下角着火，参差不齐的火边越烧越快地吞过去，火边外先焦黄发黑，烧过的地方碎成灰屑，被风吹着往右上飘、翻滚、变小、由红变灰；烧光后卡片从右边重新显出来",
  tech: "SVG mask：卡片减去一个按半径推进的扇形，扇形边缘是 6 组固定正弦叠出的参差边，半径按 t^1.35 越烧越快；焦边是外扩 24/70 像素的同形路径加模糊，火边是两道描边加辉光。300 个灰屑按火边到达的帧反解脱落时间，往上 ½at² 加速、横向随风起速、scaleX = cos 做翻面，颜色按 colorRamp 从黄白到灰。重新显出用软边渐变擦除",
  frames: FRAMES,
  component: Scene,
};
export default effect;
