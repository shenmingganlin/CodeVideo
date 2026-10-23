# 表情作品

一个套系一个子目录，里面的 `index.tsx` 默认导出一个注册 Composition 的组件，`src/Root.tsx` 会自动把它收进 Studio 的 stickers 分组。每个表情用 `src/shared/sticker.tsx` 的 `StickerComposition` 注册：

```tsx
import { MySticker } from "./MySticker";

export default function Works() {
  return <MySticker />;
}
```

方案 `brief.md` 也放在套系目录里，处理好的图片素材放 `public/stickers/<套系>/`。

作品只在作者的私有仓库里，公开仓库只有工作台，所以这里只有本文件。
