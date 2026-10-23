import { useCurrentFrame } from "remotion";
import { clamp01, rand } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 一排机场出发牌：每格的上半片绕中缝翻下来，哗啦啦翻过一串字，从左到右依次停在目标词上；
// 停一会儿，再一起翻回起始词
const FRAMES = 150;
const FROM = Array.from("上海虹桥机场");
const TO = Array.from("北京首都机场");
const POOL = Array.from("东南西北中春夏秋冬山水日月金木火土天地风云雨雪江河湖海");
const CW = 210; // 格宽
const CH = 300; // 格高
const GAP = 22;
const FLIP = 4; // 翻一片的帧数
const P1 = 8; // 第一轮开始翻
const P2 = 82; // 第二轮开始翻
const flips = (i: number) => 4 + 2 * i; // 左边先停，越往右翻得越久

// 这一格在这一轮要翻过的字：起始字、几个乱字、目标字
const sequence = (i: number, round: number, a: string, b: string) => {
  const n = flips(i);
  const seq = [a];
  for (let k = 1; k < n; k++) seq.push(POOL[Math.floor(rand(i * 31.7 + k * 7.13 + round * 101) * POOL.length)]);
  seq.push(b);
  return seq;
};

// 这一格此刻的状态：当前字、下一个字、翻到哪了（0–1，没在翻是 -1）
const stateAt = (i: number, frame: number) => {
  const run = (t: number, seq: string[]) => {
    const k = Math.floor(t / FLIP);
    if (t < 0) return { cur: seq[0], next: seq[0], p: -1 };
    if (k >= seq.length - 1) return { cur: seq[seq.length - 1], next: seq[seq.length - 1], p: -1 };
    return { cur: seq[k], next: seq[k + 1], p: (t - k * FLIP) / FLIP };
  };
  if (frame < P2) return run(frame - P1, sequence(i, 1, FROM[i], TO[i]));
  return run(frame - P2, sequence(i, 2, TO[i], FROM[i]));
};

// 半张牌：只露出字的上半或下半
const Half: React.FC<{ ch: string; top: boolean; style?: React.CSSProperties; shade?: number }> = ({
  ch,
  top,
  style,
  shade = 0,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: top ? 0 : CH / 2,
      width: CW,
      height: CH / 2,
      overflow: "hidden",
      background: C.bg2,
      borderRadius: top ? "14px 14px 0 0" : "0 0 14px 14px",
      backfaceVisibility: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        top: top ? 0 : -CH / 2,
        width: CW,
        height: CH,
        lineHeight: `${CH}px`,
        textAlign: "center",
        fontSize: 190,
        fontWeight: 800,
        fontFamily: FONT,
        color: C.fg,
      }}
    >
      {ch}
    </div>
    {/* 翻动时片子转离光源，压暗 */}
    <div style={{ position: "absolute", inset: 0, background: "#000", opacity: shade }} />
  </div>
);

const Cell: React.FC<{ i: number; frame: number; x: number; y: number }> = ({ i, frame, x, y }) => {
  const { cur, next, p } = stateAt(i, frame);
  const flipping = p >= 0;
  // 前半程：上半片（当前字）从竖直翻到水平；后半程：下半片（下一个字）从水平落到竖直
  const a1 = flipping ? clamp01(p * 2) * 90 : 0;
  const a2 = flipping ? (1 - clamp01(p * 2 - 1)) * 90 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: CW, height: CH, perspective: 900 }}>
      {/* 底下静止的两半：上面已经是下一个字，下面还是当前字 */}
      <Half ch={flipping ? next : cur} top />
      <Half ch={cur} top={false} />
      {flipping && p < 0.5 && (
        <Half
          ch={cur}
          top
          shade={(a1 / 90) * 0.55}
          style={{ transformOrigin: "50% 100%", transform: `rotateX(${-a1}deg)` }}
        />
      )}
      {flipping && p >= 0.5 && (
        <Half
          ch={next}
          top={false}
          shade={(a2 / 90) * 0.55}
          style={{ transformOrigin: "50% 0%", transform: `rotateX(${a2}deg)` }}
        />
      )}
      {/* 中缝 */}
      <div style={{ position: "absolute", left: 0, top: CH / 2 - 3, width: CW, height: 6, background: C.bg }} />
      <div style={{ position: "absolute", left: -6, top: CH / 2 - 9, width: 10, height: 18, borderRadius: 3, background: C.dim }} />
      <div style={{ position: "absolute", left: CW - 4, top: CH / 2 - 9, width: 10, height: 18, borderRadius: 3, background: C.dim }} />
    </div>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const total = FROM.length * CW + (FROM.length - 1) * GAP;
  const x0 = (W - total) / 2;
  const y0 = (H - CH) / 2 + 30;
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          left: x0,
          top: y0 - 90,
          fontSize: 40,
          letterSpacing: 12,
          color: C.accent,
          fontWeight: 700,
        }}
      >
        出发 DEPARTURES
      </div>
      {FROM.map((_, i) => (
        <Cell key={i} i={i} frame={frame} x={x0 + i * (CW + GAP)} y={y0} />
      ))}
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 23,
  name: "机场翻牌",
  group: "文字",
  desc: "一排出发牌每格的上半片绕中缝翻下来，哗啦啦翻过一串字，从左到右依次停在目标词上，停一会儿再翻回去",
  tech: "每格四个半片 div，翻动片 rotateX 0→90°（perspective 900）、转离时压暗；一片 4 帧，第 i 格翻 4+2i 片，乱字用 rand 定种子。创意参考 remotion-scenes 的 RollerSplitFlap",
  frames: FRAMES,
  component: Scene,
};
export default effect;
