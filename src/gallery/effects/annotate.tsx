import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor, prog, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一支笔在三行字上划重点：先给"节奏"画一个没闭合、两圈错开的手绘圈，再在"堆特效"下面拖一道波浪线，
// 最后从右下甩一根弧线箭头指向"想清楚"。每一笔起笔慢、中间快、收笔慢，笔在两笔之间抬起来挪过去；
// 画完线条轻轻抖，停一会儿，三处标注依次从笔尾往笔头收掉，字的颜色跟着退回去
const FRAMES = 150;
const FS = 96; // 字号，中文字是方块，一个字宽约等于字号
const LINES = ["好的动画靠节奏", "而不是堆特效", "先想清楚再动手"];
const BASE = [380, 560, 740]; // 每行的基线
const INK = C.accent;

// 第 l 行第 i 个字的方框：x0–x1，字身大约在基线上方 0.86 字号到下方 0.12 字号
const box = (l: number, i0: number, i1: number) => {
  const x0 = W / 2 - (LINES[l].length * FS) / 2 + i0 * FS;
  return { x0, x1: x0 + (i1 - i0) * FS, top: BASE[l] - FS * 0.86, bot: BASE[l] + FS * 0.12 };
};

type P = { x: number; y: number };

// 每一笔先算成密的折线，后面按长度截取：画到哪、擦到哪都按真实长度走，笔尖位置也直接取得到
const sample = (n: number, f: (t: number) => P) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

// 手绘圈：从左上起笔顺时针绕 1.22 圈，半径慢慢变大，所以第二圈不和第一圈重合，收笔停在起笔外侧
const CIRCLE = (() => {
  const b = box(0, 5, 7);
  const cx = (b.x0 + b.x1) / 2 + 6;
  const cy = (b.top + b.bot) / 2;
  const rx = (b.x1 - b.x0) / 2 + 34;
  const ry = (b.bot - b.top) / 2 + 26;
  return sample(160, (t) => {
    const a = Math.PI * 1.12 + t * Math.PI * 2 * 1.22;
    const grow = 1 + 0.1 * t + 0.035 * Math.sin(t * 9 + 1);
    // 手画的圈右边总是更扁一点、整体略往右上歪
    return {
      x: cx + Math.cos(a) * rx * grow,
      y: cy + Math.sin(a) * ry * grow * (1 - 0.08 * Math.cos(a)) - Math.cos(a) * 8,
    };
  });
})();

// 波浪下划线：从左到右，波越拖越松，线尾往上翘一点
const WAVE = (() => {
  const b = box(1, 3, 6);
  const x0 = b.x0 - 16;
  const x1 = b.x1 + 24;
  return sample(140, (t) => ({
    x: x0 + (x1 - x0) * t,
    y: b.bot + 24 + Math.sin(t * Math.PI * 2 * 4.2) * (9 + 4 * t) - t * t * 14,
  }));
})();

// 箭头杆：从右下角起笔，二次曲线弯过去，停在"想清楚"右下方
const T = box(2, 1, 4);
const ARROW_TIP = { x: T.x1 + 26, y: T.bot + 22 };
const SHAFT = (() => {
  const a = { x: T.x1 + 360, y: T.bot + 170 };
  const c = { x: T.x1 + 300, y: T.bot + 20 };
  return sample(100, (t) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * ARROW_TIP.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * ARROW_TIP.y,
  }));
})();

// 箭头尖：一笔"折回"的 V，两边不一样长
const HEAD = (() => {
  const end = SHAFT[SHAFT.length - 1];
  const prev = SHAFT[SHAFT.length - 8];
  const dir = Math.atan2(end.y - prev.y, end.x - prev.x);
  const wing = (s: number, len: number) => ({
    x: end.x - Math.cos(dir + s * 0.5) * len,
    y: end.y - Math.sin(dir + s * 0.5) * len,
  });
  const l = wing(1, 56);
  const r = wing(-1, 44);
  return sample(60, (t) => (t < 0.5 ? lerpP(l, end, t * 2) : lerpP(end, r, (t - 0.5) * 2)));
})();

