import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Composition, staticFile, useCurrentFrame } from "remotion";
import { SANS_FAMILY } from "../shared/fonts";
import { Burst, Counter, Grain } from "../shared/motion/creative";
import { clamp01, colorRamp, ease, lerp, mixColor, prog, rand } from "../shared/motion/motion";
import { FloodReveal } from "../shared/motion/transitions";

// 风格试验：排序片开场 12 秒，按「一个方块 → 1000 个方块 → 一个方块」重做一遍。
// 看的是美术和动效，不是内容：颜色就是数值，排好序的那一刻整片变成一条渐变。

const SERIF = "Noto Serif SC";
await loadFont({ family: SERIF, url: staticFile("fonts/NotoSerifSC-VF.ttf"), weight: "200 900" });

const W = 1920;
const H = 1080;
const FPS = 30;
const DUR = 360; // 12 秒，120 BPM 下一拍 15 帧

// 四个色场：深、纸、朱砂、竹青
const DARK = "#12100E";
const PAPER = "#EDE6DA";
const HOT = "#E2482B"; // 朱砂：冒泡、代价
const COOL = "#5E9C86"; // 竹青：归并、秩序
const INK = "#F4EFE4";

// 1000 个方块 = 50 × 20，铺满画面绝大部分
const COLS = 50;
const ROWS = 20;
const N = COLS * ROWS;
const PITCH = 38;
const TILE = 32;
const GX = (W - COLS * PITCH) / 2;
const GY = 140;
const GRID_H = ROWS * PITCH;

// 时间轴：章节都落在整拍上（每拍 15 帧，每章 4 拍 = 60 帧）
const T = {
  seedIn: 0,
  burst: 14, // 种子炸成 1000 个
  chaos: 60, // 乱：冒泡
  divide: 120, // 分：一行行劈开，每块各自有序
  merge: 180, // 合：并回去，整片有序
  flood: 240, // 数据变成纸
  numbers: 252,
  ratio: 300,
  collapse: 322,
  end: 344,
};

const BUBBLE_TOTAL = 499329;
const MERGE_TOTAL = 8702;

// 每个方块的值，固定种子，每次渲染都一样。两头的值往极值推：大片朱砂、大片竹青、少数中间值，
// 比均匀采样鲜亮得多（均匀的话大半方块落在两种颜色的灰褐中点上，一片闷）
const VALUE = Array.from({ length: N }, (_, i) => clamp01(0.5 + (rand(i * 7.31 + 1.7) - 0.5) * 1.9));
const chaosColor = (i: number) => mixColor(HOT, COOL, VALUE[i]);
// 排好序的色带：从朱砂经一段暖沙到竹青，中段是「透光」而不是「混浊」
const RAMP = [HOT, "#DE9F62", "#7FAE93", COOL];
const sortedColor = (t: number) => colorRamp(RAMP, t);

// 第 k 层分块：整片分成 2^k 块，每块是连续的几行；块内先各自有序
const blockOf = (i: number, k: number) => Math.floor((i / N) * 2 ** k);
const localT = (i: number, k: number) => {
  const b = blockOf(i, k);
  const size = N / 2 ** k;
  return (i - b * size) / Math.max(1, size - 1);
};

// 分与合之间的层级：0 → 4 → 0
const levelAt = (f: number) => {
  if (f < T.divide) return 0;
  if (f < T.merge) return 4 * prog(f, T.divide, T.merge - 22, ease.inOut);
  return 4 * (1 - prog(f, T.merge, T.merge + 40, ease.inOut));
};

// 一行方块分开时，行与行之间让出的空隙；整片跟着缩小，才不出画
const rowGapAt = (f: number) => {
  const k = levelAt(f);
  return k < 0.01 ? 0 : lerp(0, 13, k / 4);
};
const gridScaleAt = (f: number) => {
  const gap = rowGapAt(f);
  return GRID_H / (GRID_H + gap * (ROWS - 1));
};

const SEED = 116;

