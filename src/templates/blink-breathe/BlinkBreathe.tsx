import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type BlinkBreatheProps = {
  // public/ 下的路径：睁眼图和闭眼图，要用 npm run sticker-art 一起处理过，尺寸和位置才对齐
  open: string;
  closed: string;
  // 闭眼的帧区间（含两端），默认在 70% 处闭 4 帧
  blink?: [number, number];
  // 呼吸的伸缩幅度，0.025 = 纵向 ±2.5%
  breathe?: number;
  // 脚底离画面底边的距离
  bottom?: number;
};

// 模板「眨眼呼吸」：一张角色图 + 一张闭眼差分，循环里呼吸一次、眨一次眼。见同目录 template.md
export const BlinkBreathe: React.FC<BlinkBreatheProps> = ({
  open,
  closed,
  blink,
  breathe = 0.025,
  bottom = 20,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [from, to] = blink ?? [Math.round(durationInFrames * 0.7), Math.round(durationInFrames * 0.7) + 3];
  // 一个循环正好一个正弦周期，首尾无缝
  const scale = 1 + Math.sin((frame / durationInFrames) * Math.PI * 2) * breathe;
  const isClosed = frame >= from && frame <= to;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <Img
        src={staticFile(isClosed ? closed : open)}
        style={{
          marginBottom: bottom,
          // 以脚底为基点，纵向伸长时横向收窄。缩放会让边缘出现少量半透明像素，外圈是深色描边，看不出来
          transform: `scale(${2 - scale}, ${scale})`,
          transformOrigin: "50% 100%",
        }}
      />
    </AbsoluteFill>
  );
};
