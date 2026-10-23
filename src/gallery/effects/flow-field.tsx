import { useCallback } from "react";
import { CanvasLayer, simulate } from "../../shared/canvas";
import { rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 一万个粒子顺着一张会慢慢转的流场走，每根拖一小段尾巴，像风吹过的细丝。
// 首尾无缝：流场的时间是 sin/cos(2π·f/FRAMES)，粒子每 LIFE 帧在固定的位置重生（位置由编号和"第几轮"定，
// 轮数取模 FRAMES/LIFE），所以整个系统的状态每 FRAMES 帧重复一次。先空跑 FRAMES 帧再开始取，
// 让所有粒子都至少重生过一次

const FRAMES = 150;
const LIFE = 50;
const N = 10000;
const SPEED = 3;
const TAIL = 3;
const TAU = Math.PI * 2;

const angleAt = (x: number, y: number, f: number) => {
  const t = (TAU * f) / FRAMES;
  return (
    Math.sin(x * 0.0028 + Math.sin(t) * 1.4) * 2.2 +
    Math.cos(y * 0.0037 + Math.cos(t) * 1.1) * 1.8 +
    Math.sin((x - y) * 0.0015 + Math.sin(t * 2) * 0.6) * 1.1
  );
};

const birth = (s: Float32Array, i: number, f: number) => {
  const round = Math.floor((f + i) / LIFE) % (FRAMES / LIFE);
  s[i * 2] = rand(i * 1.731 + round * 97.13) * W;
  s[i * 2 + 1] = rand(i * 2.917 + round * 53.71 + 7) * H;
};

const flow = simulate({
  every: 25,
  init: () => {
    const s = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) birth(s, i, 0);
    return s;
  },
  step: (s, f) => {
    for (let i = 0; i < N; i++) {
      if ((f + i) % LIFE === 0) {
        birth(s, i, f);
        continue;
      }
      const a = angleAt(s[i * 2], s[i * 2 + 1], f);
      s[i * 2] += Math.cos(a) * SPEED;
      s[i * 2 + 1] += Math.sin(a) * SPEED;
    }
    return s;
  },
});

// 按年龄分 5 档、颜色分 2 种，一档一次 stroke；年龄两头淡、中间亮，重生不会闪
const BUCKETS = 5;
const COLORS = [C.cool, C.accent];

const Scene: React.FC = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number) => {
    const at = f + FRAMES;
    const now = flow.at(at);
    const before = flow.at(at - TAIL);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let c = 0; c < COLORS.length; c++) {
      for (let b = 0; b < BUCKETS; b++) {
        ctx.strokeStyle = COLORS[c];
        ctx.globalAlpha = 0.75 * Math.sin((Math.PI * (b + 0.5)) / BUCKETS);
        ctx.beginPath();
        for (let i = c; i < N; i += COLORS.length) {
          const age = (at + i) % LIFE;
          if (age < TAIL || Math.floor((age / LIFE) * BUCKETS) !== b) continue;
          ctx.moveTo(before[i * 2], before[i * 2 + 1]);
          ctx.lineTo(now[i * 2], now[i * 2 + 1]);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, []);
  return (
    <Stage>
      <CanvasLayer draw={draw} />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 87,
  name: "万条细丝顺风流",
  group: "粒子",
  desc: "一万根短短的细丝顺着一张看不见的风场流动，风场自己也在慢慢转，细丝汇成一股股弯曲的流线，出生和消失时都是淡入淡出",
  tech: "Canvas 2D（src/shared/canvas.tsx 的 CanvasLayer + simulate）：每个粒子按流场角度一步步积分，simulate 每 25 帧存检查点，乱序取帧结果一样；每根线是 3 帧前到现在的一段，按年龄分 5 档、颜色 2 种批量 stroke。SVG 画不动这么多元素",
  frames: FRAMES,
  component: Scene,
};
export default effect;
