import { useCurrentFrame } from "remotion";
import { clamp01, ease, lerp, type Rect } from "../../shared/motion/motion";
import { handoff, MorphCarrier, shadowOf, type Surface } from "../../shared/motion/Morph";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一排卡片里点中一张，它自己飞起来、拉宽成整屏的标题栏（同一个元素变形，不是切换），
// 点标题栏上的返回，它再缩回原来的位置
const FRAMES = 150;
const OPEN = [30, 62] as const;
const CLOSE = [100, 132] as const;

const CW = 380;
const CH = 240;
const GAP = 30;
const COLS = [0, 1, 2].map((i) => (W - (CW * 3 + GAP * 2)) / 2 + i * (CW + GAP));
const ROWS = [400, 400 + CH + GAP];
const PICK = 1; // 被点中的是第一排中间那张
const CARD: Rect = { x: COLS[PICK], y: ROWS[0], w: CW, h: CH, r: 18 };
const BAR: Rect = { x: 0, y: 0, w: W, h: 300, r: 0 };

const CardFace: React.FC = () => (
  <div style={{ width: CW, height: CH, padding: 28, boxSizing: "border-box", fontFamily: FONT, color: C.bg }}>
    <div style={{ fontSize: 34, fontWeight: 800 }}>第三章</div>
    <div style={{ marginTop: 26, height: 14, width: 260, borderRadius: 7, background: C.bg, opacity: 0.35 }} />
    <div style={{ marginTop: 14, height: 14, width: 190, borderRadius: 7, background: C.bg, opacity: 0.35 }} />
  </div>
);

const BarFace: React.FC = () => (
  <div style={{ width: W, height: 300, padding: "70px 120px", boxSizing: "border-box", fontFamily: FONT, color: C.bg, display: "flex", alignItems: "center", gap: 48 }}>
    <div style={{ width: 76, height: 76, borderRadius: 38, border: `5px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800 }}>←</div>
    <div>
      <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>第三章</div>
      <div style={{ marginTop: 18, height: 18, width: 520, borderRadius: 9, background: C.bg, opacity: 0.35 }} />
    </div>
  </div>
);

const card: Surface = { rect: CARD, fill: C.accent, elevation: 0.2, content: <CardFace /> };
const bar: Surface = { rect: BAR, fill: C.accent, elevation: 0.5, content: <BarFace /> };

// 光标：去点卡片 → 等 → 去点返回键 → 回原位。点下去时放一圈
const CURSOR_HOME = { x: 1500, y: 900 };
const CURSOR_CARD = { x: CARD.x + CW * 0.6, y: CARD.y + CH * 0.62 };
const CURSOR_BACK = { x: 158, y: 150 };
const cursorAt = (f: number) => {
  const legs: [number, number, { x: number; y: number }, { x: number; y: number }][] = [
    [6, 28, CURSOR_HOME, CURSOR_CARD],
    [70, 98, CURSOR_CARD, CURSOR_BACK],
    [118, 148, CURSOR_BACK, CURSOR_HOME],
  ];
  let p = CURSOR_HOME;
  for (const [a, b, from, to] of legs) {
    if (f < a) break;
    const t = ease.inOut(clamp01((f - a) / (b - a)));
    p = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
  }
  return p;
};

const Effect: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const opening = frame < (OPEN[1] + CLOSE[0]) / 2;
  const [start, end] = opening ? OPEN : CLOSE;
  const phase = handoff(frame, start, end);
  const isBar = opening ? phase === "after" : phase === "before";
  // 别的卡片在标题栏展开时往下让一点、变暗，一张接一张
  const open = (i: number) => {
    const d = i * 2;
    const a = ease.inOut(clamp01((frame - OPEN[0] - d) / 26));
    const b = ease.inOut(clamp01((frame - CLOSE[0] - d) / 26));
    return a - b;
  };
  const cursor = cursorAt(frame);
  const clicks = [28, 98];
  return (
    <Stage>
      {ROWS.flatMap((y, r) =>
        COLS.map((x, c) => {
          const i = r * 3 + c;
          if (r === 0 && c === PICK) return null;
          const k = open(i);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y + k * 60,
                width: CW,
                height: CH,
                borderRadius: 18,
                background: C.bg2,
                opacity: 1 - k * 0.55,
                boxShadow: shadowOf(0.2),
              }}
            >
              <div style={{ margin: 28, height: 22, width: 150, borderRadius: 11, background: C.dim }} />
              <div style={{ marginLeft: 28, height: 12, width: 240, borderRadius: 6, background: C.dim, opacity: 0.5 }} />
            </div>
          );
        }),
      )}
      {phase === "during" ? (
        <MorphCarrier frame={frame} start={start} end={end} from={opening ? card : bar} to={opening ? bar : card} bend={0.15} />
      ) : (
        <div
          style={{
            position: "absolute",
            left: (isBar ? BAR : CARD).x,
            top: (isBar ? BAR : CARD).y,
            width: (isBar ? BAR : CARD).w,
            height: (isBar ? BAR : CARD).h,
            borderRadius: (isBar ? BAR : CARD).r,
            background: C.accent,
            boxShadow: shadowOf(isBar ? 0.5 : 0.2),
            overflow: "hidden",
          }}
        >
          {isBar ? <BarFace /> : <CardFace />}
        </div>
      )}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {clicks.map((f) => {
          const dt = frame - f;
          if (dt < 0 || dt > 14) return null;
          const t = ease.out(dt / 14);
          const at = cursorAt(f);
          return <circle key={f} cx={at.x} cy={at.y} r={lerp(10, 54, t)} fill="none" stroke={C.fg} strokeWidth={3} opacity={1 - t} />;
        })}
        <path
          d={`M ${cursor.x} ${cursor.y} l 0 46 l 12 -11 l 9 21 l 9 -4 l -9 -20 l 17 -1 z`}
          fill={C.fg}
          stroke={C.bg}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 19,
  name: "卡片飞起变成标题栏",
  group: "转场",
  desc: "点中一张卡片，它自己飞起来、拉宽成整屏的标题栏，点返回再缩回原位；同一个元素变形，不是换页",
  tech: "MorphCarrier（ease.snap，32 帧，bend 0.15）：变形期间只画载体，起止帧和卡片、标题栏逐像素一致；内容先出后进，不叠化",
  frames: FRAMES,
  component: Effect,
};
export default effect;
