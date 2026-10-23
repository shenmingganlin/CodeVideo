import {
  getLottieMetadata,
  Lottie,
  type LottieAnimationData,
} from "@remotion/lottie";
import { staticFile, useVideoConfig } from "remotion";

// Lottie 动画：读 public/ 下的 JSON，用 <LottieClip> 播放，用法见 src/checks/LottieCheck.tsx。
//
// - @remotion/lottie 的 <Lottie> 按 Remotion 的帧号逐帧定位，不靠 lottie-web 自己的时钟，并行渲染也对得上。
//   但它把 Composition 的帧号直接当成 Lottie 的帧号，不看 JSON 里的帧率：60fps 的动画放进 30fps 的视频会慢一半。
//   <LottieClip> 按两边的帧率换算好了，不要直接用 <Lottie>
// - 带 wiggle()、random() 表达式的动画每个标签页抖得不一样（lottie-web 加载时用 Math.random 定种子），
//   要先在 AE 里把表达式转成关键帧再导出

// 一般在 calculateMetadata 里调用，把数据当 props 传进去，组件里就不用 delayRender
export const loadLottie = async (
  file: string,
  signal?: AbortSignal,
): Promise<LottieAnimationData> => {
  const res = await fetch(staticFile(file), { signal });
  if (!res.ok) {
    throw new Error(`读不到 Lottie 动画 public/${file}`);
  }
  return res.json();
};

const metadata = (data: LottieAnimationData) => {
  const meta = getLottieMetadata(data);
  if (!meta) {
    throw new Error("Lottie 数据缺少帧率、宽高或时长，不是有效的动画");
  }
  return meta;
};

// 动画在 fps 帧率下以 speed 倍速播一遍占几帧
export const lottieFrames = (
  data: LottieAnimationData,
  fps: number,
  speed = 1,
) => Math.round((metadata(data).durationInSeconds * fps) / speed);

type LottieClipProps = {
  data: LottieAnimationData;
  loop?: boolean;
  // 倍速，1 是原速
  speed?: number;
  direction?: "forward" | "backward";
  style?: React.CSSProperties;
};

// 从所在 Sequence 的第 0 帧开始播放
export const LottieClip: React.FC<LottieClipProps> = ({
  data,
  loop,
  speed = 1,
  direction,
  style,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Lottie
      animationData={data}
      loop={loop}
      direction={direction}
      playbackRate={(metadata(data).fps / fps) * speed}
      style={style}
    />
  );
};
