import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 六位数，每一位是一个竖向滚轮：一起转起来，从左到右依次减速停下，最后一位停时回弹一下；
// 停一会儿，再一起转回 000000
const FRAMES = 150;
const TARGET = [3, 0, 5, 8, 7, 1];
const DW = 170; // 窗口宽
const DH = 240; // 窗口高 = 一个数字的高度
const GAP = 20;
const START = 6;
const STOP0 = 44; // 第一位停下
const STOP_STEP = 8; // 往右每位晚停 8 帧
const BACK0 = 110; // 一起转回去
const BACK1 = FRAMES;

// 第 i 位此刻滚到的位置（单位：数字格，整数时正好停在一个数字上）
const posAt = (i: number, f: number) => {
  const stop = STOP0 + i * STOP_STEP;
  const spins = 2 + i; // 越往右转得越多圈，停得越晚也不显得慢
  const p1 = 10 * spins + TARGET[i];
  if (f < BACK0) {
    let p = p1 * ease.snap(clamp01((f - START) / (stop - START)));
    // 最后一位停下时冲过头一点再弹回
    if (i === TARGET.length - 1 && f > stop) {
      const t = f - stop;
      p += 0.22 * Math.exp(-t / 4) * Math.sin(t * 0.7);
    }
    return p;
  }
  const end = Math.ceil(p1 / 10) * 10 + 10;
  return p1 + (end - p1) * ease.inOut(clamp01((f - BACK0) / (BACK1 - BACK0)));
};

const digit = (k: number) => ((k % 10) + 10) % 10;

const Wheel: React.FC<{ i: number; frame: number; x: number; y: number }> = ({ i, frame, x, y }) => {
  const p = posAt(i, frame);
  const speed = Math.abs(p - posAt(i, frame - 1)); // 格/帧
  const k = Math.floor(p);
  const frac = p - k;
  // 越快越糊：纵向拉长 + 叠两层半透明残影
  const stretch = 1 + Math.min(0.5, speed * 0.35);
  const ghost = Math.min(0.5, speed * 0.4);
  // 停稳的那一位描一圈强调色，转回去时褪掉（第 0 帧和最后一帧都不描，接缝不跳）
  const stop = STOP0 + i * STOP_STEP;
  const glow = clamp01((frame - stop) / 6) * (1 - clamp01((frame - BACK0) / 10));
  const cells = [-1, 0, 1].map((o) => {
    const top = (frac + o) * DH; // 数字往下滚
    return { n: digit(k - o), top };
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: DW,
        height: DH,
        overflow: "hidden",
        borderRadius: 18,
        background: C.bg2,
        boxShadow: `inset 0 0 0 3px ${mixColor(C.bg2, C.accent, glow * 0.8)}`,
      }}
    >
      {cells.map(({ n, top }, j) =>
        [0, 1, 2].map((g) =>
          g > 0 && ghost < 0.02 ? null : (
            <div
              key={`${j}-${g}`}
              style={{
                position: "absolute",
                left: 0,
                top: top - g * speed * DH * 0.18,
                width: DW,
                height: DH,
                lineHeight: `${DH}px`,
                textAlign: "center",
                fontSize: 190,
                fontWeight: 800,
                fontFamily: FONT,
                fontVariantNumeric: "tabular-nums",
                color: g === 0 ? C.fg : C.dim,
                opacity: g === 0 ? 1 : ghost / g,
                transform: `scaleY(${stretch})`,
              }}
            >
              {n}
            </div>
          ),
        ),
      )}
      {/* 滚轮的弧度：上下边压暗 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${C.bg} 0%, transparent 28%, transparent 72%, ${C.bg} 100%)`,
          opacity: 0.85,
        }}
      />
    </div>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const n = TARGET.length;
  const total = n * DW + (n - 1) * GAP;
  const x0 = (W - total) / 2;
  return (
    <Stage>
      {TARGET.map((_, i) => (
        <Wheel key={i} i={i} frame={frame} x={x0 + i * (DW + GAP)} y={(H - DH) / 2} />
      ))}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 25,
  name: "老虎机滚数字",
  group: "文字",
  desc: "六位数每位是一个竖向滚轮，一起转起来，从左到右依次减速停下，最后一位冲过头弹回来；停一会儿再一起转回零",
  tech: "每位一个 overflow:hidden 窗口，位置 p 以格为单位、frac 决定数字下滚；越往右多转一圈、晚停 8 帧（ease.snap）；速度大时 scaleY 拉长并叠两层残影，最后一位衰减正弦回弹。创意参考 remotion-scenes 的 RollerSlotMachine",
  frames: FRAMES,
  component: Scene,
};
export default effect;
