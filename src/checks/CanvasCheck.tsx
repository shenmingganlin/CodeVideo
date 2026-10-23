import { useCallback } from "react";
import { AbsoluteFill, Composition } from "remotion";
import { CanvasLayer, simulate } from "../shared/canvas";
import { rand } from "../shared/motion/motion";

// 环境自检：Canvas 2D 图层 + 确定性模拟。12000 个粒子顺着流场走，每个粒子画成"3 帧前 → 现在"的一小段线，
// 寿命到了就在随机位置重生。180 帧 = 6 秒。
// 乱序渲染时每一帧都一样，靠的是 simulate() 的检查点：第 f 帧总是从最近的检查点按同样的步子算过来

const W = 1920;
const H = 1080;
const N = 12000;
const TRAIL = 3;
const SPEED = 2.4;

// 流场：角度只看位置和时间
const angleAt = (x: number, y: number, f: number) =>
  Math.sin(x * 0.0031 + f * 0.011) * 2.1 + Math.cos(y * 0.0043 - f * 0.008) * 1.9 + Math.sin((x + y) * 0.0017) * 1.2;

// 每个粒子 3 个数：x、y、剩余寿命（帧）
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
      s[i * 3] = x + Math.cos(a) * SPEED;
      s[i * 3 + 1] = y + Math.sin(a) * SPEED;
      s[i * 3 + 2] = life;
    }
    return s;
  },
});

const Scene: React.FC = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    ctx.fillStyle = "#0B1018";
    ctx.fillRect(0, 0, W, H);
    const now = flow.at(frame);
    const before = flow.at(Math.max(0, frame - TRAIL));
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    // 按颜色分 3 批画，一批一次 stroke，比每根线一次 stroke 快几十倍
    const colors = ["#5EC8E5", "#F2B66D", "#E86F8C"];
    for (let c = 0; c < colors.length; c++) {
      ctx.strokeStyle = colors[c];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let i = c; i < N; i += colors.length) {
        const x1 = now[i * 3];
        const y1 = now[i * 3 + 1];
        const x0 = before[i * 3];
        const y0 = before[i * 3 + 1];
        // 这几帧里重生过的粒子两头离得很远，不连
        if (Math.abs(x1 - x0) > 40 || Math.abs(y1 - y0) > 40) continue;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, []);
  return (
    <AbsoluteFill style={{ background: "#0B1018" }}>
      <CanvasLayer draw={draw} />
    </AbsoluteFill>
  );
};

export const CanvasCheck: React.FC = () => (
  <Composition id="CanvasCheck" component={Scene} durationInFrames={180} fps={30} width={W} height={H} />
);
