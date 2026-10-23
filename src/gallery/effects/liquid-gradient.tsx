import { hexToVec3, SHADER_NOISE, ShaderLayer } from "../../shared/shader";
import { C, Stage, type GalleryEffect } from "../kit";

// 三种颜色像融化的颜料一样在整屏里慢慢翻卷、互相渗开，亮色的细纹沿着交界流动。
// 首尾无缝：噪声的"时间"是在一个圆上走一圈，vec2(cos, sin)(2π·iFrame/FRAMES) 当偏移，第 FRAMES 帧回到原处

const FRAMES = 150;

const FRAG = `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uFrames;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  float a = 6.2831853 * iFrame / uFrames;
  vec2 t = vec2(cos(a), sin(a)) * 0.6;
  // 两次域扭曲：拿噪声去扭噪声的坐标
  vec2 q = vec2(fbm(uv * 1.5 + t), fbm(uv * 1.5 - t.yx + 5.2));
  vec2 r = vec2(fbm(uv * 1.5 + 3.2 * q + vec2(1.7, 9.2) + t * 0.7), fbm(uv * 1.5 + 3.2 * q + vec2(8.3, 2.8) - t * 0.7));
  float n = fbm(uv * 1.5 + 3.0 * r);
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.75, n));
  col = mix(col, uC, smoothstep(0.6, 1.0, length(r) * n * 1.3));
  // 交界的亮纹
  col += uC * 0.35 * smoothstep(0.015, 0.0, abs(n - 0.52));
  fragColor = vec4(col, 1.0);
}`;

const Scene: React.FC = () => (
  <Stage>
    <ShaderLayer frag={SHADER_NOISE + FRAG} uniforms={{ uA: hexToVec3(C.bg2), uB: hexToVec3(C.cool), uC: hexToVec3(C.accent), uFrames: FRAMES }} />
  </Stage>
);

const effect: GalleryEffect = {
  no: 88,
  name: "颜料流动渐变",
  group: "背景",
  desc: "三种颜色像融化的颜料一样在整屏里慢慢翻卷、互相渗开，交界处一道亮色细纹跟着流动，适合当背景或片头底",
  tech: "WebGL 着色器（src/shared/shader.tsx 的 ShaderLayer + SHADER_NOISE）：5 层值噪声做两次域扭曲，时间在一个圆上走一圈所以首尾无缝；哈希用整数 PCG，显卡和软件渲染结果一致。渲染加 --gl=angle 用显卡，快一倍",
  frames: FRAMES,
  component: Scene,
};
export default effect;
