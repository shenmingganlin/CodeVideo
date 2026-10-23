import { useCurrentFrame } from "remotion";
import { mixColor } from "../../shared/motion/motion";
import { C, H, Stage, W, loop, type GalleryEffect } from "../kit";

// 两条点链绕成双螺旋，斜着放在画面中间一直转；每隔两个点有一根碱基对横杆连着两条链，
// 近处的点大而亮，远处的小而暗，按远近排序画，前面的挡住后面的
const FRAMES = 150;
const N = 30; // 每条链的点数
const STEP = 0.42; // 相邻点绕轴转过的角度
const PITCH = 40; // 相邻点沿轴的间距
const R = 210;
const TILT = -0.42; // 螺旋轴倾斜的角度（弧度）
const CX = W / 2;
const CY = H / 2;
const FOCAL = 1400;
const RUNG_EVERY = 2;

type Item = { z: number; el: React.ReactNode };

const Effect: React.FC = () => {
  const frame = useCurrentFrame();
  // 一个循环正好转一整圈
  const spin = loop(frame, FRAMES) * Math.PI * 2;
  const ca = Math.cos(TILT);
  const sa = Math.sin(TILT);
  const project = (i: number, strand: number) => {
    const th = i * STEP + spin + strand * Math.PI;
    const ax = (i - (N - 1) / 2) * PITCH; // 沿轴
    const rx = Math.cos(th) * R; // 垂直于轴、在画面内
    const z = Math.sin(th) * R; // 朝镜头为正
    const s = FOCAL / (FOCAL - z);
    // 轴沿画面 x 方向，再整体旋转 TILT
    const x = ax * ca - rx * sa;
    const y = ax * sa + rx * ca;
    return { x: CX + x * s, y: CY + y * s, z, s };
  };
  const depth = (z: number) => (z + R) / (2 * R); // 0 = 最远，1 = 最近
  const items: Item[] = [];
  for (let strand = 0; strand < 2; strand++) {
    const color = strand === 0 ? C.accent : C.cool;
    for (let i = 0; i < N; i++) {
      const p = project(i, strand);
      const d = depth(p.z);
      if (i < N - 1) {
        const q = project(i + 1, strand);
        items.push({
          z: (p.z + q.z) / 2 - 1,
          el: (
            <line
              key={`b${strand}-${i}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={mixColor(C.bg, color, 0.25 + 0.55 * depth((p.z + q.z) / 2))}
              strokeWidth={6 * p.s}
              strokeLinecap="round"
            />
          ),
        });
      }
      items.push({
        z: p.z,
        el: <circle key={`p${strand}-${i}`} cx={p.x} cy={p.y} r={(9 + 9 * d) * p.s} fill={mixColor(C.bg, color, 0.3 + 0.7 * d)} />,
      });
    }
  }
  // 碱基对：两端各半根，颜色跟各自的链，分别按自己那半的深度排序
  for (let i = 0; i < N; i += RUNG_EVERY) {
    const a = project(i, 0);
    const b = project(i, 1);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    for (const [p, color, k] of [
      [a, C.accent, 0],
      [b, C.cool, 1],
    ] as const) {
      const zz = (p.z + m.z) / 2 - 2;
      items.push({
        z: zz,
        el: (
          <line
            key={`r${i}-${k}`}
            x1={p.x}
            y1={p.y}
            x2={m.x}
            y2={m.y}
            stroke={mixColor(C.bg, color, 0.2 + 0.5 * depth(zz))}
            strokeWidth={5 * p.s}
            strokeLinecap="round"
          />
        ),
      });
    }
  }
  items.sort((u, v) => u.z - v.z);
  return (
    <Stage>
      <svg width={W} height={H}>
        {items.map((it) => it.el)}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 49,
  name: "DNA 双螺旋旋转",
  group: "形状",
  desc: "两条点链绕成斜放的双螺旋一直转，链之间有碱基对横杆；近处的点大而亮、远处的小而暗，前面挡住后面",
  tech: "自己算 3D：点在 θ = i·0.42 + 转角 处，两条链差 π，透视缩放 1400/(1400−z)；所有点、链段、半根横杆按 z 排序画；一个循环转整一圈。创意参考 remotion-scenes 的 ShapeHelix",
  frames: FRAMES,
  component: Effect,
};
export default effect;
