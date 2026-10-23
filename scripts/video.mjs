// 视频成片：渲染 MP4 并校验
//
// 用法：npm run video -- <Composition ID> [--out=out/<id>.mp4] [--crf=18] [--mix=<混音.wav>] [--gl=angle] [--concurrency=1]
//       npm run video -- <文件.mp4>        只校验现成的视频
//
// --mix：画面静音渲染，再用 FFmpeg 把混好的 WAV 合进去（AAC 256k，按画面时长截齐）。
// motioner 实测让渲染器自己编码音频会晚 42.7ms（AAC 的 priming 没补偿），音轨还会比画面长，
// 所以有合成配乐、要卡帧的片子都走这条路。不带 --mix 时音频照旧由 Remotion 编码
//
// 画面统一输出 yuv420p、bt709（Remotion 默认会出全范围的 yuvj420p，平台转码后颜色可能偏）
//
// 校验：分辨率、帧率、帧数、时长和 Composition 一致，像素格式和色彩空间，音轨时长和画面对得上，
// 响度（B 站等平台会把响度拉到 -14 LUFS 左右，偏离太多会被压低或显得小声）和 true peak（超过 -1 dBTP 转码后容易破音）

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const ROOT = process.cwd();
const LEVEL_LABEL = { ok: "通过", warn: "注意", fail: "不合格" };
// 响度目标和容差：-14 LUFS ± 3，true peak 不超过 -1 dBTP
const LOUDNESS_TARGET = -14;
const LOUDNESS_TOLERANCE = 3;
const TRUE_PEAK_MAX = -1;

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith("--"));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};
if (!target) fail("用法：npm run video -- <Composition ID 或 文件.mp4> [--out=…] [--crf=18] [--mix=<混音.wav>] [--gl=angle] [--concurrency=1]");

// 运行命令，返回 stdout 或 stderr（ebur128 的结果在 stderr 里）
const run = (cmd, cmdArgs, stream = "stdout") =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    const text = { stdout: "", stderr: "" };
    child.stdout.on("data", (data) => (text.stdout += data));
    child.stderr.on("data", (data) => (text.stderr += data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(text[stream]) : reject(new Error(`${cmd} 失败：${text.stderr.trim().slice(-500)}`)),
    );
  });

let file;
let expected = null;
if (/\.(mp4|mov|mkv|webm)$/i.test(target)) {
  file = path.resolve(ROOT, target);
  if (!fs.existsSync(file)) fail(`找不到 ${target}`);
  if (option("mix")) fail("--mix 只在渲染时用；要校验的成片已经带着音轨");
} else {
  file = path.resolve(ROOT, option("out") ?? path.join("out", `${target}.mp4`));
  const crf = Number(option("crf") ?? 18);
  if (!Number.isInteger(crf) || crf < 0 || crf > 51) fail("--crf 要是 0–51 的整数，越小越清晰，缺省 18");
  // 地图、着色器、Three.js 这类 WebGL 画面画不出来时加 --gl=angle；一个标签页一个 WebGL 实例，吃内存时把并发调小
  const gl = option("gl");
  const GL_RENDERERS = ["angle", "egl", "swiftshader", "swangle", "vulkan", "angle-egl"];
  if (gl && !GL_RENDERERS.includes(gl)) fail(`--gl 只能是 ${GL_RENDERERS.join("、")}`);
  const concurrency = option("concurrency") === undefined ? null : Number(option("concurrency"));
  if (concurrency !== null && (!Number.isInteger(concurrency) || concurrency < 1)) fail("--concurrency 要是正整数");
  const mix = option("mix") && path.resolve(ROOT, option("mix"));
  if (mix && !fs.existsSync(mix)) fail(`找不到混音 ${option("mix")}`);
  // 带 --mix 时先渲染到旁边的静音文件，合好音轨再删掉
  const picture = mix ? file.replace(/\.mp4$/i, "") + ".silent.mp4" : file;
  console.log("打包 Remotion 工程…");
  // Node API 不读 remotion.config.ts，这里要自己打开 Rspack
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), rspack: true });
  await ensureBrowser();
  // 找不到 id 和 calculateMetadata 出错（比如还没生成配音）都在这里抛，原文要打出来
  const composition = await selectComposition({ serveUrl, id: target }).catch((err) =>
    fail(`取不到 Composition ${target}：${err.message}`),
  );
  expected = composition;
  const seconds = (composition.durationInFrames / composition.fps).toFixed(2);
  console.log(`渲染 ${target}（${composition.width}×${composition.height}，${composition.fps}fps，${composition.durationInFrames} 帧 = ${seconds}s${mix ? "，静音" : ""}）…`);
  let lastPercent = -10;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    muted: Boolean(mix),
    ...(gl ? { chromiumOptions: { gl } } : {}),
    ...(concurrency ? { concurrency } : {}),
    outputLocation: picture,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent >= lastPercent + 10) {
        lastPercent = percent;
        console.log(`  ${percent}%`);
      }
    },
  });
  if (mix) {
    console.log(`合入混音 ${path.relative(ROOT, mix)}…`);
    // 时长写成 帧数/帧率 的精确值，音轨不会比画面长
    const exact = String(composition.durationInFrames / composition.fps);
    await run("ffmpeg", [
      "-y", "-v", "error", "-i", picture, "-i", mix,
      "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
      "-t", exact, "-movflags", "+faststart", file,
    ]);
    fs.rmSync(picture);
  }
}

