// Manim 公式动画：把场景渲染成透明 WebM，放进 public/ 给 Remotion 用
//
// 用法：npm run manim -- <场景文件.py> [场景名…] [--fps=30] [--size=1920x1080]
//   不写场景名就渲染文件里的所有场景
//   --fps   默认 30，要和用到它的 Composition 一致，这样一帧对一帧
//   --size  默认 1920x1080；只占画面一小块时可以改小，渲染更快
//
// 场景文件放在作品目录里，比如 src/videos/foo/scenes.py，产物是
// public/videos/foo/manim/<场景名>.webm（VP9 带透明通道）和同名 .json（宽高、帧率、帧数），
// Composition 里用 src/shared/manim.tsx 的 <ManimClip> 嵌入。Manim 的缓存和中间文件放在 out/manim/
//
// 场景里的文字用 public/fonts/ 里的字体，写字体名就行（manim_run.py 会先注册），不依赖系统字体

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const MEDIA_DIR = path.join(ROOT, "out", "manim");
const USAGE = "用法：npm run manim -- <场景文件.py> [场景名…] [--fps=30] [--size=1920x1080]";

const args = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const [file, ...scenes] = args.filter((arg) => !arg.startsWith("--"));
const fps = Number(option("fps", "30"));
const [width, height] = option("size", "1920x1080").split("x").map(Number);

if (!file?.endsWith(".py") || !(fps > 0) || !(width > 0 && height > 0)) {
  console.error(USAGE);
  process.exit(1);
}

// capture 为 false 时直接把输出接到终端，LaTeX 报错之类能直接看到
const run = (cmd, cmdArgs, capture = false) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: ["ignore", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
      // Manim 依赖的 pydub 在 Python 3.12 上会打印一堆无关的 SyntaxWarning
      env: { ...process.env, PYTHONWARNINGS: "ignore::SyntaxWarning" },
    });
    let output = "";
    child.stdout?.on("data", (data) => (output += data));
    child.stderr?.on("data", (data) => (output += data));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${cmd} 失败（退出码 ${code}）${capture ? `：${output.trim()}` : ""}`));
    });
  });

// Manim 的成品在 out/manim/videos/<文件名>/<高>p<帧率>/ 下，partial_movie_files 里是分段的中间文件。
// 返回 成品路径 → 修改时间
const listVideos = async (dir) => {
  const videos = new Map();
  for (const name of await fs.readdir(dir, { recursive: true }).catch(() => [])) {
    if (name.endsWith(".webm") && !name.includes("partial_movie_files")) {
      const video = path.join(dir, name);
      videos.set(video, (await fs.stat(video)).mtimeMs);
    }
  }
  return videos;
};

// ffprobe 自带的 VP9 解码器读不出透明通道，所以看 WebM 里的 alpha_mode 标记
const probe = async (video) => {
  const json = await run("ffprobe", [
    ...["-v", "error", "-count_frames", "-select_streams", "v:0"],
    ...["-show_entries", "stream=width,height,r_frame_rate,nb_read_frames:stream_tags=alpha_mode", "-of", "json", video],
  ], true);
  const stream = JSON.parse(json).streams[0];
  const [num, den] = stream.r_frame_rate.split("/").map(Number);
  return {
    width: stream.width,
    height: stream.height,
    fps: num / den,
    durationInFrames: Number(stream.nb_read_frames),
    transparent: stream.tags?.alpha_mode === "1",
  };
};

try {
  const source = path.resolve(file);
  await fs.access(source).catch(() => {
    throw new Error(`找不到 ${file}`);
  });
  const rel = path.relative(SRC, path.dirname(source));
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${file} 不在 src/ 下面，没法确定产物放在 public/ 的哪里`);
  }
  const outDir = path.join(ROOT, "public", rel, "manim");
  const videosDir = path.join(MEDIA_DIR, "videos", path.basename(source, ".py"));
  const before = await listVideos(videosDir);

  console.log(`渲染 ${path.relative(ROOT, source)}（${width}×${height}，${fps}fps，透明背景）…`);
  // 经 manim_run.py 启动，先注册 public/fonts/ 里的字体
  await run("uv", [
    ...["run", path.join("scripts", "manim_run.py"), "render", source, ...(scenes.length > 0 ? scenes : ["-a"])],
    ...["--transparent", "--format", "webm", "--fps", String(fps), "-r", `${width},${height}`],
    ...["--media_dir", MEDIA_DIR, "--progress_bar", "none", "-v", "WARNING"],
  ]);

  // 渲染前后各列一次成品，有变化的就是这次渲染的
  const rendered = [...(await listVideos(videosDir))]
    .filter(([video, mtime]) => before.get(video) !== mtime)
    .map(([video]) => video);
  const missing = scenes.filter((scene) => !rendered.some((video) => path.basename(video, ".webm") === scene));
  if (rendered.length === 0 || missing.length > 0) {
    throw new Error(`${missing.length > 0 ? `没有渲染出 ${missing.join("、")}` : "没有生成视频"}，检查场景名是否写对`);
  }

  await fs.mkdir(outDir, { recursive: true });
  let allGood = true;
  for (const video of rendered) {
    const scene = path.basename(video, ".webm");
    const target = path.join(outDir, `${scene}.webm`);
    await fs.copyFile(video, target);
    const info = await probe(target);
    const meta = { width: info.width, height: info.height, fps: info.fps, durationInFrames: info.durationInFrames };
    await fs.writeFile(path.join(outDir, `${scene}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    const problems = [];
    if (!info.transparent) problems.push("没有透明通道");
    if (info.fps !== fps) problems.push(`帧率是 ${info.fps}，不是 ${fps}`);
    if (info.width !== width || info.height !== height) problems.push(`尺寸是 ${info.width}×${info.height}`);
    const size = `${((await fs.stat(target)).size / 1000).toFixed(0)} KB`;
    const summary = `${info.durationInFrames} 帧（${(info.durationInFrames / info.fps).toFixed(2)} 秒），${size}`;
    console.log(`  ${scene} → ${path.relative(ROOT, target)}：${summary}`);
    if (problems.length > 0) {
      console.log(`    [不合格] ${problems.join("、")}`);
      allGood = false;
    }
  }
  if (!allGood) process.exitCode = 1;
} catch (err) {
  console.error(`\n出错：${err.message}`);
  process.exitCode = 1;
}
