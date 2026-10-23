import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SANS_FAMILY } from "../shared/fonts";

// 环境自检：1920×1080 横屏、本地中文字体、spring 动画
export const LandscapeCheck: React.FC = () => {
  return (
    <Composition
      id="LandscapeCheck"
      component={LandscapeCheckScene}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

const LandscapeCheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4f4f2",
        color: "#1d1d1f",
        fontFamily: SANS_FAMILY,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 700,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
        }}
      >
        CodeVideo 环境自检
      </div>
      <div
        style={{ fontSize: 40, fontWeight: 400, marginTop: 24, opacity: enter }}
      >
        1920×1080 · 30fps · 思源黑体 · 第 {frame} 帧
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 12,
          width: `${progress * 100}%`,
          backgroundColor: "#1d1d1f",
        }}
      />
    </AbsoluteFill>
  );
};
