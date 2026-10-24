// 一次打包，渲染若干单帧，用来检查画面
//
// 用法：node scripts/stills.mjs <Composition ID> <帧号…> [--scale=0.5] [--crop=x,y,w,h] [--out=out/stills/<id>] [--gl=angle]
//   --gl 和渲染成片时一样写：成片加了 --gl=angle 的，静帧也要加，不然着色器、Canvas 的画面会和成片不一样
//   --crop 只留画面的一块（坐标按原尺寸的像素），原尺寸渲染再裁，细节看得清图又小。
//     写了 --crop 时 --scale 缺省是 1，管的是裁出来那块再缩放
// 比如：node scripts/stills.mjs LenzLaw 0 120 700 1560 --scale=0.5
//      node scripts/stills.mjs LenzLaw 700 --crop=1200,80,640,360

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const id = args.find((arg) => !arg.startsWith("--"));
const frames = args.filter((arg) => !arg.startsWith("--") && arg !== id).map(Number);
const crop = option("crop")?.split(",").map(Number);
if (crop && (crop.length !== 4 || crop.some((v) => !Number.isFinite(v) || v < 0) || crop[2] === 0 || crop[3] === 0)) {
  console.error("--crop 写成 x,y,w,h（原尺寸的像素），比如 --crop=1200,80,640,360");
  process.exit(1);
}
const scale = Number(option("scale") ?? (crop ? 1 : 0.5));
const outDir = path.resolve(ROOT, option("out") ?? path.join("out", "stills", id ?? "film"));
// 和 npm run video 用同一个 GL 后端，静帧才和成片一样（不传就是 Chrome 无界面时的缺省：软件渲染 SwiftShader）
const gl = option("gl");

if (!id || frames.length === 0 || frames.some((f) => !Number.isFinite(f))) {
  console.error("用法：node scripts/stills.mjs <Composition ID> <帧号…> [--scale=0.5] [--crop=x,y,w,h] [--out=目录] [--gl=angle]");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
console.log("打包 Remotion 工程…");
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  rspack: true,
});
const composition = await selectComposition({ serveUrl, id });
if (crop && (crop[0] + crop[2] > composition.width || crop[1] + crop[3] > composition.height)) {
  console.error(`--crop 超出画面（${composition.width}×${composition.height}）`);
  process.exit(1);
}

for (const frame of frames) {
  const name = `f${String(frame).padStart(4, "0")}${crop ? `-crop${crop.join("_")}` : ""}.png`;
  const output = path.join(outDir, name);
  // 裁切时先按原尺寸渲染到临时文件，再用 FFmpeg 裁出那一块（需要的话再缩放）
  const rendered = crop ? path.join(outDir, `.tmp-${name}`) : output;
  await renderStill({
    composition,
    serveUrl,
    output: rendered,
    frame,
    scale: crop ? 1 : scale,
    ...(gl ? { chromiumOptions: { gl } } : {}),
  });
  if (crop) {
    const [x, y, w, h] = crop;
    const filter = `crop=${w}:${h}:${x}:${y}${scale !== 1 ? `,scale=iw*${scale}:-1` : ""}`;
    const cut = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", rendered, "-vf", filter, output], { encoding: "utf8" });
    fs.rmSync(rendered, { force: true });
    if (cut.status !== 0) {
      console.error(`裁切失败：${cut.stderr}`);
      process.exit(1);
    }
  }
  console.log(path.relative(ROOT, output));
}
