import { spring, useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, mixColor } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, FPS, type GalleryEffect } from "../kit";

// 一块带厚度的立体字绕竖轴转进来：从侧面（看不见正面）甩到略侧的角度，冲过头再弹回停住；
// 停着时轻轻晃，打光随角度变：转向光源时正面亮、侧面暗；最后继续同一个方向转走，回到侧面接循环
const FRAMES = 150;
const TEXT = "立体";
const SIZE = 330;
const LAYERS = 30; // 厚度用多少层叠出来
const STEP = 3; // 每层隔多少 px，总厚 90px
const ENTER = 6; // 开始转进来
const LEAVE = 118; // 开始转走
const LEAVE_DUR = 26;
const REST = 22; // 停住时的角度
const FROM = -96; // 侧面，正面刚好背过去
const TO = 96;
const TILT = 10; // 微微俯视
const LIGHT = 34; // 光从右前方打来：正面转到这个角度时最亮

const angleAt = (f: number) => {
  const s = spring({ frame: f - ENTER, fps: FPS, config: { damping: 9, stiffness: 70, mass: 1 } });
  const out = ease.in(clamp01((f - LEAVE) / LEAVE_DUR));
  // 停着时的轻晃：整周期正弦，转进来和转走时都压到 0
  const sway = Math.sin(((f - ENTER) / 60) * Math.PI * 2) * 3 * clamp01((f - 40) / 20) * (1 - clamp01((f - LEAVE + 10) / 10));
  return lerp(FROM, REST, s) + (TO - REST) * out + sway;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const a = angleAt(frame);
  const rad = (a * Math.PI) / 180;
  // 转进来时同时从远处靠近一点，停住时落到原位
  const sIn = spring({ frame: frame - ENTER, fps: FPS, config: { damping: 16, stiffness: 60 } });
  const z = lerp(-260, 0, sIn) - 200 * ease.in(clamp01((frame - LEAVE) / LEAVE_DUR));
  // 正面亮度：越朝向光越亮
  const face = 0.5 + 0.5 * Math.cos(((a - LIGHT) * Math.PI) / 180);
  const faceColor = mixColor("#9A5C14", "#FFD27A", face);
  // 侧面：越往后越暗；转得越侧，看到的侧面越多，侧面也越受光
  const side = clamp01(Math.abs(Math.sin(rad)));
  // 地上的影子：正对时最宽，转到侧面时窄
  // 转到侧面（正面背过去）时字整个看不见，影子也跟着淡到 0，首尾都是空台面
  const cosA = Math.abs(Math.cos(rad));
  const shadowW = 0.35 + 0.65 * cosA;
  const shadowOp = clamp01((cosA - 0.12) / 0.45);

  return (
    <Stage>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="ex-shadow">
            <stop offset={0} stopColor="#000000" stopOpacity={0.55} />
            <stop offset={1} stopColor="#000000" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="ex-floor" cx="50%" cy="20%" r="70%">
            <stop offset={0} stopColor={C.bg2} />
            <stop offset={1} stopColor={C.bg} />
          </radialGradient>
        </defs>
        <rect y={H * 0.68} width={W} height={H * 0.32} fill="url(#ex-floor)" />
        <ellipse
          cx={W / 2}
          cy={H * 0.79}
          rx={360}
          ry={46}
          fill="url(#ex-shadow)"
          opacity={shadowOp}
          transform={`translate(${W / 2} ${H * 0.79}) scale(${shadowW} 1) translate(${-W / 2} ${-H * 0.79})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, perspective: 1500, perspectiveOrigin: "50% 40%" }}>
        <div
          style={{
            position: "absolute",
            left: W / 2 - 400,
            top: H / 2 - 240,
            width: 800,
            height: 400,
            transformStyle: "preserve-3d",
            transform: `translateZ(${z}px) rotateX(${-TILT}deg) rotateY(${a}deg)`,
          }}
        >
          {Array.from({ length: LAYERS + 1 }, (_, k) => {
            // k = 0 是正面，往后一层层是侧面
            const isFace = k === 0;
            const depth = k / LAYERS;
            const wall = mixColor("#7A4A10", "#2A1A08", depth * 0.8 + (1 - side) * 0.2);
            const lit = mixColor(wall, "#C98326", side * (1 - depth) * 0.5);
            return (
              <div
                key={k}
                style={{
                  position: "absolute",
                  inset: 0,
                  lineHeight: "400px",
                  textAlign: "center",
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: SIZE,
                  letterSpacing: 10,
                  color: isFace ? faceColor : lit,
                  backfaceVisibility: "hidden",
                  transform: `translateZ(${-k * STEP}px)`,
                  textShadow: isFace ? `0 0 1px ${mixColor(faceColor, "#FFFFFF", 0.5)}` : undefined,
                }}
              >
                {TEXT}
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 73,
  name: "立体厚字翻转",
  group: "文字",
  desc: "一块带厚度的立体字绕竖轴从侧面甩进来，冲过头再弹回停在略侧的角度，停着时轻轻晃；正面朝光时亮、侧面往后越来越暗；最后顺着同一个方向转走，回到侧面",
  tech: "CSS 3D：31 层字沿 Z 轴每层隔 3px 叠成 90px 厚（preserve-3d + backface-visibility: hidden），正面颜色按与光源的夹角余弦插值，侧面按层深变暗；转角是 spring（damping 9，冲过头约 15°）从 -96° 到 22°，转走用 ease.in 转到 96°，同时推远；地上的影子宽度跟 |cos 角|。创意参考 vivmagarwal/remotion-effects-library 的 Extruded Text",
  frames: FRAMES,
  component: Scene,
};
export default effect;
