import { useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一句话起初每个位置都在乱跳（符号、数字、汉字），从左到右一个个锁定成正确的字，
// 锁定那一下闪强调色；整句停一会儿，再从右往左碎回乱码
const FRAMES = 150;
const TEXT = Array.from("让代码替你画画");
const POOL = Array.from("#%&@$*+=?/<>01234567890ABXYZ码画字光影线点面形色帧算");
const SIZE = 150;
const GAP = 18;
const LOCK0 = 18; // 第一个字锁定
const LOCK_STEP = 8;
const BREAK0 = 104; // 最后一个字开始碎（从右往左）
const BREAK_STEP = 5;
const FLASH = 12; // 锁定后强调色褪掉的帧数

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const n = TEXT.length;
  const total = n * SIZE + (n - 1) * GAP;
  const x0 = (W - total) / 2;
  const tick = Math.floor(frame / 2); // 乱码每 2 帧换一次
  return (
    <Stage>
      {TEXT.map((ch, i) => {
        const lock = LOCK0 + i * LOCK_STEP;
        const brk = BREAK0 + (n - 1 - i) * BREAK_STEP;
        const locked = frame >= lock && frame < brk;
        let glyph = ch;
        let color: string = C.fg;
        let scale = 1;
        let dy = 0;
        if (!locked) {
          glyph = POOL[Math.floor(rand(i * 17.31 + tick * 3.77) * POOL.length)];
          color = rand(i * 5.1 + tick * 1.9) < 0.25 ? C.cool : C.dim;
          dy = (rand(i * 9.7 + tick * 2.3) - 0.5) * 10;
        } else {
          const t = clamp01((frame - lock) / FLASH);
          color = mixColor(C.accent, C.fg, t);
          scale = 1 + 0.18 * (1 - t) * (1 - t);
        }
        // 快到锁定时乱码跳得更凶，提示"要定下来了"
        const near = !locked && frame < lock && lock - frame < 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0 + i * (SIZE + GAP),
              top: (H - SIZE) / 2,
              width: SIZE,
              height: SIZE,
              lineHeight: `${SIZE}px`,
              textAlign: "center",
              fontSize: SIZE * (locked ? 1 : 0.86),
              fontWeight: 800,
              fontFamily: FONT,
              color: near ? C.fg : color,
              transform: `translateY(${dy}px) scale(${scale})`,
            }}
          >
            {glyph}
          </div>
        );
      })}
      {/* 底下一条进度线：跟着锁定的字往右长 */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: (H + SIZE) / 2 + 40,
          height: 4,
          borderRadius: 2,
          background: C.bg2,
          width: total,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x0,
          top: (H + SIZE) / 2 + 40,
          height: 4,
          borderRadius: 2,
          background: C.accent,
          width:
            total *
            (TEXT.filter((_, i) => frame >= LOCK0 + i * LOCK_STEP && frame < BREAK0 + (n - 1 - i) * BREAK_STEP).length / n),
        }}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 24,
  name: "乱码解码成字",
  group: "文字",
  desc: "一句话每个位置先乱跳符号和字，从左到右逐个锁定成正确的字、闪一下强调色；停一会儿再从右往左碎回乱码",
  tech: "逐字 DOM，乱码每 2 帧换一次、字符和颜色都用 rand(位置, 帧/2) 取；每字错开 8 帧锁定，锁定后 12 帧从强调色褪回前景色并回缩。创意参考 remotion-scenes 的 TextScramble",
  frames: FRAMES,
  component: Scene,
};
export default effect;