function lerpP(a: P, b: P, t: number): P {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// 每一笔：哪段折线、什么时候画、什么时候擦、颜色、粗细、画完点亮哪几个字
type Stroke = { pts: P[]; draw: [number, number]; erase: [number, number]; color: string; w: number };
const STROKES: Stroke[] = [
  { pts: CIRCLE, draw: [12, 38], erase: [104, 120], color: INK, w: 7 },
  { pts: WAVE, draw: [48, 68], erase: [110, 126], color: C.cool, w: 6 },
  { pts: SHAFT, draw: [78, 90], erase: [116, 132], color: INK, w: 7 },
  { pts: HEAD, draw: [92, 97], erase: [114, 124], color: INK, w: 7 },
];
// 被标注的字：哪一行、哪几个字、跟哪一笔走
const MARKS = [
  { l: 0, i0: 5, i1: 7, s: 0, color: INK },
  { l: 1, i0: 3, i1: 6, s: 1, color: C.cool },
  { l: 2, i0: 1, i1: 4, s: 2, color: INK },
];

// 折线累计长度，截取 [a, b]（0–1 的长度比例）那一段
const cumLen = (pts: P[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return acc;
};
const LENS = STROKES.map((s) => cumLen(s.pts));
const pointAt = (k: number, u: number): P => {
  const acc = LENS[k];
  const pts = STROKES[k].pts;
  const target = clamp01(u) * acc[acc.length - 1];
  let i = 1;
  while (i < acc.length - 1 && acc[i] < target) i++;
  const t = (target - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
  return lerpP(pts[i - 1], pts[i], clamp01(t));
};
const slice = (k: number, a: number, b: number, jitter: (p: P, i: number) => P) => {
  if (b - a < 0.002) return "";
  const acc = LENS[k];
  const total = acc[acc.length - 1];
  const out: P[] = [pointAt(k, a)];
  STROKES[k].pts.forEach((p, i) => {
    if (acc[i] > a * total && acc[i] < b * total) out.push(jitter(p, i));
  });
  out.push(pointAt(k, b));
  return out.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
};

// 一笔的画出比例：起落都慢，中间快
const drawn = (f: number, s: Stroke) => prog(f, s.draw[0], s.draw[1], ease.inOut);
// 擦：从笔尾往笔头收，所以截取的起点往后推
const erased = (f: number, s: Stroke) => prog(f, s.erase[0], s.erase[1], ease.inOut);

// 笔尖的轨迹：画的时候贴着线走，两笔之间抬起来走一条拱起的弧，开头从右下画外进来、结尾退回画外
const OFF: P = { x: W + 160, y: H + 120 };
const penAt = (f: number): { p: P; lift: number } => {
  for (let k = 0; k < STROKES.length; k++) {
    const s = STROKES[k];
    if (f >= s.draw[0] && f <= s.draw[1]) return { p: pointAt(k, drawn(f, s)), lift: 0 };
  }
  // 不在画：找前一笔的终点和后一笔的起点，中间抬笔挪过去
  const legs: { from: P; to: P; t0: number; t1: number }[] = [];
  let last = OFF;
  let lastF = 0;
  STROKES.forEach((s, k) => {
    legs.push({ from: last, to: pointAt(k, 0), t0: lastF, t1: s.draw[0] });
    last = pointAt(k, 1);
    lastF = s.draw[1];
  });
  legs.push({ from: last, to: OFF, t0: lastF, t1: lastF + 26 });
  for (const leg of legs) {
    if (f >= leg.t0 && f <= leg.t1) {
      // 第一段从画外进来，前几帧先不动，正好在第 0 帧之前就在画外
      const t = prog(f, leg.t0 === 0 ? 2 : leg.t0, leg.t1, ease.inOut);
      const p = lerpP(leg.from, leg.to, t);
      const hop = Math.sin(t * Math.PI);
      const d = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
      return { p: { x: p.x, y: p.y - hop * Math.min(80, d * 0.18) }, lift: hop };
    }
  }
  return { p: OFF, lift: 1 };
};

// 笔：笔尖朝左上，笔杆往右下斜；抬笔时笔略放大、影子拉开
const Pen: React.FC<{ p: P; lift: number }> = ({ p, lift }) => {
  const s = 1 + lift * 0.08;
  return (
    <g transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}>
      <g transform={`translate(${14 + lift * 18} ${18 + lift * 22}) rotate(38) scale(${s})`} opacity={0.35}>
        <rect x={-11} y={30} width={22} height={210} rx={10} fill="#000" />
      </g>
      <g transform={`rotate(-28) scale(${s})`}>
        <path d="M 0 0 L -11 34 L 11 34 Z" fill={C.fg} />
        <path d="M 0 0 L -3.5 11 L 3.5 11 Z" fill={INK} />
        <rect x={-13} y={34} width={26} height={200} rx={6} fill={C.dim} />
        <rect x={-13} y={34} width={26} height={16} fill={C.fg} opacity={0.8} />
      </g>
    </g>
  );
};

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  // 画完的线每 3 帧抖一下（line boil），画的那一笔不抖，免得笔尖和线对不上
  const boil = Math.floor(f / 3);
  const pen = penAt(f);
  return (
    <Stage>
      <svg width={W} height={H}>
        {LINES.map((line, l) => {
          const x0 = W / 2 - (line.length * FS) / 2;
          return [...line].map((ch, i) => {
            const m = MARKS.find((mk) => mk.l === l && i >= mk.i0 && i < mk.i1);
            const s = m ? STROKES[m.s] : null;
            // 标注画完那一刻字变色，擦的时候退回去
            const on = s && m ? clamp01(drawn(f, s) * 1.4 - 0.4) * (1 - erased(f, s)) : 0;
            return (
              <text
                key={`${l}-${i}`}
                x={x0 + i * FS + FS / 2}
                y={BASE[l]}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={FS}
                fontWeight={700}
                fill={m ? mixColor(C.fg, m.color, on) : C.fg}
              >
                {ch}
              </text>
            );
          });
        })}
        {STROKES.map((s, k) => {
          const b = drawn(f, s);
          const a = erased(f, s);
          const active = f > s.draw[0] && f < s.draw[1];
          const amp = active ? 0 : 2.2;
          const d = slice(k, a, b, (p, i) => ({
            x: p.x + (rand(boil * 977 + k * 131 + i * 7) - 0.5) * amp,
            y: p.y + (rand(boil * 613 + k * 71 + i * 13) - 0.5) * amp,
          }));
          // 擦到最后线变细变淡，不是一下没了
          const fade = 1 - a * a;
          return d ? (
            <path
              key={k}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.w * (0.55 + 0.45 * fade)}
              strokeOpacity={0.92 * (0.4 + 0.6 * fade)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null;
        })}
        <Pen p={pen.p} lift={pen.lift} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 83,
  name: "手绘圈重点",
  group: "线条",
  desc: "一支笔在字上划重点：给关键词画一个没闭合的手绘圈、在另一个词下拖波浪线、甩一根弧线箭头指向第三个词，字跟着变色；停一会儿标注依次收掉",
  tech: "SVG：每一笔预先采样成密折线，按累计长度截取，画到哪、笔尖在哪都由同一个比例算；ease.inOut 起落慢中间快，抬笔走拱形弧；画完的线每 3 帧换 seed 抖动。创意参考 vivmagarwal/remotion-effects-library 的 Hand Annotations",
  frames: FRAMES,
  component: Effect,
};
export default effect;
