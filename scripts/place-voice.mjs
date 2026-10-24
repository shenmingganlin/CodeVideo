// 配音迁就画面：按 timeline.json 的 voiceAt（每句第一个词开口的帧）反推 voice.json 的 pauseAfterMs 和 timeline.json 的 leadInMs
//
// 用法：npm run place-voice -- src/videos/<作品>
//
// 什么时候用：章节长度由画面定死（动作要演多久就多久），配音往里塞。在 timeline.json 写
//   "voiceAt": { "<句子 id>": <开口帧>, … }
// 每句一个，句子 id 和 voice.json 一样。跑完 layoutVoice 和 voice_mix.py 照常按停顿排，每句就落在写的那一帧。
// 反过来、画面迁就配音的片子（"配音定长度，节拍去迁就它"）不用它，直接调 pauseAfterMs。
//
// 前一句还没读完、后一句就要开口时直接报错，列出差多少毫秒：改 voiceAt、删字，或者把画面放长。
// 先要有配音清单（npm run voice）。写完要再跑一遍 npm run voice，pauseAfterMs 才进清单（文字没变的句子不重新请求）。
// 算法是 src/shared/voice.tsx 里 layoutVoice 的逆运算，跑完会照 layoutVoice 正着排一遍，核对每句真的落在 voiceAt 上

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const workArg = process.argv[2];
if (!workArg) fail("用法：npm run place-voice -- src/videos/<作品>");
const work = path.resolve(ROOT, workArg);
const tlPath = path.join(work, "timeline.json");
const voicePath = path.join(work, "voice.json");
// src/videos/foo → public/videos/foo/voice/manifest.json（src/private/ 对应 public/private/）
const manifestPath = path.join(ROOT, "public", path.relative(path.join(ROOT, "src"), work), "voice", "manifest.json");
for (const file of [tlPath, voicePath]) if (!fs.existsSync(file)) fail(`找不到 ${path.relative(ROOT, file)}`);
if (!fs.existsSync(manifestPath)) fail(`找不到配音清单 ${path.relative(ROOT, manifestPath)}，先运行 npm run voice -- ${workArg}`);

const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
const voice = JSON.parse(fs.readFileSync(voicePath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const fps = tl.fps;
if (!fps) fail("timeline.json 里没有 fps");
if (!tl.voiceAt) fail('timeline.json 里没有 voiceAt：写成 "voiceAt": { "<句子 id>": <开口帧>, … }');
const byId = Object.fromEntries(manifest.lines.map((l) => [l.id, l]));
const ids = voice.lines.map((l) => l.id);
if (manifest.lines.map((l) => l.id).join() !== ids.join()) fail("配音清单和 voice.json 的句子对不上（增删或改了顺序），先运行 npm run voice");
const extra = Object.keys(tl.voiceAt).filter((id) => !ids.includes(id));
if (extra.length) fail(`voiceAt 里有 voice.json 没有的句子：${extra.join("、")}`);

const toFrame = (ms) => Math.round((ms / 1000) * fps);
const speech = (m) => ({ first: m.captions[0]?.startMs ?? 0, last: m.captions[m.captions.length - 1]?.endMs ?? m.durationMs });

// 逆运算：要第一个词在第 at 帧开口，句子的起点 from = round(at − 首词偏移)，和 layoutVoice 一样对齐到整帧
let prevEndMs = null;
const problems = [];
voice.lines.forEach((line, i) => {
  const at = tl.voiceAt[line.id];
  if (at === undefined) fail(`voiceAt 里没有 ${line.id}：每句都要写开口帧`);
  if (i > 0 && at <= tl.voiceAt[ids[i - 1]]) problems.push(`${line.id}（第 ${at} 帧）排在 ${ids[i - 1]}（第 ${tl.voiceAt[ids[i - 1]]} 帧）前面，voiceAt 要按 voice.json 的顺序递增`);
  const { first, last } = speech(byId[line.id]);
  const from = Math.max(0, toFrame((at / fps) * 1000 - first));
  const speakAtMs = (from / fps) * 1000 + first;
  if (i === 0) tl.leadInMs = Math.round(speakAtMs);
  else {
    const pause = Math.round(speakAtMs - prevEndMs);
    if (pause < 0) problems.push(`${ids[i - 1]} 还没读完，${line.id} 就要在第 ${at} 帧开口（差 ${-pause}ms，约 ${Math.ceil((-pause / 1000) * fps)} 帧）`);
    voice.lines[i - 1].pauseAfterMs = pause;
  }
  prevEndMs = (from / fps) * 1000 + last;
});
if (problems.length) fail(`配音排不进去：\n  ${problems.join("\n  ")}`);
delete voice.lines[voice.lines.length - 1].pauseAfterMs;

// 照 layoutVoice 正着排一遍核对（缺省值和它一样）
const gapMs = tl.gapMs ?? 500;
let speakAtMs = tl.leadInMs;
const rows = [];
voice.lines.forEach((line) => {
  const { first, last } = speech(byId[line.id]);
  const from = Math.max(0, toFrame(speakAtMs - first));
  const startMs = (from / fps) * 1000;
  const opens = toFrame(startMs + first);
  const ends = Math.ceil(((startMs + last) / 1000) * fps);
  if (Math.abs(opens - tl.voiceAt[line.id]) > 1) fail(`核对没过：${line.id} 排到了第 ${opens} 帧，voiceAt 写的是 ${tl.voiceAt[line.id]}`);
  rows.push(`${line.id.padEnd(12)} 第 ${String(opens).padStart(5)} 帧开口，读到第 ${ends} 帧`);
  speakAtMs = startMs + last + (line.pauseAfterMs ?? gapMs);
  if (tl.frames && ends > tl.frames) problems.push(`${line.id} 读到第 ${ends} 帧，超出片长 ${tl.frames} 帧`);
});
console.log(rows.join("\n"));
if (problems.length) fail(problems.join("\n"));

fs.writeFileSync(voicePath, JSON.stringify(voice, null, 2) + "\n");
fs.writeFileSync(tlPath, JSON.stringify(tl, null, 2) + "\n");
console.log(`\n写好了 voice.json 的 pauseAfterMs 和 timeline.json 的 leadInMs（${tl.leadInMs}ms）。再跑 npm run voice -- ${workArg} 把停顿写进清单`);
