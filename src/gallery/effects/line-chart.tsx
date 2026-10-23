import { curveMonotoneX, line, scaleLinear } from "d3";
import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 折线从左往右一笔画出来，线头是个亮点，数值标签贴着线头走；
// 画完停一下，线从左往右收掉（尾巴追上线头），线头缩没
const FRAMES = 150;
const DRAW = [10, 84] as const;
const ERASE = [102, 140] as const;
const N = 60;
const DATA = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  return 40 + t * 70 + 16 * Math.sin(t * 9) + 7 * Math.sin(t * 23 + 1);
});

const PAD = { l: 220, r: 200, t: 200, b: 200 };
const x = scaleLinear([0, N - 1], [PAD.l, W - PAD.r]);
const y = scaleLinear([0, 140], [H - PAD.b, PAD.t]);
const path = line<number>((_, i) => x(i), (d) => y(d)).curve(curveMonotoneX);
const D = path(DATA) ?? "";

// 线上第 u（0–1）处的点，在相邻两个数据点之间线性插值
const pointAt = (u: number) => {
  const k = clamp01(u) * (N - 1);
  const i = Math.min(N - 2, Math.floor(k));
  const f = k - i;
  return { x: lerp(x(i), x(i + 1), f), y: y(lerp(DATA[i], DATA[i + 1], f)), v: lerp(DATA[i], DATA[i + 1], f) };
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const head = ease.inOut(clamp01((frame - DRAW[0]) / (DRAW[1] - DRAW[0])));
  const tail = ease.inOut(clamp01((frame - ERASE[0]) / (ERASE[1] - ERASE[0])));
  const p = pointAt(head);
  // 线头在画的时候出现，收线的最后一段缩没
  const dot = clamp01(head * 20) * (1 - clamp01((tail - 0.85) / 0.15));
  const x0 = x(0);
  const x1 = x(N - 1);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          {/* 用横向的裁剪窗决定画到哪：左边是尾巴，右边是线头 */}
          <clipPath id="lc-window">
            <rect x={lerp(x0, x1, tail) - 8} y={0} width={Math.max(0, (x1 - x0) * (head - tail)) + 8} height={H} />
          </clipPath>
        </defs>
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={C.dim} strokeOpacity={0.3} strokeDasharray="4 10" />
            <text x={PAD.l - 30} y={y(t) + 10} textAnchor="end" fill={C.dim} fontFamily={FONT} fontSize={28}>
              {t}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={C.dim} strokeWidth={3} />
        {head - tail > 0.001 ? (
          <g clipPath="url(#lc-window)">
            <path d={`${D} L ${x1} ${H - PAD.b} L ${x0} ${H - PAD.b} Z`} fill={C.cool} opacity={0.12} />
            <path d={D} fill="none" stroke={C.cool} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : null}
        {dot > 0.001 ? (
          <g opacity={dot}>
            <circle cx={p.x} cy={p.y} r={26 * dot} fill={C.accent} opacity={0.25} />
            <circle cx={p.x} cy={p.y} r={11 * dot} fill={C.accent} />
            <rect x={p.x - 70} y={p.y - 96} width={140} height={58} rx={12} fill={C.fg} />
            <text
              x={p.x}
              y={p.y - 55}
              textAnchor="middle"
              fill={C.bg}
              fontFamily={FONT}
              fontSize={32}
              fontWeight={700}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {p.v.toFixed(1)}
            </text>
          </g>
        ) : null}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 21,
  name: "折线一笔画出",
  group: "数据",
  desc: "折线从左往右画出来，线头的亮点带着数值标签一路跟着走；画完停一下，尾巴追上线头把线收掉",
  tech: "d3-scale + d3-shape（curveMonotoneX）只算坐标，SVG 自己画；横向裁剪窗控制画到哪，线头位置按数据点插值；ease.inOut",
  frames: FRAMES,
  component: Effect,
};
export default effect;
