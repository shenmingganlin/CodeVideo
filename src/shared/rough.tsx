import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import type { Point } from "roughjs/bin/geometry";
import { useCurrentFrame } from "remotion";

// Rough.js 手绘草图风：用生成器算出路径，画成普通的 SVG <path>，不碰 DOM。
//
// 确定性：Rough.js 的 seed 为 0（缺省）时用 Math.random，每帧抖得不一样；
// 不传 options 时几个图形还会共用一个随机数状态，前面多画一个图形，后面的全都变样。
// 所以统一用这里的 roughGenerator：每个图形都带自己的 seed，和画的先后无关。
// 几个一模一样的图形想抖得不一样，各传各的 seed

export type RoughGenerator = ReturnType<typeof roughGenerator>;

export const roughGenerator = (seed: number) => {
  if (!Number.isInteger(seed) || seed <= 0) {
    throw new Error(
      `Rough.js 的 seed 要是正整数，0 会改用 Math.random：${seed}`,
    );
  }
  const g = rough.generator();
  // 每次都合成一个新对象，随机数状态留在这个对象上，不会传给下一个图形
  const o = (options?: Options): Options => ({ seed, ...options });
  return {
    line: (x1: number, y1: number, x2: number, y2: number, options?: Options) =>
      g.line(x1, y1, x2, y2, o(options)),
    rectangle: (
      x: number,
      y: number,
      w: number,
      h: number,
      options?: Options,
    ) => g.rectangle(x, y, w, h, o(options)),
    ellipse: (x: number, y: number, w: number, h: number, options?: Options) =>
      g.ellipse(x, y, w, h, o(options)),
    circle: (x: number, y: number, diameter: number, options?: Options) =>
      g.circle(x, y, diameter, o(options)),
    linearPath: (points: Point[], options?: Options) =>
      g.linearPath(points, o(options)),
    polygon: (points: Point[], options?: Options) =>
      g.polygon(points, o(options)),
    curve: (points: Point[], options?: Options) => g.curve(points, o(options)),
    arc: (
      x: number,
      y: number,
      w: number,
      h: number,
      start: number,
      stop: number,
      closed = false,
      options?: Options,
    ) => g.arc(x, y, w, h, start, stop, closed, o(options)),
    path: (d: string, options?: Options) => g.path(d, o(options)),
    toPaths: (drawable: Drawable) => g.toPaths(drawable),
  };
};

// 手绘动画的"抖线"（line boil）：每 every 帧换一次 seed，线条跟着重画一遍。
// every 为 0 时不抖。8–12fps 的抖动最像手绘，30fps 的片子 every 取 3
export const useBoilSeed = (seed: number, every: number) => {
  const frame = useCurrentFrame();
  return every > 0 ? seed + Math.floor(frame / every) : seed;
};

type RoughPathsProps = {
  drawable: Drawable;
  // 画出来的比例，0–1。描边和排线按笔画顺序一笔笔画出来，实心填充跟着淡入
  progress?: number;
  // 传给每条 <path>，比如 strokeLinecap、opacity
  pathProps?: React.SVGProps<SVGPathElement>;
};

// 放在 <svg> 里用
export const RoughPaths: React.FC<RoughPathsProps> = ({
  drawable,
  progress = 1,
  pathProps,
}) => {
  const p = Math.min(1, Math.max(0, progress));
  const paths = rough.generator().toPaths(drawable);
  return (
    <>
      {paths.map((path, i) => {
        const stroked = path.stroke !== "none" && path.strokeWidth > 0;
        return (
          <path
            key={i}
            d={path.d}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            fill={path.fill ?? "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
            // pathLength=1 把整条路径的长度归一，不用量就能按比例描出来
            {...(p < 1 && stroked
              ? {
                  pathLength: 1,
                  strokeDasharray: "1 1",
                  strokeDashoffset: 1 - p,
                }
              : {})}
            fillOpacity={p < 1 && !stroked ? p : undefined}
            {...pathProps}
          />
        );
      })}
    </>
  );
};
