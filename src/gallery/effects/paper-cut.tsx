import { useCurrentFrame } from "remotion";
import { colorRamp, ease, prog } from "../../shared/motion/motion";
import { C, H, Stage, W, type GalleryEffect } from "../kit";

// 六层剪纸山从远到近一层层弹着立起来，每层带投影；立好后各层按远近不同的速度左右漂，
// 有纵深；再从近到远依次倒下去，回到一张空纸
const FRAMES = 150;
const N = 6;
const SKY = C.fg;
// 远的浅、近的深
const ramp = [C.fg, C.cool, C.dim, C.bg2, C.bg];
const layerColor = (i: number) => colorRamp(ramp, 0.12 + (0.88 * i) / (N - 1));

// 山脊：几个正弦叠起来，每层错开相位；近的山低而起伏小
const ridge = (i: number) => {
  const base = 430 + i * 95;
  const amp = 150 - i * 18;
  const pts: string[] = [];
  for (let x = -120; x <= W + 120; x += 20) {
    const y =
      base -
      amp *
        (0.55 * Math.sin(x / (260 - i * 18) + i * 1.7) +
          0.3 * Math.sin(x / (110 - i * 6) + i * 0.9) +
          0.15 * Math.sin(x / 47 + i * 2.3));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `${pts.join(" ")} ${W + 120},${H + 40} -120,${H + 40}`;
};
const RIDGES = Array.from({ length: N }, (_, i) => ridge(i));

// 最近一层上的一棵松树
const Pine: React.FC<{ x: number; y: number; s: number; fill: string }> = ({ x, y, s, fill }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
    <rect x={-8} y={-40} width={16} height={60} />
    <polygon points="0,-260 -70,-150 70,-150" />
    <polygon points="0,-200 -100,-80 100,-80" />
    <polygon points="0,-140 -130,-20 130,-20" />
  </g>
);

const Scene: React.FC = () => {
  const f = useCurrentFrame() % FRAMES;
  // 立起：从远到近，每层隔 6 帧，用回弹缓动；倒下：从近到远，每层隔 4 帧
  const stand = (i: number) => prog(f, 6 + i * 6, 26 + i * 6, ease.backOut(1.5));
  const fall = (i: number) => prog(f, 112 + (N - 1 - i) * 4, 126 + (N - 1 - i) * 4, ease.in);
  // 月亮跟着最远那层一起升起
  const moonUp = prog(f, 4, 34, ease.out) * (1 - prog(f, 130, 146, ease.in));

  return (
    <Stage bg={SKY}>
      <svg width={W} height={H}>
        <defs>
          <filter id="pc-shadow" x="-10%" y="-30%" width="120%" height="160%">
            <feDropShadow dx={0} dy={-10} stdDeviation={12} floodColor="#000" floodOpacity={0.35} />
          </filter>
        </defs>
        <circle cx={W * 0.7} cy={260 + 340 * (1 - moonUp)} r={110} fill={C.accent} opacity={moonUp} />
        {RIDGES.map((pts, i) => {
          const up = stand(i) * (1 - fall(i));
          if (up <= 0.001) return null;
          // 视差漂移：一个循环里正好一个来回，近的漂得多
          const drift = Math.sin((f / FRAMES) * Math.PI * 2) * (10 + i * 16);
          const dy = (1 - up) * 700;
          const tilt = (1 - Math.min(1, up)) * 70; // 倒着的时候像一张纸平躺着
          return (
            <g
              key={i}
              filter="url(#pc-shadow)"
              transform={`translate(${drift.toFixed(2)} ${dy.toFixed(2)})`}
              style={{ transformOrigin: `${W / 2}px ${H}px`, transformBox: "view-box" }}
            >
              <g transform={`translate(0 ${H}) scale(1 ${Math.cos((tilt * Math.PI) / 180).toFixed(4)}) translate(0 ${-H})`}>
                <polygon points={pts} fill={layerColor(i)} />
                {i === N - 1 ? (
                  <>
                    <Pine x={330} y={H - 90} s={1.15} fill={layerColor(i)} />
                    <Pine x={470} y={H - 60} s={0.8} fill={layerColor(i)} />
                  </>
                ) : null}
              </g>
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 53,
  name: "剪纸层叠",
  group: "质感",
  desc: "六层剪纸山从远到近一层层弹着立起来，每层投下影子，月亮升起；各层按远近不同速度左右漂出纵深，再从近到远依次倒下",
  tech: "SVG：每层山脊是三个正弦叠成的多边形，colorRamp 在 OKLab 里由浅到深上色；feDropShadow 投影；立起用 ease.backOut 回弹 + 竖向 cos 压扁模拟倒伏，漂移幅度随层数增加；创意参考 remotion-scenes 的 ThemePaperCut",
  frames: FRAMES,
  component: Scene,
};
export default effect;
