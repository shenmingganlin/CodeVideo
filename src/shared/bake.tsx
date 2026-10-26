import { useContext, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AbsoluteFill,
  Internals,
  OffthreadVideo,
  Sequence,
  getRemotionEnvironment,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// 预览烘焙：Studio 里实时画不动的重图层（上万粒子、大量线条），先单独渲成一段透明视频，Studio 里播视频。
// 只管预览：导出（npm run video、stills、layout……）照样现场画，成片和不烘焙时一模一样。
//
//   <PreviewBake id="flow">
//     <CanvasLayer draw={…} />
//   </PreviewBake>
//
//   npm run bake -- <Composition ID> flow [--frames=<起>-<止>] [--gl=angle]   烘焙（这层改了代码要重跑）
//   npm run bake -- <Composition ID> flow --clear                            删掉，Studio 回到现场画
//
// - 包住的那层要铺满整个画面（全屏的 Canvas、着色器、Three.js 图层），它的外层可以有位移、透明度，
//   烘焙时只录这一层自己，外层的变化在 Studio 里照常套在视频上
// - 放在 <Sequence> 里也行，帧号自动对上
// - 烘焙是 VP9 透明视频（crf 10），和现场画的差别肉眼看不出，但不是逐像素一样：要逐像素看就 --clear 或者渲静帧
// - Studio 里用了烘焙的那层左上角有个小标签"烘焙预览"，导出时不会有
// - 文件在 public/bake/<Composition ID>/，不进 git

// 烘焙渲染时 scripts/bake.mjs 用 envVariables 传进来；读 window 上的原始值，不依赖打包器替换 process.env
const bakeTarget = (): string | null => {
  if (typeof window === "undefined") return null;
  const raw = (window as unknown as { remotion_envVariables?: string }).remotion_envVariables;
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Record<string, string>).CV_BAKE ?? null;
  } catch {
    return null;
  }
};

// 烘焙时整页都藏起来、背景透明，只露出烘焙容器。要在模块加载时就装上：这层还没出场的帧（外面包着
// <Sequence from>）也得是透明的，不能等这层挂上才藏（踩过：出场前的帧录进了整个画面）
if (typeof document !== "undefined" && getRemotionEnvironment().isRendering && bakeTarget() !== null) {
  const style = document.createElement("style");
  style.textContent =
    "html, body { background: transparent !important; }" +
    "body > :not([data-cv-bake-host]) { visibility: hidden !important; }" +
    "[data-cv-bake-host] { visibility: visible !important; }";
  document.head.appendChild(style);
}

type BakeEntry = { file: string; from: number; to: number; bakedAt: string };
type BakeIndex = Record<string, BakeEntry>;

// Studio 里每 2 秒看一眼 index.json，烘焙完、删掉以后不用刷新页面
const useBakeIndex = (compId: string, enabled: boolean): BakeIndex => {
  const [index, setIndex] = useState<BakeIndex>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let last = "";
    const load = () =>
      fetch(`${staticFile(`bake/${compId}/index.json`)}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.text() : "{}"))
        .catch(() => "{}")
        .then((text) => {
          if (!alive || text === last) return;
          last = text;
          try {
            setIndex(JSON.parse(text) as BakeIndex);
          } catch {
            setIndex({});
          }
        });
    load();
    const timer = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [compId, enabled]);
  return index;
};

// 烘焙时：把这层搬到页面最上面一个铺满画面的容器里，别的全部藏起来、背景透明，只录这一层
const BakePortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  // 容器在第一次渲染时就挂上 body，子组件的 useLayoutEffect（量尺寸、画 Canvas）跑的时候它已经在页面里
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.dataset.cvBakeHost = "";
    Object.assign(el.style, { position: "fixed", left: "0", top: "0", overflow: "hidden", zIndex: "2147483647" });
    document.body.appendChild(el);
    return el;
  });
  useLayoutEffect(() => {
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
  }, [host, width, height]);
  useLayoutEffect(() => () => host.remove(), [host]);
  return createPortal(<AbsoluteFill>{children}</AbsoluteFill>, host);
};

const BakedVideo: React.FC<{ entry: BakeEntry; offset: number; children: React.ReactNode }> = ({
  entry,
  offset,
  children,
}) => {
  const frame = useCurrentFrame();
  const absolute = frame + offset;
  // 烘焙范围外照常现场画
  if (absolute < entry.from || absolute > entry.to) return <>{children}</>;
  return (
    // 视频的第 0 帧是全片第 entry.from 帧；换算到当前 Sequence 里的帧号
    <Sequence from={entry.from - offset} layout="none">
      <AbsoluteFill>
        <OffthreadVideo
          src={`${staticFile(entry.file)}?v=${encodeURIComponent(entry.bakedAt)}`}
          transparent
          muted
          pauseWhenBuffering={false}
          style={{ width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            padding: "2px 8px",
            borderRadius: 4,
            font: "12px/1.6 sans-serif",
            color: "#fff",
            background: "rgba(0,0,0,0.55)",
            pointerEvents: "none",
          }}
        >
          烘焙预览 · {entry.bakedAt.slice(5, 16).replace("T", " ")}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};

export const PreviewBake: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const env = getRemotionEnvironment();
  const { id: compId } = useVideoConfig();
  // 当前 Sequence 的第 0 帧是全片第几帧（和 useCurrentFrame 内部的算法一样）。不用"全片帧号 − 当前帧号"：
  // 预挂载（premount）期间当前帧号被钳在 0，那样算出来不对
  const sequence = useContext(Internals.SequenceContext);
  const offset = sequence ? sequence.cumulatedFrom + sequence.relativeFrom : 0;
  const index = useBakeIndex(compId, env.isStudio);

  if (env.isRendering) {
    const target = bakeTarget();
    if (target === null) return <>{children}</>; // 正常导出：现场画
    return target === id ? <BakePortal>{children}</BakePortal> : null; // 烘焙别的层时，这层不画
  }
  const entry = index[id];
  if (!entry) return <>{children}</>;
  return (
    <BakedVideo entry={entry} offset={offset}>
      {children}
    </BakedVideo>
  );
};
