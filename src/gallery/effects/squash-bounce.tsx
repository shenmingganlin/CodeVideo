import { useCurrentFrame } from "remotion";
import { squashStretch } from "../../shared/motion/creative";
import { clamp01, ease, lerp } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 弹球：一次大跳、一次小跳。落地那几帧压扁贴地，起跳时顺着速度拉长，在空中最高点恢复圆形
const FRAMES = 120;
const R = 70;
const GROUND = 820;
const CONTACT = 6; // 每次着地压扁的帧数
// 两跳按同一个重力算：高度和腾空时间的平方成正比
const HOPS = [
  { start: 0, air: 66, height: 520 },
  { start: 72, air: 42, height: 520 * (42 / 66) ** 2 },
];

// 第 f 帧球心离地面的高度（不含半径）和竖直速度
const flight = (f: number) => {
  for (const hop of HOPS) {
    const t0 = hop.start + CONTACT;
    if (f >= t0 && f < t0 + hop.air) {
      const u = (f - t0) / hop.air;
      const y = 4 * hop.height * u * (1 - u);
      const vy = (4 * hop.height * (1 - 2 * u)) / hop.air;
      return { y, vy, air: true, hop };
    }
    if (f >= hop.start && f < t0) return { y: 0, vy: 0, air: false, hop, contact: (f - hop.start) / CONTACT };
  }
  return { y: 0, vy: 0, air: false, hop: HOPS[0], contact: 0 };
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const s = flight(frame);
  let transform = "";
  let origin = "50% 50%";
  if (s.air) {
    transform = squashStretch(0, -s.vy, 0.02, 0.45);
  } else {
    // 贴地压扁：先压到最扁再弹起，面积大致不变
    const c = s.contact ?? 0;
    const depth = (s.hop.height / HOPS[0].height) * 0.38 + 0.08;
    const k = Math.sin(Math.PI * c) * depth;
    transform = `scale(${1 + k}, ${1 / (1 + k)})`;
    origin = "50% 100%";
  }
  // 横向：大跳往右、小跳往回，正好回到起点
  const x = (() => {
    const [a, b] = HOPS;
    if (frame < b.start) return lerp(W / 2 - 330, W / 2 + 330, ease.inOutSoft(clamp01((frame - CONTACT) / a.air)));
    return lerp(W / 2 + 330, W / 2 - 330, ease.inOutSoft(clamp01((frame - b.start - CONTACT) / b.air)));
  })();
  const cy = GROUND - R - s.y;
  // 影子：球越高越小越淡
  const lift = s.y / HOPS[0].height;
  return (
    <Stage>
      <svg width={W} height={H}>
        <line x1={W / 2 - 600} x2={W / 2 + 600} y1={GROUND + 2} y2={GROUND + 2} stroke={C.bg2} strokeWidth={4} strokeLinecap="round" />
        <ellipse cx={x} cy={GROUND + 4} rx={R * lerp(1.1, 0.5, lift)} ry={R * lerp(0.2, 0.1, lift)} fill="#000" opacity={lerp(0.5, 0.15, lift)} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x - R,
          top: cy - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${C.fg} 0%, ${C.accent} 38%, #C9771E 100%)`,
          transformOrigin: origin,
          transform: transform || undefined,
        }}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 8,
  name: "弹球压扁拉长",
  group: "形状",
  desc: "弹球一次大跳往右、一次小跳回来：落地压扁贴在地上，起跳时顺着速度拉长，最高点恢复圆形，影子跟着高度缩放",
  tech: "抛物线 + squashStretch（按竖直速度拉伸，保持面积），着地 6 帧以底边为原点压扁；两跳按同一重力算高度",
  frames: FRAMES,
  component: Scene,
};
export default effect;
