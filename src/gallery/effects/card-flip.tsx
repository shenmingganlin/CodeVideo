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
  // 一个循环浮两次：正弦本身两头慢中间快，像漂在水上；幅度放大到看得清
  const phase = (frame / FRAMES) * Math.PI * 4;
  const float = -Math.sin(phase) * 16;
  const float01 = 0.5 + 0.5 * Math.sin(phase); // 0 最低、1 最高
  // 倾斜比浮动晚四分之一拍，像被水推着晃
  const tilt = Math.sin(phase - Math.PI / 2) * 3;
  const shadowW = Math.abs(Math.cos((angle * Math.PI) / 180)) * 0.85 + 0.15;
  return (
    <Stage>
      {/* 浮动写进卡片自己的 3D 变换里：写在 top 或外层 translate 上，Chrome 会把整层对齐到整像素，浮起来一顿一顿的 */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - CW / 2,
          top: H / 2 + CH / 2 + 50,
          width: CW,
          height: 34,
          borderRadius: "50%",
          background: "#000",
          // 卡片往上浮时影子变小变淡
          opacity: lerp(0.5, 0.25, lift) * (1 - float01 * 0.25),
          filter: `blur(${lerp(10, 22, lift) + float01 * 4}px)`,
          transform: `scaleX(${shadowW * (1 - float01 * 0.08)})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: W / 2 - CW / 2,
          top: H / 2 - CH / 2,
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
            transform: `translateY(${float - lift * 30}px) scale(${scale}) rotateX(${tilt}deg) rotateY(${angle}deg)`,
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
  tech: "CSS perspective 1600 + rotateY 按帧算（ease.inOut，30 帧翻半圈），两面 backface-visibility: hidden；上下浮动走 translate3d（top 带小数会被取整到整像素，浮起来一顿一顿），倾斜比浮动晚四分之一拍",
  frames: FRAMES,
  component: Scene,
};
export default effect;
