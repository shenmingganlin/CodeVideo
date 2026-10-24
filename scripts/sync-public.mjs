// 把工作台同步到公开仓库：从私有仓库的一个提交里挑出白名单里的文件，拼成一个提交，推到公开仓库的 main
//
// 用法：npm run sync-public [-- --push] [--ref=main] [--message=<说明>]…
//   不带 --push 是预演：列出发布什么、相对公开仓库改了什么，不推送
//   --ref 缺省是 main；只发布已经提交的内容，工作区没提交的改动不算
//   --message 写公开仓库的提交说明，可以写多个（各成一段），缺省是"同步工作台"
//
// 两个仓库：
// - origin：私有仓库，工作台 + 作品 + 素材，平时的提交、推送、PR 都在这里
// - public：公开仓库，只有工作台，只用这个脚本往里写，两边的历史互不相干
// 作品（src/videos/*、src/stickers/* 和 public/ 下对应的素材）只在私有仓库；灵感本、素材清单只发布表头。
// 白名单和作品目录都没覆盖的文件不发布，脚本会列出来：是工作台就加进 PUBLISH，是作品就加进 PRIVATE。
// 公开仓库的提交说明只写工作台改了什么，别带作品名和作品内容

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// 原样发布：以 / 结尾的是目录
const PUBLISH = [
  ".claude/launch.json",
  ".claude/settings.json",
  ".env.example",
  ".gitignore",
  ".prettierrc",
  "CLAUDE.md",
  "LICENSE",
  "README.md",
  "techniques.md",
  "guides/",
  "eslint.config.mjs",
  "package.json",
  "package-lock.json",
  "pyproject.toml",
  "uv.lock",
  "remotion.config.ts",
  "tsconfig.json",
  "scripts/",
  "src/Root.tsx",
  "src/index.ts",
  "src/private.d.ts",
  "src/shared/",
  "src/templates/",
  "src/checks/",
  "src/gallery/",
  "src/videos/README.md",
  "src/stickers/README.md",
  "src/private/README.md",
  "public/fonts/",
  "public/checks/",
  /^public\/library\/[^/]+\/\.gitkeep$/,
];
// 只发布表头：Markdown 表格去掉数据行，说明文字和表头留着
const SKELETON = ["ideas.md", "public/library/index.md"];
// 作品和素材，只留在私有仓库
const PRIVATE = ["decks/", "src/videos/", "src/stickers/", "src/private/", "public/videos/", "public/stickers/", "public/private/", "public/library/"];

const USAGE = "用法：npm run sync-public [-- --push] [--ref=main] [--message=<说明>]";
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const git = (args, { input, env } = {}) => {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["pipe", "pipe", "pipe"],
      input,
      env,
    });
  } catch (err) {
    throw new Error(`git ${args.join(" ")} 失败：${(err.stderr || err.message).trim()}`);
  }
};
const tryGit = (args) => {
  try {
    return git(args).trim();
  } catch {
    return null;
  }
};

const matches = (rules, file) =>
  rules.some((rule) => (rule instanceof RegExp ? rule.test(file) : rule.endsWith("/") ? file.startsWith(rule) : file === rule));

const skeleton = (text) => {
  const lines = [];
  let inTable = false;
  for (const line of text.split("\n")) {
    if (!line.trimStart().startsWith("|")) inTable = false;
    else if (inTable) continue;
    else if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) inTable = true; // 分隔行之后都是数据行
    lines.push(line);
  }
  return lines.join("\n");
};

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg !== "--push" && !/^--(ref|message)=/.test(arg)) fail(`不认识的参数 ${arg}。${USAGE}`);
}
const option = (name) => args.filter((arg) => arg.startsWith(`--${name}=`)).map((arg) => arg.slice(name.length + 3));
const push = args.includes("--push");
const ref = option("ref").at(-1) ?? "main";
const messages = option("message").filter(Boolean);

