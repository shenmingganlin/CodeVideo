// 关键帧预览图：把一个 Composition 的若干帧渲染出来，拼成一张带帧号和时间的网格图
//
// 用法：npm run contact -- <Composition ID> [--count=8] [--frames=0,90,300] [--cols=4] [--bg=EDEDED]
//   --count   均匀取几帧（默认 8，含首帧和末帧），写了 --frames 就按 --frames
//   --frames  指定帧号，逗号分隔
//   --cols    每行几张，默认 4
//   --bg      透明画面垫的底色，默认微信浅色底 EDEDED
//
// 产物：out/contact/<id>.png，单帧在 out/contact/<id>/。用来给用户确认分镜、交付前自己检查画面

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out", "contact");
// drawtext 的字体路径用相对路径，避开 Windows 盘符里的冒号要转义的问题
const FONT = "public/fonts/NotoSansSC-VF.ttf";
// 网格里每张的宽度
const CELL_WIDTH = 480;

const args = process.argv.slice(2);
const id = args.find((arg) => !arg.startsWith("--"));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const count = Number(option("count") ?? 8);
const cols = Number(option("cols") ?? 4);
const bg = option("bg") ?? "EDEDED";

const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};
if (!id) fail("用法：npm run contact -- <Composition ID> [--count=8] [--frames=0,90,300] [--cols=4] [--bg=EDEDED]");
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(cols) || cols < 1) fail("--count、--cols 要写正整数");
if (!/^[0-9a-fA-F]{6}$/.test(bg)) fail("--bg 要写成 EDEDED 这样的 6 位十六进制");

const run = (cmd, cmdArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 失败：${stderr.trim()}`))));
  });

console.log("打包 Remotion 工程…");
// Node API 不读 remotion.config.ts，这里要自己打开 Rspack
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
await ensureBrowser();
const browser = await openBrowser("chrome");
try {
  // 找不到 id 和 calculateMetadata 出错（比如还没生成配音）都在这里抛，原文要打出来
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser }).catch((err) =>
    fail(`取不到 Composition ${id}：${err.message}`),
  );
  const last = composition.durationInFrames - 1;
  const frames = option("frames")
    ? option("frames").split(",").map(Number)
    : Array.from({ length: Math.min(count, last + 1) }, (_, i) => (count === 1 ? 0 : Math.round((last * i) / (count - 1))));
  const bad = frames.filter((f) => !Number.isInteger(f) || f < 0 || f > last);
  if (bad.length) fail(`帧号超出范围 0–${last}：${bad.join(",")}`);

  const framesDir = path.join(OUT_DIR, id);
  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  console.log(`渲染 ${id} 的 ${frames.length} 帧（${composition.width}×${composition.height}，${composition.fps}fps）…`);
  const files = [];
  for (const frame of frames) {
    const file = path.join(framesDir, `${String(frame).padStart(5, "0")}.png`);
    await renderStill({ composition, serveUrl, frame, output: file, imageFormat: "png", puppeteerInstance: browser });
    files.push(file);
  }

  // 每张缩到同样宽度，垫底色，左上角标帧号和时间，再拼成网格；最后一行不满时用底色补齐
  const cellHeight = Math.round((CELL_WIDTH * composition.height) / composition.width / 2) * 2;
  const rows = Math.ceil(files.length / cols);
  const filters = files.map((_, i) => {
    const seconds = (frames[i] / composition.fps).toFixed(2);
    return (
      `color=c=0x${bg}:s=${CELL_WIDTH}x${cellHeight}[bg${i}];` +
      `[${i}]scale=${CELL_WIDTH}:${cellHeight}[s${i}];[bg${i}][s${i}]overlay,` +
      `drawtext=fontfile=${FONT}:text='${frames[i]} 帧 · ${seconds}s':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6,` +
      `pad=${CELL_WIDTH + 4}:${cellHeight + 4}:2:2:color=white[c${i}]`
    );
  });
  const fill = rows * cols - files.length;
  for (let i = 0; i < fill; i++) {
    filters.push(`color=c=0x${bg}:s=${CELL_WIDTH + 4}x${cellHeight + 4}:d=1[c${files.length + i}]`);
  }
  const cells = Array.from({ length: rows * cols }, (_, i) => `[c${i}]`).join("");
  const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * (CELL_WIDTH + 4)}_${Math.floor(i / cols) * (cellHeight + 4)}`).join("|");
  const sheet = path.join(OUT_DIR, `${id}.png`);
  const grid = rows * cols === 1 ? `${cells}null[out]` : `${cells}xstack=inputs=${rows * cols}:layout=${layout}[out]`;
  await run("ffmpeg", [
    "-v", "error", "-y",
    ...files.flatMap((file) => ["-i", path.relative(ROOT, file)]),
    "-filter_complex", `${filters.join(";")};${grid}`,
    "-map", "[out]", "-frames:v", "1", path.relative(ROOT, sheet),
  ]);
  console.log(`→ ${path.relative(ROOT, sheet)}（${cols} 列 × ${rows} 行）`);
} finally {
  await browser.close({ silent: true });
}
