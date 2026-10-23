import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 顶上一层颜料，下沿挂出十几根粗细不一的滴流往下淌，快慢不同，有的淌到一半停住鼓成一滴；
// 最后整层往上收回去，接回开头
const FRAMES = 150;
const TOP = 150; // 顶层颜料的下沿
const N = 14;
const GROW1 = 110; // 淌到这一帧为止
const BACK0 = 112; // 从这一帧开始往回收
const BACK1 = 146;

const DRIPS = Array.from({ length: N }, (_, i) => {
  const r = (k: number) => rand(i * 17 + k * 101);
  const short = r(1) < 0.4; // 四成停在半路
  return {
    x: ((i + 0.25 + r(2) * 0.5) / N) * W,
    w: lerp(26, 70, r(3)),
    start: lerp(0, 50, r(4)),
    reach: short ? lerp(160, 480, r(5)) : lerp(720, 960, r(6)),
    bulb: short ? 1.45 : 1.15,
  };
});

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const back = ease.inOut(clamp01((frame - BACK0) / (BACK1 - BACK0)));
  // 顶层下沿：一排大小不同的圆，被 gooey 连成波浪边
  const lip = Array.from({ length: 24 }, (_, i) => ({
    x: (i / 23) * W,
    r: lerp(40, 70, rand(i * 7 + 3)),
  }));
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="drip-goo" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={14} result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -12" />
          </filter>
        </defs>
        <g filter="url(#drip-goo)" fill={C.accent}>
          <rect x={-40} y={-40} width={W + 80} height={TOP + 40} />
          {lip.map((c, i) => (
            <circle key={i} cx={c.x} cy={TOP} r={c.r} />
          ))}
          {DRIPS.map((d, i) => {
            // 先慢后快地淌下去，到位前减速；收回时所有滴流一起缩回顶层
            const t = clamp01((frame - d.start) / (GROW1 - d.start));
            const len = d.reach * ease.inOut(t) * (1 - back);
            if (len < 1) return null;
            const head = (d.w / 2) * lerp(1, d.bulb, ease.out(clamp01(t * 1.2)));
            return (
              <g key={i}>
                <rect x={d.x - d.w / 2} y={TOP - 40} width={d.w} height={len + 40} rx={d.w / 2} />
                <circle cx={d.x} cy={TOP + len} r={head} />
              </g>
            );
          })}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 36,
  name: "颜料往下滴",
  group: "水墨",
  desc: "画面顶上一层颜料，下沿挂出十几根粗细不一的滴流慢慢往下淌，有的停在半路鼓成一滴，最后整层收回顶上",
  tech: "SVG gooey 滤镜（feGaussianBlur 14 + alpha ×30−12）把顶层、波浪边和每根圆头长条连成一体；长度按 ease.inOut 涨到各自的落点，滴头半径随进度鼓起。创意参考 remotion-scenes 的 LiquidPaintDrip",
  frames: FRAMES,
  component: Scene,
};
export default effect;
