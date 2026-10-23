import { Composition } from "remotion";

// 表情的固定规格：240×240。帧率只用 20 或 25：GIF 帧时长以 1/100 秒计，能整除才不会忽快忽慢。
// 50fps（每帧 2/100 秒）GIF 文件本身合法，但微信播放时会把这么短的帧往上取整，整个慢一倍
export const STICKER_SIZE = 240;
export type StickerFps = 20 | 25;

type StickerCompositionProps = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  fps?: StickerFps;
};

// 表情用的 Composition，默认导出透明 GIF，Studio 里点渲染也是这个格式。
// 导出和校验用 `npm run sticker -- <id>`，见 scripts/sticker.mjs
export const StickerComposition: React.FC<StickerCompositionProps> = ({
  id,
  component,
  durationInFrames,
  fps = 20,
}) => {
  return (
    <Composition
      id={id}
      component={component}
      durationInFrames={durationInFrames}
      fps={fps}
      width={STICKER_SIZE}
      height={STICKER_SIZE}
      calculateMetadata={() => ({
        defaultCodec: "gif",
        defaultVideoImageFormat: "png",
      })}
    />
  );
};