// ffprobe 读流信息；视频帧数用 -count_packets 数，不信容器里写的
const probe = JSON.parse(
  await run("ffprobe", [
    "-v", "error", "-count_packets",
    "-show_entries", "stream=codec_type,width,height,r_frame_rate,nb_read_packets,duration,pix_fmt,color_range,color_space:format=duration,size",
    "-of", "json", file,
  ]),
);
const video = probe.streams.find((s) => s.codec_type === "video");
const audio = probe.streams.find((s) => s.codec_type === "audio");
if (!video) fail("文件里没有视频流");

const results = [];
const report = (level, name, detail) => results.push({ level, name, detail });
const [num, den] = video.r_frame_rate.split("/").map(Number);
const fps = num / den;
const frames = Number(video.nb_read_packets);
const duration = Number(probe.format.duration);

if (expected) {
  const sizeOk = video.width === expected.width && video.height === expected.height;
  report(sizeOk ? "ok" : "fail", "分辨率", `${video.width}×${video.height}${sizeOk ? "" : `，应为 ${expected.width}×${expected.height}`}`);
  const fpsOk = Math.abs(fps - expected.fps) < 0.01;
  report(fpsOk ? "ok" : "fail", "帧率", `${+fps.toFixed(3)}fps${fpsOk ? "" : `，应为 ${expected.fps}`}`);
  const framesOk = frames === expected.durationInFrames;
  report(framesOk ? "ok" : "fail", "帧数", `${frames}${framesOk ? "" : `，应为 ${expected.durationInFrames}`}`);
} else {
  report("ok", "画面", `${video.width}×${video.height}，${+fps.toFixed(3)}fps，${frames} 帧`);
}
report("ok", "时长", `${duration.toFixed(2)}s，${(Number(probe.format.size) / 1e6).toFixed(1)} MB`);
const colorOk = video.pix_fmt === "yuv420p" && video.color_space === "bt709" && video.color_range === "tv";
report(
  colorOk ? "ok" : "warn",
  "像素格式",
  `${video.pix_fmt}，${video.color_space ?? "未标色彩空间"}，${video.color_range ?? "未标范围"}${colorOk ? "" : "，应为 yuv420p、bt709、tv，平台转码后颜色可能偏"}`,
);

if (!audio) {
  report("warn", "音轨", "没有音轨，有配音或 BGM 的作品要检查");
} else {
  // 音轨比画面短半秒以上，多半是配音或 BGM 没铺满；比画面长一帧以上，是让渲染器编码音频留下的尾巴
  const gap = Number(video.duration) - Number(audio.duration);
  const frame = 1 / fps;
  const audioNote = gap > 0.5 ? `，比画面短 ${gap.toFixed(2)}s` : gap < -frame ? `，比画面长 ${(-gap * 1000).toFixed(0)}ms，卡帧的片子用 --mix 合轨` : "";
  report(audioNote ? "warn" : "ok", "音轨时长", `${Number(audio.duration).toFixed(3)}s${audioNote}`);

  const loudness = await run("ffmpeg", ["-nostats", "-hide_banner", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], "stderr");
  const summary = loudness.slice(loudness.lastIndexOf("Summary:"));
  const integrated = Number(summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1]);
  const truePeak = Number(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]);
  if (!Number.isFinite(integrated)) {
    report("warn", "响度", "音轨是静音");
  } else {
    const off = Math.abs(integrated - LOUDNESS_TARGET) > LOUDNESS_TOLERANCE;
    report(off ? "warn" : "ok", "响度", `${integrated} LUFS${off ? `，目标 ${LOUDNESS_TARGET}±${LOUDNESS_TOLERANCE}，调 <Audio volume>、配音增益或混音的响度` : ""}`);
    const hot = truePeak > TRUE_PEAK_MAX;
    report(hot ? "warn" : "ok", "True peak", `${truePeak} dBTP${hot ? `，超过 ${TRUE_PEAK_MAX}，转码后可能破音` : ""}`);
  }
}

console.log(`\n${path.relative(ROOT, file)}`);
for (const { level, name, detail } of results) {
  console.log(`[${LEVEL_LABEL[level]}] ${name}：${detail}`);
}
process.exit(results.some((r) => r.level === "fail") ? 1 : 0);
