import { useCurrentFrame } from "remotion";
import { typeFrames } from "../../shared/motion/creative";
import { clamp01, ease, mixColor } from "../../shared/motion/motion";
import { C, FPS, Stage, type GalleryEffect } from "../kit";

// 打字机：一行字带着人手的快慢逐字打出来，新打的字闪一下强调色；停住时光标闪，再快速逐字删掉
const FRAMES = 150;
const TEXT = Array.from("让代码替你画画。");
const SIZE = 110;
const TYPE_AT = typeFrames(TEXT.join(""), 8, FPS, 7, 4); // 每个字出现的帧
const DEL0 = 108; // 开始删
const DEL_STEP = 3; // 删得比打得快
// 打满时整行的宽度：提示符 + 字 + 光标（字号是方块字，一字一个 SIZE，句号也占一格）
const FULL_WIDTH = SIZE * 0.6 + 40 + TEXT.length * SIZE + 18;
const delAt = (i: number) => DEL0 + (TEXT.length - 1 - i) * DEL_STEP; // 从最后一个字往前删

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const shown = TEXT.map((_, i) => frame >= TYPE_AT[i] && frame < delAt(i));
  const n = shown.filter(Boolean).length;
  const lastTyped = TYPE_AT[TEXT.length - 1];
  const busy = (frame >= TYPE_AT[0] && frame <= lastTyped + 2) || (frame >= DEL0 - 1 && frame <= delAt(0) + 2);
  // 打字、删字的时候光标常亮，停下来每半秒闪一次
  const caretOn = busy || Math.floor(frame / (FPS / 2)) % 2 === 0;
  return (
    <Stage>
      <div
        style={{
          // 整行（打满时）在画面里居中：left 用打满时的宽度算，打字时左边不动
          position: "absolute",
          left: "50%",
          top: 540 - SIZE * 0.6,
          transform: `translateX(-${FULL_WIDTH / 2}px)`,
          display: "flex",
          alignItems: "center",
          fontSize: SIZE,
          fontWeight: 500,
          lineHeight: 1.2,
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: C.dim, marginRight: 40, fontWeight: 300 }}>&gt;</span>
        {TEXT.map((ch, i) => {
          if (!shown[i]) return null;
          // 刚打出的字从大一点、强调色落到正文色
          const t = ease.out(clamp01((frame - TYPE_AT[i]) / 6));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: mixColor(C.accent, C.fg, t),
                transform: `scale(${1.18 - 0.18 * t}) translateY(${(1 - t) * -6}px)`,
                transformOrigin: "50% 80%",
              }}
            >
              {ch}
            </span>
          );
        })}
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 10,
            height: SIZE * 1.05,
            marginLeft: 8,
            background: C.accent,
            opacity: caretOn ? 1 : 0,
          }}
        />
        {/* 占位：n 为 0 时行高不塌 */}
        {n === 0 ? <span style={{ visibility: "hidden" }}>字</span> : null}
      </div>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 3,
  name: "打字机打出又删掉",
  group: "文字",
  desc: "一行字带着人手的快慢逐字打出，新字闪一下强调色，停住时光标闪烁，再从后往前快速删光",
  tech: "typeFrames 算每字出现帧（7 字/秒、带抖动、标点停顿加长），删字每 3 帧一个；光标忙时常亮、闲时 0.5 秒一闪",
  frames: FRAMES,
  component: Scene,
};
export default effect;
