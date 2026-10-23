import { useCurrentFrame } from "remotion";
import { clamp01, ease } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 柱子从左到右一根根长出来，冲过头一点再回落，左上的总数跟着滚上去；
// 停一会儿，柱子从右到左落回基线，总数滚回 0
const FRAMES = 150;
const VALUES = [1240, 1860, 1530, 2420, 2980, 2150, 3300];
const LABELS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月"];
const MAX = 3300;
const BASE = 900; // 基线 y
const TOP = 330; // 最高的柱子顶到这里
const BW = 120;
const GAP = 56;
const X0 = (W - (BW * VALUES.length + GAP * (VALUES.length - 1))) / 2;
const GROW = 10; // 第一根开始长
const STAGGER = 6;
const DUR = 26;
const FALL = 104; // 开始落回（从最后一根开始）
const FALL_STAGGER = 4;
const FALL_DUR = 18;

const grow = ease.backOut(1.4);

// 第 i 根柱子的高度比例（0–1，长的时候会略超过 1）
const level = (frame: number, i: number) => {
  const up = grow(clamp01((frame - GROW - i * STAGGER) / DUR));
  const down = ease.in(clamp01((frame - FALL - (VALUES.length - 1 - i) * FALL_STAGGER) / FALL_DUR));
  return up * (1 - down);
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const levels = VALUES.map((_, i) => level(frame, i));
  // 总数跟着柱子走：每根柱子的数按它当前长到的比例算（不超过它自己的值）
  const total = VALUES.reduce((s, v, i) => s + v * Math.min(1, levels[i]), 0);
  const best = VALUES.indexOf(MAX);
  return (
    <Stage>
      <svg width={W} height={H}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <line key={k} x1={X0 - 40} x2={W - X0 + 40} y1={BASE - (BASE - TOP) * k} y2={BASE - (BASE - TOP) * k} stroke={C.dim} strokeOpacity={0.25} strokeDasharray="4 10" />
        ))}
        {VALUES.map((v, i) => {
          const h = ((BASE - TOP) * v * levels[i]) / MAX;
          const x = X0 + i * (BW + GAP);
          const labelO = clamp01((levels[i] - 0.6) / 0.4);
          return (
            <g key={i}>
              <rect x={x} y={BASE - h} width={BW} height={Math.max(0, h)} rx={10} fill={i === best ? C.accent : C.cool} />
              <text
                x={x + BW / 2}
                y={BASE - h - 22}
                textAnchor="middle"
                fill={C.fg}
                fontFamily={FONT}
                fontSize={30}
                fontWeight={600}
                opacity={labelO}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(v * Math.min(1, levels[i])).toLocaleString("en-US")}
              </text>
              <text x={x + BW / 2} y={BASE + 52} textAnchor="middle" fill={C.dim} fontFamily={FONT} fontSize={28}>
                {LABELS[i]}
              </text>
            </g>
          );
        })}
        <line x1={X0 - 40} x2={W - X0 + 40} y1={BASE} y2={BASE} stroke={C.dim} strokeWidth={3} />
        <text x={X0 - 40} y={170} fill={C.dim} fontFamily={FONT} fontSize={32}>
          总计
        </text>
        <text
          x={X0 - 40}
          y={270}
          fill={C.fg}
          fontFamily={FONT}
          fontSize={110}
          fontWeight={800}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(total).toLocaleString("en-US")}
        </text>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 20,
  name: "数字滚动柱子长高",
  group: "数据",
  desc: "柱子从左到右一根根长出来、冲过头一点再回落，总数跟着滚上去；最后从右到左落回基线",
  tech: "自己画 SVG 柱子；ease.backOut 长高、每根错开 6 帧；总数按每根柱子当前高度求和，滚数和柱子同步（没用 Counter：它只认一个进度，跟不上七根错开的柱子），等宽数字防抖",
  frames: FRAMES,
  component: Effect,
};
export default effect;
