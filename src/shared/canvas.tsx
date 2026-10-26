import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Canvas 2D 图层：上万粒子、流场、傅里叶本轮、像素风这类 SVG 画不动的东西（几千个 DOM 元素就卡了）
//
//   <CanvasLayer draw={(ctx, frame, { width, height }) => { … }} />
//
// draw 每帧调一次，ctx 已经清空、已经按 width × height 的坐标缩放好（渲染时 --scale=0.5 画布也跟着缩，坐标照写原尺寸）。
// 硬规则：画面只能由帧号算出来。Remotion 多个标签页乱序渲染，所以
// - 不能靠"不清屏"留轨迹：每帧从头画，拖尾就把前几帧的位置也算出来画上
// - 不能在 draw 里改外面的变量、不能用 Math.random：随机数用 motion.ts 的 rand(种子)
// - 要一步步积分的模拟（粒子跟着流场走）用下面的 simulate()，不要在 draw 里接着上一帧算

export type CanvasSize = { width: number; height: number };

export const CanvasLayer: React.FC<{
  draw: (ctx: CanvasRenderingContext2D, frame: number, size: CanvasSize) => void;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ draw, width: w, height: h, style }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = w ?? config.width;
  const height = h ?? config.height;
  const ref = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect 在 Remotion 截图之前同步跑完，useEffect 可能来不及
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // 渲染时的 --scale 体现在 devicePixelRatio 上；画布像素跟着它走，草稿档就真的少画一半
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("拿不到 Canvas 2D 上下文");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    draw(ctx, frame, { width, height });
    ctx.restore();
  }, [draw, frame, width, height]);

  return <canvas ref={ref} style={{ position: "absolute", left: 0, top: 0, width, height, ...style }} />;
};

// 确定性的逐帧模拟：state(f) = step(state(f-1), f)，state(0) = init()。
// 每 every 帧存一个检查点，取第 f 帧时从最近的检查点往后算，所以乱序取哪一帧结果都一样，
// 也不用把每一帧都存下来（一万个粒子 × 1800 帧会吃掉几百 MB）。
// step 必须是纯函数：只看传进来的 state 和帧号，随机数用 rand(种子)。它可以原地改 state 再返回
//
//   const flow = simulate({ init: () => new Float32Array(N * 2), step: (s, f) => { …; return s; }, every: 30 });
//   flow.at(frame)   第 frame 帧的状态（返回的是拷贝，随便改）
//
// 另外记住最近取过的 recent 帧（缺省 8）：Studio 顺着播放时下一帧只要从上一帧走一步，
// 不用每帧从检查点重算十几步（#87 万条细丝从每帧 27ms 降到 1ms）。step 是纯函数，从哪个更近的帧走过来结果都一样。
// 每帧要取"现在"和"几帧前"两个状态的（拖尾），recent 要大于拖尾的帧数
export const simulate = <S extends { slice(): S }>(opts: {
  init: () => S;
  step: (state: S, frame: number) => S;
  every?: number;
  recent?: number;
}) => {
  const every = opts.every ?? 30;
  const recentMax = opts.recent ?? 8;
  const checkpoints: S[] = [opts.init()];
  const recent = new Map<number, S>(); // 帧号 → 状态，按取用先后排，最早的先丢
  const remember = (frame: number, s: S) => {
    recent.delete(frame);
    recent.set(frame, s);
    if (recent.size > recentMax) recent.delete(recent.keys().next().value as number);
  };
  const at = (frame: number): S => {
    if (!Number.isInteger(frame) || frame < 0) throw new Error(`simulate 的帧号要是非负整数，现在是 ${frame}`);
    const k = Math.floor(frame / every);
    // 缺的检查点按顺序补上；已有的直接用
    while (checkpoints.length <= k) {
      const i = checkpoints.length;
      let s = checkpoints[i - 1].slice();
      for (let f = (i - 1) * every + 1; f <= i * every; f++) s = opts.step(s, f);
      checkpoints.push(s);
    }
    // 起点：检查点，或者最近取过的帧里在它和 frame 之间、离 frame 最近的那个
    let from = k * every;
    let base = checkpoints[k];
    for (const [f, s] of recent) {
      if (f <= frame && f > from) {
        from = f;
        base = s;
      }
    }
    let s = base.slice();
    for (let f = from + 1; f <= frame; f++) s = opts.step(s, f);
    remember(frame, from === frame ? base : s.slice());
    return s;
  };
  return { at, every };
};
