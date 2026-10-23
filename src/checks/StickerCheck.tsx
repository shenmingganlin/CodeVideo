import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { StickerComposition } from "../shared/sticker";

// 环境自检：240×240 表情 GIF。透明背景，20fps × 40 帧 = 2 秒
export const StickerCheck: React.FC = () => {
  return (
    <StickerComposition
      id="StickerCheck"
      component={StickerCheckScene}
      durationInFrames={40}
    />
  );
};

const StickerCheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // 一个完整周期正好铺满整段，最后一帧之后回到第 0 帧的状态，循环不跳
  const t = (frame / durationInFrames) * Math.PI * 2;
  const lift = -Math.abs(Math.sin(t)) * 36;
  const squash = 1 + Math.cos(t * 2) * 0.06;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <svg width={240} height={240} viewBox="0 0 240 240">
        {/* 深色不透明描边：GIF 只有 1 位透明，用它盖住抗锯齿边缘 */}
        <g
          transform={`translate(120 ${150 + lift}) scale(${squash} ${2 - squash})`}
        >
          <circle r={64} fill="#ffd54a" stroke="#2b2b2b" strokeWidth={6} />
          <circle cx={-22} cy={-12} r={8} fill="#2b2b2b" />
          <circle cx={22} cy={-12} r={8} fill="#2b2b2b" />
          <path
            d="M -24 16 Q 0 38 24 16"
            fill="none"
            stroke="#2b2b2b"
            strokeWidth={6}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
