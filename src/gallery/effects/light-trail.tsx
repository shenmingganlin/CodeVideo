import { useCurrentFrame } from "remotion";
import { ease, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一颗亮点拖着渐隐的光尾，沿圆角星形的轮廓跑一整圈，跑过的地方亮起细描边；
// 跑完整个轮廓闪亮一下，中间的字跟着亮，再一起熄灭，循环
const FRAMES = 150;
const CX = W / 2;
const CY = H / 2;
const R = 330;
const RUN0 = 12;
const RUN1 = 100;
const FLASH = 100;
const OUT0 = 112;
const OUT1 = 138;
const TAIL = 36; // 光尾取多少个历史点
const TAIL_GAP = 9; // 每个历史点往回退多少像素

// 圆角五角星：r(θ) = R(1 + 0.24 cos 5θ)，从正上方开始顺时针，按弧长重新参数化
const N = 900;
const PTS = Array.from({ length: N + 1 }, (_, i) => {
  const t = -Math.PI / 2 + (i / N) * Math.PI * 2;
  const r = R * (1 + 0.24 * Math.cos(5 * (t + Math.PI / 2)));
  return { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) };
});
const CUM = PTS.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - PTS[i - 1].x, p.y - PTS[i - 1].y));
  return acc;
}, []);
const LEN = CUM[N];
const POLY = PTS.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// 弧长 s 处的点（s 可以是负数，绕回去）
const at = (s: number) => {
  const u = ((s % LEN) + LEN) % LEN;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (CUM[mid] <= u) lo = mid;
    else hi = mid;
  }
  const t = (u - CUM[lo]) / Math.max(1e-6, CUM[hi] - CUM[lo]);
  return { x: PTS[lo].x + (PTS[hi].x - PTS[lo].x) * t, y: PTS[lo].y + (PTS[hi].y - PTS[lo].y) * t };
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const p = prog(frame, RUN0, RUN1, ease.inOutSoft);
  const s = p * LEN;
  const running = frame >= RUN0 && frame < RUN1;
  // 闪亮：跑完那一刻冲高再回落
  const fl = frame >= FLASH ? Math.exp(-(frame - FLASH) / 5) : 0;
  const out = 1 - prog(frame, OUT0, OUT1, ease.inOut);
  const lit = frame < RUN0 ? 0 : out; // 已描出部分的亮度
  const stroke = mixColor(C.accent, "#FFF6E6", fl * 0.8);
  const word = frame >= FLASH ? out : 0;

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="trail-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={10} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* 底稿：一直在的暗轮廓 */}
        <polyline points={POLY} fill="none" stroke={C.dim} strokeWidth={2} opacity={0.35} />
        {/* 跑过的地方亮起来 */}
        {lit > 0 && (
          <polyline
            points={POLY}
            fill="none"
            stroke={stroke}
            strokeWidth={4 + fl * 4}
            strokeLinejoin="round"
            strokeDasharray={`${LEN} ${LEN}`}
            strokeDashoffset={LEN - s}
            opacity={lit}
            filter="url(#trail-glow)"
          />
        )}
        {/* 光尾 + 亮点 */}
        {running &&
          Array.from({ length: TAIL }, (_, k) => {
            const back = k * TAIL_GAP;
            if (back > s) return null;
            const q = at(s - back);
            const f = 1 - k / TAIL;
            return <circle key={k} cx={q.x} cy={q.y} r={2 + 12 * f * f} fill={k === 0 ? "#FFFFFF" : C.accent} opacity={k === 0 ? 1 : 0.7 * f} />;
          })}
        {running && (
          <circle cx={at(s).x} cy={at(s).y} r={30} fill={C.accent} opacity={0.35} filter="url(#trail-glow)" />
        )}
        {/* 中间的字：轮廓闭合时亮起 */}
        <text
          x={CX}
          y={CY}
          fontFamily={FONT}
          fontWeight={800}
          fontSize={170}
          textAnchor="middle"
          dominantBaseline="central"
          fill={mixColor(C.bg2, C.fg, word)}
          filter={fl > 0.05 ? "url(#trail-glow)" : undefined}
        >
          描
        </text>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 42,
  name: "光点沿轮廓描一圈",
  group: "线条",
  desc: "一颗亮点拖着渐隐的光尾沿圆角星形跑一圈，跑过的地方亮起描边；跑完整个轮廓闪亮一下、中间的字亮起，再一起熄灭",
  tech: "SVG：轮廓是 r = R(1 + 0.24cos5θ) 采样 900 点按弧长查表，亮点位置二分查弧长；描边用 strokeDasharray/Dashoffset 跟进度；光尾是往回退 36 个点、越往后越小越透明的圆，外加 feGaussianBlur 光晕。创意参考 remotion-scenes 的 LogoLightTrail",
  frames: FRAMES,
  component: Scene,
};
export default effect;
