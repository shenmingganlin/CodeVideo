// 版面检查：逐帧量出打了名字的字、公式、标注（src/shared/layout.tsx 的 box()、<LayoutProbe>），
// 报出同一帧里互相压住、或者跑出安全区的元素，连着的帧并成一段。不出图
//
// 用法：npm run layout -- <Composition ID> [--every=5] [--frames=<起>-<止>] [--min=6] [--gl=angle]
//   --every  每几帧量一次，缺省 5（字是 12–20 帧淡入的，5 帧一量漏不掉）；--every=1 逐帧
//   --min    压住多少像素才算（宽和高都要超过），缺省 6，免得描边贴边也报
//   --gl     和成片用同一个
// 结果在 out/layout/<id>.json。0 是没问题，1 是查出了问题
// 作品里没放 <LayoutProbe /> 时一帧也量不到，直接报错

import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOG = "[layout]";
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};
const args = process.argv.slice(2);
const USAGE = "用法：npm run layout -- <Composition ID> [--every=5] [--frames=<起>-<止>] [--min=6] [--gl=angle]";
for (const arg of args.filter((a) => a.startsWith("--"))) {
  if (!/^--(every|frames|min|gl)=/.test(arg)) fail(`不认识的选项 ${arg}（要用等号连着写）\n${USAGE}`);
}
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const id = args.find((arg) => !arg.startsWith("--"));
if (!id) fail(USAGE);
const every = Number(option("every") ?? 5);
const min = Number(option("min") ?? 6);
if (!(every >= 1) || !(min >= 0)) fail(USAGE);
const gl = option("gl");

console.log("打包 Remotion 工程…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
const inputProps = { layoutProbe: true };
const composition = await selectComposition({ serveUrl, id, inputProps });
let from = 0;
let to = composition.durationInFrames - 1;
if (option("frames")) {
  const m = option("frames").match(/^(\d+)-(\d+)$/);
  if (!m) fail("--frames 写成 <起>-<止>");
  from = Number(m[1]);
  to = Math.min(to, Number(m[2]));
}
const frames = [];
for (let f = from; f <= to; f += every) frames.push(f);
if (frames[frames.length - 1] !== to) frames.push(to);

const samples = new Map();
const unsized = new Set();
const measure = async (list, concurrency) => {
  let done = 0;
  await renderFrames({
    composition,
    serveUrl,
    inputProps,
    frames: list,
    imageFormat: "none",
    outputDir: null,
    // 只量版面，不要声音（有配音的作品不加这个会在写音频资源时报 EINVAL）
    muted: true,
    concurrency,
    onStart: () => {},
    onFrameUpdate: () => {
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${list.length}`);
    },
    onBrowserLog: (log) => {
      if (!log.text.startsWith(LOG)) return;
      const sample = JSON.parse(log.text.slice(LOG.length));
      if (sample.unsized) unsized.add(sample.frame);
      else {
        unsized.delete(sample.frame);
        samples.set(sample.frame, sample);
      }
    },
    ...(gl ? { chromiumOptions: { gl } } : {}),
  });
};
console.log(`量 ${frames.length} 帧（第 ${from}–${to} 帧，每 ${every} 帧一次）…`);
await measure(frames, null);
if (samples.size === 0 && unsized.size === 0) fail(`${id} 里没有 <LayoutProbe />（src/shared/layout.tsx），量不到东西`);
// 渲染标签页的头一帧有时量不到真实尺寸，单开一个标签页补量
if (unsized.size) {
  const retry = [...unsized].sort((a, b) => a - b);
  console.log(`补量 ${retry.length} 帧（标签页刚打开时版面还没排好）…`);
  await measure(retry, 1);
  if (unsized.size) fail(`第 ${[...unsized].join("、")} 帧一直量不到版面尺寸`);
}

// 每一帧找问题，key 相同的连成一段
const key = (issue) => (issue.kind === "out" ? `out|${issue.a}` : `hit|${[issue.a, issue.b].sort().join("|")}`);
const overlap = (a, b) => [Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)];
const allowed = (allow, a, b) => allow.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const open = new Map();
const list = [];
for (const f of [...samples.keys()].sort((a, b) => a - b)) {
  const { rects, nested, safe, allow, free = [] } = samples.get(f);
  const issues = [];
  rects.forEach((r) => {
    if (free.includes(r.name)) return;
    const over = Math.max(safe.l - r.x, safe.t - r.y, r.x + r.w - safe.r, r.y + r.h - safe.b);
    if (over > min) issues.push({ kind: "out", a: r.name, size: Math.round(over), rect: r });
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      // 同名的是同一样东西的几块（切成竖条的波），不互相比
      if (a.name === b.name || nested.some(([x, y]) => x === i && y === j) || allowed(allow, a.name, b.name)) continue;
      const [w, h] = overlap(a, b);
      // 框里的小字压住了别的，框本身多半也压住了，只报框
      const parentHits = (c, other) => c.parent >= 0 && overlap(rects[c.parent], other).every((v) => v > min);
      if (parentHits(a, b) || parentHits(b, a)) continue;
      if (w > min && h > min) issues.push({ kind: "hit", a: a.name, b: b.name, size: `${Math.round(w)}×${Math.round(h)}`, area: w * h, rects: [a, b] });
    }
  }
  for (const issue of issues) {
    const k = key(issue);
    const run = open.get(k);
    const worse = (x, y) => (x.kind === "out" ? x.size > y.size : x.area > y.area);
    // 隔了不止一个采样间隔就另起一段
    if (run && f - run.end <= every) {
      run.end = f;
      if (worse(issue, run.worst)) run.worst = { ...issue, frame: f };
    } else {
      const fresh = { start: f, end: f, worst: { ...issue, frame: f } };
      open.set(k, fresh);
      list.push(fresh);
    }
  }
}
list.sort((a, b) => a.start - b.start);
const fmt = (run) => {
  const w = run.worst;
  const span = run.start === run.end ? `第 ${run.start} 帧` : `第 ${run.start}–${run.end} 帧`;
  return w.kind === "out" ? `[出界] ${span}：${w.a} 超出安全区 ${w.size}px（最严重在第 ${w.frame} 帧）` : `[压住] ${span}：${w.a} 和 ${w.b} 重叠，最多 ${w.size}px（第 ${w.frame} 帧）`;
};
const names = new Set([...samples.values()].flatMap((s) => s.rects.map((r) => r.name)));
console.log(`\n量到 ${samples.size} 帧，元素：${[...names].join("、") || "（没有）"}`);
list.forEach((run) => console.log(fmt(run)));
console.log(list.length ? `${list.length} 处问题。是故意的就在 <LayoutProbe allow> 里写上这对名字` : "没有压住或出界的");
const outDir = path.join(ROOT, "out", "layout");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${id}.json`);
fs.writeFileSync(outFile, JSON.stringify({ id, every, min, issues: list }, null, 1));
console.log(`结果：${path.relative(ROOT, outFile)}`);
process.exit(list.length ? 1 : 0);
