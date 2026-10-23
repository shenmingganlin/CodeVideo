import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 毛笔按笔顺写一个"永"：点、横折钩、横撇、撇、捺。每笔有笔尖往前走，起笔按重、行笔提细、出锋收尖；
// 写完停一会儿，墨迹洇开淡掉，回到白纸
const FRAMES = 150;
const PAPER = C.fg;
const INK = C.bg;

type Stroke = { pts: [number, number][]; width: [number, number][] };

// 中心线坐标按 1080 高的画面设计，字大约 700 像素见方；width 是 [沿笔画的进度 0–1, 笔宽] 的关键点
const STROKES: Stroke[] = [
  // 点：落笔轻，往右下按下去，收成一个圆头
  { pts: [[925, 190], [955, 222], [985, 258]], width: [[0, 12], [0.35, 30], [0.8, 44], [1, 36]] },
  // 横折钩：横往右略上扬，折处顿一下，竖直下，底部往左上踢出钩
  {
    pts: [[815, 338], [900, 328], [995, 314], [1012, 330], [1006, 450], [1004, 620], [1004, 800], [998, 846], [972, 836], [935, 798]],
    width: [[0, 34], [0.04, 26], [0.2, 20], [0.25, 40], [0.32, 32], [0.75, 30], [0.86, 36], [0.92, 26], [1, 2]],
  },
  // 横撇：短横，折，撇向左下出锋
  {
    pts: [[690, 472], [770, 464], [850, 455], [858, 470], [820, 540], [760, 625], [680, 705]],
    width: [[0, 30], [0.1, 20], [0.3, 20], [0.36, 34], [0.55, 26], [1, 2]],
  },
  // 撇：从右上起笔，往左下靠到竖上
  {
    pts: [[1215, 395], [1170, 432], [1105, 488], [1030, 545]],
    width: [[0, 36], [0.2, 26], [0.7, 14], [1, 3]],
  },
  // 捺：轻起，越走越重，到底顿笔再往右平着出锋
  {
    pts: [[1075, 505], [1125, 575], [1180, 655], [1240, 740], [1300, 805], [1345, 822], [1395, 826]],
    width: [[0, 6], [0.3, 20], [0.6, 34], [0.78, 48], [0.86, 44], [1, 2]],
  },
];

const widthAt = (keys: [number, number][], t: number) => {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, w0] = keys[i - 1];
      const [t1, w1] = keys[i];
      return lerp(w0, w1, ease.inOut((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
};

// 沿折线每 2 像素取一个点，记下笔宽；画的时候一个点盖一个圆，像笔肚压在纸上
const STEP = 2;
const SAMPLES = STROKES.map((s) => {
  const segs = s.pts.slice(1).map((p, i) => Math.hypot(p[0] - s.pts[i][0], p[1] - s.pts[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  const out: { x: number; y: number; r: number }[] = [];
  for (let d = 0; d <= total; d += STEP) {
    let rest = d;
    let i = 0;
    while (i < segs.length - 1 && rest > segs[i]) rest -= segs[i++];
    const k = clamp01(rest / segs[i]);
    const [a, b] = [s.pts[i], s.pts[i + 1]];
    out.push({ x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), r: (widthAt(s.width, d / total) * 1.4) / 2 });
  }
  return { out, total };
});

// 每笔的写字时间按长度分，笔与笔之间抬笔 4 帧；6–96 帧写，96–116 停，116–144 洇开淡掉
const WRITE0 = 6;
const WRITE1 = 96;
const GAP = 4;
const ALL = SAMPLES.reduce((a, s) => a + s.total, 0);
const SPAN = WRITE1 - WRITE0 - GAP * (STROKES.length - 1);
const TIMES = (() => {
  let f = WRITE0;
  return SAMPLES.map((s) => {
    const dur = (s.total / ALL) * SPAN;
    const t = { start: f, end: f + dur };
    f += dur + GAP;
    return t;
  });
})();
const FADE0 = 116;
const FADE1 = 144;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const fade = ease.inOut(clamp01((frame - FADE0) / (FADE1 - FADE0)));
  return (
    <Stage bg={PAPER}>
      <svg width={W} height={H}>
        <defs>
          <filter id="brush-edge" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency={0.06} numOctaves={2} seed={5} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feGaussianBlur in="d" stdDeviation={fade * 22} />
          </filter>
        </defs>
        <g
          transform="translate(-82 22)"
          filter="url(#brush-edge)"
          opacity={1 - fade}
          fill={INK}
        >
          {SAMPLES.map((s, i) => {
            const p = ease.inOut(clamp01((frame - TIMES[i].start) / (TIMES[i].end - TIMES[i].start)));
            const n = Math.floor(p * (s.out.length - 1)) + 1;
            if (frame < TIMES[i].start) return null;
            return (
              <g key={i}>
                {s.out.slice(0, n).map((c, j) => (
                  <circle key={j} cx={c.x} cy={c.y} r={Math.max(1, c.r)} />
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 35,
  name: "毛笔一笔写出字",
  group: "水墨",
  desc: "毛笔按笔顺写出一个永字，起笔重按、行笔提细、出锋收尖，捺尾顿一下再挑出去；写完停住，墨迹洇开淡掉",
  tech: "每笔一条手写折线中心线，每 2 像素盖一个圆，半径按笔画进度插值笔宽；feTurbulence 让边缘发毛，结尾加高斯模糊和透明度洇开。创意参考 remotion-scenes 的 LiquidCalligraphyInk",
  frames: FRAMES,
  component: Scene,
};
export default effect;
