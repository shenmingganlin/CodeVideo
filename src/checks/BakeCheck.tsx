import { useCallback } from "react";
import { AbsoluteFill, Composition, Sequence, interpolate, useCurrentFrame } from "remotion";
import { PreviewBake } from "../shared/bake";
import { CanvasLayer, simulate } from "../shared/canvas";
import { rand } from "../shared/motion/motion";

// 环境自检：预览烘焙（src/shared/bake.tsx）。12000 根细丝的流场包在 <PreviewBake id="flow"> 里，
// 放在从第 30 帧开始的 <Sequence> 里，外层还有淡入，用来验证烘焙的帧号和外层效果都对得上。
//   npm run bake -- BakeCheck flow      烘焙后 Studio 里这层左上角出"烘焙预览"，播放不卡
//   npm run bake -- BakeCheck flow --clear
// 背景、标题不在烘焙里，烘出来的视频只有细丝，透明底

const W = 1920;
const H = 1080;
const N = 12000;
const TRAIL = 3;

const angleAt = (x: number, y: number, f: number) =>
  Math.sin(x * 0.0031 + f * 0.011) * 2.1 + Math.cos(y * 0.0043 - f * 0.008) * 1.9 + Math.sin((x + y) * 0.0017) * 1.2;

const respawn = (s: Float32Array, i: number, f: number) => {
  s[i * 3] = rand(i * 7.13 + f * 0.917) * W;
  s[i * 3 + 1] = rand(i * 3.71 + f * 1.303 + 11) * H;
  s[i * 3 + 2] = 40 + Math.floor(rand(i * 1.97 + f * 0.53 + 29) * 120);
};

const flow = simulate({
  every: 30,
  init: () => {
    const s = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) respawn(s, i, 0);
    return s;
  },
  step: (s, f) => {
    for (let i = 0; i < N; i++) {
      const x = s[i * 3];
      const y = s[i * 3 + 1];
      const life = s[i * 3 + 2] - 1;
      if (life <= 0 || x < -20 || x > W + 20 || y < -20 || y > H + 20) {
        respawn(s, i, f);
        continue;
      }
      const a = angleAt(x, y, f);
      s[i * 3] = x + Math.cos(a) * 2.4;
      s[i * 3 + 1] = y + Math.sin(a) * 2.4;
      s[i * 3 + 2] = life;
    }
    return s;
  },
});

const Flow: React.FC = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    const now = flow.at(frame);
    const before = flow.at(Math.max(0, frame - TRAIL));
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    const colors = ["#5EC8E5", "#F2B66D", "#E86F8C"];
    for (let c = 0; c < colors.length; c++) {
      ctx.strokeStyle = colors[c];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = c; i < N; i += colors.length) {
        const x0 = before[i * 3];
        const y0 = before[i * 3 + 1];
        const x1 = now[i * 3];
        const y1 = now[i * 3 + 1];
        if (Math.abs(x1 - x0) > 40 || Math.abs(y1 - y0) > 40) continue;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, []);
  return <CanvasLayer draw={draw} />;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0B1018" }}>
      <Sequence from={30}>
        {/* 外层的淡入不进烘焙，Studio 里照常套在烘焙视频上 */}
        <AbsoluteFill style={{ opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" }) }}>
          <PreviewBake id="flow">
            <Flow />
          </PreviewBake>
        </AbsoluteFill>
      </Sequence>
      <div style={{ position: "absolute", left: 80, bottom: 70, color: "#E8EEF5", font: "600 44px sans-serif" }}>
        第 {frame} 帧
      </div>
    </AbsoluteFill>
  );
};

export const BakeCheck: React.FC = () => (
  <Composition id="BakeCheck" component={Scene} durationInFrames={180} fps={30} width={W} height={H} />
);
