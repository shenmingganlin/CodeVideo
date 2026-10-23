import { useCurrentFrame } from "remotion";
import { mixColor } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 两行字浮在水面上：每个字按正弦相位依次上下起伏，跟着波的斜率轻轻歪，
// 波峰上的字变亮变成强调色；下面一条细线是水面，和字同一个波
const FRAMES = 120;
const CYCLES = 2; // 一个循环里波走两遍
const LINES = [
  { text: "字沿着波浪起伏", size: 150, y: H / 2 - 120, amp: 46, k: 0.55, dir: 1 },
  { text: "像水面上的浮标", size: 96, y: H / 2 + 150, amp: 30, k: 0.7, dir: -1 },
];

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const ph = (frame / FRAMES) * Math.PI * 2 * CYCLES;
  return (
    <Stage>
      {LINES.map((ln, li) => {
        const chars = Array.from(ln.text);
        const step = ln.size * 1.12;
        const x0 = (W - step * chars.length) / 2 + step / 2;
        // 水面：和字同相位的正弦线
        const pts: string[] = [];
        for (let x = 0; x <= W; x += 12) {
          const i = (x - x0) / step;
          const y = ln.y + ln.size * 0.62 + ln.amp * 0.55 * Math.sin(ph * ln.dir - i * ln.k);
          pts.push(`${x},${y.toFixed(1)}`);
        }
        return (
          <div key={li}>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <polyline points={pts.join(" ")} fill="none" stroke={C.cool} strokeWidth={3} opacity={0.35} />
            </svg>
            {chars.map((ch, i) => {
              const a = ph * ln.dir - i * ln.k;
              const s = Math.sin(a);
              const dy = -ln.amp * s;
              // 斜率：d(sin)/di = -k cos，按它歪一点
              const tilt = Math.cos(a) * ln.k * ln.dir * 14;
              const crest = Math.max(0, s) ** 3;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: x0 + i * step - ln.size / 2,
                    top: ln.y - ln.size / 2,
                    width: ln.size,
                    height: ln.size,
                    lineHeight: `${ln.size}px`,
                    textAlign: "center",
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: ln.size,
                    color: mixColor(li === 0 ? C.fg : "#AEB4BE", C.accent, crest),
                    transform: `translateY(${dy}px) rotate(${tilt}deg) scale(${1 + 0.06 * crest})`,
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        );
      })}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 41,
  name: "字沿波浪起伏",
  group: "文字",
  desc: "两行字像水面上的浮标，每个字依次上下起伏、跟着波歪一点，波峰上的字亮成强调色；两行的波一左一右",
  tech: "逐字 DOM：位移 = 振幅 × sin(相位 − 字序 × k)，旋转跟 cos 走（波的斜率），颜色按 max(0, sin)³ 混到强调色；一个循环波走两遍。创意参考 remotion-scenes 的 TextWave",
  frames: FRAMES,
  component: Scene,
};
export default effect;
