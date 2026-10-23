import { Composition, Folder } from "remotion";
import { FPS, H, W, type GalleryEffect } from "./kit";

// 收集 effects/ 下的每个效果，注册成 G-<文件名>。元数据放在 defaultProps 里，
// npm run gallery 从 getCompositions 读出来拼网页
const context = require.context("./effects", false, /^\.\/[\w-]+\.tsx$/);
const effects = (
  await Promise.all(
    context.keys().map(async (key) => ({
      slug: key.slice(2, -4),
      // private.d.ts 把模块的默认导出写成了 React.FC，这里的是 GalleryEffect
      effect: (await context(key)).default as unknown as GalleryEffect,
    })),
  )
).sort((a, b) => a.effect.no - b.effect.no);

export const Gallery: React.FC = () => (
  <Folder name="gallery">
    {effects.map(({ slug, effect }) => (
      <Composition
        key={slug}
        id={`G-${slug}`}
        component={effect.component}
        durationInFrames={effect.frames}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{
          gallery: {
            slug,
            no: effect.no,
            name: effect.name,
            group: effect.group,
            desc: effect.desc,
            tech: effect.tech,
          },
        }}
      />
    ))}
  </Folder>
);
