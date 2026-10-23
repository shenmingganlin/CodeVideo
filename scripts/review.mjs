// 成片审查：motioner 的逐个转场审查 + 音效对帧
//
// 用法：npm run review -- <作品目录> <成片.mp4> [--only=transitions|sync] [--mix=<混音.wav>]
//   例：npm run review -- src/videos/foo out/Foo.mp4
//   只重混了声音时用 --only=sync，省掉几分钟的转场审查
//
// 1. 转场：读作品目录 timeline.json 里的 transitions（transition_review.py 的计划格式，
//    [{name, start, end, kind, handoffs?}]），写成 out/review/<作品>/plan.json 再审查。
//    计划不另抄一份，免得和时间线对不上。审查图、overview.png、report.json 都在 out/review/<作品>/
// 2. 音效：作品目录有 audio/mix.cues.json 时跑 sync_check.py。先测合进成片的那条混音当基线，
//    再测成片，逐条和基线比：差不超过半帧（至少 12ms）就算对上。基线缺省是 voice_mix.py 出的
//    public/<作品>/audio/fullmix.wav，没有它再用 audio/mix.wav，别的混音用 --mix 指定。
//    只看成片的绝对偏差不行：合成音效的起音点本身就可能偏一点，配音盖住的地方也会匹配偏，
//    这些在基线里一样偏，成片和基线对得上就说明合轨没出错
//
// 脚本在 motioner 技能目录的 scripts/ 下，用 .venv 的 Python 运行。技能目录怎么找见 motioner-dir.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findMotioner } from "./motioner-dir.mjs";

const ROOT = process.cwd();
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [workArg, filmArg] = args.filter((arg) => !arg.startsWith("--"));
if (!workArg || !filmArg) fail("用法：npm run review -- <作品目录> <成片.mp4> [--only=transitions|sync] [--mix=<混音.wav>]");
const only = option("only");
if (only && !["transitions", "sync"].includes(only)) fail("--only 只能是 transitions 或 sync");
const work = path.resolve(ROOT, workArg);
const film = path.resolve(ROOT, filmArg);
if (!fs.existsSync(film)) fail(`找不到成片 ${filmArg}`);
const timelineFile = path.join(work, "timeline.json");
const timeline = fs.existsSync(timelineFile) ? JSON.parse(fs.readFileSync(timelineFile, "utf8")) : null;
if (only !== "sync") {
  if (!timeline) fail(`${path.relative(ROOT, timelineFile)} 不存在，转场计划要写在作品的时间线里`);
  if (!Array.isArray(timeline.transitions) || timeline.transitions.length === 0) {
    fail("timeline.json 里没有 transitions：每道场景边界写一条 {name, start, end, kind}，变形再加 handoffs");
  }
}

const python = path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!fs.existsSync(python)) fail("没有 .venv，先运行 uv sync");

const motioner = findMotioner();
if (!motioner) fail("找不到 motioner 技能目录。它是桌面版的账号技能；装在别处时设 MOTIONER_DIR（指向含 scripts/ 的 motioner 目录）");
const skillScript = (name) => path.join(motioner, "scripts", name);

