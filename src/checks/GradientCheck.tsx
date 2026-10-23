import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { StickerComposition } from "../shared/sticker";

// GIF 压力测试：大面积渐变 + 半透明光晕，用来比较不同 GIF 编码器的色带和透明边处理。
// 240×240，20fps × 60 帧 = 3 秒，首尾帧无缝衔接。
// 自带导出会超过 500KB，正好用来测试导出脚本自动改用 gifski
export const GradientCheck: React.FC = () => {
  return (
    <StickerComposition
      id="GradientCheck"
      component={GradientCheckScene}
      durationInFrames={60}
    />
  );
};

const GradientCheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = (frame / durationInFrames) * Math.PI * 2;

  return (
    <AbsoluteFill>
      <svg width={240} height={240} viewBox="0 0 240 240">
        <defs>
          {/* 高光绕圈移动，逼出渐变色带 */}
          <radialGradient
            id="gradient-check-body"
            fx={0.5 + Math.cos(t) * 0.2}
            fy={0.42 + Math.sin(t) * 0.15}
            r={0.75}
          >
            <stop offset="0%" stopColor="#fff6c2" />
            <stop offset="55%" stopColor="#ffb340" />
            <stop offset="100%" stopColor="#e2541b" />
          </radialGradient>
          <filter
            id="gradient-check-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation={8 + Math.sin(t) * 4} />
          </filter>
        </defs>
        {/* 半透明光晕：GIF 只有 1 位透明，这一圈最容易出问题 */}
        <circle
          cx={120}
          cy={120}
          r={80}
          fill="#ff8a3d"
          opacity={0.6}
          filter="url(#gradient-check-glow)"
        />
        <circle cx={120} cy={120} r={70} fill="url(#gradient-check-body)" />
      </svg>
    </AbsoluteFill>
  );
};
