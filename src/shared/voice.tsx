import type { Caption } from "@remotion/captions";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { layoutProbing } from "./layout";

// 读取 npm run voice 生成的配音清单，把每句排到时间轴上。
// 只管时间，不管画面：字幕怎么画、画面怎么跟着配音走，由每个作品自己写

export type VoiceLine = {
  id: string;
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
  // public/ 下的路径，用 staticFile() 引用
  src: string;
  durationMs: number;
  // 逐词时间，相对这句开头
  captions: Caption[];
  // voice.json 里给这句单独写的句后停顿，覆盖 layoutVoice 的 gapMs
  pauseAfterMs?: number;
  // voice.json 里其他自定义字段原样保留
  [key: string]: unknown;
};

export type VoiceManifest = { lines: VoiceLine[] };

export type PlacedLine = VoiceLine & {
  // 这句音频在整个视频里从第几帧开始、占多少帧（含首尾静音）
  from: number;
  durationInFrames: number;
  // 这句音频开始的时间（毫秒），已经对齐到帧。真正开口的时间看 captions[0].startMs
  startMs: number;
};

export type VoiceLayout = {
  // 逐词时间已经换算成整个视频里的时间
  lines: PlacedLine[];
  durationInFrames: number;
};

// dir 是作品在 src/ 下的目录，比如 "videos/foo"。一般在 calculateMetadata 里调用
export const loadVoice = async (
  dir: string,
  signal?: AbortSignal,
): Promise<VoiceManifest> => {
  const res = await fetch(staticFile(`${dir}/voice/manifest.json`), { signal });
  if (!res.ok) {
    throw new Error(
      `读不到 ${dir} 的配音清单，先运行 npm run voice -- src/${dir}`,
    );
  }
  return res.json();
};

type LayoutOptions = {
  fps: number;
  // 第一个词开口之前的空白
  leadInMs?: number;
  // 句与句之间的停顿：上一句最后一个词读完，到下一句第一个词开口。单句可以用 pauseAfterMs 覆盖
  gapMs?: number;
  // 最后一个词读完之后还留多久
  tailMs?: number;
};

// 按顺序一句接一句排开，算出每句的起始帧和视频总长。
// 停顿按实际读出来的词计算：Edge 的音频首尾各带一段静音（结尾常有半秒多），按文件长度排的话停顿会偏长。
// 相邻两句的 Sequence 因此可能重叠一点，重叠的只是上一句结尾的静音
export const layoutVoice = (
  manifest: VoiceManifest,
  { fps, leadInMs = 500, gapMs = 500, tailMs = 1000 }: LayoutOptions,
): VoiceLayout => {
  const toFrame = (ms: number) => Math.round((ms / 1000) * fps);
  // 下一句的第一个词应该在什么时候开口
  let speakAtMs = leadInMs;
  let endMs = tailMs;
  const lines = manifest.lines.map((line): PlacedLine => {
    const first = line.captions[0];
    const last = line.captions[line.captions.length - 1];
    const speechStartMs = first ? first.startMs : 0;
    const speechEndMs = last ? last.endMs : line.durationMs;
    const from = Math.max(0, toFrame(speakAtMs - speechStartMs));
    const startMs = (from / fps) * 1000;
    speakAtMs = startMs + speechEndMs + (line.pauseAfterMs ?? gapMs);
    endMs = startMs + speechEndMs + tailMs;
    return {
      ...line,
      from,
      durationInFrames: Math.ceil((line.durationMs / 1000) * fps),
      startMs,
      captions: line.captions.map((caption) => ({
        ...caption,
        startMs: caption.startMs + startMs,
        endMs: caption.endMs + startMs,
        timestampMs:
          caption.timestampMs === null ? null : caption.timestampMs + startMs,
      })),
    };
  });
  return {
    lines,
    durationInFrames: Math.max(1, Math.ceil((endMs / 1000) * fps)),
  };
};

// 把排好的每句配音放到时间轴上
export const VoiceTrack: React.FC<{ lines: PlacedLine[]; volume?: number }> = ({
  lines,
  volume = 1,
}) => {
  // npm run layout 只量版面、隔几帧取一帧，渲染器混这样的音频会算错写入位置而崩掉，干脆不放
  if (layoutProbing()) return null;
  return (
    <>
      {lines.map((line) => (
        <Sequence
          key={line.id}
          name={`配音 ${line.id}`}
          from={line.from}
          durationInFrames={line.durationInFrames}
          layout="none"
        >
          <Audio src={staticFile(line.src)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
};

// 按 id 找某一句，找不到直接报错，免得 id 写错时画面悄悄错位
export const lineById = (layout: VoiceLayout, id: string) => {
  const line = layout.lines.find((candidate) => candidate.id === id);
  if (!line) {
    throw new Error(`配音里没有 id 为「${id}」的句子`);
  }
  return line;
};
