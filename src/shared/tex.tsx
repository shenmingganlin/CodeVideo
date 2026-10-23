import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { SANS_FAMILY } from "./fonts";
import "./tex.css";

// KaTeX 的字体写在它的 CSS 里，浏览器要等用到才加载，渲染时公式出现的头几帧可能还没加载好。
// 这里在渲染开始前把 KaTeX 0.19 声明的 20 个字体全部加载完
const KATEX_FONTS = [
  "16px KaTeX_AMS",
  "16px KaTeX_Caligraphic",
  "bold 16px KaTeX_Caligraphic",
  "16px KaTeX_Fraktur",
  "bold 16px KaTeX_Fraktur",
  "16px KaTeX_Main",
  "bold 16px KaTeX_Main",
  "italic 16px KaTeX_Main",
  "italic bold 16px KaTeX_Main",
  "italic 16px KaTeX_Math",
  "italic bold 16px KaTeX_Math",
  "16px KaTeX_SansSerif",
  "bold 16px KaTeX_SansSerif",
  "italic 16px KaTeX_SansSerif",
  "16px KaTeX_Script",
  "16px KaTeX_Size1",
  "16px KaTeX_Size2",
  "16px KaTeX_Size3",
  "16px KaTeX_Size4",
  "16px KaTeX_Typewriter",
];

const fontsHandle = delayRender("加载 KaTeX 字体");
Promise.all(
  KATEX_FONTS.map(async (font) => {
    const faces = await document.fonts.load(font);
    if (faces.length === 0) {
      throw new Error(
        `KaTeX 的 CSS 里没有字体「${font}」，升级 KaTeX 后要更新 tex.tsx 里的字体列表`,
      );
    }
  }),
)
  .then(() => continueRender(fontsHandle))
  .catch((err) => cancelRender(err));

type TexProps = {
  // LaTeX 源码，建议用 String.raw`\frac{a}{b}`，免得反斜杠被转义
  tex: string;
  // 独立成行的公式（displayMode，求和、积分符号更大），默认是行内公式
  display?: boolean;
  // 公式里汉字用的字体，默认思源黑体。换别的字体要先在作品里加载好，再把字体名传进来
  cjkFont?: string;
  macros?: Record<string, string>;
  style?: React.CSSProperties;
  className?: string;
};

// 用 KaTeX 排版公式，只负责排版，大小、颜色、动画由外面控制：
// - 字号跟随 style.fontSize（KaTeX 会再放大到 1.21 倍）
// - 局部上色用 \textcolor{颜色}{...}；局部做动画可以用 \htmlClass、\htmlStyle 包起来
export const Tex: React.FC<TexProps> = ({
  tex,
  display = false,
  cjkFont = SANS_FAMILY,
  macros,
  style,
  className,
}) => {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        output: "html",
        throwOnError: true,
        // 允许公式里直接写汉字，不在控制台报警告
        strict: "ignore",
        // 公式都是自己写的，放开 \htmlClass、\htmlStyle 这些命令
        trust: true,
        macros,
      }),
    [tex, display, macros],
  );
  return (
    <span
      className={className}
      style={
        {
          ...style,
          "--tex-cjk-font": JSON.stringify(cjkFont),
        } as React.CSSProperties
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
