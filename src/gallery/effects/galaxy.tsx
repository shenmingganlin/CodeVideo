import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { mixColor, rand } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 斜俯视的螺旋星系：两条旋臂缠着一个暖白的亮核慢慢转，内圈的星比外圈转得快，星星有大有小、轻轻闪
const FRAMES = 150;
const TAU = Math.PI * 2;
const CX = W / 2;
const CY = H / 2 + 20;
const R = 620; // 星系盘半径（盘面坐标）
const TILT = 0.42; // 盘面压扁：斜着看
const ROLL = -0.32; // 整个椭圆在屏幕上的倾角
const PITCH = 0.26; // 对数螺旋的缠绕：角度 = ln(r) / PITCH
const LIFE = [50, 75, 150]; // 每颗星"活"的帧数，都整除 FRAMES

type Star = { r: number; th: number; size: number; b: number; color: string; life: number; ph: number; tw: number; twp: number };

// 每颗星生成一对，相差 180°，整个图案二重对称：一个循环刚性转半圈就回到原样
const STARS: Star[] = (() => {
  const out: Star[] = [];
  const add = (r: number, th: number, size: number, b: number, color: string, s: number) => {
    const life = LIFE[Math.floor(rand(s + 7) * LIFE.length)];
    const ph = rand(s + 8);
    const tw = rand(s + 9);
    const twp = [5, 6, 10][Math.floor(rand(s + 10) * 3)];
    out.push({ r, th, size, b, color, life, ph, tw, twp }, { r, th: th + Math.PI, size, b, color, life, ph, tw, twp });
  };
  const gauss = (s: number) => {
    const a = Math.max(1e-6, rand(s));
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(TAU * rand(s + 0.5));
  };
  // 旋臂：越往外越稀、越散
  for (let i = 0; i < 2200; i++) {
    const s = i * 11 + 1;
    const r = 60 + R * rand(s) ** 1.4;
    const spread = 0.18 + 0.32 * (r / R);
    const th = Math.log(r / 60) / PITCH + gauss(s + 1) * spread;
    const r2 = r * (1 + gauss(s + 2) * 0.06);
    const k = rand(s + 3);
    const color = k < 0.55 ? mixColor(C.fg, C.cool, 0.55) : k < 0.85 ? C.fg : mixColor(C.cool, "#B26BFF", 0.4);
    add(r2, th, 0.7 + rand(s + 4) ** 4 * 2.6, 0.45 + rand(s + 5) * 0.55, color, s);
  }
  // 盘面上均匀撒的暗星
  for (let i = 0; i < 900; i++) {
    const s = 50000 + i * 11;
    const r = R * Math.sqrt(rand(s)) * 1.05;
    add(r, rand(s + 1) * TAU, 0.6 + rand(s + 2) * 0.8, 0.18 + rand(s + 3) * 0.25, mixColor(C.fg, C.dim, 0.4), s);
  }
  // 核球：暖白，挤在中间
  for (let i = 0; i < 700; i++) {
    const s = 90000 + i * 11;
    const r = Math.abs(gauss(s)) * 70;
    add(r, rand(s + 1) * TAU, 0.7 + rand(s + 2) * 1.2, 0.5 + rand(s + 3) * 0.5, mixColor(C.fg, C.accent, 0.35 + rand(s + 4) * 0.4), s);
  }
  return out;
})();

// 背景远星，不动，给转动一个参照
const BG = Array.from({ length: 220 }, (_, i) => ({ x: rand(i * 3 + 7) * W, y: rand(i * 3 + 8) * H, r: 0.5 + rand(i * 3 + 9) * 0.9 }));

// 盘面极坐标 → 屏幕
const project = (r: number, th: number) => {
  const x = r * Math.cos(th);
  const y = r * Math.sin(th) * TILT;
  return [CX + x * Math.cos(ROLL) - y * Math.sin(ROLL), CY + x * Math.sin(ROLL) + y * Math.cos(ROLL)];
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const u = frame / FRAMES;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#06070B";
    ctx.fillRect(0, 0, W, H);
    for (const s of BG) {
      ctx.fillStyle = "rgba(238,240,243,0.28)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    // 亮核：压扁、倾斜的径向渐变
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(ROLL);
    ctx.scale(1, TILT);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 360);
    core.addColorStop(0, "rgba(255,246,228,0.95)");
    core.addColorStop(0.08, "rgba(246,214,160,0.7)");
    core.addColorStop(0.3, "rgba(120,150,200,0.18)");
    core.addColorStop(1, "rgba(79,179,217,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 360, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    // 整体刚性转半圈（二重对称，首尾无缝），转向让旋臂拖在后面
    const rigid = -Math.PI * u;
    for (const s of STARS) {
      // 每颗星活 life 帧：淡入、在一小段弧上走（内圈走得快 = 差速转动）、淡出，然后在原位重新出生
      const p = (u * (FRAMES / s.life) + s.ph) % 1;
      const env = Math.sin(Math.PI * p) ** 1.5;
      if (env < 0.01) continue;
      const lifeTurn = (s.life / FRAMES) * Math.PI;
      const extra = -(Math.min(4, 140 / Math.max(25, s.r)) - 1) * 0.2 * lifeTurn * (p - 0.5);
      const [x, y] = project(s.r, s.th + rigid + extra);
      const tw = 0.8 + 0.2 * Math.sin(TAU * (u * (FRAMES / s.twp) + s.tw));
      const a = s.b * env * tw;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.color;
      if (s.size < 1.3) {
        ctx.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.size * 0.6, 0, TAU);
        ctx.fill();
        // 亮星多一圈柔光
        ctx.globalAlpha = a * 0.18;
        ctx.beginPath();
        ctx.arc(x, y, s.size * 2.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [u]);
  return (
    <Stage bg="#06070B">
      <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 78,
  name: "银河旋臂",
  group: "背景",
  desc: "斜俯视的螺旋星系，两条蓝白旋臂缠着暖白亮核慢慢转，内圈的星比外圈转得快，星星大小亮度各不同、轻轻闪烁",
  tech: "Canvas 2D 叠加混合：7600 颗星（旋臂沿对数螺旋高斯散布、盘面暗星、核球）成对放、相差 180°，整体一个循环刚性转半圈（首尾无缝）；每颗星活 50/75/150 帧，活着时按半径多走一小段弧（内快外慢），淡入淡出后原位重生；亮核是压扁的径向渐变。创意参考 DavidHDev/react-bits 的 Galaxy",
  frames: FRAMES,
  component: Scene,
};
export default effect;
