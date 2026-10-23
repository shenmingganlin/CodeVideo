// 动效样片库：把 src/gallery/effects/ 下的效果渲染成循环小片，拼成网页 out/gallery/index.html 给用户挑
//
// 用法：npm run gallery [-- <名字…>] [--force] [--no-open] [--list]
//   --list 只打印"编号、名字、分组、文件名、描述"，不渲染不开网页
//   名字是 effects/ 下的文件名（不带 .tsx），不写就处理全部
//   源码没变的效果不重新渲染（对比 out/gallery/<名字>.json 里记的哈希），--force 全部重渲
//   每段渲染完量一次首尾接缝：最后一帧到第一帧的变化明显大于平时相邻两帧，就报"接缝跳"；整段几乎不动报"不动"
//   加 --no-open 不开浏览器
// 产物都在 out/（不进 git），换电脑重跑一遍就有

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "gallery");
const EFFECTS = path.join(SRC, "effects");
const OUT = path.join(ROOT, "out", "gallery");
const SCALE = 0.5;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
for (const arg of args) if (arg.startsWith("--") && !["--force", "--no-open", "--list"].includes(arg)) fail(`不认识的选项 ${arg}`);
const force = args.includes("--force");
const wanted = args.filter((arg) => !arg.startsWith("--"));

const all = fs
  .readdirSync(EFFECTS)
  .filter((f) => /^[\w-]+\.tsx$/.test(f))
  .map((f) => f.slice(0, -4));
for (const name of wanted) if (!all.includes(name)) fail(`没有这个效果：${name}（src/gallery/effects/${name}.tsx 不存在）`);
const slugs = wanted.length ? wanted : all;

// --list：直接从源码读编号、名字、分组、描述打印出来，不渲染、不开网页。挑样片时照它出选项，不用自己 grep
if (args.includes("--list")) {
  const field = (text, key) => text.match(new RegExp(`^\\s*${key}:\\s*(?:"([^"]*)"|(\\d+))`, "m"))?.slice(1).find((v) => v !== undefined);
  const rows = slugs
    .map((slug) => {
      const text = fs.readFileSync(path.join(EFFECTS, `${slug}.tsx`), "utf8");
      return { slug, no: Number(field(text, "no")), name: field(text, "name"), group: field(text, "group"), desc: field(text, "desc") };
    })
    .sort((a, b) => a.no - b.no);
  for (const r of rows) console.log(`#${r.no}\t${r.name}\t${r.group}\t${r.slug}\t${r.desc}`);
  console.log(`共 ${rows.length} 个；小片在 out/gallery/<文件名>.mp4，可以直接挂进分镜页的 media`);
  process.exit(0);
}

// 哈希只算真正用到的源码：效果文件和它沿相对路径 import 到的文件，加上 index.tsx、kit.tsx 和它们 import 到的。
// 不能整个 src/shared/ 一起算：别的对话改 src/shared/ 里样片没用到的文件（比如 field/），会让 86 段全部重渲好几分钟
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;
const resolveImport = (spec, fromDir) => {
  const base = path.resolve(fromDir, spec);
  const tries = [base, ...[".ts", ".tsx", ".js", ".mjs"].map((x) => base + x), ...["index.ts", "index.tsx"].map((x) => path.join(base, x))];
  return tries.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
};
const closure = (entries) => {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const dep = resolveImport(m[1], path.dirname(file));
      if (dep) stack.push(dep);
    }
  }
  return seen;
};
const commonFiles = closure([path.join(SRC, "index.tsx"), path.join(SRC, "kit.tsx")]);
const hashOf = (slug) => {
  const own = path.join(EFFECTS, `${slug}.tsx`);
  const files = [...new Set([...commonFiles, own, ...closure([own])])].sort();
  const h = crypto.createHash("sha1");
  for (const p of files) h.update(path.relative(ROOT, p)).update(fs.readFileSync(p));
  return h.digest("hex");
};

