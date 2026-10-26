// 预览烘焙：把 <PreviewBake id="…"> 包住的重图层单独渲成透明视频，Studio 里播它，不卡（见 src/shared/bake.tsx）
//
// 用法：npm run bake -- <Composition ID> <烘焙 id> [--frames=<起>-<止>] [--gl=angle] [--concurrency=N]
//       npm run bake -- <Composition ID> <烘焙 id> --clear      删掉这层的烘焙，Studio 回到现场画
//       npm run bake -- <Composition ID> --list                  列出这个 Composition 烘焙了哪些层
//
// 只给 Studio 预览用：导出照样现场画。这层的代码改了要重新烘焙，不然 Studio 里看到的还是旧的
// --frames 缺省是整片（帧号是全片的，含两端）；--gl 和这部片子的成片用同一个；--crf 缺省 10（实测 20 体积小三成、PSNR 低 0.8 dB）
// 出 public/bake/<Composition ID>/<烘焙 id>.webm（VP9 透明，crf 10）和 index.json，不进 git

import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const [compId, bakeId] = args.filter((a) => !a.startsWith("--"));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const USAGE = "用法：npm run bake -- <Composition ID> <烘焙 id> [--frames=<起>-<止>] [--gl=angle] [--concurrency=N] | --clear | --list";
if (!compId) fail(USAGE);
const KNOWN = ["frames", "gl", "concurrency", "crf"];
for (const arg of args.filter((a) => a.startsWith("--"))) {
  if (arg === "--clear" || arg === "--list") continue;
  if (!KNOWN.some((k) => arg.startsWith(`--${k}=`))) fail(`不认识的选项 ${arg}（要用等号连着写，比如 --frames=0-299）\n${USAGE}`);
}

const dir = path.join(ROOT, "public", "bake", compId);
const indexFile = path.join(dir, "index.json");
const readIndex = () => (fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : {});
const writeIndex = (index) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");
};

if (args.includes("--list")) {
  const index = readIndex();
  const ids = Object.keys(index);
  if (ids.length === 0) console.log(`${compId} 没有烘焙的图层`);
  for (const id of ids) console.log(`${id}：第 ${index[id].from}–${index[id].to} 帧，${index[id].bakedAt} 烘焙，${index[id].file}`);
  process.exit(0);
}
if (!bakeId) fail(USAGE);
if (!/^[\w-]+$/.test(bakeId)) fail("烘焙 id 只能用字母、数字、下划线和减号");

if (args.includes("--clear")) {
  const index = readIndex();
  if (!index[bakeId]) fail(`${compId} 没有烘焙过 ${bakeId}`);
  fs.rmSync(path.join(ROOT, "public", index[bakeId].file), { force: true });
  delete index[bakeId];
  writeIndex(index);
  console.log(`删掉了 ${compId} 的 ${bakeId}，Studio 里这层回到现场画`);
  process.exit(0);
}

const gl = option("gl");
const GL_RENDERERS = ["angle", "egl", "swiftshader", "swangle", "vulkan", "angle-egl"];
if (gl && !GL_RENDERERS.includes(gl)) fail(`--gl 只能是 ${GL_RENDERERS.join("、")}`);
const concurrency = option("concurrency") === undefined ? null : Number(option("concurrency"));
if (concurrency !== null && (!Number.isInteger(concurrency) || concurrency < 1)) fail("--concurrency 要是正整数");

console.log("打包 Remotion 工程…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
await ensureBrowser();
// 烘焙时 <PreviewBake> 读这个变量：id 对上的层单独画在透明背景上，别的全部不画
const envVariables = { CV_BAKE: bakeId };
const composition = await selectComposition({ serveUrl, id: compId, envVariables }).catch((err) =>
  fail(`取不到 Composition ${compId}：${err.message}`),
);
let range = [0, composition.durationInFrames - 1];
if (option("frames") !== undefined) {
  const m = option("frames").match(/^(\d+)-(\d+)$/);
  if (!m || Number(m[1]) > Number(m[2])) fail("--frames 写成 <起>-<止>，比如 --frames=0-299（含两端）");
  range = [Number(m[1]), Number(m[2])];
  if (range[1] >= composition.durationInFrames) fail(`--frames 超出范围：${compId} 只有 0–${composition.durationInFrames - 1} 帧`);
}

const file = `bake/${compId}/${bakeId}.webm`;
const out = path.join(ROOT, "public", file);
const temp = out.replace(/\.webm$/, ".tmp.webm");
fs.mkdirSync(dir, { recursive: true });
const frames = range[1] - range[0] + 1;
console.log(`烘焙 ${compId} 的 ${bakeId}（第 ${range[0]}–${range[1]} 帧，共 ${frames} 帧${gl ? `，--gl=${gl}` : ""}）…`);
let lastPercent = -10;
const started = Date.now();
await renderMedia({
  composition,
  serveUrl,
  envVariables,
  codec: "vp9",
  crf: Number(option("crf") ?? 10),
  imageFormat: "png",
  pixelFormat: "yuva420p",
  muted: true,
  frameRange: range,
  ...(gl ? { chromiumOptions: { gl } } : {}),
  ...(concurrency ? { concurrency } : {}),
  outputLocation: temp,
  onProgress: ({ progress }) => {
    const percent = Math.floor(progress * 100);
    if (percent >= lastPercent + 10) {
      lastPercent = percent;
      console.log(`  ${percent}%`);
    }
  },
});
// 渲完再换掉旧文件，烘焙中途 Studio 还能播旧的
fs.renameSync(temp, out);
const index = readIndex();
// 本地时间（Studio 的标签显示它），写成 2026-10-25T14:03:22
const now = new Date();
const bakedAt = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
index[bakeId] = { file, from: range[0], to: range[1], bakedAt };
writeIndex(index);
const mb = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`烘焙好了：public/${file}（${mb} MB，${((Date.now() - started) / 1000).toFixed(0)} 秒）。Studio 两秒内自动换上，不用刷新`);
