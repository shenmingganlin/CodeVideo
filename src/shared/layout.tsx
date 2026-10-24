// 版面检查的探针：给画面里的字、公式、标注打上名字，`npm run layout` 逐帧量出它们的包围盒，
// 报出同一帧里互相压住、或者跑出安全区的元素。不出图，只报帧号和名字。
//
// 用法：
//   1. 要查的元素加 {...box("公式")}（就是一个 data-box 属性）。同名的可以有多个
//   2. 作品根组件里放一个 <LayoutProbe />，Canvas 画的东西（波、曲线）用 regions 报上它的屏幕矩形
//        <LayoutProbe safe={{ l: 54, t: 46, r: 1866, b: 1040 }} allow={[["字幕", "猫"]]} free={["字幕"]} regions={(f) => [...]} />
//   3. npm run layout -- <Composition ID> [--every=5] [--frames=<起>-<止>]
//
// 平时（Studio、渲染成片）LayoutProbe 什么都不做，只有 npm run layout 传了 layoutProbe 才量。
// 看得见才算：自己和祖先的 opacity 乘起来不到 0.05、display:none、visibility:hidden 的不量。
// clip-path 擦出来的字（写到一半）按整块算，宁可多报。嵌套的两个元素（框里的标注）不算互相压住

import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";

export type Rect = { name: string; x: number; y: number; w: number; h: number };

export const box = (name: string) => ({ "data-box": name });

export const LAYOUT_LOG = "[layout]";

type Props = {
  // 安全区（画面坐标），缺省是整个画面
  safe?: { l: number; t: number; r: number; b: number };
  // 允许互相压住的名字对，比如字幕压在猫身上没关系
  allow?: [string, string][];
  // 不受安全区限制的名字（比如贴着画面底边的字幕），照样查互相压住
  free?: string[];
  // Canvas 画的、DOM 量不到的东西，按帧报屏幕矩形
  regions?: (frame: number) => Rect[];
};

export const layoutProbing = () => Boolean((getInputProps() as { layoutProbe?: boolean }).layoutProbe);

const visible = (el: Element) => {
  let alpha = 1;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    alpha *= Number(style.opacity);
  }
  return alpha >= 0.05;
};

export const LayoutProbe: React.FC<Props> = (props) => (layoutProbing() ? <Probe {...props} /> : null);

const Probe: React.FC<Props> = ({ safe, allow = [], free = [], regions }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = delayRender("layout probe");
    // 每个渲染标签页的头一帧，根元素可能还挪在屏幕外、宽度是 0，这时排出来的版面不对：
    // 等它有了真实尺寸再量，等不到（约 2 秒）就报 unsized，npm run layout 会单独补量这些帧
    const measure = (tries: number) => {
      const root = ref.current?.parentElement;
      if (!root) return continueRender(handle);
      const base = root.getBoundingClientRect();
      if (base.width === 0 && tries > 0) return requestAnimationFrame(() => measure(tries - 1));
      if (base.width === 0) {
        console.log(LAYOUT_LOG + JSON.stringify({ frame, unsized: true }));
        return continueRender(handle);
      }
      // 渲染时页面可能被缩放，按根元素换回画面坐标
      const k = width / base.width;
      const boxes: (Rect & { el: Element })[] = [];
      root.querySelectorAll("[data-box]").forEach((el) => {
        if (!visible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        boxes.push({ el, name: el.getAttribute("data-box") ?? "?", x: (r.left - base.left) * k, y: (r.top - base.top) * k, w: r.width * k, h: r.height * k });
      });
      // 嵌套的一对不算互相压住；parent 是最近的打了名字的祖先，祖先已经压住的，里面的小字不再重复报
      const nested: [number, number][] = [];
      boxes.forEach((a, i) =>
        boxes.forEach((b, j) => {
          if (i < j && (a.el.contains(b.el) || b.el.contains(a.el))) nested.push([i, j]);
        }),
      );
      const parentOf = (el: Element) => {
        const up = el.parentElement?.closest("[data-box]");
        return up ? boxes.findIndex((b) => b.el === up) : -1;
      };
      const rects = [...boxes.map(({ el, ...rest }) => ({ ...rest, parent: parentOf(el) })), ...(regions?.(frame) ?? []).map((r) => ({ ...r, parent: -1 }))];
      console.log(
        LAYOUT_LOG +
          JSON.stringify({
            frame,
            rects: rects.map((r) => ({ ...r, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) })),
            nested,
            safe: safe ?? { l: 0, t: 0, r: width, b: height },
            allow,
            free,
          }),
      );
      continueRender(handle);
    };
    // 等字体加载完再量，不然公式、中文的宽度是后备字体的
    document.fonts.ready.then(() => measure(120));
  });
  return <AbsoluteFill ref={ref} style={{ pointerEvents: "none", visibility: "hidden" }} />;
};
