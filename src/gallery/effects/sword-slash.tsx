import { useCurrentFrame } from "remotion";
import { clamp01, ease, mixColor, prog } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 牌子上先亮起一点寒光（蓄势），一道弧形刀光 4 帧内从左下划到右上，亮芯后面拖着渐隐的残影；
// 牌子顺着刀痕错开，下半块往下沉一点，停一拍再合回去，合缝处闪一下
const FRAMES = 120;
const GLINT = [14, 34]; // 寒光聚起来
const SWEEP = [33, 37]; // 刀头划过的 4 帧
const HIT = 35; // 刀头经过牌子中心的那一帧
const JOIN = [74, 94]; // 两半合回

const CX = W / 2;
const CY = H / 2 + 20;
const SIZE = 420;

// 刀光走的圆弧：圆心在画面右下外面，弧从左下扫到右上，正好穿过牌子中心
const AC = { x: 1600, y: 2000 };
const R = Math.hypot(CX - AC.x, CY - AC.y);
const A0 = (-150 * Math.PI) / 180; // 画面下沿外
const A1 = (-60 * Math.PI) / 180; // 画面右沿外
const at = (a: number, r = R) => ({ x: AC.x + Math.cos(a) * r, y: AC.y + Math.sin(a) * r });

// 刀痕：过牌子中心、沿圆弧切线方向的直线，比圆弧本身更干脆
const AH = Math.atan2(CY - AC.y, CX - AC.x);
const D = { x: -Math.sin(AH), y: Math.cos(AH) };
const NRM = { x: -D.y, y: D.x }; // 指向下半块
const fixD = D.x < 0 ? { x: -D.x, y: -D.y } : D; // 让 D 朝右上

