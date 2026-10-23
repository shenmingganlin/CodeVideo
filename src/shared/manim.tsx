import { Video } from "@remotion/media";
import { Freeze, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// 嵌入 npm run manim 渲染的透明视频（scripts/manim.mjs）

export type ManimMeta = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

// 读场景的宽高、帧率、帧数。dir 是作品在 src/ 下的目录，scene 是场景类名。一般在 calculateMetadata 里调用
export const loadManimMeta = async (
  dir: string,
  scene: string,
  signal?: AbortSignal,
): Promise<ManimMeta> => {
  const res = await fetch(staticFile(`${dir}/manim/${scene}.json`), { signal });
  if (!res.ok) {
    throw new Error(
      `读不到 Manim 场景 ${scene}，先运行 npm run manim -- src/${dir}/<场景文件>.py ${scene}`,
    );
  }
  return res.json();
};

// 片段在当前 Composition 里占几帧。Manim 的帧率和 Composition 一致时就是它自己的帧数
export const manimFrames = (meta: ManimMeta, fps: number) =>
  Math.round((meta.durationInFrames / meta.fps) * fps);

type ManimClipProps = {
  dir: string;
  scene: string;
  meta: ManimMeta;
  // 播完后停在最后一帧，默认开着：公式变形完通常要停在结果上
  holdLastFrame?: boolean;
  style?: React.CSSProperties;
};

// 从所在 Sequence 的第 0 帧开始播放。画面按比例缩放到填满父元素，透明的地方露出下面的画面
export const ManimClip: React.FC<ManimClipProps> = ({
  dir,
  scene,
  meta,
  holdLastFrame = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lastFrame = manimFrames(meta, fps) - 1;
  if (frame > lastFrame && !holdLastFrame) {
    return null;
  }
  return (
    <Freeze frame={lastFrame} active={frame > lastFrame}>
      <Video
        src={staticFile(`${dir}/manim/${scene}.webm`)}
        muted
        objectFit="contain"
        style={{ width: "100%", height: "100%", ...style }}
        // 浏览器解不了透明通道时会改用 OffthreadVideo，这时也要保留透明
        fallbackOffthreadVideoProps={{ transparent: true }}
      />
    </Freeze>
  );
};
