import { mixColor, prog } from "./motion/motion";

// 读作品的 timeline.json：章节、事件帧、拍子都只写在那里（见 CLAUDE.md"做视频先调技能"），
// 画面用这里的函数取，不再在作品里各写一遍"现在在哪一章、这章第几帧"。只管时间，不管画什么
//
// 用法：
//   import data from "./timeline.json";
//   const tl = timeline(data);
//   tl.chapterAt(frame)        当前章节（最后一章之后仍算最后一章）
//   tl.local(frame)            { chapter, index, f: 本章第几帧, p: 本章进度 0..1 }
//   tl.event("collapse")       事件帧，名字写错直接报错，不会静默变成 NaN
//   tl.beat(8)                 第 8 拍的帧号（从 beat0 起算，缺省 0）
//   tl.blend(frame, ch => ch.field, 12)   章节交界前后 ±6 帧混过去，颜色走 OKLab，数字线性
//
// 名字容易混：`gapMs` 是配音的句间停顿（layoutVoice、voice_mix.py 读），`gap_ms` 是配乐合成的音符间隔（make_score.py 原样带给 synth_score.py），两个不是一回事

export type Chapter = {
  id: string;
  // 章节动词（motioner 的概念四行），比如"生""存"
  verb?: string;
  from: number;
  // 不含这一帧，下一章从这里开始
  to: number;
  [key: string]: unknown;
};

export type TimelineData = {
  fps: number;
  width: number;
  height: number;
  frames: number;
  bpm?: number;
  // 每拍几帧；缺省按 fps × 60 / bpm 算
  beatFrames?: number;
  // 第 0 拍落在第几帧，缺省 0
  beat0?: number;
  chapters: Chapter[];
  events?: Record<string, number | unknown>;
  [key: string]: unknown;
};

export type Local<C extends Chapter> = {
  chapter: C;
  index: number;
  // 本章内第几帧，从 0 起
  f: number;
  // 本章进度 0..1，不加缓动
  p: number;
};

// 章节要首尾相接、铺满整片，事件帧要在片子里；不对就报错，免得画面在某一帧悄悄取错章节
export const checkTimeline = (data: TimelineData): string[] => {
  const problems: string[] = [];
  const ch = data.chapters;
  if (!ch?.length) return ["chapters 是空的"];
  if (ch[0].from !== 0) problems.push(`第一章 ${ch[0].id} 要从第 0 帧开始，现在是 ${ch[0].from}`);
  for (let i = 1; i < ch.length; i++) {
    if (ch[i].from !== ch[i - 1].to) problems.push(`章节 ${ch[i - 1].id} 到第 ${ch[i - 1].to} 帧结束，${ch[i].id} 却从第 ${ch[i].from} 帧开始`);
  }
  for (const c of ch) if (c.to <= c.from) problems.push(`章节 ${c.id} 的 to（${c.to}）不大于 from（${c.from}）`);
  const last = ch[ch.length - 1];
  if (last.to !== data.frames) problems.push(`最后一章 ${last.id} 到第 ${last.to} 帧结束，片长是 ${data.frames} 帧`);
  const ids = new Set<string>();
  for (const c of ch) {
    if (ids.has(c.id)) problems.push(`章节 id ${c.id} 重复`);
    ids.add(c.id);
  }
  for (const [name, v] of Object.entries(data.events ?? {})) {
    if (typeof v === "number" && (v < 0 || v >= data.frames)) problems.push(`事件 ${name} 在第 ${v} 帧，超出 0–${data.frames - 1}`);
  }
  return problems;
};

export const timeline = <D extends TimelineData>(data: D) => {
  const problems = checkTimeline(data);
  if (problems.length) throw new Error(`timeline.json 有问题：\n- ${problems.join("\n- ")}`);
  type C = D["chapters"][number];
  const chapters = data.chapters as C[];
  const beatFrames = data.beatFrames ?? (data.bpm ? (data.fps * 60) / data.bpm : undefined);

  const indexAt = (frame: number) => {
    const i = chapters.findIndex((c) => frame < c.to);
    return i === -1 ? chapters.length - 1 : i;
  };

  return {
    data,
    chapters,
    fps: data.fps,
    frames: data.frames,
    beatFrames,

    indexAt,
    chapterAt: (frame: number): C => chapters[indexAt(frame)],

    local: (frame: number): Local<C> => {
      const index = indexAt(frame);
      const chapter = chapters[index];
      const f = frame - chapter.from;
      return { chapter, index, f, p: Math.min(1, Math.max(0, f / (chapter.to - chapter.from))) };
    },

    chapter: (id: string): C => {
      const c = chapters.find((x) => x.id === id);
      if (!c) throw new Error(`timeline.json 里没有章节 ${id}（有：${chapters.map((x) => x.id).join("、")}）`);
      return c;
    },

    event: (name: string): number => {
      const v = data.events?.[name];
      if (typeof v !== "number") throw new Error(`timeline.json 的 events 里没有 ${name}（或者不是帧号）`);
      return v;
    },

    // 第 n 拍的帧号，可以是小数拍（半拍 = 0.5）。结果取整，保证落在整帧上
    beat: (n: number): number => {
      if (!beatFrames) throw new Error("timeline.json 没写 bpm 或 beatFrames，取不了拍子");
      return Math.round((data.beat0 ?? 0) + n * beatFrames);
    },

    // 章节交界前后各 width/2 帧，从上一章的值混到下一章的。pick 取出的是颜色（#RRGGBB）就在 OKLab 里混，是数字就线性插
    blend: <V extends string | number>(frame: number, pick: (c: C) => V, width = 12): V => {
      let v = pick(chapters[0]);
      for (const c of chapters.slice(1)) {
        const t = prog(frame, c.from - width / 2, c.from + width / 2);
        if (t <= 0) break;
        const next = pick(c);
        v = (typeof v === "number" && typeof next === "number" ? v + (next - v) * t : mixColor(String(v), String(next), t)) as V;
      }
      return v;
    },
  };
};

export type Timeline<D extends TimelineData = TimelineData> = ReturnType<typeof timeline<D>>;
