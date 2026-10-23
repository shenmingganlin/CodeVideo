import { useCurrentFrame } from "remotion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 三团液体绕着中心转，越靠越近，粘连成一团，再拉着丝分开；外圈几颗小水珠被吸进去又甩出来
const FRAMES = 150;
const CX = W / 2;
const CY = H / 2;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  // 距离：开头最远，中间合成一团
  const d = 70 + 230 * (0.5 + 0.5 * Math.cos(u * Math.PI * 2));
  const spin = u * Math.PI * 2;
  const blobs = [0, 1, 2].map((i) => {
    const a = spin + (i * Math.PI * 2) / 3;
    return { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, r: 120 - i * 12 };
  });
  const drops = [0, 1, 2, 3, 4].map((i) => {
    const a = -spin * 2 + (i * Math.PI * 2) / 5;
    const rr = 200 + 200 * (0.5 + 0.5 * Math.cos(u * Math.PI * 4 + i));
    return { x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, r: 34 };
  });
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="goo" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={26} result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 36 -16" />
          </filter>
        </defs>
        <g filter="url(#goo)">
          {[...blobs, ...drops].map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={C.accent} />
          ))}
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 12,
  name: "液滴粘连融合",
  group: "水墨",
  desc: "三团液体边转边靠拢，挨上就粘成一团，再拉着丝分开，几颗小水珠被吸进去又甩出来",
  tech: "SVG gooey 滤镜：feGaussianBlur 26 + feColorMatrix 把 alpha 拉成 ×36−16 的硬边；圆的位置用余弦算，整圈循环",
  frames: FRAMES,
  component: Scene,
};
export default effect;
