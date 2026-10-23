import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一句话先排成一行弹进来，然后字一个个松手掉下去：有重力，落地弹几下，互相撞着滚着
// 歪七扭八地堆成一堆；最后地板中间的活门往下打开，整堆字掉出画面，活门再关上接循环。
// 物理（重力、弹跳、字和字的碰撞、摩擦带出的滚动）在模块加载时逐帧算好，第 f 帧查表
const FRAMES = 150;
const TEXT = Array.from("重力会把字都拽下来");
const R = 56; // 碰撞半径：每个字当一个圆
const SIZE = 104;
const FLOOR = 880; // 地面
const ROW_Y = 300; // 一开始那行字的高度
const ROW_STEP = 132;
const ROW_X0 = W / 2 - (ROW_STEP * (TEXT.length - 1)) / 2;
const ENTER = 2; // 那行字弹进来
const ENTER_STEP = 2;
const DROP0 = 20; // 第一个字松手
const DROP_STEP = 4;
const DOOR_OPEN = [108, 116]; // 活门打开
const DOOR_CLOSE = [132, 147]; // 活门关上
const DOOR_ANG = 84; // 打开到多少度
const HALF = 560; // 每扇活门的长度，两扇拼成地板中间那段
const G = 1.25; // 重力，px/帧²
const E = 0.42; // 弹性
const MU = 0.45; // 摩擦
const SUB = 12;

// 松手顺序：从中间往两边交替，掉下去的字不会穿过还在行里的字
const ORDER = (() => {
  const n = TEXT.length;
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
})();
const DROP_AT = TEXT.map((_, i) => DROP0 + ORDER.indexOf(i) * DROP_STEP);

type B = { x: number; y: number; vx: number; vy: number; a: number; w: number; live: boolean; gone: boolean };
type Snap = { x: number; y: number; a: number; live: boolean; gone: boolean }[];

const doorAt = (f: number) =>
  DOOR_ANG *
  (ease.in(clamp01((f - DOOR_OPEN[0]) / (DOOR_OPEN[1] - DOOR_OPEN[0]))) -
    ease.inOut(clamp01((f - DOOR_CLOSE[0]) / (DOOR_CLOSE[1] - DOOR_CLOSE[0]))));

// 两扇活门：左扇铰链在左端、右扇铰链在右端，往下转开
const doorSegs = (deg: number) => {
  const t = (deg * Math.PI) / 180;
  const lx = W / 2 - HALF;
  const rx = W / 2 + HALF;
  return [
    { ax: lx, ay: FLOOR, bx: lx + Math.cos(t) * HALF, by: FLOOR + Math.sin(t) * HALF },
    { ax: rx, ay: FLOOR, bx: rx - Math.cos(t) * HALF, by: FLOOR + Math.sin(t) * HALF },
  ];
};

// 那行字弹进来：每字错开，从上面落下来带一点回弹
const rowY = (i: number, f: number) => {
  const t = clamp01((f - ENTER - i * ENTER_STEP) / 16);
  return lerp(-160, ROW_Y, ease.backOut(1.5)(t));
};

const SIM: Snap[] = (() => {
  const bs: B[] = TEXT.map((_, i) => ({
    x: ROW_X0 + i * ROW_STEP,
    y: rowY(i, 0),
    vx: 0,
    vy: 0,
    a: 0,
    w: 0,
    live: false,
    gone: false,
  }));
  const out: Snap[] = [];
  const I = 0.5 * R * R; // 实心圆的转动惯量 / 质量
  for (let f = 0; f < FRAMES; f++) {
    // 松手：给一点往中间的速度和往上的小跳，让字落到一处堆起来
    bs.forEach((b, i) => {
      if (!b.live && !b.gone && f === DROP_AT[i]) {
        b.live = true;
        const tx = W / 2 + (rand(i * 4.7 + 3) - 0.5) * 200;
        b.vx = (tx - b.x) / 34;
        b.vy = -6 - rand(i * 2.3) * 3;
        b.w = (rand(i * 8.1 + 1) - 0.5) * 0.12;
      }
      if (!b.live) {
        b.y = rowY(i, f);
        // 松手前 6 帧轻轻一抖，抖动的包络两头都是 0
        const pre = DROP_AT[i] - f;
        b.a = pre > 0 && pre <= 6 ? Math.sin(pre * 2.2) * 0.07 * Math.sin((Math.PI * pre) / 6) : 0;
      }
    });
    out.push(bs.map((b) => ({ x: b.x, y: b.y, a: b.a, live: b.live, gone: b.gone })));

    const segs = doorSegs(doorAt(f + 1));
    const settle = doorAt(f) < 3; // 活门开了就不再刹车，让字顺着门板滑下去
    const dt = 1 / SUB;
    for (let s = 0; s < SUB; s++) {
      const touch = bs.map(() => 0);
      for (const b of bs) {
        if (!b.live) continue;
        b.vy += G * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.w * dt;
        if (b.y > H + 300) {
          b.live = false;
          b.gone = true;
        }
      }
      // 字和活门（线段）
      for (const b of bs) {
        if (!b.live) continue;
        for (const g of segs) {
          const ex = g.bx - g.ax;
          const ey = g.by - g.ay;
          const len2 = ex * ex + ey * ey;
          const u = clamp01(((b.x - g.ax) * ex + (b.y - g.ay) * ey) / len2);
          const px = g.ax + ex * u;
          const py = g.ay + ey * u;
          const dx = b.x - px;
          const dy = b.y - py;
          const d = Math.hypot(dx, dy);
          if (d >= R || d < 1e-6) continue;
          const nx = dx / d;
          const ny = dy / d;
          b.x += nx * (R - d);
          b.y += ny * (R - d);
          contact(b, null, nx, ny, I);
          touch[bs.indexOf(b)]++;
        }
      }
      // 字和字
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const p = bs[i];
          const q = bs[j];
          if (!p.live || !q.live) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d >= 2 * R || d < 1e-6) continue;
          const nx = dx / d;
          const ny = dy / d;
          const push = (2 * R - d) / 2;
          p.x -= nx * push;
          p.y -= ny * push;
          q.x += nx * push;
          q.y += ny * push;
          contact(q, p, nx, ny, I);
          touch[i]++;
          touch[j]++;
        }
      }
      // 堆着的时候停下来：字是方的，碰着别的东西时滚不起来，转动和横向滑动都很快被吃掉
      bs.forEach((b, i) => {
        if (!b.live || touch[i] === 0 || !settle) return;
        b.w *= 1 - 0.06;
        b.vx *= 1 - 0.015;
        // 慢下来以后像方块一样"坐住"：速度越小刹得越狠，堆不会一直摊开
        if (Math.hypot(b.vx, b.vy) < 2.5) {
          b.vx *= 1 - 0.08;
          b.w *= 1 - 0.1;
        }
      });
    }
  }
  return out;
})();

