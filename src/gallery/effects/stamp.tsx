import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 浅色纸面上，一枚方形红印带着影子从上方放大着砸下来，落纸那一下整个画面震一震，
// 印抬起飞走，纸上留下斑驳的朱文印；停一会儿印迹淡掉，循环
const FRAMES = 150;
const CX = W / 2;
const CY = H / 2;
const S = 360; // 印面边长
const RED = "#C23A2A"; // 占位的印泥红（accent 往朱红偏）
const RED_DARK = "#8A2219"; // 印身侧面
const PAPER = C.fg;
const IMPACT = 28; // 落纸帧
const DROP0 = 8;
const LIFT0 = 44;
const LIFT1 = 64;
const FADE0 = 122;
const FADE1 = 144;
const CHARS = ["代", "出", "码", "品"]; // 竖排右起：代码 / 出品

// 印面：方框 + 2×2 四个字
const SealFace: React.FC<{ color: string }> = ({ color }) => {
  const b = 16;
  const cell = (S - b * 2 - 28) / 2;
  return (
    <g>
      <rect x={b / 2} y={b / 2} width={S - b} height={S - b} rx={10} fill="none" stroke={color} strokeWidth={b} />
      {CHARS.map((ch, i) => {
        // 右列先读：代、码在右，出、品在左
        const col = i < 2 ? 1 : 0;
        const row = i % 2;
        const x = b + 14 + col * cell + cell / 2;
        const y = b + 14 + row * cell + cell / 2;
        return (
          <text
            key={i}
            x={x}
            y={y}
            fill={color}
            fontFamily={FONT}
            fontWeight={900}
            fontSize={cell * 0.92}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {ch}
          </text>
        );
      })}
    </g>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;

  // 印的高度：0 = 贴在纸上，1 = 在画面外上方
  let h = 0;
  if (frame < IMPACT) h = 1 - prog(frame, DROP0, IMPACT, ease.in);
  else if (frame >= LIFT0) h = prog(frame, LIFT0, LIFT1, ease.in);
  const stampVisible = frame >= DROP0 && frame < LIFT1;
  // 高处时更大、更往上，影子更散、更偏
  const scale = 1 + h * 1.3;
  const lift = -h * 760;
  const shadowOff = 18 + h * 120;
  const shadowBlur = 6 + h * 40;
  const shadowA = 0.35 * (1 - h * 0.6);
  // 落下前印面压紧那几帧稍微扁一点
  const press = frame >= IMPACT && frame < IMPACT + 6 ? 1 - 0.04 * (1 - (frame - IMPACT) / 6) : 1;

  // 落纸震动：几帧衰减的位移
  const ts = frame - IMPACT;
  const shake = ts >= 0 && ts < 16 ? 22 * Math.exp(-ts / 4) : 0;
  const dx = shake * Math.sin(ts * 2.3);
  const dy = shake * Math.cos(ts * 3.1) * 0.7;

  // 印迹：落纸那一刻出现，最后淡掉
  const printA = frame < IMPACT ? 0 : 1 - prog(frame, FADE0, FADE1, ease.inOut);
  // 刚印上时颜色更湿更深，几帧后干成正常的红
  const wet = frame >= IMPACT ? 1 - clamp01((frame - IMPACT - 16) / 20) : 0;

  return (
    <Stage bg={PAPER}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${dx}px, ${dy}px)` }}>
        <svg width={W} height={H}>
          <defs>
            {/* 印泥：噪声挖洞 + 边缘毛糙 */}
            <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={7} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={9} xChannelSelector="R" yChannelSelector="G" result="rough" />
              <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves={2} seed={3} result="n2" />
              <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -30 18.2" result="holes" />
              <feComposite in="rough" in2="holes" operator="in" />
            </filter>
            <filter id="stamp-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={shadowBlur} />
            </filter>
          </defs>
          {/* 纸面上淡淡的纤维感：几条极浅的横纹 */}
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={0} y={60 + i * 72} width={W} height={1} fill={C.dim} opacity={0.06} />
          ))}
          {/* 印迹 */}
          <g transform={`translate(${CX - S / 2}, ${CY - S / 2}) rotate(-3, ${S / 2}, ${S / 2})`} opacity={printA} filter="url(#stamp-ink)">
            <SealFace color={mixColor(RED, "#7A1C16", wet * 0.5)} />
          </g>
          {/* 印的影子 */}
          {stampVisible && (
            <rect
              x={CX - (S * scale) / 2 + shadowOff}
              y={CY - (S * scale) / 2 + lift * 0.15 + shadowOff}
              width={S * scale}
              height={S * scale}
              rx={18}
              fill="#000"
              opacity={shadowA}
              filter="url(#stamp-shadow)"
            />
          )}
          {/* 印本身：从上往下看是印钮和印身 */}
          {stampVisible && (
            <g transform={`translate(${CX}, ${CY + lift}) scale(${scale}, ${scale * press}) rotate(-3)`}>
              <rect x={-S / 2} y={-S / 2} width={S} height={S} rx={18} fill={RED_DARK} />
              <rect x={-S / 2 + 18} y={-S / 2 + 18} width={S - 36} height={S - 36} rx={12} fill={RED} />
              <circle cx={0} cy={0} r={S * 0.22} fill={RED_DARK} />
              <circle cx={-S * 0.05} cy={-S * 0.05} r={S * 0.16} fill={mixColor(C.accent, RED, 0.5)} />
            </g>
          )}
        </svg>
      </div>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 39,
  name: "印章盖下来",
  group: "文字",
  desc: "一枚红印带着影子从上方放大着砸到纸上，画面一震，印抬起飞走，留下斑驳的朱文印，停一会儿淡去",
  tech: "SVG：印的高度 h 控制缩放、上移和影子偏移模糊；落纸后 16 帧指数衰减的位移做震屏；印迹用 feDisplacementMap 毛边 + feTurbulence 阈值挖洞（固定 seed），红色 #C23A2A 是占位色。创意参考 remotion-scenes 的 LogoStamp",
  frames: FRAMES,
  component: Scene,
};
export default effect;