const SortingStyleDemo: React.FC = () => {
  const frame = useCurrentFrame();

  const k = levelAt(frame);
  const ordered = prog(frame, T.divide, T.divide + 22, ease.out);
  const merged = prog(frame, T.merge, T.merge + 40, ease.inOut);
  // 转场时方块阵不自己淡出：纸的 flood 会把它盖掉，先淡出中间就是一段死场

  const bubbleProgress = frame < T.chaos ? 0 : prog(frame, T.chaos, T.divide, ease.out);
  const mergeProgress = frame < T.merge ? 0 : prog(frame, T.merge, T.merge + 40, ease.out);

// 排好序之后一道高光扫过整片，给「合」一个收尾，不让画面空等转场
const shineAt = (c: number) => {
  const s = prog(frame, T.merge + 40, T.flood - 2, ease.inOut);
  const d = Math.abs(c / (COLS - 1) - s);
  return frame < T.merge + 40 || frame >= T.flood ? 0 : Math.max(0, 1 - d * 9) * 0.5;
};
  const scale = gridScaleAt(frame);
  const gap = rowGapAt(frame);

  return (
    <AbsoluteFill style={{ background: DARK }}>
      {/* ── 数据场：从种子炸开 → 乱 → 分 → 合 → 变成纸 ─────────────────── */}
      {frame >= T.burst - 4 ? (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
            {Array.from({ length: N }, (_, i) => {
              const c = i % COLS;
              const r = Math.floor(i / COLS);

              // 从中心飞出去：rank 决定谁先落地
              const rank = (Math.abs(c - (COLS - 1) / 2) + Math.abs(r - (ROWS - 1) / 2) * 1.6) / 32;
              const fly = prog(frame, T.burst + rank * 7, T.burst + rank * 7 + 15, ease.out);
              if (fly <= 0) return null;

              const x = GX + c * PITCH;
              const y = GY + r * (PITCH + gap) + gap * 0.5;

              // 颜色：乱的 → 各自块内有序 → 全片有序
              const local =
                ordered > 0 ? mixColor(chaosColor(i), sortedColor(localT(i, Math.round(k))), ordered) : chaosColor(i);
              const color = merged > 0 ? mixColor(local, sortedColor(i / (N - 1)), merged) : local;

              // 比较时的一点闪：只在第三章之前
              const flicker =
                frame >= T.chaos && frame < T.divide && rand(i * 3.7 + Math.floor(frame / 2) * 11.3) > 0.94
                  ? 0.6
                  : 0;
              const shine = shineAt(c);

              // 落地时压一下
              const land = frame - (T.burst + rank * 7 + 15);
              const squash = land >= 0 && land < 8 ? 1 + 0.16 * (1 - land / 8) : 1;

              const px = lerp(W / 2 - TILE / 2, x + PITCH / 2 - TILE / 2, fly);
              const py = lerp(H / 2 - TILE / 2, y + PITCH / 2 - TILE / 2, fly);

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: px,
                    top: py,
                    width: TILE,
                    height: TILE,
                    borderRadius: 4,
                    background: mixColor(color, "#FFFFFF", Math.max(flicker, shine)),
                    transform: `scale(${lerp(2.4, 1, fly) * squash})`,
                    opacity: clamp01(fly * 3),
                  }}
                />
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* ── 种子：开头长出来，结尾缩回来 ─────────────────────────────────── */}
      {frame < T.burst + 12 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <SeedTile frame={frame} opening />
        </AbsoluteFill>
      ) : null}

      {/* ── 读数：代价，一直涨 ───────────────────────────────────────────── */}
      {frame >= T.chaos - 4 && frame < T.flood + 10 ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 40,
              display: "flex",
              justifyContent: "center",
              gap: 200,
            }}
          >
            <Readout
              label="冒泡 · 比较次数"
              color={HOT}
              frame={frame}
              start={T.chaos}
              total={BUBBLE_TOTAL}
              progress={bubbleProgress}
              dim={frame >= T.divide + 6}
            />
            <Readout
              label="归并 · 比较次数"
              color={COOL}
              frame={frame}
              start={T.merge}
              total={MERGE_TOTAL}
              progress={mergeProgress}
              dim={frame < T.merge}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ── 数据变成纸：从方阵中心涌出一张纸 ─────────────────────────────── */}
      {frame >= T.flood ? (
        <FloodReveal
          frame={frame}
          start={T.flood}
          end={T.flood + 26}
          origin={{ x: W / 2, y: H / 2 }}
          r0={110}
          width={W}
          height={H}
          rim={{ color: COOL, width: 3 }}
        >
          <PaperScene frame={frame} />
        </FloodReveal>
      ) : null}

      {/* ── 收：墨从中心涌回来，盖住纸，只剩那个方块 ─────────────────────── */}
      {frame >= T.collapse ? (
        <FloodReveal
          frame={frame}
          start={T.collapse}
          end={T.collapse + 20}
          origin={{ x: W / 2, y: H / 2 }}
          r0={SEED / 2}
          width={W}
          height={H}
          rim={{ color: HOT, width: 2 }}
        >
          <AbsoluteFill style={{ background: DARK, alignItems: "center", justifyContent: "center" }}>
            <SeedTile frame={frame} />
          </AbsoluteFill>
        </FloodReveal>
      ) : null}

      <Grain frame={frame} opacity={0.055} vignette={frame < T.flood || frame >= T.collapse ? 0.34 : 0.16} />
    </AbsoluteFill>
  );
};

