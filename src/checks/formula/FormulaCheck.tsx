import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Composition,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { SANS_FAMILY } from "../../shared/fonts";
import { loadManimMeta, ManimClip, type ManimMeta } from "../../shared/manim";
import { Tex } from "../../shared/tex";

// 环境自检：KaTeX 公式排版 + Manim 透明视频叠加。
// Manim 场景在同目录的 scenes.py，改完运行 npm run manim -- src/checks/formula/scenes.py
const FPS = 30;
const HOLD_FRAMES = 30;

type Props = { manim: ManimMeta | null };

// 视频比 Manim 片段多 1 秒，用来检查片段播完后停在最后一帧
const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  abortSignal,
}) => {
  const manim = await loadManimMeta(
    "checks/formula",
    "PythagorasMorph",
    abortSignal,
  );
  return {
    durationInFrames: manim.durationInFrames + HOLD_FRAMES,
    props: { manim },
  };
};

export const FormulaCheck: React.FC = () => {
  return (
    <Composition
      id="FormulaCheck"
      component={FormulaCheckScene}
      durationInFrames={1}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ manim: null }}
      calculateMetadata={calculateMetadata}
    />
  );
};

// 第一个公式从第 0 帧就显示，用来检查 KaTeX 字体在第一帧就已经加载好
const FORMULAS = [
  { tex: String.raw`\int_0^1 x^2\,dx = \frac{1}{3}`, enter: null },
  { tex: String.raw`\text{面积} = \pi r^2`, enter: 20 },
  {
    tex: String.raw`\sum_{n=1}^{\infty} \frac{1}{n^2} = \htmlStyle{color: #ea580c}{\frac{\pi^2}{6}}`,
    enter: 40,
  },
];

const FormulaCheckScene: React.FC<Props> = ({ manim }) => {
  const frame = useCurrentFrame();
  if (!manim) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4f4f2",
        color: "#1d1d1f",
        fontFamily: SANS_FAMILY,
      }}
    >
      <AbsoluteFill style={{ transform: "translateY(-150px)" }}>
        <ManimClip dir="checks/formula" scene="PythagorasMorph" meta={manim} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 80,
          fontSize: 32,
          color: "#6b6b68",
        }}
      >
        公式自检 · 上：Manim 透明视频 · 下：KaTeX · 第 {frame} 帧
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 110,
          width: "100%",
          display: "flex",
          justifyContent: "space-evenly",
          alignItems: "center",
          fontSize: 56,
        }}
      >
        {FORMULAS.map(({ tex, enter }) => (
          <Tex
            key={tex}
            tex={tex}
            display
            style={{
              opacity:
                enter === null
                  ? 1
                  : interpolate(frame, [enter, enter + 10], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
