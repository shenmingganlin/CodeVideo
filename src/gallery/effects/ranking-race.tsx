import { useCurrentFrame } from "remotion";
import { colorRamp, ease, lerp, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 六根横条一年年往前跑：长度跟数值，名次变了就上下平滑换位，右下角的年份像里程表一样滚；
// 第 5 年停一会儿，再快速倒回第 1 年接上开头
const FRAMES = 150;
const LABELS = ["选项 A", "选项 B", "选项 C", "选项 D", "选项 E", "选项 F"];
// 每行是一个时间点（第 1–5 年），每列是一个选项
const DATA = [
  [320, 280, 240, 200, 160, 120],
  [430, 390, 470, 300, 260, 340],
  [520, 610, 560, 380, 420, 480],
  [640, 700, 620, 450, 690, 560],
  [760, 820, 720, 530, 880, 960],
];
const MAX = 1000;
const HOLD0 = 10; // 第 1 年停住
const STEP = 24; // 每年之间跑多少帧
const HOLD1 = HOLD0 + STEP * (DATA.length - 1); // 106：到第 5 年
const REWIND0 = 124; // 停一会儿后倒回
const REWIND1 = 146;
const ROW = 104;
const TOP = 210;
const BX = 420; // 横条起点
const BMAX = 1180; // 数值 MAX 对应的长度
const COLORS = LABELS.map((_, i) => colorRamp([C.cool, C.fg, C.accent], i / (LABELS.length - 1)));

// 时间：0 = 第 1 年，4 = 第 5 年；年与年之间匀速，不在每年停顿
const timeAt = (frame: number) => {
  if (frame < REWIND0) return (DATA.length - 1) * prog(frame, HOLD0, HOLD1, ease.inOutSoft);
  return (DATA.length - 1) * (1 - prog(frame, REWIND0, REWIND1, ease.inOut));
};

const valuesAt = (t: number) => {
  const i = Math.min(DATA.length - 2, Math.floor(t));
  const u = t - i;
  return DATA[i].map((v, k) => lerp(v, DATA[i + 1][k], u));
};

// 连续名次：比我大的个数，差值在 ±GAP 内的按比例算半个，这样交换时位置是滑过去的
const GAP = 24;
const ranks = (vals: number[]) =>
  vals.map((v, i) =>
    vals.reduce((s, w, j) => (j === i ? s : s + Math.min(1, Math.max(0, 0.5 + (w - v) / (2 * GAP)))), 0),
  );

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const t = timeAt(frame);
  const vals = valuesAt(t);
  const rk = ranks(vals);
  const year = t + 1;
  const yi = Math.floor(year + 1e-6);
  const yf = year - yi;
  return (
    <Stage>
      <svg width={W} height={H}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <line key={k} x1={BX + BMAX * k} x2={BX + BMAX * k} y1={TOP - 40} y2={TOP + ROW * LABELS.length} stroke={C.dim} strokeOpacity={0.25} strokeDasharray="4 10" />
        ))}
        <line x1={BX} x2={BX} y1={TOP - 40} y2={TOP + ROW * LABELS.length} stroke={C.dim} strokeWidth={3} />
        {LABELS.map((label, i) => {
          const y = TOP + rk[i] * ROW;
          const len = (BMAX * vals[i]) / MAX;
          return (
            <g key={label} transform={`translate(0 ${y})`}>
              <text x={BX - 28} y={ROW / 2 + 12} textAnchor="end" fill={C.fg} fontFamily={FONT} fontSize={36}>
                {label}
              </text>
              <rect x={BX} y={14} width={len} height={ROW - 28} rx={8} fill={COLORS[i]} />
              <text
                x={BX + len + 20}
                y={ROW / 2 + 12}
                fill={C.fg}
                fontFamily={FONT}
                fontSize={34}
                fontWeight={600}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(vals[i])}
              </text>
            </g>
          );
        })}
        <clipPath id="year-window">
          <rect x={1180} y={820} width={640} height={170} />
        </clipPath>
        <g clipPath="url(#year-window)" fontFamily={FONT} fontWeight={800} fontSize={130} fill={C.fg} opacity={0.9}>
          {[0, 1].map((k) => (
            <text key={k} x={1800} y={960 + (k - yf) * 160} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
              第 {yi + k} 年
            </text>
          ))}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 48,
  name: "排行榜赛跑",
  group: "数据",
  desc: "六根横条一年年往前跑，名次变了就上下平滑换位，右下角年份像里程表一样滚；跑到第 5 年停一会儿，再倒回第 1 年",
  tech: "自己画 SVG；五个时间点线性插值，时间整体用 ease.inOutSoft 匀着跑；名次用连续的软排序（差值 ±24 内按比例算），交换时位置不跳；年份是 clipPath 窗口里的两行字按小数部分滚动。创意参考 remotion-scenes 的 DataRanking",
  frames: FRAMES,
  component: Effect,
};
export default effect;
