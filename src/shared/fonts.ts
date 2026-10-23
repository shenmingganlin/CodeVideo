import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// 默认中文字体：思源黑体（Noto Sans SC，OFL 许可），可变字重 100–900。
// 没有特别要求时用它；某个作品专用的字体在作品自己的目录里加载。
export const SANS_FAMILY = "Noto Sans SC";

await loadFont({
  family: SANS_FAMILY,
  url: staticFile("fonts/NotoSansSC-VF.ttf"),
  weight: "100 900",
});
