import {
  AbsoluteFill,
  Composition,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { SANS_FAMILY } from "../shared/fonts";
import { ease } from "../shared/motion/motion";
import { RoughPaths, roughGenerator, useBoilSeed } from "../shared/rough";

// 环境自检：Rough.js 手绘草图风。几个图形一笔笔画出来，之后每 3 帧换一次 seed 做"抖线"。
// 120 帧 = 4 秒。并行渲染的每一帧都得到同样的线条，靠的是 roughGenerator 的固定 seed
const INK = "#2b2b2b";
const RED = "#d9480f";
const BLUE = "#1c7ed6";

export const RoughCheck: React.FC = () => {
  return (
    <Composition
      id="RoughCheck"
      component={RoughCheckScene}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

// 第 start 帧开始画，画 length 帧
const draw = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inOut,
  });

const RoughCheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  // 画完以后才开始抖，画的过程中线条不变
  const seed = useBoilSeed(7, frame < 70 ? 0 : 3);
  const g = roughGenerator(seed);

  const box = g.rectangle(260, 300, 420, 320, {
    stroke: INK,
    strokeWidth: 4,
    fill: BLUE,
    fillStyle: "hachure",
    hachureGap: 14,
    roughness: 1.6,
  });
  const ball = g.circle(1300, 460, 340, {
    stroke: INK,
    strokeWidth: 4,
    fill: RED,
    fillStyle: "cross-hatch",
    hachureGap: 16,
    roughness: 1.4,
    // 同一个 seed 下两个图形也不会一样，这里换个 seed 只是演示用法
    seed: seed + 100,
  });
  const arrow = g.curve(
    [
      [720, 470],
      [900, 380],
      [1080, 470],
    ],
    { stroke: INK, strokeWidth: 5, roughness: 1.2 },
  );
  const head = g.linearPath(
    [
      [1040, 430],
      [1085, 474],
      [1025, 492],
    ],
    { stroke: INK, strokeWidth: 5, roughness: 1.2 },
  );
  const underline = g.line(560, 860, 1360, 860, {
    stroke: RED,
    strokeWidth: 6,
    roughness: 2.2,
    bowing: 4,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#faf6ec",
        fontFamily: SANS_FAMILY,
        color: INK,
      }}
    >
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <RoughPaths drawable={box} progress={draw(frame, 0, 30)} />
        <RoughPaths drawable={arrow} progress={draw(frame, 24, 16)} />
        <RoughPaths drawable={head} progress={draw(frame, 38, 6)} />
        <RoughPaths drawable={ball} progress={draw(frame, 36, 30)} />
        <RoughPaths drawable={underline} progress={draw(frame, 60, 10)} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 770,
          width: "100%",
          textAlign: "center",
          fontSize: 56,
        }}
      >
        Rough.js 手绘草图 · 固定 seed · 画完每 3 帧抖一次
      </div>
    </AbsoluteFill>
  );
};
