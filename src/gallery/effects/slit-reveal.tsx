import { useCurrentFrame } from "remotion";
import { clamp01, ease } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 画面中间一条强调色细线从中点往两边拉开，大字从线上往上推出、小字从线下往下垂出，
// 两行都像从一道缝里挤出来；停一会儿，字缩回缝里，线收回中点
const FRAMES = 120;
const TOP = Array.from("让代码替你画画");
const BOTTOM = "一帧一帧算出来";
const CY = H / 2 + 20; // 缝的位置
const TOP_SIZE = 150;
const BOT_SIZE = 56;
const LINE_W = 1240;
// 时间点
const LINE_IN: [number, number] = [4, 22];
const TOP_IN = 16; // 第一个字开始往上推
const CHAR_STEP = 3;
const RISE = 18;
const BOT_IN: [number, number] = [30, 50];
const TOP_OUT = 76; // 第一个字开始缩回
const BOT_OUT: [number, number] = [72, 88];
const LINE_OUT: [number, number] = [98, 116];

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const lineIn = ease.out(clamp01((frame - LINE_IN[0]) / (LINE_IN[1] - LINE_IN[0])));
  const lineOut = ease.inOut(clamp01((frame - LINE_OUT[0]) / (LINE_OUT[1] - LINE_OUT[0])));
  const lineW = LINE_W * lineIn * (1 - lineOut);
  const topTotal = TOP.length * TOP_SIZE;
  const x0 = (W - topTotal) / 2;
  const botIn = ease.out(clamp01((frame - BOT_IN[0]) / (BOT_IN[1] - BOT_IN[0])));
  const botOut = ease.in(clamp01((frame - BOT_OUT[0]) / (BOT_OUT[1] - BOT_OUT[0])));
  const botY = (1 - botIn + botOut) * -BOT_SIZE * 1.8; // 0 是完全垂出来
  return (
    <Stage>
      {/* 上半：遮罩的底边就是缝，字从下往上推出来 */}
      <div style={{ position: "absolute", left: 0, top: CY - TOP_SIZE - 40, width: W, height: TOP_SIZE + 40, overflow: "hidden" }}>
        {TOP.map((ch, i) => {
          const tin = ease.out(clamp01((frame - TOP_IN - i * CHAR_STEP) / RISE));
          const tout = ease.in(clamp01((frame - TOP_OUT - i * CHAR_STEP) / 14));
          const y = (1 - tin + tout) * (TOP_SIZE + 40);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x0 + i * TOP_SIZE,
                top: 20,
                width: TOP_SIZE,
                height: TOP_SIZE,
                lineHeight: `${TOP_SIZE}px`,
                textAlign: "center",
                fontSize: TOP_SIZE * 0.92,
                fontWeight: 900,
                fontFamily: FONT,
                color: C.fg,
                transform: `translateY(${y}px)`,
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>
      {/* 下半：遮罩的顶边是缝，小字往下垂出来 */}
      <div style={{ position: "absolute", left: 0, top: CY + 4, width: W, height: BOT_SIZE * 1.6, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 14,
            width: W,
            textAlign: "center",
            fontSize: BOT_SIZE,
            letterSpacing: 18,
            fontFamily: FONT,
            color: C.dim,
            transform: `translateY(${botY}px)`,
          }}
        >
          {BOTTOM}
        </div>
      </div>
      {/* 缝 */}
      <div
        style={{
          position: "absolute",
          left: (W - lineW) / 2,
          top: CY - 2,
          width: lineW,
          height: 5,
          borderRadius: 3,
          background: C.accent,
        }}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 26,
  name: "字从缝里滑出",
  group: "文字",
  desc: "一条强调色细线从中点拉开，大字逐个从线上往上推出、小字从线下垂出；停一会儿缩回缝里，线收回中点",
  tech: "两个 overflow:hidden 容器以细线为边界当遮罩，字 translateY 进出（ease.out 进、ease.in 回），大字每字错开 3 帧；线宽两头用 ease 拉开收回。创意参考 remotion-scenes 的 TextMaskReveal",
  frames: FRAMES,
  component: Scene,
};
export default effect;
