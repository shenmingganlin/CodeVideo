// 表情导出与校验
//
// 用法：npm run sticker -- [Composition ID，可用 * 通配] [文件.gif] [--all] [--encoder=auto|remotion|gifski]
//   Composition ID  渲染导出成 GIF，再做校验
//   文件.gif        只校验现成的 GIF，比如剪映或 gifski 图形版导出的
//   --all           导出所有 240×240 的 Composition
//   --encoder       auto（默认）：先用 Remotion 自带的 GIF 导出，超过 500KB 再改用
//                   PNG 序列 + gifski，quality 从 90 往下降直到达标。remotion / gifski：只用指定的一种。
//                   要写成 --encoder=gifski，不能用空格隔开
//
// 产物放在 out/stickers/：<id>.gif，以及 <id>.preview.png（浅色底、深色底各一排抽帧，用来查白边）。
// 校验现成的 GIF 时预览图也放这里，文件名跟着 GIF 走

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  openBrowser,
  renderFrames,
  renderMedia,
} from "@remotion/renderer";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out", "stickers");
const FRAMES_DIR = path.join(ROOT, "out", ".frames");
// 只用 tools 里的命令行版。C:\Program Files\gifski 是图形版，从命令行调用会弹窗卡住
const GIFSKI = path.join(ROOT, "tools", "gifski", "gifski.exe");
const SIZE = 240;
// 微信表情上限 500KB，这里按 500×1000 字节算，留一点余量
const MAX_BYTES = 500 * 1000;
const GIFSKI_QUALITIES = [90, 80, 70, 60, 50];
// 微信聊天的浅色、深色背景
const BACKGROUNDS = ["EDEDED", "111111"];
const LEVEL_LABEL = { ok: "通过", warn: "注意", fail: "不合格" };

const USAGE =
  "用法：npm run sticker -- [Composition ID，可用 * 通配] [文件.gif] [--all] [--encoder=auto|remotion|gifski]";
const usageError = (message) => {
  if (message) console.error(message);
  console.error(USAGE);
  process.exit(1);
};

const args = process.argv.slice(2);
const isGif = (arg) => /\.gif$/i.test(arg);
const files = args.filter(isGif);
const patterns = args.filter((arg) => !arg.startsWith("--") && !isGif(arg));
const exportAll = args.includes("--all");
const encoder =
  args.find((arg) => arg.startsWith("--encoder="))?.split("=")[1] ?? "auto";

