import { useCurrentFrame } from "remotion";
import { clamp01, lerp, mixColor, rand } from "../../shared/motion/motion";
import { C, Stage, W, type GalleryEffect } from "../kit";

// 一句话的字从画面上方一个个砸到地平线上，落地压扁回弹；停一拍，再一个个蹦起来飞出画面
const FRAMES = 135;
const TEXT = Array.from("字从天上掉下来");
const SIZE = 150;
const GAP = 14;
const BASE = 640; // 地平线（字的底边）
const IN0 = 4; // 第一个字开始下落
const STAGGER = 5;
const FALL = 14; // 下落帧数
const OUT0 = 72; // 第一个字蹦走
const FLY = 26; // 蹦走帧数

// 落地后的压扁回弹：先扁后高，几下就停
const landing = (t: number) => (t < 0 ? 0 : Math.exp(-t / 4.5) * Math.cos(t * 0.55));

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const total = TEXT.length * SIZE + (TEXT.length - 1) * GAP;
  const x0 = (W - total) / 2;
  return (
    <Stage>
      {/* 地平线，字砸下来的地方 */}
      <div
        style={{
          position: "absolute",
          left: x0 - 60,
          width: total + 120,
          top: BASE + 6,
          height: 4,
          borderRadius: 2,
          background: C.bg2,
        }}
      />
      {TEXT.map((ch, i) => {
        const fIn = IN0 + i * STAGGER;
        const fOut = OUT0 + i * STAGGER;
        let y = 0;
        let sx = 1;
        let sy = 1;
        let rot = 0;
        let op = 1;
        let color: string = C.fg;
        if (frame < fIn) return null;
        if (frame < fIn + FALL) {
          // 自由落体：越落越快，砸下去那一帧速度最大
          const t = (frame - fIn) / FALL;
          y = -(1 - t * t) * 760;
          sy = 1 + 0.25 * t; // 下落时被速度拉长
          sx = 1 / sy;
        } else if (frame < fOut) {
          const w = landing(frame - fIn - FALL);
          sx = 1 + 0.32 * w;
          sy = 1 - 0.32 * w;
          color = mixColor(C.fg, C.accent, clamp01(w * 1.6));
        } else {
          // 蹦走：先蹲一下，再抛物线飞出画面上方，带一点转
          const t = (frame - fOut) / FLY;
          if (t >= 1) return null;
          const crouch = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0;
          sx = 1 + 0.18 * crouch;
          sy = 1 - 0.22 * crouch;
          const u = clamp01((t - 0.18) / 0.82);
          y = -(u * 1.5 - 0.4 * u * u) * 900;
          const side = rand(i * 7.3) - 0.5;
          rot = u * side * 120;
          op = 1 - clamp01((u - 0.6) / 0.4);
          sy *= lerp(1, 1.2, Math.min(1, u * 3));
          sx /= lerp(1, 1.2, Math.min(1, u * 3));
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0 + i * (SIZE + GAP),
              top: BASE - SIZE,
              width: SIZE,
              height: SIZE,
              lineHeight: `${SIZE}px`,
              textAlign: "center",
              fontSize: SIZE,
              fontWeight: 900,
              color,
              opacity: op,
              transformOrigin: "50% 100%",
              transform: `translateY(${y}px) rotate(${rot}deg) scale(${sx}, ${sy})`,
            }}
          >
            {ch}
          </div>
        );
      })}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 2,
  name: "字砸下来再蹦走",
  group: "文字",
  desc: "一句话的字一个个从上方砸到地平线上，落地压扁回弹、闪一下强调色，停一拍后蹲一下蹦出画面",
  tech: "逐字 DOM，自由落体 y=t²、落地用衰减余弦做压扁回弹，底边为变形原点；每字错开 5 帧",
  frames: FRAMES,
  component: Scene,
};
export default effect;
