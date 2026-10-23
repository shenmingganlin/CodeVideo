import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一张贴纸从右下角被掀起来：折起的那块翻出浅灰的背面，带卷曲的明暗，下面投着影；
// 越揭越快，整张翻走露出底下另一张贴纸；然后同一张贴纸从上面落回来"啪"地贴上，接回开头
const FRAMES = 150;
const S = 600; // 贴纸边长
const X0 = W / 2 - S / 2;
const Y0 = H / 2 - S / 2;
const R = 64; // 圆角
const PEEL0 = 16; // 开始揭
const PEEL1 = 88; // 整张翻走
const DROP0 = 100; // 新贴纸开始落
const LAND = 126; // 贴上
const END_D = 2100; // 揭完时折线离右下角的距离，此时翻过去的那块已整个出画

type P = { x: number; y: number };
const CORNERS: P[] = [
  { x: X0, y: Y0 },
  { x: X0 + S, y: Y0 },
  { x: X0 + S, y: Y0 + S },
  { x: X0, y: Y0 + S },
];
const PIN = CORNERS[2]; // 从右下角揭

// 多边形在半平面 dot(p - m, n) <= 0 里的部分（一条边一条边地裁）
const clipHalf = (poly: P[], m: P, n: P, keepInside: boolean): P[] => {
  const side = (p: P) => ((p.x - m.x) * n.x + (p.y - m.y) * n.y) * (keepInside ? 1 : -1);
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
};
const pts = (poly: P[]) => poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

// 揭的进度：先一点点撬起，后面越来越快（d 关于时间是凸的）
const peelD = (f: number) => {
  const t = clamp01((f - PEEL0) / (PEEL1 - PEEL0));
  return END_D * (0.1 * Math.sin((t * Math.PI) / 2) + 0.9 * t ** 2.2);
};

// 一张贴纸：白边 + 色块 + 大字
const Sticker: React.FC<{ fill: string; ink: string; text: string }> = ({ fill, ink, text }) => (
  <g>
    <rect x={X0} y={Y0} width={S} height={S} rx={R} fill={C.fg} />
    <rect x={X0 + 28} y={Y0 + 28} width={S - 56} height={S - 56} rx={R - 22} fill={fill} />
    <circle cx={X0 + S - 130} cy={Y0 + 130} r={46} fill={ink} opacity={0.25} />
    <text
      x={W / 2}
      y={H / 2 + 100}
      textAnchor="middle"
      fill={ink}
      fontFamily={FONT}
      fontSize={300}
      fontWeight={900}
    >
      {text}
    </text>
  </g>
);

