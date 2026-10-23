# 视频作品

一个视频一个子目录，里面的 `index.tsx` 默认导出一个注册 Composition 的组件，`src/Root.tsx` 会自动把它收进 Studio 的 videos 分组：

```tsx
import { MyVideo } from "./MyVideo";

export default function Works() {
  return <MyVideo />;
}
```

方案 `brief.md`、台词 `voice.json`、时间线 `timeline.json` 也放在作品目录里，配音、配乐这些素材放 `public/videos/<作品>/`。

作品只在作者的私有仓库里，公开仓库只有工作台，所以这里只有本文件。
