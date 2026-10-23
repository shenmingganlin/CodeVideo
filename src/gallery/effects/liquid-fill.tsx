import { useCurrentFrame } from "remotion";
import { prog, ease, lerp } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 瓶子里水位涨满，水面一前一后两层波浪，涨得快时浪大；满了停一会再退下去
const FRAMES = 150;
const BW = 460;
const BH = 640;
const BX = (W - BW) / 2;
const BY = (H - BH) / 2 + 20;
const LOW = 0.08;
const HIGH = 0.86;

const level = (f: number) =>
  lerp(LOW, HIGH, prog(f, 10, 64, ease.inOut)) - (HIGH - LOW) * prog(f, 88, 140, ease.inOut);

// 水面一条正弦波，phase 每圈走整数个周期，首尾接得上
const surface = (y0: number, amp: number, k: number, phase: number) => {
  const pts: string[] = [];
  for (let x = 0; x <= BW; x += 10) {
    const y = y0 + Math.sin((x / BW) * Math.PI * 2 * k + phase) * amp;
    pts.push(`${(BX + x).toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${BX},${BY + BH} L${pts.join(" L")} L${BX + BW},${BY + BH} Z`;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const v = Math.abs(level(frame + 1) - level(frame - 1)) * 60; // 涨落的速度
  const amp = 10 + v * 16;
  const y0 = BY + BH * (1 - level(frame));
  const ph = (frame / FRAMES) * Math.PI * 2;
  const pct = Math.round(((level(frame) - LOW) / (HIGH - LOW)) * 100);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <clipPath id="bottle">
            <rect x={BX} y={BY} width={BW} height={BH} rx={60} />
          </clipPath>
        </defs>
        <g clipPath="url(#bottle)">
          <rect x={BX} y={BY} width={BW} height={BH} fill={C.bg2} />
          <path d={surface(y0 - 6, amp * 0.8, 1.5, -ph * 3 + 1.3)} fill={C.cool} opacity={0.45} />
          <path d={surface(y0, amp, 1, ph * 2)} fill={C.cool} />
          {/* 气泡：每个在自己的周期里从底往上冒，周期整除循环长度 */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const period = [50, 75, 150, 50, 75, 30][i];
            const t = ((frame + i * 17) % period) / period;
            const by = lerp(BY + BH - 20, BY + 20, t);
            if (by < y0 + 18) return null;
            return (
              <circle
                key={i}
                cx={BX + 70 + i * 62 + Math.sin(t * Math.PI * 4) * 8}
                cy={by}
                r={5 + (i % 3) * 3}
                fill={C.fg}
                opacity={0.35}
              />
            );
          })}
        </g>
        <rect x={BX} y={BY} width={BW} height={BH} rx={60} fill="none" stroke={C.dim} strokeWidth={6} />
        <text
          x={BX + BW + 60}
          y={y0 + 14}
          fill={C.fg}
          fontSize={56}
          fontWeight={700}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {pct}%
        </text>
        <line x1={BX + BW + 10} y1={y0} x2={BX + BW + 44} y2={y0} stroke={C.fg} strokeWidth={4} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 11,
  name: "水位上涨",
  group: "水墨",
  desc: "瓶子里的水涨满，水面两层波浪一前一后晃，涨得快时浪大，满了再退回去，刻度跟着水面走",
  tech: "正弦波路径（每圈整数个周期）+ clipPath 裁进瓶身；振幅跟水位的速度走，水位 ease.inOut",
  frames: FRAMES,
  component: Scene,
};
export default effect;
