import { Composition, Folder } from "remotion";

// 分镜评审页的静帧草图：一个镜头一个小 Composition，各画各的，不和别的镜头衔接（见 CLAUDE.md"分镜评审页"）。
// `npm run sketch -- src/videos/<作品>` 把每个镜头的草图渲成 PNG，出在 out/board/<作品>/，再挂进 board.json 的 media
//
// 用法（作品目录的 index.tsx）：
//   import { ShotSketches } from "../../shared/sketch";
//   <ShotSketches prefix="MyFilm" width={1920} height={1080} shots={{
//     s1: { component: S1 },                 // 只渲第 0 帧
//     s3: { component: S3, stills: [0, 40] }, // 一个镜头要两张时写帧号，组件里用 useCurrentFrame() 摆两个状态
//   }} />
// 注册成 <prefix>-s1、<prefix>-s3，收在 Studio 的 <prefix 小写>-sketch 文件夹里。键名和 board.json 的镜头 id 一致
// 草图只摆这个镜头关键的那一两个状态，画到能看出构图、主体、配色就停；毛病写进镜头的 questions，不去修

export type ShotSketch = {
  component: React.FC;
  // 要出图的帧号，缺省 [0]。不是动画：一个帧号就是一个要给用户看的状态
  stills?: number[];
};

export const ShotSketches: React.FC<{
  prefix: string;
  width: number;
  height: number;
  shots: Record<string, ShotSketch>;
  fps?: number;
}> = ({ prefix, width, height, shots, fps = 30 }) => {
  if (!/^[A-Za-z0-9-]+$/.test(prefix)) throw new Error(`ShotSketches 的 prefix 只能用字母、数字和 -：${prefix}`);
  return (
    <Folder name={`${prefix.toLowerCase()}-sketch`}>
      {Object.entries(shots).map(([shot, { component, stills = [0] }]) => {
        if (!/^[A-Za-z0-9-]+$/.test(shot)) throw new Error(`镜头 id 只能用字母、数字和 -（Composition id 的限制）：${shot}`);
        if (!stills.length || stills.some((f) => !Number.isInteger(f) || f < 0)) throw new Error(`${prefix}-${shot} 的 stills 要是非负整数帧号`);
        return (
          <Composition
            key={shot}
            id={`${prefix}-${shot}`}
            component={component}
            durationInFrames={Math.max(...stills) + 1}
            fps={fps}
            width={width}
            height={height}
            // npm run sketch 从这里读要出哪几帧、对应哪个镜头
            defaultProps={{ sketch: { shot, stills } }}
          />
        );
      })}
    </Folder>
  );
};
