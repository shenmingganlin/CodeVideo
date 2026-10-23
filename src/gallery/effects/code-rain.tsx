import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 黑客帝国式的代码雨：一列列字符往下落，每列快慢、长短都不同，头部亮白发光，尾巴渐暗成青绿；字符时不时变一下。后面一层更小、更暗、虚焦，拉出纵深
const FRAMES = 150;
const GREEN = mixColor(C.cool, "#5BF29A", 0.7);
const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789日月火水木金土山川口";
// 每格换字的周期，都整除 FRAMES，首尾无缝
const SWAP = [3, 5, 6, 10, 15, 25, 30];

const LAYERS = [
  { cell: 20, alpha: 0.42, blur: 1.6, laps: [1, 2], seed: 500 },
  { cell: 32, alpha: 1, blur: 0, laps: [1, 2, 3], seed: 0 },
];

type Col = { x: number; drops: { laps: number; off: number; len: number; travel: number }[] };

const makeCols = (L: (typeof LAYERS)[number]): Col[] => {
  const n = Math.ceil(W / L.cell);
  const rows = Math.ceil(H / L.cell);
  return Array.from({ length: n }, (_, i) => {
    const s = L.seed + i * 13;
    // 每列 1–2 滴，每滴一个循环落整数趟；落的距离比画面长，走完画外那段相当于两滴之间的空
    const nd = rand(s + 1) < 0.35 ? 2 : 1;
    return {
      x: i * L.cell + L.cell / 2,
      drops: Array.from({ length: nd }, (_, k) => ({
        laps: L.laps[Math.floor(rand(s + 2 + k * 5) * L.laps.length)],
        off: rand(s + 3 + k * 5),
        len: 6 + Math.floor(rand(s + 4 + k * 5) * 18),
        // 尾巴要整个走出画面底边才换趟
        travel: rows + 30 + Math.floor(rand(s + 5 + k * 5) * rows),
      })),
    };
  });
};
const COLS = LAYERS.map(makeCols);

const glyphAt = (col: number, row: number, frame: number, layer: number, head: boolean) => {
  const s = layer * 7777 + col * 131 + row * 17;
  // 头每 3 帧换字；其余大部分格子很久才换一次，少数格子闪得快
  const p = head ? 3 : rand(s + 2) < 0.7 ? 30 : SWAP[Math.floor(rand(s + 1) * SWAP.length)];
  const bucket = Math.floor((frame + rand(s + 3) * p) / p) % (FRAMES / p);
  return GLYPHS[Math.floor(rand(s + bucket * 7.13 + 9) * GLYPHS.length)];
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  return (
    <Stage bg="#05070A">
      <svg width={W} height={H}>
        <defs>
          <filter id="cr-far" x="-20%" y="-5%" width="140%" height="110%">
            <feGaussianBlur stdDeviation={LAYERS[0].blur} />
          </filter>
          <filter id="cr-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={6} />
          </filter>
        </defs>
        {LAYERS.map((L, li) => {
          const glyphs = [];
          const heads = [];
          const rows = Math.ceil(H / L.cell);
          for (let ci = 0; ci < COLS[li].length; ci++) {
            const col = COLS[li][ci];
            for (let di = 0; di < col.drops.length; di++) {
              const dr = col.drops[di];
              // 头所在的行（连续值），一格一格跳着走，像老终端
              const headPos = ((dr.off + u * dr.laps) % 1) * dr.travel - 2;
              const headRow = Math.floor(headPos);
              for (let k = 0; k < dr.len; k++) {
                const row = headRow - k;
                if (row < 0 || row > rows) continue;
                // 头最亮，尾巴按平方衰减
                const t = k / dr.len;
                const lum = k === 0 ? 1 : (1 - t) ** 1.6 * 0.85;
                const color = k === 0 ? C.fg : mixColor(GREEN, "#0B2A1C", t * 0.85);
                const ch = glyphAt(ci, row, frame, li, k === 0);
                const y = row * L.cell + L.cell * 0.85;
                const el = (
                  <text
                    key={`${ci}-${di}-${k}`}
                    transform={`translate(${col.x} ${y}) scale(-1 1)`}
                    textAnchor="middle"
                    fontSize={L.cell * 0.86}
                    fill={color}
                    opacity={lum * L.alpha}
                  >
                    {ch}
                  </text>
                );
                glyphs.push(el);
                if (k < 2 && li === 1) heads.push(el);
              }
            }
          }
          return (
            <g key={li} filter={li === 0 ? "url(#cr-far)" : undefined}>
              {li === 1 && (
                <g filter="url(#cr-glow)" style={{ mixBlendMode: "screen" }}>
                  {heads}
                </g>
              )}
              {glyphs}
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 77,
  name: "代码雨",
  group: "背景",
  desc: "一列列片假名、数字和汉字往下落，每列快慢长短不同，头部亮白发光、尾巴渐暗成青绿，字符时不时变一下；后面一层更小更暗、虚焦，拉出纵深",
  tech: "SVG 文字：每列 1–2 滴，每滴一个循环落 1–3 整趟（落的距离比画面长，画外那段就是滴与滴的间隔），头一格一格跳着走；尾巴亮度 (1-t)^1.6；每格换字的周期都整除 150 帧；字水平镜像；头两格叠 6px 模糊做辉光，后层 1.6px 模糊。创意参考 DavidHDev/react-bits 的 LetterGlitch",
  frames: FRAMES,
  component: Scene,
};
export default effect;
