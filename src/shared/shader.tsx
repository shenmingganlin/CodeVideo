import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// 着色器图层：全屏一个片元着色器，每帧画一次。渐变和流体背景、域扭曲噪声、光效、溶解遮罩这类逐像素算的东西
//
//   <ShaderLayer frag={FRAG} uniforms={{ uMix: 0.4, uColorA: hexToVec3("#0D1B2A") }} />
//
// frag 两种写法都行：
// - Shadertoy 写法：只写 `void mainImage(out vec4 fragColor, in vec2 fragCoord) { … }`，自动补上 iTime、iResolution、iFrame
// - 完整写法：自己写 `#version 300 es` 和 `out vec4 …`，同样能用 iTime、iResolution、iFrame（要自己声明）
// 自带的 uniform：iTime = 帧号 / fps（秒），iFrame = 帧号，iResolution = 画布像素宽高（渲染缩放后的，fragCoord 也是这个单位）
// uniforms 里数字是 float，2/3/4 个数的数组是 vec2/vec3/vec4，颜色用 hexToVec3 转成 0..1 的 vec3
//
// 要点：
// - 画面只能由帧号算：只用 iTime、iFrame 和传进来的 uniform，不读上一帧（要上一帧的反馈效果只能预渲染）
// - 输出要预乘透明度：半透明的地方 rgb 要乘过 a，不然叠在别的画面上会发白
// - 一个 ShaderLayer 一个 WebGL 上下文，Chrome 同时最多十几个，一个画面别摆太多
// - 着色器编译出错会直接抛错，信息里带行号；Shadertoy 写法的行号要减去补上的那几行（PRELUDE_LINES）

export const hexToVec3 = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`hexToVec3 要 #RRGGBB，现在是 ${hex}`);
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform float iTime;
uniform float iFrame;
uniform vec2 iResolution;
out vec4 shaderOut;
`;
export const PRELUDE_LINES = PRELUDE.split("\n").length - 1;
const MAIN = `
void main() { mainImage(shaderOut, gl_FragCoord.xy); }`;

const wrap = (frag: string) => (frag.trimStart().startsWith("#version") ? frag : PRELUDE + frag + MAIN);

type Program = { gl: WebGL2RenderingContext; program: WebGLProgram; src: string; locs: Map<string, WebGLUniformLocation | null> };

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("建不了着色器");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`着色器编译出错：\n${log}`);
  }
  return sh;
};

const build = (gl: WebGL2RenderingContext, frag: string): Program => {
  const src = wrap(frag);
  const program = gl.createProgram();
  if (!program) throw new Error("建不了着色器程序");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, src));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`着色器链接出错：\n${gl.getProgramInfoLog(program)}`);
  // 一个盖满画面的大三角形，比两个三角形拼的方块少一条对角线的重复计算
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return { gl, program, src: frag, locs: new Map() };
};

// 常用的噪声函数，拼在 frag 前面用：`frag={SHADER_NOISE + FRAG}`。提供 hash21、vnoise（值噪声 0..1）、fbm（5 层）
// 哈希用整数算（PCG），不用常见的 fract(sin(…) * 43758.5)：sin 在不同 GPU 后端精度不一样，
// 同一帧在显卡和软件渲染上能差出整片噪点（实测最大差 245/255）。整数哈希在哪都逐位相同，剩下的差只在最后一位
export const SHADER_NOISE = `
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash21(vec2 p) { ivec2 i = ivec2(floor(p)); return float(pcg(uint(i.x) * 1597334677u ^ pcg(uint(i.y)))) / 4294967295.0; }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { v += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
`;

export type Uniform = number | readonly number[];

export const ShaderLayer: React.FC<{
  frag: string;
  uniforms?: Record<string, Uniform>;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ frag, uniforms = {}, width: w, height: h, style }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = w ?? config.width;
  const height = h ?? config.height;
  const ref = useRef<HTMLCanvasElement>(null);
  const prog = useRef<Program | null>(null);
  // uniforms 每次渲染都是新对象，拼成字符串当依赖，值没变就不重画
  const key = JSON.stringify(uniforms);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    // preserveDrawingBuffer：不开的话 Remotion 截图时画布可能已经被清掉，截出来是透明的
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error("拿不到 WebGL2：渲染时试试加 --gl=angle");
    if (!prog.current || prog.current.src !== frag) prog.current = build(gl, frag);
    const p = prog.current;
    gl.useProgram(p.program);
    const loc = (name: string) => {
      if (!p.locs.has(name)) p.locs.set(name, gl.getUniformLocation(p.program, name));
      return p.locs.get(name) ?? null;
    };
    gl.uniform1f(loc("iTime"), frame / config.fps);
    gl.uniform1f(loc("iFrame"), frame);
    gl.uniform2f(loc("iResolution"), pw, ph);
    for (const [name, v] of Object.entries(JSON.parse(key) as Record<string, Uniform>)) {
      const l = loc(name);
      if (typeof v === "number") gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
      else throw new Error(`uniform ${name} 只能是数字或 2–4 个数的数组`);
    }
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frag, key, frame, width, height, config.fps]);

  return <canvas ref={ref} style={{ position: "absolute", left: 0, top: 0, width, height, ...style }} />;
};