const sidecar = (slug) => path.join(OUT, `${slug}.json`);
const readSidecar = (slug) => {
  try {
    return JSON.parse(fs.readFileSync(sidecar(slug), "utf8"));
  } catch {
    return null;
  }
};

fs.mkdirSync(OUT, { recursive: true });
const stale = slugs.filter((slug) => {
  if (force) return true;
  const old = readSidecar(slug);
  return !old || old.hash !== hashOf(slug) || !fs.existsSync(path.join(OUT, `${slug}.mp4`));
});

// 把成片解码成 96×54 的灰度帧，量相邻帧的平均差和首尾接缝
const measure = (file) => {
  const w = 96;
  const h = 54;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], {
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) fail(`ffmpeg 解码 ${file} 失败：${r.stderr}`);
  const size = w * h;
  const n = Math.floor(r.stdout.length / size);
  const frame = (i) => r.stdout.subarray(i * size, (i + 1) * size);
  const diff = (a, b) => {
    let s = 0;
    for (let i = 0; i < size; i++) s += Math.abs(a[i] - b[i]);
    return s / size;
  };
  const steps = [];
  for (let i = 0; i + 1 < n; i++) steps.push(diff(frame(i), frame(i + 1)));
  const sorted = [...steps].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const seam = diff(frame(n - 1), frame(0));
  const flags = [];
  if (sorted[sorted.length - 1] < 0.15) flags.push("不动");
  else if (seam > p95 * 2 + 1) flags.push("接缝跳");
  return { seam: +seam.toFixed(2), p95: +p95.toFixed(2), flags };
};

if (stale.length) {
  console.log(`要渲染 ${stale.length} 个：${stale.join("、")}`);
  console.log("打包 Remotion 工程…");
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
  const compositions = await getCompositions(serveUrl);
  for (const slug of stale) {
    const composition = compositions.find((c) => c.id === `G-${slug}`);
    if (!composition) fail(`Studio 里没有 G-${slug}：检查 effects/${slug}.tsx 是否默认导出了 GalleryEffect`);
    const output = path.join(OUT, `${slug}.mp4`);
    const started = Date.now();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 20,
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      muted: true,
      scale: SCALE,
      outputLocation: output,
    });
    const check = measure(output);
    const meta = composition.defaultProps.gallery;
    fs.writeFileSync(
      sidecar(slug),
      JSON.stringify(
        { ...meta, frames: composition.durationInFrames, fps: composition.fps, hash: hashOf(slug), ...check },
        null,
        2,
      ) + "\n",
    );
    const note = check.flags.length ? `  ⚠ ${check.flags.join("、")}（接缝 ${check.seam}，平时 ${check.p95}）` : "";
    console.log(`  #${meta.no} ${meta.name}  ${((Date.now() - started) / 1000).toFixed(0)} 秒${note}`);
  }
} else console.log("源码都没变，不用重渲");

