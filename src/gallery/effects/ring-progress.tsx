import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 四圈同心环形进度条从外到内错开长出来，冲过头一点再回稳，端点是圆头、带一点光；
// 中间的大数字跟着最外圈滚到 86%，右边的图例一行行滑进来、数字一起滚；停一会儿，环从内到外倒着收回去
const FRAMES = 150;
const CX = 760;
const CY = H / 2;
const RINGS = [
  { name: "完成度", v: 86, r: 360, color: C.accent },
  { name: "覆盖率", v: 72, r: 290, color: C.cool },
  { name: "满意度", v: 58, r: 220, color: mixColor(C.accent, C.fg, 0.45) },
  { name: "留存率", v: 41, r: 150, color: mixColor(C.cool, C.fg, 0.45) },
];
const SW = 44; // 环宽
const GROW0 = 8; // 第一圈开始长
const STAGGER = 9; // 一圈比一圈晚几帧
const BACK0 = 104; // 开始收（最内圈先收）
const BACK1 = 140;

// 欠阻尼弹簧，起步速度 0：第一个峰约 1.06，几乎不再回弹第二次
const settle = (t: number) => {
  if (t <= 0) return 0;
  const k = 0.13;
  const w = 0.17;
  return 1 - Math.exp(-k * t) * (Math.cos(w * t) + (k / w) * Math.sin(w * t));
};

// 第 i 圈现在的读数（0–100）：长出来用弹簧，收回去用 inOut，内圈先收
const valueAt = (i: number, f: number) => {
  const grow = settle(f - (GROW0 + i * STAGGER));
  const j = RINGS.length - 1 - i;
  const span = (BACK1 - BACK0) * 0.55;
  const back = prog(f, BACK0 + j * ((BACK1 - BACK0 - span) / 3), BACK0 + j * ((BACK1 - BACK0 - span) / 3) + span, ease.inOut);
  return RINGS[i].v * grow * (1 - back);
};

// 从正上方起顺时针的一段圆弧
const arcPath = (r: number, v: number) => {
  const a = (Math.min(v, 99.99) / 100) * Math.PI * 2;
  const x = CX + Math.sin(a) * r;
  const y = CY - Math.cos(a) * r;
  return `M ${CX} ${CY - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
};

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const vals = RINGS.map((_, i) => valueAt(i, f));
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="rp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        {RINGS.map((ring, i) => {
          const v = vals[i];
          const a = (v / 100) * Math.PI * 2;
          const tip = { x: CX + Math.sin(a) * ring.r, y: CY - Math.cos(a) * ring.r };
          // 读数很小时圆头会剩一个点：前 1.5 个百分点里线宽跟着长出来，不是一个点凭空冒出来
          const grow = clamp01(v / 1.5);
          return (
            <g key={ring.name}>
              <circle cx={CX} cy={CY} r={ring.r} fill="none" stroke={C.bg2} strokeWidth={SW} />
              {v > 0.02 ? (
                <>
                  <path
                    d={arcPath(ring.r, v)}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={SW * grow}
                    strokeLinecap="round"
                  />
                  <circle cx={tip.x} cy={tip.y} r={(SW / 2) * grow} fill={ring.color} opacity={0.6} filter="url(#rp-glow)" />
                  <circle cx={tip.x} cy={tip.y} r={(SW / 2 - 9) * grow} fill={mixColor(ring.color, "#FFFFFF", 0.45)} opacity={0.7} />
                </>
              ) : null}
            </g>
          );
        })}
        <text x={CX} y={CY + 34} textAnchor="middle" fontFamily={FONT} fontSize={124} fontWeight={800} fill={C.fg}>
          {Math.round(vals[0])}
          <tspan fontSize={60} dx={6} fill={C.dim}>
            %
          </tspan>
        </text>
        <text x={CX} y={CY + 84} textAnchor="middle" fontFamily={FONT} fontSize={30} fill={C.dim} letterSpacing={6}>
          总体完成度
        </text>
        {RINGS.map((ring, i) => {
          // 图例跟着各自的环出来，收的时候一起退回去
          const vin = clamp01(vals[i] / ring.v);
          const show = prog(f, GROW0 + i * STAGGER, GROW0 + i * STAGGER + 22, ease.out) * Math.min(1, vin * 3);
          const y = 330 + i * 130;
          return (
            <g key={ring.name} opacity={show} transform={`translate(${(1 - show) * 60} 0)`}>
              <rect x={1260} y={y - 30} width={36} height={36} rx={10} fill={ring.color} />
              <text x={1320} y={y} fontFamily={FONT} fontSize={40} fill={C.fg}>
                {ring.name}
              </text>
              <text x={1640} y={y} textAnchor="end" fontFamily={FONT} fontSize={44} fontWeight={700} fill={ring.color}>
                {`${Math.round(vals[i])}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 85,
  name: "环形进度图",
  group: "数据",
  desc: "四圈环形进度条从外到内错开长出来，冲过头一点再回稳，中间大数字和右边图例的数字跟着滚；停一会儿环从内到外倒着收回",
  tech: "SVG 圆弧 path + 圆头描边，读数用欠阻尼弹簧（峰值约 1.06）错开 9 帧，收回用 ease.inOut；端点叠一层模糊做光点。创意参考 vivmagarwal/remotion-effects-library 的 Donut Progress 和 Sunburst Rings",
  frames: FRAMES,
  component: Effect,
};
export default effect;
