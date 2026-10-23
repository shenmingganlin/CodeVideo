import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一句话的字从左到右一个个从糊成一团、略偏的状态对焦变清楚；
// 然后一个四角取景框在词之间跳，框到的词清楚、其余的词跟着失焦；最后整句从右往左糊掉
const FRAMES = 150;
const WORDS = ["每一帧", "都由", "代码", "算出"];
const SIZE = 132;
const WGAP = 56; // 词与词之间多留的空
const IN0 = 4; // 第一个字开始对焦
const IN_STEP = 3;
const IN_DUR = 18;
const OUT0 = 112; // 最后一个字开始失焦（从右往左）
const OUT_STEP = 2;
const OUT_DUR = 16;
// 取景框依次停在哪个词、从第几帧开始往那里跳
const FOCUS = [
  { f: 40, w: 0 },
  { f: 58, w: 1 },
  { f: 74, w: 2 },
  { f: 92, w: 3 },
];
const JUMP = 9; // 跳一次用几帧
const BOX_IN = [34, 42];
const BOX_OUT = [110, 120];
const BLUR_MAX = 26;

type Ch = { ch: string; w: number; x: number };
const CHARS: Ch[] = [];
const WORD_BOX: { x0: number; x1: number }[] = [];
{
  let x = 0;
  WORDS.forEach((word, w) => {
    const x0 = x;
    for (const ch of word) {
      CHARS.push({ ch, w, x });
      x += SIZE;
    }
    WORD_BOX.push({ x0, x1: x });
    x += WGAP;
  });
  const shift = (W - (x - WGAP)) / 2;
  CHARS.forEach((c) => (c.x += shift));
  WORD_BOX.forEach((b) => {
    b.x0 += shift;
    b.x1 += shift;
  });
}
const N = CHARS.length;
const TOP = (H - SIZE) / 2;

// 取景框落在第几个词：0–3 的小数，跳的时候用 snap 缓动，停下时略冲过头再回来
const focusPos = (f: number) => {
  let p = FOCUS[0].w;
  for (let i = 1; i < FOCUS.length; i++) {
    const t = clamp01((f - FOCUS[i].f) / JUMP);
    const over = Math.sin(Math.PI * clamp01((f - FOCUS[i].f - JUMP * 0.6) / 8)) * 0.06;
    p += (FOCUS[i].w - FOCUS[i - 1].w) * ease.snap(t) + over;
  }
  return p;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const fp = focusPos(frame);
  const boxIn = ease.out(clamp01((frame - BOX_IN[0]) / (BOX_IN[1] - BOX_IN[0])));
  const boxOut = ease.in(clamp01((frame - BOX_OUT[0]) / (BOX_OUT[1] - BOX_OUT[0])));
  const boxOn = boxIn * (1 - boxOut);
  // 框到的词清楚，离框越远越糊；框出现时才开始让别的词失焦
  const sel = (w: number) => {
    const d = Math.abs(w - fp);
    return 1 - clamp01(d / 0.9);
  };

  // 框的位置和大小在词之间插值
  const i0 = Math.min(WORD_BOX.length - 1, Math.floor(fp));
  const i1 = Math.min(WORD_BOX.length - 1, i0 + 1);
  const k = fp - i0;
  const bx0 = lerp(WORD_BOX[i0].x0, WORD_BOX[i1].x0, k) - 34;
  const bx1 = lerp(WORD_BOX[i0].x1, WORD_BOX[i1].x1, k) + 34;
  const by0 = TOP - 30;
  const by1 = TOP + SIZE + 30;
  const bScale = lerp(1.25, 1, boxIn) * lerp(1, 1.12, boxOut);
  const bcx = (bx0 + bx1) / 2;
  const bcy = (by0 + by1) / 2;
  const L = 34; // 角标长度

  return (
    <Stage>
      {CHARS.map((c, i) => {
        const tIn = ease.out(clamp01((frame - (IN0 + i * IN_STEP)) / IN_DUR));
        const tOut = ease.in(clamp01((frame - (OUT0 + (N - 1 - i) * OUT_STEP)) / OUT_DUR));
        const shown = tIn * (1 - tOut);
        // 选词带来的失焦：框出现后才起作用，框走后慢慢恢复
        const defocus = boxOn * (1 - sel(c.w));
        const blur = BLUR_MAX * (1 - shown) + 9 * defocus;
        const op = shown * lerp(1, 0.4, defocus);
        const jx = (rand(i * 7.3 + 1) - 0.5) * 70 * (1 - tIn) + (rand(i * 3.1 + 5) - 0.5) * 50 * tOut;
        const jy = (rand(i * 5.9 + 2) - 0.5) * 50 * (1 - tIn) - 40 * tOut;
        const sc = lerp(1.35, 1, tIn) * lerp(1, 1.2, tOut) * lerp(1, 0.94, defocus);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x,
              top: TOP,
              width: SIZE,
              height: SIZE,
              lineHeight: `${SIZE}px`,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: SIZE * 0.9,
              color: C.fg,
              opacity: op,
              filter: `blur(${blur.toFixed(2)}px)`,
              transform: `translate(${jx}px, ${jy}px) scale(${sc})`,
            }}
          >
            {c.ch}
          </div>
        );
      })}
      {boxOn > 0.001 && (
        <svg
          width={W}
          height={H}
          style={{ position: "absolute", inset: 0, opacity: boxOn }}
        >
          <g transform={`translate(${bcx} ${bcy}) scale(${bScale}) translate(${-bcx} ${-bcy})`}>
            <path
              d={[
                `M${bx0} ${by0 + L} V${by0} H${bx0 + L}`,
                `M${bx1 - L} ${by0} H${bx1} V${by0 + L}`,
                `M${bx1} ${by1 - L} V${by1} H${bx1 - L}`,
                `M${bx0 + L} ${by1} H${bx0} V${by1 - L}`,
              ].join(" ")}
              fill="none"
              stroke={C.accent}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      )}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 71,
  name: "字从模糊聚焦",
  group: "文字",
  desc: "一句话的字从左到右一个个从糊成一团、略偏的状态对焦变清楚；一个四角取景框在词之间跳，框到的词清楚、其余的词失焦变淡；最后整句从右往左糊掉飘走",
  tech: "逐字 DOM + CSS blur：对焦每字错开 3 帧、18 帧 ease.out，模糊从 26px 收到 0、位移和放大同时回位；取景框位置是 0–3 的小数，跳词用 ease.snap 加一点冲过头，每个词的失焦量按离框的距离算。创意参考 DavidHDev/react-bits 的 BlurText 和 TrueFocus",
  frames: FRAMES,
  component: Scene,
};
export default effect;