// 运行 Python 脚本，输出直接打到终端。0 是全部通过，1 是查出了问题（转场可疑、音效偏了），
// 别的退出码或者没写出结果文件才是脚本本身出错。Python 崩溃也返回 1，所以结果文件要先删掉再跑
const run = (script, scriptArgs, result) =>
  new Promise((resolve, reject) => {
    fs.rmSync(result, { force: true });
    // PYTHONUTF8：Windows 上 Python 默认按 GBK 输出，中文标签会乱码
    const env = { ...process.env, PYTHONUTF8: "1" };
    const child = spawn(python, [skillScript(script), ...scriptArgs], { cwd: ROOT, stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => {
      if ((code === 0 || code === 1) && fs.existsSync(result)) resolve(code);
      else fail(`${script} 没跑完（退出码 ${code}），看上面的报错`);
    });
  });

const outDir = path.join(ROOT, "out", "review", path.basename(work));
fs.mkdirSync(outDir, { recursive: true });

if (only !== "sync") {
  // 上一次的审查图先清掉：转场改了名或删了，旧图会混在新结果里
  for (const name of fs.readdirSync(outDir)) {
    if (name.endsWith(".png") || name === "report.json") fs.rmSync(path.join(outDir, name));
  }
  const plan = path.join(outDir, "plan.json");
  fs.writeFileSync(plan, JSON.stringify(timeline.transitions, null, 1));
  console.log(`\n== 转场审查（${timeline.transitions.length} 道边界）`);
  await run("transition_review.py", [film, "--plan", plan, "--out", outDir], path.join(outDir, "report.json"));
}

const cuesFile = path.join(work, "audio", "mix.cues.json");
// 基线是合进成片的那条混音：有配音时是 fullmix.wav（src/videos/foo → public/videos/foo/audio/），否则是 mix.wav
const mixFile = option("mix")
  ? path.resolve(ROOT, option("mix"))
  : [
      path.join(ROOT, "public", path.relative(path.join(ROOT, "src"), work), "audio", "fullmix.wav"),
      path.join(work, "audio", "mix.wav"),
    ].find((file) => fs.existsSync(file));
if (option("mix") && !fs.existsSync(mixFile)) fail(`找不到混音 ${option("mix")}`);
let mismatched = 0;
if (only === "transitions") {
  // 只审转场
} else if (!fs.existsSync(cuesFile)) {
  console.log(`\n== 音效对帧：没有 ${path.relative(ROOT, cuesFile)}，跳过`);
} else {
  const cues = JSON.parse(fs.readFileSync(cuesFile, "utf8"));
  const fps = cues.fps ?? timeline?.fps;
  if (!fps) fail(`${path.relative(ROOT, cuesFile)} 里没有 fps，作品目录也没有 timeline.json`);
  const tolerance = Math.max(12, 500 / fps);
  const filmJson = path.join(outDir, "sync.json");
  const baseJson = path.join(outDir, "sync-baseline.json");
  const syncArgs = cues.fps ? [] : ["--fps", String(fps)];
  // cue 里的音效路径相对 synth_score.py 的输出目录（通常是 audio/synth/），不一定是 cues 文件旁边
  const firstFile = (Array.isArray(cues) ? cues : cues.cues)?.[0]?.file;
  const soundRoot = [path.dirname(cuesFile), path.join(path.dirname(cuesFile), "synth")].find(
    (dir) => !firstFile || path.isAbsolute(firstFile) || fs.existsSync(path.join(dir, firstFile)),
  );
  // 合成出来的 WAV 不进 git，新克隆的仓库要先重新生成
  if (!soundRoot) fail(`找不到音效文件 ${firstFile}（应在 audio/ 或 audio/synth/ 下），先运行 npm run mix -- ${workArg}`);
  syncArgs.push("--root", soundRoot);
  fs.rmSync(baseJson, { force: true });
  if (mixFile) {
    console.log(`\n== 音效对帧基线：${path.relative(ROOT, mixFile)}`);
    await run("sync_check.py", [mixFile, cuesFile, "--json", baseJson, ...syncArgs], baseJson);
  } else {
    console.log(`\n[注意] 没有 fullmix.wav 或 mix.wav 当基线，只能和计划帧比，合成音效本身的偏差也会算进来。先运行 npm run mix -- ${workArg}`);
  }
  console.log(`\n== 音效对帧：${path.relative(ROOT, film)}`);
  await run("sync_check.py", [film, cuesFile, "--json", filmJson, ...syncArgs], filmJson);

  const filmResults = JSON.parse(fs.readFileSync(filmJson, "utf8"));
  const baseResults = mixFile ? JSON.parse(fs.readFileSync(baseJson, "utf8")) : null;
  console.log(`\n== 成片和${baseResults ? "混音基线" : "计划帧"}对比（容差 ${tolerance.toFixed(0)}ms）`);
  const diffs = [];
  let checked = 0;
  let warned = 0;
  filmResults.forEach((cue, i) => {
    if (cue.status === "SKIP") return;
    checked += 1;
    // 两次跑的是同一份 cues，按下标一一对应
    const base = baseResults?.[i]?.frame === cue.frame ? baseResults[i] : undefined;
    const found = (result) => result && "offset_ms" in result && result.status !== "MASKED?";
    if (!found(cue)) {
      // 同一条混音，混音里找得到、成片里找不到，就是成片的音轨坏了（静音、截短、合错了文件）
      if (found(base)) {
        mismatched += 1;
        console.log(`[不合格] f${cue.frame} ${cue.label}：混音里有，成片里匹配不上（${cue.status}），查一下成片的音轨`);
      } else {
        warned += 1;
        console.log(`[注意] f${cue.frame} ${cue.label}：混音里也匹配不上，多半被配音或别的声音盖住，听一下这里`);
      }
      return;
    }
    const reference = found(base) ? base.offset_ms : 0;
    const diff = cue.offset_ms - reference;
    diffs.push(diff);
    if (Math.abs(diff) <= tolerance) return;
    mismatched += 1;
    const detail = baseResults ? `成片 ${cue.offset_ms}ms，混音 ${reference}ms，差 ${diff.toFixed(1)}ms` : `偏 ${diff.toFixed(1)}ms`;
    console.log(`[不合格] f${cue.frame} ${cue.label}：${detail}，匹配度 ${cue.score}`);
  });
  const sorted = [...diffs].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  console.log(`${checked - mismatched - warned}/${checked} 条对上，${mismatched} 条不合格，${warned} 条要听，中位差 ${median.toFixed(1)}ms`);
  if (Math.abs(median) > tolerance / 2) console.log("[注意] 整体偏一个常数，多半是合轨或编码的问题（比如没用 --mix，AAC priming 没补偿）");
}

console.log(`\n审查图和报告：${path.relative(ROOT, outDir)}。逐张打开看，每道转场写结论：好 / 弱 / 坏、帧号、原因`);
process.exit(mismatched ? 1 : 0);