const StickerA: React.FC = () => <Sticker fill={C.accent} ink={C.bg} text="贴" />;
const StickerB: React.FC = () => <Sticker fill={C.cool} ink={C.bg} text="换" />;

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const d = f < PEEL1 ? peelD(f) : END_D;
  // 揭的方向朝左上，边揭边往上偏一点，翻起来那块跟着转
  const ang = ((-137 + 14 * prog(f, PEEL0, PEEL1, ease.inOut)) * Math.PI) / 180;
  const u = { x: Math.cos(ang), y: Math.sin(ang) };
  // 折线：过 m、法向 u；右下角那一侧（dot <= 0 的反面）被翻过去
  const m = { x: PIN.x + u.x * d * 0.5, y: PIN.y + u.y * d * 0.5 };
  const peeling = f >= PEEL0 && f < PEEL1 && d > 0.5;
  const flat = peeling ? clipHalf(CORNERS, m, u, false) : CORNERS; // 还贴着的
  const lifted = peeling ? clipHalf(CORNERS, m, u, true) : []; // 被掀起的（原位置）
  // 沿折线的镜像矩阵：p' = p - 2((p - m)·u)u
  const mx = [1 - 2 * u.x * u.x, -2 * u.x * u.y, -2 * u.x * u.y, 1 - 2 * u.y * u.y];
  const k = 2 * (m.x * u.x + m.y * u.y);
  const mirror = `matrix(${mx[0]} ${mx[1]} ${mx[2]} ${mx[3]} ${k * u.x} ${k * u.y})`;

  // 新贴纸从上面落下：先慢后快地砸下来，带一点转和放大，贴上时压一下
  const fall = clamp01((f - DROP0) / (LAND - DROP0));
  const h = f >= DROP0 && f < LAND ? 1 - fall * fall : 0;
  const press = f >= LAND && f < LAND + 10 ? Math.sin(((f - LAND) / 10) * Math.PI) * 0.025 : 0;
  const dropY = -h * (H / 2 + S);
  const dropScale = 1 + 0.18 * h - press;
  const dropRot = -9 * h;
  const showA = f < PEEL0 || peeling || f >= DROP0;
  const whole = !peeling; // 没在揭的时候整张画

  const lightBack = mixColor(C.fg, C.dim, 0.18);
  const darkBack = mixColor(C.fg, C.dim, 0.75);

  return (
    <Stage bg={C.bg2}>
      <svg width={W} height={H}>
        <defs>
          <filter id="sp-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={18} />
          </filter>
          <clipPath id="sp-flat">
            <polygon points={pts(flat)} />
          </clipPath>
          <clipPath id="sp-lift">
            <polygon points={pts(lifted)} />
          </clipPath>
          {/* 背面的卷曲明暗：贴着折线最暗，往外先亮一道再回到平的浅灰 */}
          <linearGradient
            id="sp-back"
            gradientUnits="userSpaceOnUse"
            x1={m.x}
            y1={m.y}
            x2={m.x - u.x * 260}
            y2={m.y - u.y * 260}
          >
            <stop offset={0} stopColor={darkBack} />
            <stop offset={0.18} stopColor={C.fg} />
            <stop offset={0.45} stopColor={lightBack} />
            <stop offset={1} stopColor={lightBack} />
          </linearGradient>
          {/* 折线这一侧还贴着的部分，靠折线处被翻起的那块压暗 */}
          <linearGradient
            id="sp-crease"
            gradientUnits="userSpaceOnUse"
            x1={m.x}
            y1={m.y}
            x2={m.x + u.x * 140}
            y2={m.y + u.y * 140}
          >
            <stop offset={0} stopColor="#000" stopOpacity={0.45} />
            <stop offset={1} stopColor="#000" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 底下那张，带自己的影子 */}
        <rect x={X0} y={Y0 + 14} width={S} height={S} rx={R} fill="#000" opacity={0.35} filter="url(#sp-soft)" />
        <StickerB />

        {showA && whole ? (
          <g
            transform={`translate(${W / 2} ${H / 2 + dropY}) rotate(${dropRot}) scale(${dropScale}) translate(${-W / 2} ${-H / 2})`}
          >
            {/* 落下来时离得越高影子越大越淡 */}
            {f >= DROP0 ? (
              <rect
                x={X0}
                y={Y0}
                width={S}
                height={S}
                rx={R}
                fill="#000"
                opacity={0.35 * (1 - h)}
                filter="url(#sp-soft)"
                transform={`translate(${30 * h} ${-dropY * 0.5 + 40 * h})`}
              />
            ) : null}
            <StickerA />
          </g>
        ) : null}

        {peeling ? (
          <>
            <g clipPath="url(#sp-flat)">
              <StickerA />
              <rect x={0} y={0} width={W} height={H} fill="url(#sp-crease)" />
            </g>
            {/* 翻起那块投在下面的影子：镜像后的形状往右下偏、模糊 */}
            <g transform={`translate(${-u.x * 26} ${-u.y * 26 + 18})`} opacity={0.45} filter="url(#sp-soft)">
              <g transform={mirror}>
                <rect x={X0} y={Y0} width={S} height={S} rx={R} fill="#000" clipPath="url(#sp-lift)" />
              </g>
            </g>
            {/* 翻过来的背面 */}
            <g transform={mirror}>
              <rect x={X0} y={Y0} width={S} height={S} rx={R} fill="url(#sp-back)" clipPath="url(#sp-lift)" />
            </g>
          </>
        ) : null}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 79,
  name: "贴纸卷角揭开",
  group: "转场",
  desc: "贴纸从右下角被掀起来，翻出带卷曲明暗的背面、下面投着影，越揭越快整张翻走，露出底下另一张；新贴纸再落下来啪地贴上",
  tech: "折线几何：贴纸矩形按折线半平面裁成两块（clipPath 多边形），掀起的那块套沿折线的镜像 matrix 画成背面，背面用沿法向的线性渐变做卷曲高光，镜像形状模糊偏移当投影；折线距离 d∝t^2.2 越揭越快，方向从 -137° 转到 -123°；落下用 1-s² 加速并带转角和缩放；创意参考 DavidHDev/react-bits 的 StickerPeel",
  frames: FRAMES,
  component: Effect,
};
export default effect;
