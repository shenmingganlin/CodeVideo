// 一次打包，渲染若干单帧，用来检查画面
//
// 用法：node scripts/stills.mjs <Composition ID> <帧号…> [--scale=0.5] [--out=out/stills/<id>]
// 比如：node scripts/stills.mjs LenzLaw 0 120 700 1560 --scale=0.5

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const id = args.find((arg) => !arg.startsWith("--"));
const frames = args.filter((arg) => !arg.startsWith("--") && arg !== id).map(Number);
const scale = Number(option("scale") ?? 0.5);
const outDir = path.resolve(ROOT, option("out") ?? path.join("out", "stills", id ?? "film"));

if (!id || frames.length === 0 || frames.some((f) => !Number.isFinite(f))) {
  console.error("用法：node scripts/stills.mjs <Composition ID> <帧号…> [--scale=0.5] [--out=目录]");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
console.log("打包 Remotion 工程…");
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  rspack: true,
});
const composition = await selectComposition({ serveUrl, id });

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    scale,
    chromiumOptions: { gl: "angle" },
  });
  console.log(path.relative(ROOT, output));
}
