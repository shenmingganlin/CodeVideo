import { useCurrentFrame } from "remotion";
import { clamp01, lerp } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 纸上落一滴墨，边缘毛糙地晕成一大团；再落一滴纸色，从墨里晕开把它吃掉，回到白纸。
// 墨团不铺满画面，毛边一直留在画面里
const FRAMES = 120;
const PAPER = C.fg;
const INK = C.bg;

// 一滴：落下那一帧是个小点，先快后慢地洇开，外面一圈淡的水痕走在前面
const Drop: React.FC<{
  frame: number;
  start: number;
  dur: number;
  x: number;
  y: number;
  maxR: number;
  color: string;
  filter: string;
}> = ({ frame, start, dur, x, y, maxR, color, filter }) => {
  const t = clamp01((frame - start) / dur);
  if (frame < start) return null;
  // 先快后慢
  const grow = (v: number) => 1 - Math.pow(1 - v, 1.6);
  const r = lerp(14, maxR, grow(t));
  const halo = lerp(20, maxR * 1.06, grow(clamp01(t * 1.15)));
  return (
    <g>
      <circle cx={x} cy={y} r={halo} fill={color} opacity={0.35} filter={`url(#${filter}-soft)`} />
      <circle cx={x} cy={y} r={r} fill={color} filter={`url(#${filter})`} />
    </g>
  );
};

const Rough: React.FC<{ id: string; seed: number; scale: number; freq: number }> = ({
  id,
  seed,
  scale,
  freq,
}) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={4} seed={seed} result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
  </filter>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  return (
    <Stage bg={PAPER}>
      <svg width={W} height={H}>
        <defs>
          <Rough id="ink" seed={7} scale={70} freq={0.012} />
          <Rough id="ink-soft" seed={11} scale={110} freq={0.008} />
          <Rough id="paper" seed={23} scale={70} freq={0.012} />
          <Rough id="paper-soft" seed={29} scale={110} freq={0.008} />
        </defs>
        {/* 纸色滴的 920 要连墨团带水痕一起盖住：墨的外沿约 560×1.06 + 位移 55，两个落点相距约 190 */}
        {/* 墨滴 4–56 帧洇开，纸色滴 60–112 帧盖回去，最后 8 帧是白纸，接回开头 */}
        <Drop frame={frame} start={4} dur={52} x={W * 0.46} y={H * 0.5} maxR={560} color={INK} filter="ink" />
        <Drop frame={frame} start={60} dur={52} x={W * 0.56} y={H * 0.46} maxR={920} color={PAPER} filter="paper" />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 10,
  name: "墨迹晕开",
  group: "水墨",
  desc: "一滴墨落在纸上，毛边洇成一大团，外圈带一道淡水痕；再落一滴纸色从墨里晕开，把墨团吃掉",
  tech: "SVG feTurbulence（fractalNoise，seed 固定）+ feDisplacementMap 扰动圆的边缘，外加一圈更淡更毛的水痕；半径按 1−(1−t)^1.6 先快后慢",
  frames: FRAMES,
  component: Scene,
};
export default effect;
