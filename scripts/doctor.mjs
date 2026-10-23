// 环境预检：换了电脑、升级了工具、渲染莫名报错时先跑一遍
//
// 用法：npm run doctor
//
// 只检查工具在不在、版本对不对、.env 填没填，不联网、不渲染。.env 里的 Key 只看有没有，不打印

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { findMotioner } from "./motioner-dir.mjs";

const ROOT = process.cwd();
const LEVEL_LABEL = { ok: "通过", warn: "注意", fail: "不合格" };
const results = [];
const report = (level, name, detail) => results.push({ level, name, detail });

// 运行命令，返回 stdout + stderr；命令不存在或失败时返回 null
const output = (cmd, args) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.on("data", (data) => (text += data));
    child.stderr.on("data", (data) => (text += data));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? text : null);
    });
  });
const firstLine = (text) => text.trim().split(/\r?\n/)[0];
// Python 的导入警告会混在输出前面，结果取最后一行
const lastLine = (text) => text.trim().split(/\r?\n/).at(-1);

// Node：和 package.json 的 engines 一致（^20.19 || ^22.13 || >=24），.env 用的 process.loadEnvFile 也在这些版本里
const [major, minor] = process.versions.node.split(".").map(Number);
const nodeOk = major >= 24 || (major === 22 && minor >= 13) || (major === 20 && minor >= 19);
report(nodeOk ? "ok" : "fail", "Node", `v${process.versions.node}${nodeOk ? "" : "，要 20.19+、22.13+ 或 24+"}`);
const installed = fs.existsSync(path.join(ROOT, "node_modules", "remotion"));
report(installed ? "ok" : "fail", "node_modules", installed ? "已安装" : "没装，运行 npm install");

for (const tool of ["ffmpeg", "ffprobe"]) {
  const text = await output(tool, ["-version"]);
  if (!text) {
    report("fail", tool, "不在 PATH 上");
    continue;
  }
  // sticker.mjs 用了 -fps_mode，要 FFmpeg 5.1 以上
  const version = text.match(/version (\d+)\.(\d+)/);
  const recent = version && (Number(version[1]) > 5 || (Number(version[1]) === 5 && Number(version[2]) >= 1));
  report(recent ? "ok" : "warn", tool, `${version ? `${version[1]}.${version[2]}` : firstLine(text)}${recent ? "" : "（要 5.1 以上）"}`);
}

const gifski = path.join(ROOT, "tools", "gifski", "gifski.exe");
const gifskiVersion = fs.existsSync(gifski) ? await output(gifski, ["--version"]) : null;
report(gifskiVersion ? "ok" : "fail", "gifski", gifskiVersion ? firstLine(gifskiVersion) : "tools/gifski/gifski.exe 不在或运行不了");

const uv = await output("uv", ["--version"]);
report(uv ? "ok" : "fail", "uv", uv ? firstLine(uv) : "不在 PATH 上");
if (uv) {
  const py = await output("uv", [
    "run", "python", "-c",
    "import edge_tts, manim, PIL, numpy, scipy; print(f'edge-tts {edge_tts.__version__}, Manim {manim.__version__}, Pillow {PIL.__version__}, NumPy {numpy.__version__}, SciPy {scipy.__version__}')",
  ]);
  report(py ? "ok" : "fail", "Python 依赖", py ? lastLine(py) : "导入失败，运行 uv sync");
}

// motioner 是桌面版的账号技能，npm run review 要用它的脚本
const motioner = findMotioner();
report(motioner ? "ok" : "warn", "motioner 技能", motioner ?? "没找到，终端里的 claude 没有它；npm run review 要设 MOTIONER_DIR");

// Manim 的 MathTex 要 latex 和 dvisvgm
for (const tool of ["latex", "dvisvgm"]) {
  const text = await output(tool, ["--version"]);
  report(text ? "ok" : "warn", tool, text ? firstLine(text) : "不在 PATH 上，Manim 的公式会失败");
}

report(
  fs.existsSync(path.join(ROOT, "public", "fonts", "NotoSansSC-VF.ttf")) ? "ok" : "fail",
  "默认字体",
  "public/fonts/NotoSansSC-VF.ttf",
);

// 生图：只看 .env 里三项填没填
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  const env = Object.fromEntries(
    fs.readFileSync(envFile, "utf8").split(/\r?\n/).map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
  );
  const missing = ["IMAGE_API_BASE", "IMAGE_API_MODEL", "IMAGE_API_KEY"].filter((key) => !env[key]);
  report(missing.length ? "warn" : "ok", "生图配置", missing.length ? `.env 缺 ${missing.join("、")}` : ".env 已填");
} else {
  report("warn", "生图配置", "没有 .env，要生图就照 .env.example 建一个");
}

// Studio 端口只是提示：开着 Studio 不影响渲染
const studioOpen = await new Promise((resolve) => {
  const socket = net.connect(3100, "127.0.0.1");
  socket.on("connect", () => (socket.destroy(), resolve(true)));
  socket.on("error", () => resolve(false));
});
report("ok", "Studio", studioOpen ? "3100 端口上开着" : "没开（npm run dev）");

for (const { level, name, detail } of results) {
  console.log(`[${LEVEL_LABEL[level]}] ${name}：${detail}`);
}
const failed = results.filter((r) => r.level === "fail").length;
console.log(failed ? `\n${failed} 项不合格` : "\n环境正常");
process.exit(failed ? 1 : 0);