// 接触冲量：法向带弹性，切向带摩擦并把一部分变成转动。n 从 o（或墙）指向 b
function contact(b: B, o: B | null, nx: number, ny: number, I: number) {
  const tx = -ny;
  const ty = nx;
  // 接触点相对速度（含转动）
  const ovx = o ? o.vx : 0;
  const ovy = o ? o.vy : 0;
  const rvx = b.vx - ovx;
  const rvy = b.vy - ovy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  const mInv = o ? 2 : 1;
  const e = vn < -3 ? E : 0; // 慢碰不弹，免得堆着时一直抖
  const jn = (-(1 + e) * vn) / mInv;
  b.vx += jn * nx;
  b.vy += jn * ny;
  if (o) {
    o.vx -= jn * nx;
    o.vy -= jn * ny;
  }
  // 切向：接触点处两边表面的速度差
  const vt = rvx * tx + rvy * ty - R * b.w - (o ? R * o.w : 0);
  const k = mInv + (R * R) / I + (o ? (R * R) / I : 0);
  const jt = Math.max(-MU * jn, Math.min(MU * jn, -vt / k));
  b.vx += jt * tx;
  b.vy += jt * ty;
  b.w -= (R * jt) / I;
  if (o) {
    o.vx -= jt * tx;
    o.vy -= jt * ty;
    o.w -= (R * jt) / I;
  }
}

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const snap = SIM[frame];
  const deg = doorAt(frame);
  const segs = doorSegs(deg);
  const open = clamp01(deg / 20);
  return (
    <Stage>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="ft-pit" x1={0} y1={0} x2={0} y2={1}>
            <stop offset={0} stopColor="#000000" stopOpacity={0.7} />
            <stop offset={1} stopColor="#000000" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* 活门下面的洞 */}
        <rect x={W / 2 - HALF} y={FLOOR} width={HALF * 2} height={H - FLOOR} fill="url(#ft-pit)" opacity={open} />
        {/* 两边固定的地板 */}
        <rect x={0} y={FLOOR} width={W / 2 - HALF} height={14} rx={4} fill={C.dim} />
        <rect x={W / 2 + HALF} y={FLOOR} width={W / 2 - HALF} height={14} rx={4} fill={C.dim} />
        {snap.map((b, i) =>
          b.gone ? null : (
            <text
              key={i}
              transform={`translate(${b.x} ${b.y}) rotate(${(b.a * 180) / Math.PI})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={FONT}
              fontWeight={900}
              fontSize={SIZE}
              fill={i === 0 || i === 1 ? C.accent : C.fg}
            >
              {TEXT[i]}
            </text>
          ),
        )}
        {/* 活门：盖在字前面画，字掉进洞里时被门边挡住一点 */}
        {segs.map((g, k) => {
          const ang = (Math.atan2(g.by - g.ay, g.bx - g.ax) * 180) / Math.PI;
          return (
            <g key={k} transform={`translate(${g.ax} ${g.ay}) rotate(${ang})`}>
              <rect x={0} y={0} width={HALF} height={14} rx={4} fill={C.dim} />
              <circle cx={0} cy={7} r={9} fill={C.bg2} stroke={C.dim} strokeWidth={3} />
            </g>
          );
        })}
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 74,
  name: "字掉下来堆成一堆",
  group: "文字",
  desc: "一句话先排成一行弹进来，字从中间往两边一个个松手掉下去，落地弹几下、互相撞着滚着，歪七扭八地堆成一堆；最后地板中间的活门往下打开，整堆字掉出画面，活门再关上",
  tech: "模块加载时逐帧积分（每帧 12 步）：每个字当一个圆，重力 1.25px/帧²，和活门线段、和别的字做位置修正 + 冲量碰撞（弹性 0.42、慢碰不弹，库仑摩擦 0.45 把切向速度变成转动），第 f 帧查表；松手从中间往两边交替，给一点朝中间的初速度好堆起来。创意参考 DavidHDev/react-bits 的 FallingText",
  frames: FRAMES,
  component: Scene,
};
export default effect;