// 两个 remote 要分开：origin 指向公开仓库的话，平时一推送作品就公开了
const sameRepo = (a, b) => a.replace(/(\.git)?\/?$/, "").toLowerCase() === b.replace(/(\.git)?\/?$/, "").toLowerCase();
const publicUrl = tryGit(["remote", "get-url", "public"]);
if (!publicUrl) fail("没有叫 public 的 remote，先运行 git remote add public <公开仓库地址>");
const originUrl = tryGit(["remote", "get-url", "origin"]);
if (originUrl && sameRepo(originUrl, publicUrl)) fail(`origin 和 public 是同一个仓库（${publicUrl}）。origin 应该是私有仓库，先改回来再同步`);

try {
  const commit = tryGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (!commit) fail(`找不到 ${ref}`);

  const published = [];
  const skeletons = [];
  const kept = [];
  const unknown = [];
  const entries = git(["ls-tree", "-r", "-z", "--full-tree", commit]).split("\0").filter(Boolean);
  for (const line of entries) {
    const tab = line.indexOf("\t");
    const [mode, type, sha] = line.slice(0, tab).split(" ");
    const file = line.slice(tab + 1);
    if (type !== "blob") unknown.push(file);
    else if (matches(PUBLISH, file)) published.push({ mode, sha, file });
    else if (SKELETON.includes(file)) {
      const stripped = git(["hash-object", "-w", "--stdin"], { input: skeleton(git(["cat-file", "blob", sha])) }).trim();
      published.push({ mode, sha: stripped, file });
      skeletons.push(file);
    } else if (matches(PRIVATE, file)) kept.push(file);
    else unknown.push(file);
  }

  // 用临时索引拼树，不碰工作区和真正的索引
  const indexFile = path.join(os.tmpdir(), `sync-public-${process.pid}.index`);
  let tree;
  try {
    const env = { ...process.env, GIT_INDEX_FILE: indexFile };
    git(["update-index", "--add", "-z", "--index-info"], { input: published.map((e) => `${e.mode} ${e.sha}\t${e.file}\0`).join(""), env });
    tree = git(["write-tree"], { env }).trim();
  } finally {
    fs.rmSync(indexFile, { force: true });
    fs.rmSync(`${indexFile}.lock`, { force: true });
  }

  console.log(`来源：${ref}（${git(["log", "-1", "--format=%h %s", commit]).trim()}）`);
  console.log(`发布 ${published.length} 个文件，${skeletons.join("、")} 只发布表头；作品和素材 ${kept.length} 个文件留在私有仓库`);
  if (unknown.length > 0) {
    console.log("\n[注意] 这些文件不在白名单里，也不在作品目录里，没有发布：");
    for (const file of unknown) console.log(`  ${file}`);
    console.log("是工作台就加进 scripts/sync-public.mjs 的 PUBLISH，是作品就加进 PRIVATE");
  }

  console.log(`\n拉取公开仓库 ${publicUrl}`);
  let parent = null;
  if (git(["ls-remote", "public", "refs/heads/main"]).trim()) {
    git(["fetch", "--quiet", "public", "main"]);
    parent = git(["rev-parse", "FETCH_HEAD"]).trim();
  }
  if (parent && git(["rev-parse", `${parent}^{tree}`]).trim() === tree) {
    console.log("公开仓库已经是最新的，不用同步");
    process.exit(0);
  }
  if (parent) {
    console.log("相对公开仓库的变化：");
    for (const line of git(["diff-tree", "-r", "--name-status", "--no-renames", parent, tree]).trim().split("\n")) console.log(`  ${line}`);
  } else console.log("公开仓库还是空的，这是第一个提交");

  if (!push) {
    console.log(`\n这是预演，没有推送。要看完整的文件列表：git ls-tree -r --name-only ${tree}`);
    console.log("确认无误后：npm run sync-public -- --push --message=<工作台改了什么>");
    process.exit(0);
  }

  const message = messages.length > 0 ? messages.join("\n\n") : "同步工作台";
  const publishedCommit = git(["commit-tree", tree, ...(parent ? ["-p", parent] : [])], { input: `${message}\n` }).trim();
  execFileSync("git", ["push", "public", `${publishedCommit}:refs/heads/main`], { stdio: "inherit" });
  git(["fetch", "--quiet", "public"]);
  console.log(`\n已推送到公开仓库：${publicUrl}`);
} catch (err) {
  fail(err.message);
}
