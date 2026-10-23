# 只自用的作品

这个目录除了本文件都不进 git：放用了商标、他人形象等只能自用、不适合公开的作品。换电脑时要自己拷过去。

每个作品一个子目录，里面的 `index.tsx` 默认导出一个注册 Composition 的组件，`src/Root.tsx` 会自动把它们收进 Studio 的 private 分组：

```tsx
import { MySticker } from "./MySticker";

export default function Works() {
  return <MySticker />;
}
```

公共代码照常从 `../../shared/` 引用。

用到的图片、音频这类素材放 `public/private/<作品>/`，同样不进 git，代码里写 `staticFile("private/<作品>/...")`。换电脑时这个目录也要一起拷。
