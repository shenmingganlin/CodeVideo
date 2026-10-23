// 找 motioner 技能目录：npm run review 用它的 Python 脚本，npm run doctor 检查它在不在
//
// 它是 Claude 桌面版的账号技能，放在 <LocalAppData>/Claude-3p（或 Claude）/local-agent-mode-sessions/
// skills-plugin/<组织>/<账号>/skills/motioner，路径里的 ID 会变，所以每次现找。
// 也认 ~/.claude/skills/motioner；都不对时设环境变量 MOTIONER_DIR
// 直接运行（node scripts/motioner-dir.mjs）时打印目录，找不到就退出码 1，给 Python 脚本用

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const listDirs = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
};

const isMotioner = (dir) => fs.existsSync(path.join(dir, "scripts", "transition_review.py"));

export const findMotioner = () => {
  // 设了就只认它：设错了宁可报找不到，不悄悄换成别的目录
  if (process.env.MOTIONER_DIR) return isMotioner(process.env.MOTIONER_DIR) ? process.env.MOTIONER_DIR : undefined;
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const skillRoots = [path.join(os.homedir(), ".claude", "skills")];
  for (const app of ["Claude-3p", "Claude"]) {
    for (const org of listDirs(path.join(local, app, "local-agent-mode-sessions", "skills-plugin"))) {
      for (const account of listDirs(org)) skillRoots.push(path.join(account, "skills"));
    }
  }
  // 有多份时用最近更新的那份
  return skillRoots
    .map((root) => path.join(root, "motioner"))
    .filter(isMotioner)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dir = findMotioner();
  if (!dir) process.exit(1);
  console.log(dir);
}
