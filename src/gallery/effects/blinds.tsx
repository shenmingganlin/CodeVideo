import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 画面切成 10 条横条，每条绕自己的水平中线翻过去，背面是下一场对应的那一截，
// 从上到下依次错开；停一会儿再接着往同一个方向翻 180°，翻回第一场
const FRAMES = 150;
const N = 10;
const SH = H / N;
const STAG = 2; // 相邻两条错开的帧数
const DUR = 16; // 每条翻一次的帧数
const FLIPS = [20, 92]; // 两次翻转的起始帧，翻完各停一段

const SceneA: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H}>
      <circle cx={W / 2} cy={H / 2} r={230} fill={C.accent} />
      <text x={120} y={150} fill={C.fg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        01
      </text>
    </svg>
  </AbsoluteFill>
);

const SceneB: React.FC = () => (
  <AbsoluteFill style={{ background: C.accent }}>
    <svg width={W} height={H}>
      <rect
        x={W / 2 - 200}
        y={H / 2 - 200}
        width={400}
        height={400}
        rx={36}
        fill={C.bg}
        transform={`rotate(45 ${W / 2} ${H / 2})`}
      />
      <text x={120} y={150} fill={C.bg} fontFamily={FONT} fontSize={64} fontWeight={700}>
        02
      </text>
    </svg>
  </AbsoluteFill>
);

// 一条横条的一面：整幅画面往上挪到这一截，外面裁掉
const Face: React.FC<{ i: number; back?: boolean; shade: number; children: React.ReactNode }> = ({
  i,
  back,
  shade,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      backfaceVisibility: "hidden",
      transform: back ? "rotateX(180deg)" : undefined,
    }}
  >
    <div style={{ position: "absolute", left: 0, top: -i * SH, width: W, height: H }}>{children}</div>
    <div style={{ position: "absolute", inset: 0, background: "#000", opacity: shade }} />
  </div>
);

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  return (
    <Stage bg={C.bg2}>
      {Array.from({ length: N }, (_, i) => {
        const at = (s: number) => prog(frame, s + i * STAG, s + i * STAG + DUR, ease.inOut);
        const angle = 180 * at(FLIPS[0]) + 180 * at(FLIPS[1]);
        // 侧过来时变暗，读得出是在翻
        const shade = 0.55 * Math.abs(Math.sin((angle * Math.PI) / 180));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: i * SH,
              width: W,
              height: SH,
              transformStyle: "preserve-3d",
              transform: `perspective(2400px) rotateX(${angle}deg)`,
            }}
          >
            <Face i={i} shade={shade}>
              <SceneA />
            </Face>
            <Face i={i} back shade={shade}>
              <SceneB />
            </Face>
          </div>
        );
      })}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 31,
  name: "百叶窗翻开",
  group: "转场",
  desc: "画面切成十条横条，从上到下一条接一条翻过去，背面就是下一场，停一会儿再翻回来",
  tech: "每条是 preserve-3d 的双面 div，正反面各放整幅画面再负偏移裁出那一截，rotateX 0→180→360、相邻错 2 帧、每条 16 帧 ease.inOut，侧面按 |sin| 压暗；创意参考 lifeprompt-team/remotion-scenes 的 TransitionBlinds",
  frames: FRAMES,
  component: Effect,
};
export default effect;
