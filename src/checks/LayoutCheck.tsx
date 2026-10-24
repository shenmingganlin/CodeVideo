import React from "react";
import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from "remotion";
import { box, LayoutProbe } from "../shared/layout";

// npm run layout 的自检：60 帧里故意出三种情况，应该报出且只报出这三处
//   第 0–29 帧：标注从右往左滑，第 24 帧前后压上标题（压住）
//   第 30–59 帧：右下角的字滑出安全区（出界）
//   Canvas 画的圆用 regions 报上来，第 32 帧前后起压住副标题（压住）
//   字幕压在圆上是允许的（allow），框里的小字和框嵌套，都不该报
const SAFE = { l: 80, t: 60, r: 1840, b: 1020 };

const LayoutCheckScene: React.FC = () => {
  const f = useCurrentFrame();
  const noteX = interpolate(f, [0, 29], [1500, 300], { extrapolateRight: "clamp" });
  const tagX = interpolate(f, [30, 59], [1500, 1800], { extrapolateLeft: "clamp" });
  const circleY = interpolate(f, [0, 59], [800, 420]);
  const text: React.CSSProperties = { position: "absolute", fontFamily: "sans-serif", fontSize: 64, color: "white" };
  return (
    <AbsoluteFill style={{ background: "#223" }}>
      <div {...box("标题")} style={{ ...text, left: 200, top: 200, border: "3px solid #fc6", padding: 20 }}>
        标题文字
        <div {...box("框里的小字")} style={{ fontSize: 28 }}>框里的小字</div>
      </div>
      <div {...box("标注")} style={{ ...text, left: noteX, top: 230, color: "#fc6" }}>
        标注
      </div>
      <div {...box("副标题")} style={{ ...text, left: 900, top: 460, fontSize: 48 }}>
        副标题在这里
      </div>
      <div {...box("角标")} style={{ ...text, left: tagX, top: 900, fontSize: 40 }}>
        角标
      </div>
      <svg style={{ position: "absolute", inset: 0 }} width={1920} height={1080}>
        <circle cx={1000} cy={circleY} r={80} fill="#6cf" />
      </svg>
      <div {...box("字幕")} style={{ ...text, left: 860, top: 960, fontSize: 40 }}>
        字幕压着圆没关系
      </div>
      <LayoutProbe safe={SAFE} allow={[["字幕", "圆"]]} regions={(g) => [{ name: "圆", x: 920, y: interpolate(g, [0, 59], [800, 420]) - 80, w: 160, h: 160 }]} />
    </AbsoluteFill>
  );
};

export const LayoutCheck: React.FC = () => (
  <Composition id="LayoutCheck" component={LayoutCheckScene} width={1920} height={1080} fps={30} durationInFrames={60} />
);
