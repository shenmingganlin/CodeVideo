import { useCurrentFrame } from "remotion";
import { clamp01, mixColor, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一张纸被碎纸机咬住往下送，穿过机口就切成一条条竖条，碎条吊在下面各自卷、晃；
// 整张送完碎条松开，带着重力翻着掉出画面；一张新纸从上面落下来，弹两下停住，接回开头
const FRAMES = 150;
const PW = 760; // 纸宽
const PH = 520; // 纸高
const PX = W / 2 - PW / 2;
const REST_Y = 70; // 纸静止时的上沿
const SLOT = REST_Y + PH; // 机口（纸下沿正好搭在口上）
const BODY_H = 120; // 机身高度，纸穿过机身这段看不见
const EXIT = SLOT + BODY_H; // 出口，碎条从这里吊下来
const N = 14; // 碎条数
const SW = PW / N;
const SEG = 26; // 每条碎条分成几节，节节累积弯曲
const GRAB = 10; // 咬住纸
const FEED_V = 13; // 送纸稳定速度（像素/帧）
const RAMP = 8; // 从咬住到全速用几帧
const DROP0 = 96; // 新纸开始落
const LAND = 116;

// 送进去的长度：咬住时先猛地一拽，再匀速送（速度在 RAMP 帧里从 0 升到 FEED_V）
const fed = (f: number) => {
  const t = f - GRAB;
  if (t <= 0) return 0;
  if (t < RAMP) return (FEED_V * t * t) / (2 * RAMP);
  return FEED_V * (t - RAMP / 2);
};
// 纸上沿穿过出口的时刻：碎条从这一刻起松开
const DONE = (() => {
  let f = GRAB;
  while (fed(f) < PH + BODY_H) f += 0.25;
  return f;
})();

// 纸面：页眉色条、一个圆、几行字
const Sheet: React.FC = () => (
  <g>
    <rect x={0} y={0} width={PW} height={PH} rx={6} fill={C.fg} />
    <rect x={0} y={0} width={PW} height={92} rx={6} fill={C.accent} />
    <text x={40} y={64} fill={C.bg} fontFamily={FONT} fontSize={44} fontWeight={800}>
      机密文件
    </text>
    <circle cx={PW - 150} cy={250} r={96} fill={C.cool} />
    {[150, 200, 250, 300, 350, 400, 450].map((y, i) => (
      <rect key={y} x={40} y={y} width={i % 3 === 2 ? 280 : 420} height={18} rx={9} fill={C.dim} opacity={0.55} />
    ))}
  </g>
);

const Effect: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  const feeding = f >= GRAB && f < DONE;
  const L = Math.min(fed(f), PH + BODY_H); // 已送进去多少
  const top = REST_Y + L; // 纸（未切部分）上沿
  // 吊在出口下面的碎条长度
  const hang = Math.max(0, Math.min(PH, L - BODY_H));
  // 松开后的下落：每条错开一点
  const fallT = (i: number) => Math.max(0, f - DONE - rand(i * 7 + 3) * 4);

  // 新纸落下：1-s² 加速砸下来，落地后阻尼弹两下
  const dropS = clamp01((f - DROP0) / (LAND - DROP0));
  const dropOff = f >= DROP0 && f < LAND ? -(1 - dropS * dropS) * (REST_Y + PH + 40) : 0;
  const bounce = f >= LAND ? -Math.exp(-(f - LAND) / 4) * Math.abs(Math.sin(((f - LAND) / 7) * Math.PI)) * 22 : 0;
  const newY = REST_Y + dropOff + bounce;
  const showNew = f >= DROP0;
  // 机身：送纸时高频细抖
  const run = feeding ? Math.min(1, (f - GRAB) / 3) * Math.min(1, (DONE - f) / 3) : 0;
  const shake = run * (Math.sin(f * 2.7) * 1.6 + Math.sin(f * 4.3) * 0.9);

  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          {/* 机口以上才看得见没切的纸 */}
          <clipPath id="sh-above">
            <rect x={0} y={-H} width={W} height={H + SLOT} />
          </clipPath>
          {Array.from({ length: N }, (_, i) => (
            <clipPath id={`sh-col-${i}`} key={i}>
              <rect x={i * SW + 1.5} y={-10} width={SW - 3} height={PH + 20} />
            </clipPath>
          ))}
          <linearGradient id="sh-body" x1={0} y1={0} x2={0} y2={1}>
            <stop offset={0} stopColor={mixColor(C.bg2, C.dim, 0.5)} />
            <stop offset={1} stopColor={C.bg2} />
          </linearGradient>
        </defs>

        {/* 碎条：从出口吊下来，一节节累积弯曲，像纸条自己卷着；松开后整条带转角掉下去 */}
        {hang > 0 || f >= DONE
          ? Array.from({ length: N }, (_, i) => {
              const len = f >= DONE ? PH : hang;
              const segLen = len / SEG;
              const r1 = rand(i * 31 + 5);
              const r2 = rand(i * 17 + 11);
              // 越靠两边越往外撇；每条自己的卷曲方向和晃动相位
              const splay = ((i - (N - 1) / 2) / N) * 0.5;
              const curl = (r1 - 0.5) * 0.9;
              const wob = Math.sin((f / FRAMES) * Math.PI * 2 * 3 + r2 * 6.28) * 0.06;
              const grow = clamp01(len / PH);
              const per = ((splay + curl * grow) * grow + wob) / SEG;
              const t = fallT(i);
              const fx = PX + i * SW + SW / 2 + t * (splay * 9 + (r2 - 0.5) * 4);
              const fy = EXIT + 1.1 * t * t + t * 2;
              const fr = t * (r1 - 0.5) * 4;
              // 从出口往下一节节画：每节在上一节末端处继续转 per 弧度
              let x = 0;
              let y = 0;
              let a = 0;
              const nodes: React.ReactNode[] = [];
              for (let s = 0; s < SEG; s++) {
                a += per;
                // 这一节对应纸上的哪一段：碎条最底下是纸的最底下
                const srcY = PH - len + s * segLen;
                nodes.push(
                  <g
                    key={s}
                    transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((-a * 180) / Math.PI).toFixed(3)})`}
                  >
                    <svg x={-SW / 2} y={0} width={SW} height={segLen + 1.2} overflow="hidden">
                      <g transform={`translate(${-i * SW} ${-srcY})`} clipPath={`url(#sh-col-${i})`}>
                        <Sheet />
                      </g>
                    </svg>
                    <rect x={-SW / 2} y={0} width={SW} height={segLen + 1.2} fill="#000" opacity={(0.04 + 0.08 * r2 + Math.abs(a) * 0.4).toFixed(3)} />
                  </g>,
                );
                x += Math.sin(a) * segLen;
                y += Math.cos(a) * segLen;
              }
              return (
                <g key={i} transform={`translate(${fx.toFixed(2)} ${fy.toFixed(2)}) rotate(${fr.toFixed(2)})`}>
                  {nodes}
                </g>
              );
            })
          : null}

        {/* 还没送进去的纸 */}
        {f < DONE ? (
          <g clipPath="url(#sh-above)">
            <g transform={`translate(${PX} ${top})`}>
              <rect x={6} y={14} width={PW} height={PH} rx={6} fill="#000" opacity={0.3} />
              <Sheet />
            </g>
          </g>
        ) : null}

        {/* 新纸 */}
        {showNew ? (
          <g transform={`translate(${PX} ${newY.toFixed(2)})`}>
            <rect x={6} y={14} width={PW} height={PH} rx={6} fill="#000" opacity={0.3} />
            <Sheet />
          </g>
        ) : null}

        {/* 机身盖在纸上面 */}
        <g transform={`translate(0 ${shake.toFixed(2)})`}>
          <rect x={PX - 90} y={SLOT - 6} width={PW + 180} height={BODY_H + 6} rx={22} fill="url(#sh-body)" />
          <rect x={PX - 14} y={SLOT - 2} width={PW + 28} height={10} rx={5} fill={C.bg} />
          <rect x={PX - 14} y={EXIT - 12} width={PW + 28} height={8} rx={4} fill={C.bg} />
          <circle cx={PX + PW + 40} cy={SLOT + 56} r={10} fill={feeding ? C.accent : C.dim} />
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 80,
  name: "碎纸机切条",
  group: "转场",
  desc: "纸被碎纸机咬住往下送，穿过机口切成十四条竖条，碎条吊着各自卷、晃，送完松开翻着掉下去，新纸再从上面落下来弹两下",
  tech: "纸未切部分用机口以上的 clipPath 露出；碎条每条分 26 节，每节在上节末端继续转一个小角度（外撇 + 随机卷 + 循环晃动），节内嵌纸面对应那一截；送纸 t² 起速再匀速，松开后 1.1t² 下落带转；新纸 1-s² 砸下、指数衰减弹跳；创意参考 DavidHDev/react-bits 的 Shredder",
  frames: FRAMES,
  component: Effect,
};
export default effect;
