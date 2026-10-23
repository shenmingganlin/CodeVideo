import { useCurrentFrame } from "remotion";
import { ease, lerp, prog } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 卡片翻到背面，停一会再翻回正面。翻的时候稍微抬起来、影子跟着变窄
const FRAMES = 120;
const CW = 620;
const CH = 400;

const Face: React.FC<{
  back?: boolean;
  bg: string;
  fg: string;
  label: string;
  title: string;
}> = ({ back, bg, fg, label, title }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: 28,
      background: bg,
      color: fg,
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
      transform: back ? "rotateY(180deg)" : undefined,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 18,
      boxShadow: `inset 0 0 0 4px ${C.dim}`,
    }}
  >
    <div style={{ fontSize: 34, opacity: 0.7, letterSpacing: 6 }}>{label}</div>
    <div style={{ fontSize: 120, fontWeight: 800 }}>{title}</div>
  </div>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  // 0–180 度在 12–42 帧，180–360 度在 72–102 帧
  const a = prog(frame, 12, 42, ease.inOut);
  const b = prog(frame, 72, 102, ease.inOut);
  const angle = (a + b) * 180;
  // 翻到侧面（90 度）时抬得最高
  const lift = Math.abs(Math.sin((angle * Math.PI) / 180));
  const scale = lerp(1, 1.08, lift);
  const float = Math.sin((frame / FRAMES) * Math.PI * 2) * 10;
  const tilt = Math.sin((frame / FRAMES) * Math.PI * 4) * 3;
  const shadowW = Math.abs(Math.cos((angle * Math.PI) / 180)) * 0.85 + 0.15;
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          left: W / 2 - (CW * shadowW) / 2,
          top: H / 2 + CH / 2 + 50,
          width: CW * shadowW,
          height: 34,
          borderRadius: "50%",
          background: "#000",
          opacity: lerp(0.5, 0.25, lift),
          filter: `blur(${lerp(10, 22, lift)}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: W / 2 - CW / 2,
          top: H / 2 - CH / 2 + float - lift * 30,
          width: CW,
          height: CH,
          perspective: 1600,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `scale(${scale}) rotateX(${tilt}deg) rotateY(${angle}deg)`,
          }}
        >
          <Face bg={C.bg2} fg={C.fg} label="正面" title="问题" />
          <Face back bg={C.accent} fg={C.bg} label="背面" title="答案" />
        </div>
      </div>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 9,
  name: "卡片翻面",
  group: "形状",
  desc: "卡片绕竖轴翻到背面露出答案，停一会再翻回来，翻到侧面时抬起、影子收窄",
  tech: "CSS perspective 1600 + rotateY 按帧算（ease.inOut，30 帧翻半圈），两面 backface-visibility: hidden",
  frames: FRAMES,
  component: Scene,
};
export default effect;
