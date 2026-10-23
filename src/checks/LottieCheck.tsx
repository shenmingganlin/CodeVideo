import type { LottieAnimationData } from "@remotion/lottie";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Composition,
  useCurrentFrame,
} from "remotion";
import { SANS_FAMILY } from "../shared/fonts";
import { LottieClip, loadLottie, lottieFrames } from "../shared/lottie";

// 环境自检：Lottie。public/checks/lottie/ 下是手写的弹球（1 秒一循环，带挤压拉伸），
// 同一段动画做了 30fps 和 60fps 两份，左右并排循环 3 遍：两个球始终同步，说明帧率换算对了。
// 现成的 Lottie 动画放在作品对应的 public/ 目录，来源和许可证写进 brief.md
const FPS = 30;
const LOOPS = 3;

type Props = {
  bounce30: LottieAnimationData | null;
  bounce60: LottieAnimationData | null;
};

const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  abortSignal,
}) => {
  const [bounce30, bounce60] = await Promise.all([
    loadLottie("checks/lottie/bounce.json", abortSignal),
    loadLottie("checks/lottie/bounce-60fps.json", abortSignal),
  ]);
  return {
    durationInFrames: lottieFrames(bounce30, FPS) * LOOPS,
    props: { bounce30, bounce60 },
  };
};

export const LottieCheck: React.FC = () => {
  return (
    <Composition
      id="LottieCheck"
      component={LottieCheckScene}
      durationInFrames={1}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ bounce30: null, bounce60: null }}
      calculateMetadata={calculateMetadata}
    />
  );
};

const LABEL: React.CSSProperties = {
  position: "absolute",
  top: 860,
  fontSize: 36,
  width: 800,
  textAlign: "center",
};

const LottieCheckScene: React.FC<Props> = ({ bounce30, bounce60 }) => {
  const frame = useCurrentFrame();
  if (!bounce30 || !bounce60) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4efe6",
        color: "#33201a",
        fontFamily: SANS_FAMILY,
      }}
    >
      <div style={{ position: "absolute", left: 120, top: 40 }}>
        <LottieClip data={bounce30} loop style={{ width: 800, height: 800 }} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 40 }}>
        <LottieClip data={bounce60} loop style={{ width: 800, height: 800 }} />
      </div>
      <div style={{ ...LABEL, left: 120 }}>30fps 的 Lottie</div>
      <div style={{ ...LABEL, left: 1000 }}>60fps 的 Lottie</div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          width: "100%",
          textAlign: "center",
          fontSize: 40,
        }}
      >
        Lottie · 放进 30fps 的视频，两个球应该一直同步 · 第 {frame} 帧
      </div>
    </AbsoluteFill>
  );
};