// 网页上的格子放 480×270 的小片和一张封面，放大才播原片：二十几段 960×540 一起解码，网页会卡
const previews = (slug, meta) => {
  const big = path.join(OUT, `${slug}.mp4`);
  const small = path.join(OUT, `${slug}.small.mp4`);
  const poster = path.join(OUT, `${slug}.jpg`);
  const fresh = (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= fs.statSync(big).mtimeMs;
  const ffmpeg = (ffArgs) => {
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...ffArgs], { encoding: "utf8" });
    if (r.status !== 0) fail(`ffmpeg 出 ${slug} 的预览失败：${r.stderr}`);
  };
  if (!fresh(small))
    ffmpeg(["-i", big, "-vf", "scale=480:270", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", small]);
  if (!fresh(poster)) ffmpeg(["-ss", String(meta.frames / meta.fps / 2), "-i", big, "-frames:v", "1", "-vf", "scale=480:270", "-q:v", "4", poster]);
};
for (const slug of all) {
  const meta = readSidecar(slug);
  if (meta && fs.existsSync(path.join(OUT, `${slug}.mp4`))) previews(slug, meta);
}

// 网页用全部效果（不只这次渲染的），源文件删掉了的不放
const effects = all
  .map(readSidecar)
  .filter(Boolean)
  .sort((a, b) => a.no - b.no);
const dupes = effects.filter((e, i) => effects.findIndex((o) => o.no === e.no) !== i);
for (const e of dupes) console.warn(`编号 #${e.no} 重复：${e.slug}`);
const missing = all.filter((slug) => !readSidecar(slug));
if (missing.length) console.warn(`还没渲染：${missing.join("、")}（npm run gallery -- ${missing.join(" ")}）`);

fs.writeFileSync(path.join(OUT, "index.html"), page(effects));
const flagged = effects.filter((e) => e.flags.length);
console.log(`\n样片库：${effects.length} 个效果${flagged.length ? `，${flagged.length} 个有问题：${flagged.map((e) => `#${e.no} ${e.flags.join("、")}`).join("，")}` : ""}`);
console.log(path.relative(ROOT, path.join(OUT, "index.html")));

if (!args.includes("--no-open")) {
  const file = path.join(OUT, "index.html");
  const [cmd, cmdArgs] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : process.platform === "darwin" ? ["open", [file]] : ["xdg-open", [file]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
}

function page(effects) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // 分组按组里最小的编号排，新效果加在哪组就出现在哪组
  const groups = [];
  for (const e of effects) {
    let g = groups.find((x) => x.name === e.group);
    if (!g) groups.push((g = { name: e.group, items: [] }));
    g.items.push(e);
  }
  const card = (e) => `
      <article class="card" id="e${e.no}">
        <button class="play" type="button" data-src="${esc(e.slug)}.mp4?v=${e.hash.slice(0, 8)}" data-title="#${e.no} ${esc(e.name)}" aria-label="放大看 #${e.no} ${esc(e.name)}">
          <video src="${esc(e.slug)}.small.mp4?v=${e.hash.slice(0, 8)}" poster="${esc(e.slug)}.jpg?v=${e.hash.slice(0, 8)}" muted loop playsinline preload="none" aria-hidden="true"></video>
          <span class="no">#${e.no}</span>
          ${e.flags.length ? `<span class="flag">${esc(e.flags.join("、"))}</span>` : ""}
        </button>
        <h3>${esc(e.name)}</h3>
        <p>${esc(e.desc)}</p>
        <p class="tech">${esc(e.tech)} · ${(e.frames / e.fps).toFixed(1)} 秒一循环</p>
        <button class="copy" type="button" data-text="#${e.no} ${esc(e.name)}">复制"#${e.no} ${esc(e.name)}"</button>
      </article>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>动效样片库</title>
<style>
  :root { color-scheme: dark; --bg: #0f1115; --card: #181b21; --line: #2a2f38; --fg: #e8eaee; --dim: #9aa1ad; --accent: #f2a93b; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.6 "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif; }
  header { position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line); padding: 14px 28px; }
  header h1 { margin: 0 0 4px; font-size: 20px; }
  header p { margin: 0; color: var(--dim); }
  nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  nav a { color: var(--fg); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 2px 12px; }
  nav a:hover, nav a:focus-visible { border-color: var(--accent); outline: none; }
  main { padding: 8px 28px 60px; }
  h2 { font-size: 17px; margin: 28px 0 12px; color: var(--dim); font-weight: 600; scroll-margin-top: 120px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 20px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; scroll-margin-top: 120px; }
  .card h3 { margin: 12px 14px 2px; font-size: 16px; }
  .card p { margin: 0 14px 6px; }
  .card .tech { color: var(--dim); font-size: 13px; }
  .play { position: relative; display: block; width: 100%; padding: 0; border: 0; background: #000; cursor: zoom-in; aspect-ratio: 16 / 9; }
  .play:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .play video { width: 100%; height: 100%; display: block; }
  .no { position: absolute; left: 10px; top: 8px; background: rgba(0,0,0,.6); color: #fff; border-radius: 6px; padding: 0 8px; font-weight: 700; }
  .flag { position: absolute; right: 10px; top: 8px; background: #b3261e; color: #fff; border-radius: 6px; padding: 0 8px; font-size: 13px; }
  .copy { margin: 4px 14px 14px; background: none; color: var(--accent); border: 1px solid var(--line); border-radius: 6px; padding: 3px 10px; font: inherit; font-size: 13px; cursor: pointer; }
  .copy:hover, .copy:focus-visible { border-color: var(--accent); outline: none; }
  dialog { padding: 0; border: 1px solid var(--line); border-radius: 10px; background: #000; color: var(--fg); width: min(92vw, 1600px); }
  dialog::backdrop { background: rgba(0,0,0,.8); }
  dialog video { width: 100%; display: block; }
  dialog .bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: var(--card); }
  dialog .bar button { background: none; color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 2px 12px; font: inherit; cursor: pointer; }
  .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: var(--accent); color: #111; padding: 6px 16px; border-radius: 8px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<header>
  <h1>动效样片库 · ${effects.length} 个</h1>
  <p>看中哪个就在对话里说编号和名字（比如"#1 格子落水泛涟漪"），可以说"要 #3 的感觉，但慢一点"。配色只是占位，做作品时照你定的风格换。点画面放大。</p>
  <nav aria-label="分组">${groups.map((g, i) => `<a href="#g${i}">${esc(g.name)}（${g.items.length}）</a>`).join("")}</nav>
</header>
<main>
${groups.map((g, i) => `  <section aria-labelledby="g${i}">
    <h2 id="g${i}">${esc(g.name)}</h2>
    <div class="grid">${g.items.map(card).join("")}
    </div>
  </section>`).join("\n")}
</main>
<dialog id="big" aria-label="放大播放">
  <video muted loop playsinline autoplay></video>
  <div class="bar"><strong></strong><button type="button" id="close">关闭（Esc）</button></div>
</dialog>
<div class="toast" role="status" aria-live="polite"></div>
<script>
  // 只播屏幕上看得见的格子，其余停在封面上；放大的时候格子全停
  const grid = [...document.querySelectorAll(".card video")];
  const big = document.getElementById("big");
  const bigVideo = big.querySelector("video");
  const sync = () => {
    for (const v of grid) {
      const r = v.getBoundingClientRect();
      const visible = !big.open && r.bottom > 0 && r.top < innerHeight && r.width > 0;
      if (visible && v.paused) v.play().catch(() => {});
      else if (!visible && !v.paused) v.pause();
    }
  };
  // 滚动时最多每 150 毫秒对一次（IntersectionObserver 在后台标签页里不触发，所以自己量）
  let pending = 0;
  const later = () => { if (!pending) pending = setTimeout(() => { pending = 0; sync(); }, 150); };
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", later);
  document.addEventListener("visibilitychange", sync);
  sync();

  document.querySelectorAll(".play").forEach((b) => b.addEventListener("click", () => {
    bigVideo.src = b.dataset.src;
    big.querySelector("strong").textContent = b.dataset.title;
    big.showModal();
    sync();
    bigVideo.play().catch(() => {});
  }));
  document.getElementById("close").addEventListener("click", () => big.close());
  big.addEventListener("click", (e) => { if (e.target === big) big.close(); });
  big.addEventListener("close", () => { bigVideo.pause(); bigVideo.removeAttribute("src"); bigVideo.load(); sync(); });

  const toast = document.querySelector(".toast");
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
    }
    toast.textContent = "已复制：" + text;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
  };
  document.querySelectorAll(".copy").forEach((b) => b.addEventListener("click", () => copy(b.dataset.text)));
</script>
</body>
</html>
`;
}
