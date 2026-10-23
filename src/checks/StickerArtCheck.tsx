import { BlinkBreathe } from "../templates/blink-breathe/BlinkBreathe";
import { StickerComposition } from "../shared/sticker";

// 环境自检：生图 → npm run sticker-art → 表情，也是模板「眨眼呼吸」的示例。
// 猫的两张图是用图生图得到的差分（睁眼、闭眼），处理后尺寸和位置完全对齐。20fps × 40 帧 = 2 秒
export const StickerArtCheck: React.FC = () => (
  <StickerComposition
    id="StickerArtCheck"
    component={StickerArtCheckScene}
    durationInFrames={40}
  />
);

const StickerArtCheckScene: React.FC = () => (
  <BlinkBreathe
    open="checks/sticker-art/cat.png"
    closed="checks/sticker-art/cat-blink.png"
    blink={[28, 31]}
  />
);
