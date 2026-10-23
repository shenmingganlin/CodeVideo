import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 整屏像一池水银：表面慢慢起伏流动，凸起处反出天光的亮带，凹处和地平线反成深色，边缘有锐利的高光
const FRAMES = 150;
const TAU = Math.PI * 2;
const GW = 384; // 在 384×216 的小格子上算，再放大到整屏
const GH = 216;
const S = W / GW;

// 高度场：先用两组正弦扭一下坐标（让波纹有流体的弯曲），再叠几组斜向正弦。
// 每组的时间项都是整数圈，第 FRAMES 帧回到原样
const WAVES = [
  { kx: 1.1, ky: 0.4, t: 1, a: 1.0, p: 0.3 },
  { kx: -0.5, ky: 1.3, t: -1, a: 0.8, p: 1.9 },
  { kx: 1.9, ky: -1.2, t: 1, a: 0.4, p: 4.1 },
  { kx: -2.4, ky: -1.7, t: -2, a: 0.22, p: 2.6 },
];

const height = (x: number, y: number, u: number) => {
  // x、y 归一化到画面宽度（0–1，竖向 0–0.5625）
  const wx = x + 0.07 * Math.sin(TAU * (0.8 * y + u) + 0.7) + 0.03 * Math.sin(TAU * (1.9 * y - u));
  const wy = y + 0.07 * Math.sin(TAU * (0.7 * x - u) + 2.1) + 0.03 * Math.sin(TAU * (2.1 * x + u));
  let h = 0;
  for (const w of WAVES) h += w.a * Math.sin(TAU * (w.kx * wx + w.ky * wy + w.t * u) + w.p);
  return h;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 铬的环境：反射方向往上看是亮天、往下是暗地，中间一道很窄的黑地平线，地面上方一条亮带
const env = (rx: number, ry: number, rz: number) => {
  const sky = 0.3 + 0.55 * smooth(0.05, 0.75, ry);
  const horizon = 1 - 0.85 * Math.exp(-(((ry + 0.02) / 0.06) ** 2));
  const ground = 0.06 + 0.5 * Math.exp(-(((ry + 0.4) / 0.1) ** 2));
  const side = 0.85 + 0.15 * Math.sin(rx * 5 + rz * 2);
  return (ry >= 0 ? sky : ground) * horizon * side;
};

const L1 = (() => {
  const v = [-0.45, 0.75, 0.5];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

const SHADOW = [12, 14, 20];
const MID = [118, 128, 142];
const LIGHT = [238, 242, 246];

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(GW, GH);
    // 多算一圈，方便取差分
    const hf = new Float32Array((GW + 2) * (GH + 2));
    for (let j = 0; j < GH + 2; j++)
      for (let i = 0; i < GW + 2; i++) hf[j * (GW + 2) + i] = height((i - 1) / GW, (j - 1) / GW, u);
    const SLOPE = 0.05; // 起伏的陡度：高度场的梯度乘它就是表面斜率
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const c = (j + 1) * (GW + 2) + i + 1;
        const dx = ((hf[c + 1] - hf[c - 1]) * GW * SLOPE) / 2;
        const dy = ((hf[c + GW + 2] - hf[c - GW - 2]) * GW * SLOPE) / 2;
        // 法线：表面朝向观者（z），往下看一点
        let nx = -dx, ny = dy, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        // 视线 (0, 0.35, -1) 归一化后对法线反射
        const vx = 0, vy = 0.33, vz = -0.944;
        const dot = vx * nx + vy * ny + vz * nz;
        const rx = vx - 2 * dot * nx, ry = vy - 2 * dot * ny, rz = vz - 2 * dot * nz;
        let e = env(rx, ry, rz);
        // 两处高光：一盏主灯、一条柔和的顶光
        const sp = Math.max(0, rx * L1[0] + ry * L1[1] + rz * L1[2]);
        e += sp ** 60 * 1.4 + Math.max(0, ry) ** 8 * 0.25;
        // 掠射处（法线偏得多）更亮一点，像金属的菲涅耳
        e += (1 - nz) * 0.2;
        e = Math.min(1.25, e);
        const t = Math.min(1, e) ** 1.25;
        const k = (j * GW + i) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const base = t < 0.5 ? SHADOW[ch] + (MID[ch] - SHADOW[ch]) * (t / 0.5) : MID[ch] + (LIGHT[ch] - MID[ch]) * ((t - 0.5) / 0.5);
          img.data[k + ch] = Math.min(255, base + Math.max(0, e - 1) * 300);
        }
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [u]);
  return (
    <Stage bg={C.bg}>
      <canvas
        ref={ref}
        width={GW}
        height={GH}
        style={{
          position: "absolute",
          left: -8,
          top: -8,
          width: W + 16,
          height: H + 16,
          filter: `blur(${S * 0.35}px)`,
        }}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 76,
  name: "液态金属流动",
  group: "背景",
  desc: "整屏像一池水银慢慢起伏流动，凸起处反出天光亮带，凹处和地平线反成深色，转折处有锐利的高光",
  tech: "Canvas 2D 逐像素：384×216 的高度场 = 坐标先用正弦扭曲再叠 5 组斜向正弦（时间项整数圈，首尾无缝），差分求法线、反射视线去查一张\"亮天 + 黑地平线 + 暗地亮带\"的环境，加 Phong 高光和菲涅耳提亮，放大到整屏后轻微模糊。创意参考 DavidHDev/react-bits 的 LiquidChrome",
  frames: FRAMES,
  component: Scene,
};
export default effect;
