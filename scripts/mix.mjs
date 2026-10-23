// 合成一个作品的配乐、音效和配音混音：timeline.json → 成片要合进去的 fullmix.wav
//
// 用法：npm run mix -- <作品目录>
//   例：npm run mix -- src/videos/foo
//
// 依次运行：
// 1. scripts/make_score.py：timeline.json → audio/score.json
// 2. motioner 的 synth_score.py：score.json → audio/synth/（music.wav、sfx/*.wav、cues.json）
// 3. motioner 的 build_mix.py：synth/cues.json → audio/mix.wav，以及 mix.cues.json（对帧用）、mix.cues.md、mix.timeline.png
// 4. scripts/voice_mix.py：铺上配音（没有配音就只做母带）→ public/<作品>/audio/fullmix.wav
// WAV 都不进 git，新克隆的仓库跑一遍就能重建；score.json、cues 这些文本跟着提交。
// 只改了 timeline.json 的 voiceMix 时，单独跑第 4 步就够了
//
// 2、3 两步在 motioner 技能目录里，技能目录怎么找见 motioner-dir.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findMotioner } from "./motioner-dir.mjs";

const ROOT = process.cwd();
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const workArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!workArg) fail("用法：npm run mix -- <作品目录>，比如 src/videos/foo");
const work = path.resolve(ROOT, workArg);
if (!fs.existsSync(path.join(work, "timeline.json"))) fail(`${workArg} 下没有 timeline.json`);
const rel = path.relative(path.join(ROOT, "src"), work);
if (rel.startsWith("..") || path.isAbsolute(rel)) fail(`${workArg} 不在 src/ 下面，没法确定混音放在 public/ 的哪里`);

const python = path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!fs.existsSync(python)) fail("没有 .venv，先运行 uv sync");
const motioner = findMotioner();
if (!motioner) fail("找不到 motioner 技能目录。它是桌面版的账号技能；装在别处时设 MOTIONER_DIR（指向含 scripts/ 的 motioner 目录）");

const run = (label, script, scriptArgs) =>
  new Promise((resolve, reject) => {
    console.log(`\n== ${label}`);
    // PYTHONUTF8：Windows 上 Python 默认按 GBK 输出，中文会乱码
    const env = { ...process.env, PYTHONUTF8: "1" };
    const child = spawn(python, [script, ...scriptArgs], { cwd: ROOT, stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : fail(`${path.basename(script)} 没跑完（退出码 ${code}），看上面的报错`)));
  });

// 参数用相对仓库根目录的路径：build_mix.py 会把 --out 原样写进要提交的 mix.cues.json，绝对路径会带出本机目录
const audio = path.relative(ROOT, path.join(work, "audio"));
await run("总谱：timeline.json → audio/score.json", path.join(ROOT, "scripts", "make_score.py"), [path.relative(ROOT, work)]);
await run("合成音乐和音效", path.join(motioner, "scripts", "synth_score.py"), [
  path.join(audio, "score.json"),
  "--out",
  path.join(audio, "synth"),
]);
await run("按帧混音", path.join(motioner, "scripts", "build_mix.py"), [
  path.join(audio, "synth", "cues.json"),
  "--out",
  path.join(audio, "mix.wav"),
]);
await run("配音和母带", path.join(ROOT, "scripts", "voice_mix.py"), [path.relative(ROOT, work)]);

const fullmix = path.posix.join("public", rel.split(path.sep).join("/"), "audio", "fullmix.wav");
console.log(`\n下一步：npm run video -- <Composition ID> --mix=${fullmix}`);
console.log(`然后：npm run review -- ${workArg} out/<Composition ID>.mp4`);
