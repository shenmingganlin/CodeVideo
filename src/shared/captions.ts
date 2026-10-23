import type { Caption } from "@remotion/captions";

// 把逐词时间（Remotion 的 Caption）分成一条条字幕，只管断句和时间。
// 字幕画成什么样由每个作品自己决定，这里不涉及样式

export type Subtitle = {
  // 这条字幕的文字，已经去掉首尾空白
  text: string;
  startMs: number;
  endMs: number;
  // 组成这条字幕的词，做逐词高亮时用。首尾两个词的文字已经和 text 一样修剪过，逐个画出来就是 text
  tokens: Caption[];
};

export type SubtitleOptions = {
  // 每条最多几个字：汉字、全角符号算 1，英文字母、数字、半角符号算 0.5
  maxChars?: number;
  // 两个词之间停顿超过这么久就断开，给没有标点的文字兜底
  breakAfterPauseMs?: number;
  // 最后一个词读完后字幕多留一会儿；离下一条的空隙比这短，就一直显示到下一条出现
  holdMs?: number;
  // 去掉每条末尾的逗号、句号、顿号、分号、冒号。问号、叹号、省略号和引号保留
  trimPunctuation?: boolean;
};

// 结尾的标点后面可能还跟着右引号、右括号
const CLOSERS = '"”’」』）)】》';
const SENTENCE_END = new RegExp(`[。！？!?；;…][${CLOSERS}]*\\s*$`);
const CLAUSE_END = new RegExp(`[，,、：:][${CLOSERS}]*\\s*$`);
const TRIMMABLE_END = /[，,。．.、；;：:\s]+$/;

export const visualLength = (text: string) => {
  let length = 0;
  for (const ch of text.trim()) {
    length += (ch.codePointAt(0) ?? 0) > 0xff ? 1 : 0.5;
  }
  return length;
};

const joinText = (tokens: Caption[]) =>
  tokens.map((token) => token.text).join("");

// 一段连续的配音（通常是 voice.json 里的一句）分成字幕
export const groupCaptions = (
  captions: Caption[],
  {
    maxChars = 18,
    breakAfterPauseMs = 600,
    holdMs = 400,
    trimPunctuation = true,
  }: SubtitleOptions = {},
): Subtitle[] => {
  // 先按标点和长停顿切成短语，记下短语是不是句子结尾
  const phrases: { tokens: Caption[]; sentenceEnd: boolean }[] = [];
  let current: Caption[] = [];
  captions.forEach((token, i) => {
    const previous = captions[i - 1];
    if (
      current.length > 0 &&
      previous &&
      token.startMs - previous.endMs >= breakAfterPauseMs
    ) {
      phrases.push({ tokens: current, sentenceEnd: false });
      current = [];
    }
    current.push(token);
    if (SENTENCE_END.test(token.text) || CLAUSE_END.test(token.text)) {
      phrases.push({
        tokens: current,
        sentenceEnd: SENTENCE_END.test(token.text),
      });
      current = [];
    }
  });
  if (current.length > 0) {
    phrases.push({ tokens: current, sentenceEnd: true });
  }

  // 再把短语装进字幕：不超过 maxChars，句子结尾一定换条；单个短语太长就按词切开
  const groups: Caption[][] = [];
  let group: Caption[] = [];
  const flush = () => {
    if (group.length > 0) groups.push(group);
    group = [];
  };
  for (const phrase of phrases) {
    if (visualLength(joinText([...group, ...phrase.tokens])) > maxChars) {
      flush();
    }
    for (const token of phrase.tokens) {
      if (
        group.length > 0 &&
        visualLength(joinText([...group, token])) > maxChars
      ) {
        flush();
      }
      group.push(token);
    }
    if (phrase.sentenceEnd) flush();
  }
  flush();

  return groups.map((tokens, i) => {
    // 去掉首尾空白和末尾标点时直接改在首尾两个词上，这样逐个词画出来和 text 一致
    const shown = tokens.map((token, j) => {
      let text = j === 0 ? token.text.trimStart() : token.text;
      if (j === tokens.length - 1) {
        text = trimPunctuation
          ? text.replace(TRIMMABLE_END, "")
          : text.trimEnd();
      }
      return text === token.text ? token : { ...token, text };
    });
    const lastEnd = tokens[tokens.length - 1].endMs;
    const nextStart = groups[i + 1]?.[0].startMs ?? Infinity;
    return {
      text: joinText(shown),
      startMs: tokens[0].startMs,
      endMs: Math.min(lastEnd + holdMs, Math.max(nextStart, lastEnd)),
      tokens: shown,
    };
  });
};

// 整段配音的字幕：每句单独分组，再把重叠的部分截掉，保证同一时刻只有一条
export const toSubtitles = (
  lines: { captions: Caption[] }[],
  options?: SubtitleOptions,
): Subtitle[] => {
  const subtitles = lines.flatMap((line) =>
    groupCaptions(line.captions, options),
  );
  return subtitles.map((subtitle, i) => {
    const next = subtitles[i + 1];
    return next && subtitle.endMs > next.startMs
      ? { ...subtitle, endMs: next.startMs }
      : subtitle;
  });
};

// 某个时刻（毫秒）该显示的字幕，没有就返回 null
export const activeSubtitle = (subtitles: Subtitle[], ms: number) =>
  subtitles.find((subtitle) => ms >= subtitle.startMs && ms < subtitle.endMs) ??
  null;
