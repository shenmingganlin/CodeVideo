import { useMemo } from "react";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Composition,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { activeSubtitle, toSubtitles } from "../../shared/captions";
import { SANS_FAMILY } from "../../shared/fonts";
import {
  layoutVoice,
  loadVoice,
  type VoiceLayout,
  VoiceTrack,
} from "../../shared/voice";

// 环境自检：Edge 配音 + 逐词字幕。台词在同目录的 voice.json，改完运行 npm run voice -- src/checks/voice
const FPS = 30;

type Props = { voice: VoiceLayout | null };

// 视频长度跟着配音走：读清单、排时间轴，再把结果当 props 传给画面
const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  abortSignal,
}) => {
  const voice = layoutVoice(await loadVoice("checks/voice", abortSignal), {
    fps: FPS,
  });
  return { durationInFrames: voice.durationInFrames, props: { voice } };
};

export const VoiceCheck: React.FC = () => {
  return (
    <Composition
      id="VoiceCheck"
      component={VoiceCheckScene}
      durationInFrames={1}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ voice: null }}
      calculateMetadata={calculateMetadata}
    />
  );
};

const VoiceCheckScene: React.FC<Props> = ({ voice }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const subtitles = useMemo(
    () => (voice ? toSubtitles(voice.lines) : []),
    [voice],
  );
  if (!voice) {
    return null;
  }
  const ms = (frame / fps) * 1000;
  const subtitle = activeSubtitle(subtitles, ms);
  // 正在读的那句：从第一个词开口到最后一个词读完
  const line = voice.lines.find(
    ({ captions }) =>
      captions.length > 0 &&
      ms >= captions[0].startMs &&
      ms < captions[captions.length - 1].endMs,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4f4f2",
        color: "#1d1d1f",
        fontFamily: SANS_FAMILY,
      }}
    >
      <VoiceTrack lines={voice.lines} />
      <div style={{ position: "absolute", top: 64, left: 80, fontSize: 36 }}>
        配音字幕自检 · 第 {frame} 帧 ·{" "}
        {line ? `${line.id}（${line.voice}）` : "句间停顿"}
      </div>
      {subtitle ? (
        <div
          style={{
            position: "absolute",
            bottom: 140,
            width: "100%",
            textAlign: "center",
            fontSize: 64,
            fontWeight: 600,
          }}
        >
          {subtitle.tokens.map((token) => (
            // 已经读到的词用深色，还没读到的用浅灰，用来看字幕和声音对不对得上
            <span
              key={token.startMs}
              style={{ color: ms >= token.startMs ? "#1d1d1f" : "#b0b0ac" }}
            >
              {token.text}
            </span>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
