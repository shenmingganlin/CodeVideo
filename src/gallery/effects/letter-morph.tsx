import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LetterMorph } from "../../shared/motion/Morph";
import { ease } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一个词变成另一个词：两边都有的那段字整体滑到新位置，其余的字旧的往上退、新的从下面升起；再变回来
const FRAMES = 150;
const A = "做视频";
const B = "用代码做视频";
const FONT_STYLE: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 170,
  fontWeight: 800,
};
const Y = H / 2 - 95;
// 两段变形之间各停一会儿；两个 LetterMorph 一直挂着（换方向只切 visibility），省得每次重新量字宽
const GO = { start: 14, end: 56 };
const BACK = { start: 89, end: 131 };
const SWITCH = 72;

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const forward = frame < SWITCH;
  const layer = (visible: boolean, node: React.ReactNode) => (
    <AbsoluteFill style={{ visibility: visible ? "visible" : "hidden" }}>{node}</AbsoluteFill>
  );
  return (
    <Stage>
      {layer(
        forward,
        <LetterMorph
          frame={frame}
          start={GO.start}
          end={GO.end}
          from={A}
          to={B}
          font={FONT_STYLE}
          color={C.fg}
          colorTo={C.accent}
          x={W / 2}
          y={Y}
          mode="travel"
          minRun={2}
          ease={ease.snap}
        />,
      )}
      {layer(
        !forward,
        <LetterMorph
          frame={frame}
          start={BACK.start}
          end={BACK.end}
          from={B}
          to={A}
          font={FONT_STYLE}
          color={C.accent}
          colorTo={C.fg}
          x={W / 2}
          y={Y}
          mode="travel"
          minRun={2}
          ease={ease.snap}
        />,
      )}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 5,
  name: "词变词",
  group: "文字",
  desc: "“做视频”变成“用代码做视频”：共有的三个字整体滑到新位置，多出来的字从下面升起，颜色跟着过渡；再变回来",
  tech: "LetterMorph mode=travel、minRun=2，ease.snap；只有连续两字以上的共有片段会滑动，其余旧字上退、新字升起",
  frames: FRAMES,
  component: Scene,
};
export default effect;
