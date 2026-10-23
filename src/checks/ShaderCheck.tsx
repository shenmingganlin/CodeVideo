import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import { SANS_FAMILY } from "../shared/fonts";
import { prog } from "../shared/motion/motion";
import { hexToVec3, SHADER_NOISE, ShaderLayer } from "../shared/shader";

// 环境自检：着色器图层。底下是域扭曲噪声做的流动渐变（Shadertoy 写法），
// 上面叠一层透明的溶解遮罩：噪声阈值从 0 走到 1，一个圆从中间带着亮边吃开，露出下面的字。
// 两层都只看 iTime / uniform，乱序渲染每帧一样。150 帧 = 5 秒

const FLOW = `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  float t = iTime * 0.15;
  // 域扭曲：拿噪声去扭噪声的坐标，出来是流体一样的纹路
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 - t + 5.2));
  vec2 r = vec2(fbm(uv * 1.6 + 3.0 * q + vec2(1.7, 9.2) + t * 1.3), fbm(uv * 1.6 + 3.0 * q + vec2(8.3, 2.8) - t));
  float n = fbm(uv * 1.6 + 3.0 * r);
  vec3 col = mix(uA, uB, smoothstep(0.2, 0.8, n));
  col = mix(col, uC, smoothstep(0.55, 0.95, length(q) * n));
  fragColor = vec4(col, 1.0);
}`;

const DISSOLVE = `
uniform float uProgress;
uniform vec3 uEdge;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // 圆从中间往外吃，边缘用噪声打毛
  float d = length(uv) * 1.1 + (vnoise(fragCoord / iResolution.y * 9.0) - 0.5) * 0.25;
  float edge = uProgress * 1.4 - d;
  float hole = smoothstep(0.0, 0.02, edge);
  float rim = smoothstep(0.0, 0.03, edge) - smoothstep(0.03, 0.08, edge);
  // 遮罩层：没吃到的地方是深色，吃开的地方透明，交界一道亮边。输出预乘过透明度
  vec3 cover = vec3(0.04, 0.05, 0.08);
  float a = 1.0 - hole;
  vec3 rgb = cover * a + uEdge * rim;
  fragColor = vec4(rgb, max(a, rim));
}`;

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = prog(frame, 20, 120);
  return (
    <AbsoluteFill>
      <ShaderLayer frag={SHADER_NOISE + FLOW} uniforms={{ uA: hexToVec3("#13294B"), uB: hexToVec3("#3F8F9C"), uC: hexToVec3("#F3C98B") }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: SANS_FAMILY, fontSize: 160, fontWeight: 700, color: "#F7F2E8" }}>
        着色器
      </AbsoluteFill>
      <ShaderLayer frag={SHADER_NOISE + DISSOLVE} uniforms={{ uProgress: progress, uEdge: hexToVec3("#FFB86B") }} />
    </AbsoluteFill>
  );
};

export const ShaderCheck: React.FC = () => (
  <Composition id="ShaderCheck" component={Scene} durationInFrames={150} fps={30} width={1920} height={1080} />
);