// 不认识的选项直接报错，免得写错了被悄悄忽略
for (const arg of args.filter((a) => a.startsWith("--"))) {
  if (arg === "--encoder") {
    // 空格隔开时后面的值会被当成 Composition ID
    usageError("--encoder 要用等号连着写，比如 --encoder=gifski");
  }
  if (arg !== "--all" && !arg.startsWith("--encoder=")) {
    usageError(`不认识的选项 ${arg}`);
  }
}
if (!["auto", "remotion", "gifski"].includes(encoder)) {
  usageError(`--encoder 只能是 auto、remotion 或 gifski，现在是「${encoder}」`);
}
if (!exportAll && patterns.length === 0 && files.length === 0) usageError();

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} KB`;
const fileSize = async (file) => (await fs.stat(file)).size;

// 运行外部命令，失败时带上 stderr；capture 为 true 时返回 stdout
const run = (cmd, cmdArgs, capture = false) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: ["ignore", capture ? "pipe" : "ignore", "pipe"],
    });
    const chunks = [];
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 120_000);
    child.stdout?.on("data", (data) => chunks.push(data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else
        reject(
          new Error(
            `${path.basename(cmd)} 失败（退出码 ${code}）：${stderr.trim()}`,
          ),
        );
    });
  });

// 解析 GIF 结构：尺寸、每帧延时（1/100 秒）、循环次数。
// 是否透明不看这里的透明色标记：ffmpeg 导出的不透明 GIF 也会用透明色做帧间优化，要看解码后的像素
const inspectGif = (buf) => {
  const header = buf.toString("latin1", 0, 6);
  if (header !== "GIF89a" && header !== "GIF87a") {
    throw new Error("不是 GIF 文件");
  }
  const colorTableSize = (flags) =>
    flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0;
  let pos = 13 + colorTableSize(buf[10]);
  const skipSubBlocks = () => {
    while (buf[pos] !== 0) pos += buf[pos] + 1;
    pos += 1;
  };
  const delays = [];
  let loopCount = null;
  let delay = 0;
  while (pos < buf.length && buf[pos] !== 0x3b) {
    const block = buf[pos++];
    if (block === 0x2c) {
      // 图像描述符 9 字节 + 局部色表 + LZW 最小码长 1 字节，后面是图像数据块
      pos += 9 + colorTableSize(buf[pos + 8]) + 1;
      skipSubBlocks();
      delays.push(delay);
      delay = 0;
    } else if (block === 0x21) {
      const label = buf[pos++];
      if (label === 0xf9) {
        delay = buf.readUInt16LE(pos + 2);
      } else if (
        label === 0xff &&
        buf.toString("latin1", pos + 1, pos + 12) === "NETSCAPE2.0"
      ) {
        const sub = pos + 1 + buf[pos];
        if (buf[sub] >= 3 && buf[sub + 1] === 1) {
          loopCount = buf.readUInt16LE(sub + 2);
        }
      }
      skipSubBlocks();
    } else {
      throw new Error(`GIF 结构无法解析（偏移 ${pos - 1}）`);
    }
  }
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
    frames: delays.length,
    // 文件里写的原值，校验帧时长用
    rawDelays: delays,
    // 0 按浏览器的做法当 10/100 秒，算总时长和预览图用，免得帧率算成无穷大
    delays: delays.map((d) => (d === 0 ? 10 : d)),
    loopCount,
  };
};

// 把一帧 RGBA 合成到黑底，再按 4×4 取平均。
// gifski 的抖动噪点每帧都不一样，直接逐像素比会误报接缝；平均后噪点抵消，真正的跳变还在
const BLOCK = 4;
const toThumb = (raw, offset, width, height) => {
  const w = Math.floor(width / BLOCK);
  const h = Math.floor(height / BLOCK);
  const thumb = new Float32Array(w * h * 3);
  for (let y = 0; y < h * BLOCK; y++) {
    for (let x = 0; x < w * BLOCK; x++) {
      const i = offset + (y * width + x) * 4;
      const alpha = raw[i + 3] / 255 / (BLOCK * BLOCK);
      const o = (Math.floor(y / BLOCK) * w + Math.floor(x / BLOCK)) * 3;
      thumb[o] += raw[i] * alpha;
      thumb[o + 1] += raw[i + 1] * alpha;
      thumb[o + 2] += raw[i + 2] * alpha;
    }
  }
  return thumb;
};

// 解码成原始 RGBA 帧（已按 GIF 的处置方式合成好，就是播放时看到的画面）
const decodeFrames = async (gif, { width, height }) => {
  const raw = await run(
    "ffmpeg",
    ["-v", "error", "-i", gif, "-fps_mode", "passthrough"]
      .concat(["-f", "rawvideo", "-pix_fmt", "rgba", "-"]),
    true,
  );
  return { raw, width, height, count: Math.floor(raw.length / (width * height * 4)) };
};

// 解码后的画面里有没有透明像素，有才算透明背景
const hasAlpha = ({ raw, width, height, count }) => {
  const end = count * width * height * 4;
  for (let i = 3; i < end; i += 4) if (raw[i] < 255) return true;
  return false;
};

// 算相邻两帧的平均差异。
// 最后一帧回到第一帧那一步明显大于平时的话，循环播放时会跳一下
const measureSeam = ({ raw, width, height, count }) => {
  const frameBytes = width * height * 4;
  if (count < 3) return null;
  const thumbs = Array.from({ length: count }, (_, i) =>
    toThumb(raw, i * frameBytes, width, height),
  );
  const diff = (a, b) => {
    let sum = 0;
    for (let i = 0; i < thumbs[a].length; i++) {
      sum += Math.abs(thumbs[a][i] - thumbs[b][i]);
    }
    return sum / thumbs[a].length;
  };
  // 只统计真正在动的帧，停顿的帧不拉低基准
  const moving = [];
  for (let i = 0; i < count - 1; i++) {
    const step = diff(i, i + 1);
    if (step > 0.05) moving.push(step);
  }
  moving.sort((x, y) => x - y);
  const typical = moving.length > 0 ? moving[Math.floor(moving.length / 2)] : 0;
  const seam = diff(count - 1, 0);
  if (typical === 0) return seam > 0.5 ? Infinity : 1;
  return seam / typical;
};

// timing 是 Composition 的 { fps, durationInFrames }；校验现成文件时为 null，
// 这时以 GIF 自己最短的帧时长为基准
const runChecks = (info, bytes, seamRatio, timing) => {
  const base = timing ? 100 / timing.fps : Math.min(...info.delays);
  const total = info.delays.reduce((a, b) => a + b, 0);
  const seconds = `${(total / 100).toFixed(2)} 秒`;
  const zeros = info.rawDelays.filter((d) => d === 0).length;
  let timingCheck;
  if (zeros > 0) {
    timingCheck = [
      "fail",
      `有 ${zeros} 帧的帧时长是 0，浏览器按 10/100 秒播放，别的客户端可能不一样；按 10/100 秒算共 ${seconds}`,
    ];
  } else if (info.rawDelays.some((d) => d < 4)) {
    // 只允许 20 或 25fps（每帧 5 或 4/100 秒）。50fps 的 GIF 文件合法，
    // 但微信会把 2/100 秒的帧往上取整，实测整个慢一倍
    timingCheck = [
      "fail",
      "有短于 4/100 秒的帧（超过 25fps），微信会拖慢播放，改用 20 或 25fps",
    ];
  } else if (!Number.isInteger(base)) {
    timingCheck = [
      "warn",
      `${timing.fps}fps 换算不成整数的 1/100 秒，节奏会忽快忽慢，改用 20 或 25fps`,
    ];
  } else if (base !== 4 && base !== 5) {
    timingCheck = [
      "warn",
      `每帧 ${base}/100 秒（${+(100 / base).toFixed(1)}fps），表情只用 20 或 25fps（每帧 5 或 4/100 秒），共 ${seconds}`,
    ];
  } else if (
    info.delays.every((d) => d % base === 0) &&
    (!timing || total === timing.durationInFrames * base)
  ) {
    timingCheck = ["ok", `每帧 ${base}/100 秒，共 ${seconds}`];
  } else {
    timingCheck = ["warn", `帧时长不一致，共 ${seconds}`];
  }
  const loopText =
    info.loopCount === 0
      ? "无限循环"
      : info.loopCount === null
        ? "只播一次"
        : `只重复 ${info.loopCount} 次`;
  const seamOk = seamRatio === null || seamRatio <= 2.5;
  const seamText =
    seamRatio === null
      ? "帧太少，跳过"
      : seamOk
        ? "衔接自然"
        : `最后一帧回到第一帧的变化是平时的 ${Number.isFinite(seamRatio) ? seamRatio.toFixed(1) : "很多"} 倍，循环会跳一下`;
  return [
    ["尺寸", info.width === SIZE && info.height === SIZE ? "ok" : "fail", `${info.width}×${info.height}`],
    ["体积", bytes <= MAX_BYTES ? "ok" : "fail", `${kb(bytes)}，上限 ${kb(MAX_BYTES)}`],
    ["循环", info.loopCount === 0 ? "ok" : "fail", loopText],
    ["帧数", info.frames > 1 ? "ok" : "warn", info.frames > 1 ? `${info.frames} 帧` : "只有 1 帧，是静态图"],
    ["帧时长", ...timingCheck],
    ["首尾接缝", seamOk ? "ok" : "warn", seamText],
  ];
};

// 预览图：浅色底、深色底各一排，均匀抽最多 6 帧
const makePreview = (gif, preview, { width, height, fps, frameCount }) => {
  const cols = Math.min(6, frameCount);
  const step = Math.max(1, Math.floor(frameCount / cols));
  const seconds = (frameCount / fps + 0.5).toFixed(2);
  const inputs = BACKGROUNDS.map((_, i) => `[g${i}]`).join("");
  const rows = BACKGROUNDS.map((_, i) => `[row${i}]`).join("");
  const filter = [`[0:v]split=${BACKGROUNDS.length}${inputs}`];
  BACKGROUNDS.forEach((hex, i) => {
    filter.push(
      `color=c=0x${hex}:s=${width}x${height}:r=${fps}:d=${seconds}[bg${i}]`,
      `[bg${i}][g${i}]overlay=shortest=1:format=rgb,select='not(mod(n\\,${step}))',tile=${cols}x1[row${i}]`,
    );
  });
  filter.push(`${rows}vstack=inputs=${BACKGROUNDS.length}`);
  return run("ffmpeg", [
    ...["-v", "error", "-y", "-i", gif],
    ...["-filter_complex", filter.join(";"), "-frames:v", "1", preview],
  ]);
};

// 校验一个 GIF、生成预览图并打印结果，返回是否全部达标
const report = async (title, gif, timing) => {
  const info = inspectGif(await fs.readFile(gif));
  const decoded = await decodeFrames(gif, info);
  const checks = runChecks(info, await fileSize(gif), measureSeam(decoded), timing);
  // 先打印结论，预览图出错也不影响
  console.log(`${title}${hasAlpha(decoded) ? "，透明背景" : ""}`);
  for (const [label, level, detail] of checks) {
    console.log(`  [${LEVEL_LABEL[level]}] ${label}：${detail}`);
  }
  const base = timing ? 100 / timing.fps : Math.min(...info.delays);
  const total = info.delays.reduce((a, b) => a + b, 0);
  // 预览图统一放 out/stickers/，校验现成文件时也不往原文件旁边写
  const preview = path.join(OUT_DIR, path.basename(gif).replace(/\.gif$/i, ".preview.png"));
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
    await makePreview(gif, preview, {
      width: info.width,
      height: info.height,
      fps: timing?.fps ?? 100 / base,
      frameCount: timing?.durationInFrames ?? Math.round(total / base),
    });
    console.log(`  预览：${path.relative(ROOT, preview)}`);
  } catch (err) {
    console.log(`  预览：没生成，${err.message}`);
  }
  return checks.every(([, level]) => level !== "fail");
};

const pickCompositions = (all) => {
  const stickers = all.filter((c) => c.width === SIZE && c.height === SIZE);
  if (exportAll) return stickers;
  const picked = [];
  for (const pattern of patterns) {
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`^${escaped.join(".*")}$`);
    const hits = stickers.filter((c) => re.test(c.id));
    if (hits.length === 0) {
      const other = all.find((c) => re.test(c.id));
      const known = stickers.map((c) => c.id).join("、") || "无";
      throw new Error(
        other
          ? `「${other.id}」是 ${other.width}×${other.height}，不是 240×240 的表情 Composition`
          : `找不到 Composition「${pattern}」。现有的 240×240 Composition：${known}`,
      );
    }
    for (const hit of hits) if (!picked.includes(hit)) picked.push(hit);
  }
  return picked;
};

// 渲染 PNG 序列，再用 gifski 编码；quality 从高往低试，直到体积达标
const encodeWithGifski = async (serveUrl, browser, comp, gif) => {
  try {
    await fs.access(GIFSKI);
  } catch {
    throw new Error(`找不到 ${path.relative(ROOT, GIFSKI)}，gifski 命令行版要放在这里`);
  }
  const dir = path.join(FRAMES_DIR, comp.id);
  await fs.rm(dir, { recursive: true, force: true });
  try {
    await renderFrames({
      serveUrl,
      composition: comp,
      imageFormat: "png",
      outputDir: dir,
      inputProps: {},
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
      puppeteerInstance: browser,
      logLevel: "error",
    });
    const frames = (await fs.readdir(dir))
      .filter((name) => name.endsWith(".png"))
      .sort()
      .map((name) => path.join(dir, name));
    for (const quality of GIFSKI_QUALITIES) {
      await run(GIFSKI, [
        ...["--quiet", "--fps", String(comp.fps), "--quality", String(quality)],
        ...["-o", gif, ...frames],
      ]);
      if ((await fileSize(gif)) <= MAX_BYTES) return `gifski，quality ${quality}`;
    }
    return `gifski，quality 降到 ${GIFSKI_QUALITIES.at(-1)} 仍超限`;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const exportStickers = async () => {
  console.log("打包 Remotion 工程…");
  // Node API 不读 remotion.config.ts，这里要自己打开 Rspack
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    rspack: true,
  });
  await ensureBrowser();
  const browser = await openBrowser("chrome");
  let allPassed = true;
  try {
    const compositions = pickCompositions(
      await getCompositions(serveUrl, { inputProps: {}, puppeteerInstance: browser }),
    );
    await fs.mkdir(OUT_DIR, { recursive: true });
    for (const comp of compositions) {
      const gif = path.join(OUT_DIR, `${comp.id}.gif`);
      console.log(`\n渲染 ${comp.id}（${comp.durationInFrames} 帧，${comp.fps}fps）…`);
      let used = "Remotion 自带导出";
      if (encoder !== "gifski") {
        await renderMedia({
          serveUrl,
          composition: comp,
          codec: "gif",
          imageFormat: "png",
          outputLocation: gif,
          overwrite: true,
          puppeteerInstance: browser,
          logLevel: "error",
        });
      }
      if (encoder === "gifski" || (encoder === "auto" && (await fileSize(gif)) > MAX_BYTES)) {
        if (encoder === "auto") {
          console.log(`  自带导出 ${kb(await fileSize(gif))}，超过上限，改用 gifski`);
        }
        used = await encodeWithGifski(serveUrl, browser, comp, gif);
      }
      const title = `${comp.id} → ${path.relative(ROOT, gif)}（${used}）`;
      allPassed = (await report(title, gif, comp)) && allPassed;
    }
  } finally {
    await browser.close({ silent: true });
    await fs.rm(FRAMES_DIR, { recursive: true, force: true });
    // bundle 会在系统临时目录里复制一份 public/，用完删掉，免得越积越多
    if (serveUrl.startsWith(os.tmpdir())) {
      await fs.rm(serveUrl, { recursive: true, force: true });
    }
  }
  return allPassed;
};

try {
  let allPassed = true;
  for (const file of files) {
    const gif = path.resolve(file);
    allPassed = (await report(`校验 ${path.relative(ROOT, gif)}`, gif, null)) && allPassed;
  }
  if (exportAll || patterns.length > 0) {
    allPassed = (await exportStickers()) && allPassed;
  }
  if (!allPassed) process.exitCode = 1;
} catch (err) {
  console.error(`\n出错：${err.message}`);
  process.exitCode = 1;
}
