import { Folder } from "remotion";
import { CanvasCheck } from "./checks/CanvasCheck";
import { D3Check } from "./checks/D3Check";
import { FormulaCheck } from "./checks/formula/FormulaCheck";
import { GradientCheck } from "./checks/GradientCheck";
import { LandscapeCheck } from "./checks/LandscapeCheck";
import { LayoutCheck } from "./checks/LayoutCheck";
import { LottieCheck } from "./checks/LottieCheck";
import { MapCheck } from "./checks/MapCheck";
import { RoughCheck } from "./checks/RoughCheck";
import { ShaderCheck } from "./checks/ShaderCheck";
import { ThreeCheck } from "./checks/ThreeCheck";
import { StickerArtCheck } from "./checks/StickerArtCheck";
import { StickerCheck } from "./checks/StickerCheck";
import { SketchCheck } from "./checks/sketch/SketchCheck";
import { SortingStyleDemoComposition } from "./checks/StyleDemo";
import { VoiceCheck } from "./checks/voice/VoiceCheck";
import { Gallery } from "./gallery";

// 作品不写死在这里：src/videos/、src/stickers/、src/private/ 下每个子目录的 index.tsx
// 默认导出一个注册 Composition 的组件，自动收进对应分组。公开仓库只有工作台，这几个目录是空的，照样能打开。
// require.context 的参数必须是字面量，所以分开写三遍。
// 字体用了顶层 await，这些模块是异步的，require 拿到的是 Promise
const collect = (context: ReturnType<typeof require.context>) =>
  Promise.all(
    context
      .keys()
      .map(async (key) => ({ key, Works: (await context(key)).default })),
  );
const groups = [
  {
    name: "videos",
    works: await collect(
      require.context("./videos", true, /^\.\/[^/]+\/index\.tsx$/),
    ),
  },
  {
    name: "stickers",
    works: await collect(
      require.context("./stickers", true, /^\.\/[^/]+\/index\.tsx$/),
    ),
  },
  {
    name: "private",
    works: await collect(
      require.context("./private", true, /^\.\/[^/]+\/index\.tsx$/),
    ),
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="checks">
        <LandscapeCheck />
        <StickerCheck />
        <GradientCheck />
        <StickerArtCheck />
        <VoiceCheck />
        <FormulaCheck />
        <SortingStyleDemoComposition />
        <LottieCheck />
        <RoughCheck />
        <D3Check />
        <MapCheck />
        <SketchCheck />
        <CanvasCheck />
        <ShaderCheck />
        <ThreeCheck />
        <LayoutCheck />
      </Folder>
      <Gallery />
      {groups.map(
        ({ name, works }) =>
          works.length > 0 && (
            <Folder key={name} name={name}>
              {works.map(({ key, Works }) => (
                <Works key={key} />
              ))}
            </Folder>
          ),
      )}
    </>
  );
};