const half = (side: number) => {
  const L = 1600;
  const n = { x: NRM.x * side * L, y: NRM.y * side * L };
  const pts = [
    [CX + fixD.x * L, CY + fixD.y * L],
    [CX - fixD.x * L, CY - fixD.y * L],
    [CX - fixD.x * L + n.x, CY - fixD.y * L + n.y],
    [CX + fixD.x * L + n.x, CY + fixD.y * L + n.y],
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
};

// 刀头在第 f 帧（可以是小数）走到圆弧的哪个角度：慢起、猛冲、收刀
const headAngle = (f: number) => A0 + (A1 - A0) * prog(f, SWEEP[0] - 1.5, SWEEP[1] + 1.5, ease.whip);

// 月牙形刀光：沿圆弧从刀尾到刀头，外沿是圆弧，内沿往圆心收，刀头最宽
const crescent = (aHead: number, aTail: number, width: number) => {
  const n = 28;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 = 刀尾，1 = 刀头
    const a = aTail + (aHead - aTail) * t;
    const w = width * Math.sin(Math.PI * t ** 2.5) ** 0.7; // 最宽处靠近刀头，两头尖
    const o = at(a);
    const p = at(a, R - w);
    outer.push(`${o.x.toFixed(1)},${o.y.toFixed(1)}`);
    inner.unshift(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return outer.concat(inner).join(" ");
};

const Plaque: React.FC = () => (
  <g>
    <rect x={CX - SIZE / 2} y={CY - SIZE / 2} width={SIZE} height={SIZE} rx={34} fill={C.bg2} stroke={C.dim} strokeWidth={6} />
    <text x={CX} y={CY + 92} textAnchor="middle" fill={C.accent} fontFamily={FONT} fontSize={270} fontWeight={900}>
      斩
    </text>
  </g>
);

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const t = frame - HIT;

  // 两半错开：一刀下去立刻滑开，停住时下半块还在慢慢往下沉，然后合回
  const open = (t >= 0 ? 1 - Math.exp(-t / 3.5) : 0) * (1 - prog(frame, JOIN[0], JOIN[1], ease.inOut));
  const sag = clamp01((frame - HIT) / (JOIN[0] - HIT)) ** 2 * (1 - prog(frame, JOIN[0], JOIN[1], ease.inOut));
  const slide = 46 * open;
  const gap = 14 * open;
  const upper = `translate(${(-fixD.x * slide - NRM.x * gap).toFixed(2)} ${(-fixD.y * slide - NRM.y * gap).toFixed(2)})`;
  const lower =
    `translate(${(fixD.x * slide + NRM.x * gap).toFixed(2)} ${(fixD.y * slide + NRM.y * gap + 34 * sag).toFixed(2)}) ` +
    `rotate(${(3 * sag).toFixed(3)} ${CX} ${CY})`;

  // 蓄势：牌子微微绷紧，挨刀后弹一下回来
  const tense = prog(frame, GLINT[0], HIT, ease.in);
  const recoil = t >= 0 ? Math.exp(-t / 4) * Math.cos(t / 2.2) : 0;
  const squeeze = 1 - 0.02 * tense * (t < 0 ? 1 : 0) + 0.03 * recoil;

  // 震屏：挨刀那一下最猛，合回时再轻轻一下
  const tj = frame - JOIN[1];
  const shake =
    (t >= 0 ? 18 * Math.exp(-t / 3) * Math.sin(t * 2.6) : 0) + (tj >= 0 ? 6 * Math.exp(-tj / 3) * Math.sin(tj * 2.9) : 0);
  const shakeY = (t >= 0 ? 10 * Math.exp(-t / 3) * Math.cos(t * 3.1) : 0) + (tj >= 0 ? 3 * Math.exp(-tj / 3) * Math.cos(tj * 3.3) : 0);

  // 寒光：先慢后快地涨起来，刀头经过时被吞掉
  const glintP = prog(frame, GLINT[0], GLINT[1], ease.in);
  const glintGone = 1 - prog(frame, SWEEP[0], SWEEP[0] + 2, ease.out);
  const glint = glintP * glintGone;
  const gp = at(A0 + (A1 - A0) * 0.24); // 牌子左下角外，刀头出发的地方
  const glintRot = 45 * glintP;

  // 刀光：刀头位置 + 刀尾落后几帧；收刀后刀尾追上刀头，残影散掉
  const aHead = headAngle(frame);
  const aTail = headAngle(frame - 2.6);
  const bladeOn = frame >= SWEEP[0] - 1 && frame <= SWEEP[1] + 9;
  const fade = 1 - clamp01((frame - SWEEP[1]) / 9);
  const ghosts = [0, 1, 2].map((k) => ({ head: headAngle(frame - 1.4 - k * 1.3), tail: headAngle(frame - 4 - k * 1.8), o: 0.32 - k * 0.09 }));

  // 刀痕：刚切开时发白发亮，冷却成冷色再褪掉；合回时闪一下
  const seamHot = t >= 0 ? Math.exp(-t / 6) : 0;
  const seamJoin = Math.max(0, 1 - Math.abs(frame - JOIN[1] + 1) / 4);
  const seam = Math.max(seamHot * open + 0.25 * open, seamJoin);
  const seamColor = mixColor(C.cool, "#FFFFFF", Math.max(seamHot, seamJoin));

  const dark = 0.35 * prog(frame, GLINT[0], HIT, ease.in) * (1 - prog(frame, HIT, HIT + 14, ease.out));
  const flash = t >= 0 ? 0.3 * Math.exp(-t / 1.6) : 0;
  const L = 300;
  // 刀走过的轨迹留一道细线，慢慢褪
  const trace = frame >= SWEEP[0] ? Math.exp(-(frame - SWEEP[1]) / 6) * clamp01((frame - SWEEP[0] + 1) / 3) : 0;
  const traceEnd = at(aHead);
  const traceStart = at(A0);

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <filter id="ss-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <filter id="ss-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
          <clipPath id="ss-up">
            <polygon points={half(-1)} />
          </clipPath>
          <clipPath id="ss-low">
            <polygon points={half(1)} />
          </clipPath>
        </defs>
        <g transform={`translate(${shake.toFixed(2)} ${shakeY.toFixed(2)})`}>
          <g transform={`translate(${CX} ${CY}) scale(${squeeze.toFixed(4)}) translate(${-CX} ${-CY})`}>
            {/* 两半各自带着自己那条刀痕边移动 */}
            <g transform={upper}>
              <g clipPath="url(#ss-up)">
                <Plaque />
              </g>
            </g>
            <g transform={lower}>
              <g clipPath="url(#ss-low)">
                <Plaque />
              </g>
            </g>
            {seam > 0.01 && (
              <g opacity={seam}>
                <line x1={CX - fixD.x * L} y1={CY - fixD.y * L} x2={CX + fixD.x * L} y2={CY + fixD.y * L} stroke={seamColor} strokeWidth={14} filter="url(#ss-glow)" opacity={0.8} />
                <line x1={CX - fixD.x * L} y1={CY - fixD.y * L} x2={CX + fixD.x * L} y2={CY + fixD.y * L} stroke={seamColor} strokeWidth={3} strokeLinecap="round" />
              </g>
            )}
          </g>
          <rect x={-40} y={-40} width={W + 80} height={H + 80} fill="#000" opacity={dark} />
          {glint > 0.01 && (
            <g transform={`translate(${gp.x.toFixed(2)} ${gp.y.toFixed(2)}) rotate(${glintRot.toFixed(2)}) scale(${(0.2 + glint).toFixed(4)})`}>
              <circle r={50} fill={C.cool} opacity={0.5 * glint} filter="url(#ss-glow)" />
              <path d="M0,-90 L9,-9 L90,0 L9,9 L0,90 L-9,9 L-90,0 L-9,-9 Z" fill="#FFFFFF" />
            </g>
          )}
          {trace > 0.01 && (
            <path
              d={`M${traceStart.x.toFixed(1)},${traceStart.y.toFixed(1)} A${R.toFixed(1)},${R.toFixed(1)} 0 0 1 ${traceEnd.x.toFixed(1)},${traceEnd.y.toFixed(1)}`}
              fill="none"
              stroke={C.cool}
              strokeWidth={4}
              opacity={0.5 * Math.min(1, trace)}
              filter="url(#ss-soft)"
            />
          )}
          {bladeOn && (
            <g opacity={fade}>
              {ghosts.map((g, i) => (
                <polygon key={i} points={crescent(g.head, g.tail, 40)} fill={C.cool} opacity={g.o} filter="url(#ss-soft)" />
              ))}
              <polygon points={crescent(aHead, aTail, 70)} fill={C.cool} opacity={0.75} filter="url(#ss-glow)" />
              <polygon points={crescent(aHead, aTail, 34)} fill="#FFFFFF" />
            </g>
          )}
        </g>
        <rect x={0} y={0} width={W} height={H} fill={C.fg} opacity={flash} />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 59,
  name: "刀光一闪",
  group: "特效",
  desc: "牌子上先聚起一点寒光，一道月牙形刀光 4 帧内从左下劈到右上，拖着渐隐的残影；牌子顺着刀痕错开，下半块慢慢往下沉，停一拍再合回去，合缝处闪一下",
  tech: "SVG：刀光是沿圆弧的月牙多边形，刀头角度用 whip 缓动（慢起猛冲），刀尾晚 2.6 帧，三层残影再晚一些；牌子用两个半平面 clipPath 切开，滑开是指数趋近、下沉按平方加速；挨刀和合回各一次衰减震屏，刀痕从白热冷却到冷色",
  frames: FRAMES,
  component: Effect,
};
export default effect;
