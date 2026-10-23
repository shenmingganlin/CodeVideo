import { useCurrentFrame } from "remotion";
import { arc, clamp01, colorRamp, ease, lerp, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 中间一个方块蓄力一下，炸成满屏的小方块铺成网格，网格起伏一会儿，再沿弧线收回成一个方块
const FRAMES = 150;
const COLS = 32;
const ROWS = 18;
const PITCH = 56;
const TILE = 44;
const GX = (W - COLS * PITCH) / 2 + (PITCH - TILE) / 2;
const GY = (H - ROWS * PITCH) / 2 + (PITCH - TILE) / 2;
const SUB = 9; // 收在大方块里时每个小块的大小：32×18 个拼成 288×162 的大块，和网格同比例
const BW = COLS * SUB;
const BH = ROWS * SUB;

const BURST = 20; // 炸开
const FLY = 26; // 每块飞多少帧
const STAGGER = 16; // 从中心往外错开
const GATHER = 92; // 开始收回
const LAND = GATHER + STAGGER + FLY; // 全部收回、换回大方块

const tiles = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const grid = { x: GX + c * PITCH + TILE / 2, y: GY + r * PITCH + TILE / 2 };
  // 在大方块里的位置：按同样的行列缩进去
  const home = {
    x: W / 2 + (c - (COLS - 1) / 2) * SUB,
    y: H / 2 + (r - (ROWS - 1) / 2) * SUB,
  };
  const dist = Math.hypot(grid.x - W / 2, grid.y - H / 2) / Math.hypot(W / 2, H / 2);
  return { grid, home, dist, seed: i, hue: (c / (COLS - 1)) * 0.6 + (r / (ROWS - 1)) * 0.4 };
});

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 大方块：蓄力时往里收一下，收回落定时压一下再弹回
  if (frame < BURST || frame >= LAND) {
    const charge = frame < BURST ? Math.sin(clamp01((frame - 6) / (BURST - 6)) * Math.PI * 0.5) : 0;
    const settle = frame >= LAND ? Math.exp(-(frame - LAND) / 3) * Math.cos((frame - LAND) * 0.7) : 0;
    const s = 1 - 0.12 * charge + 0.1 * settle;
    return (
      <Stage>
        <svg width={W} height={H}>
          <rect
            x={W / 2 - (BW * s) / 2}
            y={H / 2 - (BH * s) / 2}
            width={BW * s}
            height={BH * s}
            rx={8}
            fill={C.accent}
          />
        </svg>
      </Stage>
    );
  }
  return (
    <Stage>
      <svg width={W} height={H}>
        {tiles.map((p) => {
          const outT = clamp01((frame - BURST - p.dist * STAGGER) / FLY);
          const inT = clamp01((frame - GATHER - (1 - p.dist) * STAGGER) / FLY);
          const out = ease.out(outT);
          const back = ease.inOut(inT);
          const bend = (rand(p.seed * 3.7) - 0.5) * 0.9;
          let q;
          let size;
          if (inT <= 0) {
            q = arc(p.home, p.grid, out, bend);
            size = lerp(SUB, TILE, out);
          } else {
            q = arc(p.grid, p.home, back, -bend);
            size = lerp(TILE, SUB, back);
          }
          // 停在网格上时，从中心往外一圈圈起伏
          const settled = clamp01(outT * 2 - 1) * (1 - clamp01(inT * 3));
          const wave = Math.sin(frame * 0.2 - p.dist * 9) * settled;
          size *= 1 + 0.18 * wave;
          // 颜色：飞的时候从强调色铺成渐变，收回时回到强调色
          const k = out * (1 - back);
          const color = colorRamp([C.accent, C.fg, C.cool], p.hue * k);
          const spin = (rand(p.seed * 1.9) - 0.5) * 180 * Math.sin(Math.PI * outT) + (rand(p.seed * 2.3) - 0.5) * 180 * Math.sin(Math.PI * inT);
          return (
            <rect
              key={p.seed}
              x={q.x - size / 2}
              y={q.y - size / 2}
              width={size}
              height={size}
              rx={size * 0.12}
              fill={color}
              transform={`rotate(${spin} ${q.x} ${q.y})`}
            />
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 7,
  name: "一个炸成满屏再收回",
  group: "形状",
  desc: "中间的大方块蓄力收一下，炸成 576 个小方块沿弧线铺满画面并铺开成渐变，网格从中心往外起伏，再收回成一个方块落定一弹",
  tech: "SVG rect × 576，arc() 弯曲路径，飞出 ease.out、收回 ease.inOut，按离中心的距离错开 16 帧；参考 StyleDemo",
  frames: FRAMES,
  component: Scene,
};
export default effect;