/* ── 种子方块 ──────────────────────────────────────────────────────────────── */
const SeedTile: React.FC<{ frame: number; opening?: boolean }> = ({ frame, opening }) => {
  // 开头：长出来 → 脉冲 → 炸开；结尾：从纸里浮起来，慢慢呼吸
  // 第一帧就看得见种子：全黑开场像视频坏了
  const appear = opening
    ? 0.75 + 0.25 * prog(frame, T.seedIn, 8, ease.out)
    : prog(frame, T.collapse, T.collapse + 14, ease.out);
  const beat = opening ? Math.max(0, 1 - Math.abs(frame - T.burst + 2) / 6) : 0;
  const breathe = 1 + 0.035 * Math.sin((frame / FPS) * Math.PI * 2 * 1.1);
  const s = lerp(0.55, 1, appear) * (1 + beat * 0.16) * breathe;

  return (
    <div
      style={{
        width: SEED,
        height: SEED,
        borderRadius: 10,
        background: HOT,
        transform: `scale(${s})`,
        opacity: appear,
        boxShadow: `0 0 ${60 + beat * 60}px rgba(226,72,43,${0.25 + beat * 0.3})`,
      }}
    />
  );
};

/* ── 读数 ──────────────────────────────────────────────────────────────────── */
const Readout: React.FC<{
  label: string;
  color: string;
  frame: number;
  start: number;
  total: number;
  progress: number;
  dim: boolean;
}> = ({ label, color, frame, start, total, progress, dim }) => {
  const o = prog(frame, start - 4, start + 10, ease.out) * (dim ? 0.3 : 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: o }}>
      <div
        style={{
          fontFamily: SANS_FAMILY,
          fontSize: 20,
          letterSpacing: "0.3em",
          color: INK,
          opacity: 0.55,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <Counter
        from={0}
        to={total}
        progress={progress}
        style={{
          fontFamily: SANS_FAMILY,
          fontSize: 84,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color,
          lineHeight: 1,
        }}
      />
    </div>
  );
};

/* ── 纸上的两个数字 ───────────────────────────────────────────────────────── */
const PaperScene: React.FC<{ frame: number }> = ({ frame }) => {
  const n1 = prog(frame, T.numbers, T.numbers + 16, ease.out);
  const n2 = prog(frame, T.numbers + 8, T.numbers + 24, ease.out);
  // 「对」不跟着 57 倍走：一开始就在两个数字中间立着，不然中间空一大块
  const dui = prog(frame, T.numbers + 22, T.numbers + 34, ease.out);
  const ratio = prog(frame, T.ratio, T.ratio + 12, ease.snap);
  const leave = prog(frame, T.collapse - 2, T.collapse + 12, ease.in);
  // 57 倍砸下来之前，两个数字快速让位，不能和它叠在一起。
  // 用 out（快出长收）：in 这条贝塞尔末端收得慢，退场会拖泥带水
  const numLeave = prog(frame, T.ratio - 4, T.ratio + 6, ease.out);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 110,
          opacity: (1 - leave) * (1 - numLeave),
          transform: `scale(${(1 - leave * 0.14) * (1 - numLeave * 0.12)})`,
        }}
      >
        <BigNumber text="499,329" label="冒泡" color={HOT} p={n1} />
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 132,
            fontWeight: 600,
            color: DARK,
            opacity: Math.max(dui * 0.75, ratio * 0.75),
            transform: `scale(${lerp(0.86, 1, Math.max(dui, ratio))})`,
            paddingBottom: 30,
          }}
        >
          对
        </div>
        <BigNumber text="8,702" label="归并" color={COOL} p={n2} />
      </AbsoluteFill>

      {/* 57 倍：最后砸在中间 */}
      {frame >= T.ratio ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 300,
              fontWeight: 800,
              color: DARK,
              opacity: prog(frame, T.ratio, T.ratio + 6, ease.out) * (1 - leave),
              transform: `scale(${lerp(1.24, 1, ratio)})`,
              letterSpacing: "-0.02em",
              mixBlendMode: "multiply",
            }}
          >
            57<span style={{ fontSize: 176 }}>倍</span>
          </div>
          <Burst
            frame={frame}
            start={T.ratio}
            x={W / 2}
            y={H / 2}
            color={DARK}
            rays={18}
            r0={90}
            r1={430}
            frames={20}
            width={3}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const BigNumber: React.FC<{ text: string; label: string; color: string; p: number }> = ({ text, label, color, p }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div
      style={{
        fontFamily: SANS_FAMILY,
        fontSize: 26,
        letterSpacing: "0.36em",
        color: DARK,
        opacity: p * 0.5,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: SANS_FAMILY,
        fontSize: 158,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color,
        lineHeight: 1,
        opacity: p,
        transform: `translateY(${lerp(24, 0, p)}px)`,
      }}
    >
      {text}
    </div>
  </div>
);

export const SortingStyleDemoComposition: React.FC = () => (
  <Composition
    id="SortingStyleDemo"
    component={SortingStyleDemo}
    durationInFrames={DUR}
    fps={FPS}
    width={W}
    height={H}
  />
);
