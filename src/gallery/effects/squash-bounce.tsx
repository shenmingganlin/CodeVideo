import { useCurrentFrame } from "remotion";
import { clamp01, lerp } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 弹球从左上角落进画面，一路往右弹：一跳比一跳低、越来越快，最后贴着地滚出右边。
// 竖直方向是真的重力加速度：下落越来越快、上升越来越慢，最高点一瞬停顿；
// 落地不是硬拐弯，而是压进一根"地面弹簧"里再弹出来，压得多深由落地速度决定
const FRAMES = 150;
const R = 70;
const GROUND = 840;
const G = 1.6; // 重力，px/帧²
const K = 1.3; // 地面弹簧硬度：接触约 3 帧
const DAMP = 0.32; // 接触时的阻尼：每跳剩约 62% 的高度
const SUB = 40; // 每帧积分步数

type S = { x: number; y: number; vx: number; vy: number };

// 整条轨迹在模块加载时算好，第 f 帧直接查表（只由帧号决定）。
// 第 0 帧球在画面左上角外、第 150 帧已滚出右边，首尾都是空画面，循环无缝
const TRACK: S[] = (() => {
  let x = -120;
  let y = 900; // 球底离地高度，负数是压进地面的深度
  let vx = 15.2;
  let vy = 0;
  const out: S[] = [];
  for (let f = 0; f <= FRAMES; f++) {
    out.push({ x, y, vx, vy });
    for (let i = 0; i < SUB; i++) {
      const dt = 1 / SUB;
      let ay = -G;
      if (y < 0) {
        ay += -K * y - DAMP * vy;
        vx *= 1 - 0.01 * dt; // 擦地时损失一点横向速度
      }
      vy += ay * dt;
      y += vy * dt;
      x += vx * dt;
    }
  }
  return out;
})();

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const s = TRACK[frame];
  const deg = 180 / Math.PI;

  let transform: string;
  if (s.y >= 0) {
    // 空中：顺着速度方向拉长、垂直方向变窄（面积不变），越快越长；快落地时收回圆形，接上压扁
    const speed = Math.abs(s.vy);
    const k = 0.32 * Math.tanh(speed / 38) * clamp01(s.y / 30);
    const sx = 1 + k;
    const a = Math.atan2(-s.vy, s.vx) * deg;
    const cy = GROUND - R - s.y;
    transform = `translate(${s.x} ${cy}) rotate(${a}) scale(${sx} ${1 / sx}) rotate(${-a})`;
  } else {
    // 接触：以着地点为原点压扁，压得越深越扁
    const pen = -s.y;
    const sy = 1 - (0.6 * pen) / R;
    const sx = 1 / sy ** 0.7;
    transform = `translate(${s.x} ${GROUND}) scale(${sx} ${sy}) translate(0 ${-R})`;
  }

  // 滚动：转过的角度等于走过的路程 / 半径
  const spin = (s.x / R) * deg;
  const lift = clamp01(s.y / 600);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <radialGradient id="sb-ball" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor={C.accent} />
            <stop offset="1" stopColor="#B86A18" />
          </radialGradient>
          <radialGradient id="sb-hi" cx="34%" cy="28%" r="40%">
            <stop offset="0" stopColor={C.fg} stopOpacity={0.75} />
            <stop offset="1" stopColor={C.fg} stopOpacity={0} />
          </radialGradient>
          <clipPath id="sb-clip">
            <circle r={R} />
          </clipPath>
        </defs>
        <line x1={0} x2={W} y1={GROUND + 2} y2={GROUND + 2} stroke={C.bg2} strokeWidth={4} />
        {/* 影子：球越高越小越淡 */}
        <ellipse
          transform={`translate(${s.x} ${GROUND + 4})`}
          rx={R * lerp(1.15, 0.45, lift)}
          ry={R * lerp(0.2, 0.08, lift)}
          fill="#000"
          opacity={lerp(0.5, 0.12, lift)}
        />
        <g transform={transform}>
          <circle r={R} fill="url(#sb-ball)" />
          {/* 一道转动的花纹，看得出球在滚 */}
          <g clipPath="url(#sb-clip)">
            <g transform={`rotate(${spin})`}>
              <rect x={-R} y={-11} width={R * 2} height={22} fill={C.fg} opacity={0.85} />
              <rect x={-11} y={-R} width={22} height={R * 2} fill={C.bg2} opacity={0.35} />
            </g>
          </g>
          {/* 高光不跟着转：光源是固定的 */}
          <circle r={R} fill="url(#sb-hi)" />
        </g>
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 8,
  name: "弹球压扁拉长",
  group: "形状",
  desc: "弹球从左上角落进来一路往右弹，一跳比一跳低、越来越密，最后贴地滚出画面：下落加速、上升减速，落地压扁、腾空顺着速度拉长，花纹跟着滚",
  tech: "真重力积分（g=1.6px/帧²，每帧 40 步）+ 地面弹簧阻尼接触（k=1.3、c=0.32，每跳剩约 62% 高度），压扁深度由落地速度决定；拉长按竖直速度 tanh 饱和；轨迹在模块加载时算好按帧查表",
  frames: FRAMES,
  component: Scene,
};
export default effect;
