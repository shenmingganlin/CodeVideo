import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 左右两个磁极，几百根铁屑先乱七八糟地散着，从磁极附近开始一圈圈转向、挪到磁感线上，
// 排出标准的偶极子图样；停一会儿再被抖散回原样
const FRAMES = 150;
const CX = W / 2;
const CY = H / 2;
const D = 360; // 磁极到中心的距离
const POLE_R = 70; // 场线从离磁极这么远的地方起笔
const NP = { x: CX - D, y: CY };
const SP = { x: CX + D, y: CY };
const LEN = 18; // 一根铁屑的长度
const GAP = 24; // 沿场线每隔多少像素放一根

// 两个点"磁荷" +q、−q 叠加的场
const field = (x: number, y: number) => {
  const ax = x - NP.x, ay = y - NP.y, bx = x - SP.x, by = y - SP.y;
  const ra = Math.pow(ax * ax + ay * ay, 1.5), rb = Math.pow(bx * bx + by * by, 1.5);
  return { x: ax / ra - bx / rb, y: ay / ra - by / rb };
};

type Filing = { x0: number; y0: number; a0: number; x1: number; y1: number; a1: number; delay: number };

const build = (): Filing[] => {
  const out: Filing[] = [];
  const LINES = 18;
  for (let k = 0; k < LINES; k++) {
    const th = ((k + 0.5) / LINES) * Math.PI * 2;
    let x = NP.x + Math.cos(th) * POLE_R, y = NP.y + Math.sin(th) * POLE_R;
    let walked = GAP / 2;
    for (let step = 0; step < 900; step++) {
      const f = field(x, y);
      const m = Math.hypot(f.x, f.y);
      const dx = f.x / m, dy = f.y / m;
      x += dx * 4;
      y += dy * 4;
      walked += 4;
      if (Math.hypot(x - SP.x, y - SP.y) < POLE_R || x < -40 || x > W + 40 || y < -40 || y > H + 40) break;
      if (walked >= GAP) {
        walked -= GAP;
        const seed = out.length + 1;
        const jit = (rand(seed * 5) - 0.5) * 8;
        const dist = Math.min(Math.hypot(x - NP.x, y - NP.y), Math.hypot(x - SP.x, y - SP.y));
        out.push({
          x0: rand(seed * 5 + 1) * W,
          y0: rand(seed * 5 + 2) * H,
          a0: rand(seed * 5 + 3) * Math.PI,
          x1: x - dy * jit,
          y1: y + dx * jit,
          a1: Math.atan2(dy, dx),
          delay: clamp01((dist - POLE_R) / 700) * 0.22 + rand(seed * 5 + 4) * 0.04,
        });
      }
    }
  }
  // 铁屑不分头尾：目标角取和起始角差得最少的那个方向
  for (const f of out) {
    while (f.a1 - f.a0 > Math.PI / 2) f.a1 -= Math.PI;
    while (f.a1 - f.a0 < -Math.PI / 2) f.a1 += Math.PI;
  }
  return out;
};
const FILINGS = build();

const Pole: React.FC<{ x: number; label: string; color: string }> = ({ x, label, color }) => (
  <g>
    <rect x={x - 55} y={CY - 80} width={110} height={160} rx={22} fill={color} />
    <text x={x} y={CY + 22} textAnchor="middle" fontFamily={FONT} fontSize={64} fontWeight={700} fill={C.bg}>
      {label}
    </text>
  </g>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  return (
    <Stage>
      <svg width={W} height={H}>
        {FILINGS.map((f, i) => {
          // 0–0.12 散着；按离磁极远近依次排上去；0.62–0.74 停住；0.74–0.96 抖散回去
          const into = ease.inOut(clamp01((u - 0.12 - f.delay) / 0.22));
          const back = ease.inOut(clamp01((u - 0.74 - (0.22 - f.delay) * 0.3) / 0.16));
          const k = into * (1 - back);
          // 正在挪动的铁屑跟着"敲桌子"抖
          const moving = Math.sin(Math.PI * k);
          const shake = moving * 6 * Math.sin(frame * 2.3 + i);
          const x = lerp(f.x0, f.x1, k) + shake;
          const y = lerp(f.y0, f.y1, k) + shake * 0.6;
          const a = lerp(f.a0, f.a1, k) + moving * 0.4 * Math.sin(frame * 1.7 + i * 3);
          const dx = (Math.cos(a) * LEN) / 2, dy = (Math.sin(a) * LEN) / 2;
          return (
            <line
              key={i}
              x1={x - dx}
              y1={y - dy}
              x2={x + dx}
              y2={y + dy}
              stroke={mixColor(C.dim, C.fg, 0.35 + 0.55 * k)}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
        <Pole x={NP.x} label="N" color={C.accent} />
        <Pole x={SP.x} label="S" color={C.cool} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 29,
  name: "铁屑排成磁感线",
  group: "粒子",
  desc: "左右两块磁铁，满屏乱撒的铁屑从磁极附近开始一圈圈转过来、挪到磁感线上，排出标准的磁感线图样，停一会儿再被抖散",
  tech: "两个点磁荷 ±q 叠加出偶极子场，从 N 极起 18 条场线逐步积分，沿线每 24px 放一根铁屑；每根按离磁极的距离错开时间，从随机位置和朝向插值过去（铁屑不分头尾，角度取差得少的方向）。创意参考 remotion-scenes 的 ParticleMagneticField",
  frames: FRAMES,
  component: Scene,
};
export default effect;
