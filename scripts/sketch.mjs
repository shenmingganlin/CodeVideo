// 分镜草图：把作品用 ShotSketches（src/shared/sketch.tsx）注册的每个镜头渲成静帧 PNG，给分镜评审页挂
//
// 用法：npm run sketch -- <作品目录> [镜头 id…] [--scale=0.5] [--gl=angle]
//   作品的 board/board.json 里写 "sketch": "<prefix>"，和 ShotSketches 的 prefix 一样
//   出在 out/board/<作品>/<镜头>.png；一个镜头出多帧时是 <镜头>-f<帧号>.png
//   不写镜头 id 就出全部。只打包一次，一个镜头几秒
// 渲完对一遍 board.json：哪个镜头没注册草图、哪张图没挂进 media，打印出来。不改 board.json，挂不挂由助手写

import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

const ROOT = process.cwd();
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
for (const arg of args.filter((a) => a.startsWith("--"))) if (!/^--(scale|gl)=/.test(arg)) fail(`不认识的选项 ${arg}`);
const [workArg, ...only] = args.filter((arg) => !arg.startsWith("--"));
if (!workArg) fail("用法：npm run sketch -- <作品目录> [镜头 id…] [--scale=0.5]");
const work = path.resolve(ROOT, workArg);
const boardFile = path.join(work, "board", "board.json");
if (!fs.existsSync(boardFile)) fail(`${path.relative(ROOT, boardFile)} 还没写`);
let board;
try {
  board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
} catch (error) {
  fail(`board.json 不是合法的 JSON：${error.message}`);
}
const prefix = board.sketch;
if (!prefix) fail(`board.json 里要写 "sketch": "<prefix>"，和作品 index.tsx 里 <ShotSketches prefix=…> 的一样`);
const scale = Number(option("scale") ?? 0.5);
if (!(scale > 0 && scale <= 1)) fail("--scale 要在 0–1 之间，缺省 0.5");
const gl = option("gl");
const outDir = path.join(ROOT, "out", "board", path.basename(work));
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/");

console.log("打包 Remotion 工程…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
const sketches = (await getCompositions(serveUrl)).filter((c) => c.id.startsWith(`${prefix}-`) && c.defaultProps?.sketch);
if (!sketches.length) fail(`Studio 里没有 ${prefix}-<镜头> 的草图 Composition：作品 index.tsx 里用 <ShotSketches prefix="${prefix}" …> 注册`);
for (const id of only) if (!sketches.some((c) => c.defaultProps.sketch.shot === id)) fail(`镜头 ${id} 没有注册草图`);

fs.mkdirSync(outDir, { recursive: true });
const made = new Map();
for (const composition of sketches) {
  const { shot, stills } = composition.defaultProps.sketch;
  if (only.length && !only.includes(shot)) continue;
  for (const frame of stills) {
    const output = path.join(outDir, stills.length === 1 ? `${shot}.png` : `${shot}-f${frame}.png`);
    const started = Date.now();
    await renderStill({ composition, serveUrl, output, frame, scale, ...(gl ? { chromiumOptions: { gl } } : {}) });
    console.log(`${rel(output)}（${((Date.now() - started) / 1000).toFixed(1)}s）`);
    made.set(shot, [...(made.get(shot) ?? []), rel(output)]);
  }
}

// 对一遍 board.json
const shots = board.shots ?? [];
const registered = new Set(sketches.map((c) => c.defaultProps.sketch.shot));
const notes = [];
for (const s of shots) {
  if (!registered.has(s.id)) notes.push(`镜头 ${s.id} 没有草图（只留文字的话在说明里写"草图后补"）`);
  const linked = new Set((s.media ?? []).map((m) => String(m.src).replaceAll("\\", "/")));
  for (const file of made.get(s.id) ?? []) if (!linked.has(file)) notes.push(`镜头 ${s.id} 的 media 里还没挂 ${file}`);
}
for (const shot of registered) if (!shots.some((s) => s.id === shot)) notes.push(`草图 ${prefix}-${shot} 在 board.json 里没有对应的镜头`);
if (notes.length) {
  console.log("\n对照 board.json：");
  for (const n of notes) console.log(`  ${n}`);
} else {
  console.log("\n草图都已挂进 board.json");
}
