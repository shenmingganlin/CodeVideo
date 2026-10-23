import { useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 暗墙上一行灯管字：没通电是灰管子，通电先闪几下再亮稳，带光晕，墙上映出一团光；
// 其中一个字接触不良，亮稳后隔一会儿抖闪；最后断电变暗，循环
const FRAMES = 150;
const TEXT = Array.from("深夜营业");
const SIZE = 230;
const GAP = 26;
const BAD = 2; // 接触不良的那个字："营"
const TUBE = mixColor(C.accent, "#FF4F7A", 0.55); // 灯管色（占位）
const OFF0 = 128; // 开始断电
const OFF1 = 136;

// 通电闪烁序列：每一项是 [起始帧, 亮度]，到下一项为止
const BOOT: [number, number][] = [
  [0, 0],
  [14, 0.9],
  [16, 0],
  [21, 0.5],
  [23, 0.05],
  [30, 1],
  [32, 0.15],
  [34, 1],
];
// 坏字自己的抖闪：亮稳以后几段
const GLITCH: [number, number][] = [
  [0, 1],
  [70, 0.1],
  [72, 0.8],
  [73, 0.05],
  [76, 1],
  [104, 0.2],
  [106, 1],
];

const seq = (s: [number, number][], f: number) => {
  let v = s[0][1];
  for (const [t, b] of s) if (f >= t) v = b;
  return v;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const power = frame < OFF0 ? seq(BOOT, frame) : 1 - clamp01((frame - OFF0) / (OFF1 - OFF0));
  const on = frame >= OFF1 ? 0 : power;
  // 通电时电流的微弱嗡动
  const hum = on > 0.5 ? 1 - 0.05 * rand(frame * 1.7) : 1;
  const lv = TEXT.map((_, i) => on * hum * (i === BAD && frame < OFF0 ? seq(GLITCH, frame) : 1));
  const avg = lv.reduce((a, b) => a + b, 0) / lv.length;

  const n = TEXT.length;
  const total = n * SIZE + (n - 1) * GAP;
  const x0 = (W - total) / 2;
  const y = H / 2 - 40;
  const sub = "· 欢迎光临 ·";
  const subOn = on * hum;

  return (
    <Stage bg="#101116">
      {/* 墙：竖砖缝，被灯光映亮 */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="neon-wall" cx="50%" cy="46%" r="55%">
            <stop offset="0%" stopColor={TUBE} stopOpacity={0.32} />
            <stop offset="45%" stopColor={TUBE} stopOpacity={0.1} />
            <stop offset="100%" stopColor={TUBE} stopOpacity={0} />
          </radialGradient>
          <filter id="neon-glow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={18} result="b2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={44} result="b3" />
            <feMerge>
              <feMergeNode in="b3" />
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: 19 }, (_, r) => (
          <rect key={`r${r}`} x={0} y={r * 60} width={W} height={2} fill="#000" opacity={0.35} />
        ))}
        {Array.from({ length: 19 * 13 }, (_, k) => {
          const r = Math.floor(k / 13);
          const c = k % 13;
          return <rect key={k} x={c * 160 + (r % 2) * 80} y={r * 60} width={2} height={60} fill="#000" opacity={0.3} />;
        })}
        <rect x={0} y={0} width={W} height={H} fill="url(#neon-wall)" opacity={avg} />

        {/* 管子本体：不通电也看得见的暗灰描边 */}
        {TEXT.map((ch, i) => (
          <text
            key={`off${i}`}
            x={x0 + i * (SIZE + GAP) + SIZE / 2}
            y={y}
            fontFamily={FONT}
            fontWeight={300}
            fontSize={SIZE}
            textAnchor="middle"
            dominantBaseline="central"
            fill="none"
            stroke="#3A3E48"
            strokeWidth={7}
            strokeLinejoin="round"
          >
            {ch}
          </text>
        ))}
        <text
          x={W / 2}
          y={y + SIZE * 0.82}
          fontFamily={FONT}
          fontWeight={300}
          fontSize={70}
          letterSpacing={18}
          textAnchor="middle"
          dominantBaseline="central"
          fill="none"
          stroke="#3A3E48"
          strokeWidth={4}
        >
          {sub}
        </text>

        {/* 通电的灯管：亮芯 + 多层光晕 */}
        {TEXT.map((ch, i) =>
          lv[i] > 0.01 ? (
            <text
              key={`on${i}`}
              x={x0 + i * (SIZE + GAP) + SIZE / 2}
              y={y}
              fontFamily={FONT}
              fontWeight={300}
              fontSize={SIZE}
              textAnchor="middle"
              dominantBaseline="central"
              fill="none"
              stroke={mixColor(TUBE, "#FFF4F6", 0.55)}
              strokeWidth={7}
              strokeLinejoin="round"
              opacity={lv[i]}
              filter="url(#neon-glow)"
            >
              {ch}
            </text>
          ) : null,
        )}
        {TEXT.map((ch, i) =>
          lv[i] > 0.01 ? (
            <text
              key={`glow${i}`}
              x={x0 + i * (SIZE + GAP) + SIZE / 2}
              y={y}
              fontFamily={FONT}
              fontWeight={300}
              fontSize={SIZE}
              textAnchor="middle"
              dominantBaseline="central"
              fill="none"
              stroke={TUBE}
              strokeWidth={16}
              strokeLinejoin="round"
              opacity={lv[i] * 0.55}
              filter="url(#neon-glow)"
            >
              {ch}
            </text>
          ) : null,
        )}
        {subOn > 0.01 && (
          <text
            x={W / 2}
            y={y + SIZE * 0.82}
            fontFamily={FONT}
            fontWeight={300}
            fontSize={70}
            letterSpacing={18}
            textAnchor="middle"
            dominantBaseline="central"
            fill="none"
            stroke={mixColor(C.cool, "#F2FBFF", 0.5)}
            strokeWidth={4}
            opacity={subOn}
            filter="url(#neon-glow)"
          >
            {sub}
          </text>
        )}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 40,
  name: "霓虹灯牌通电",
  group: "文字",
  desc: "暗墙上的灯管字先是灰管子，通电闪几下才亮稳，墙上映出一团光；“营”字接触不良时不时抖闪，最后断电变暗",
  tech: "SVG 描边文字当灯管：暗灰管子常驻，亮芯 + 粗描边叠三层 feGaussianBlur（6/18/44）做光晕；通电和坏字的闪烁是写死的 [帧, 亮度] 序列，嗡动用 rand(帧)；墙光是随平均亮度变的 radialGradient。创意参考 remotion-scenes 的 TextNeon / LogoNeonSign",
  frames: FRAMES,
  component: Scene,
};
export default effect;
