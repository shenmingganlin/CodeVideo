// 分镜评审页：把作品的分镜表摆进浏览器，用户逐个镜头留言，助手读留言、改分镜，循环到定稿
//
// 用法：
//   npm run board -- <作品目录>              起本地服务器（只听 127.0.0.1，从 3200 起找空端口）并打开浏览器
//   npm run board -- <作品目录> --list       列出待处理的留言和定稿状态，不用开着服务器
//   npm run board -- <作品目录> --resolve=3,4 --reply="改成从左边涌进来了"
//                                            把留言标成已处理，回复显示在页面上那条留言下面
//   加 --no-open 不开浏览器
//
// 文件都在 <作品目录>/board/，跟着作品提交进私有仓库，留着方案怎么改过来的：
//   board.json     分镜表，助手写。格式见 scripts/board/example.json
//   comments.json  留言和定稿记录，页面和命令行都写它，助手不手改
// 页面每 1.5 秒查一次：board.json 或它引用的草图变了就整页重画（输入框里没发出去的字留着），
// 只有留言变了就只重画留言。改完一轮留言把 board.json 的 round 加 1 再 --resolve；
// 用户点"定稿"记一条 approval，round 再变就算没定稿，要用户重新点

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = process.cwd();
const HERE = path.join(ROOT, "scripts", "board");
const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => args.includes(`--${name}`);
for (const arg of args.filter((a) => a.startsWith("--"))) {
  if (!["--list", "--no-open"].includes(arg) && !/^--(resolve|reply)=/.test(arg)) fail(`不认识的选项 ${arg}`);
}
const [workArg] = args.filter((arg) => !arg.startsWith("--"));
if (!workArg) fail("用法：npm run board -- <作品目录> [--list] [--resolve=<编号,…> --reply=<回复>] [--no-open]");
const work = path.resolve(ROOT, workArg);
if (!fs.existsSync(work) || !fs.statSync(work).isDirectory()) fail(`找不到作品目录 ${workArg}`);
const dir = path.join(work, "board");
const boardFile = path.join(dir, "board.json");
const commentsFile = path.join(dir, "comments.json");
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/");
const OVERALL = "_board"; // 整体留言的 target，镜头 id 不能以 _ 开头

// 页面只能取这几处的文件，.env、.git 之类的取不到
const MEDIA_ROOTS = [path.join(ROOT, "out"), path.join(ROOT, "public"), work];
const resolveMedia = (src) => {
  const file = path.resolve(ROOT, String(src));
  if (!MEDIA_ROOTS.some((root) => file.startsWith(root + path.sep))) return null;
  if (file.split(path.sep).some((part) => part.startsWith("."))) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
};
// 读分镜表。结构错了（JSON 写坏、缺 id、id 重复）算错误，页面保留上一份能用的；
// 草图文件找不到只算提醒，草图常常是后渲染的
const loadBoard = () => {
  if (!fs.existsSync(boardFile)) return { error: `${rel(boardFile)} 还没写，格式见 scripts/board/example.json` };
  let board;
  try {
    board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
  } catch (error) {
    return { error: `${rel(boardFile)} 不是合法的 JSON：${error.message}` };
  }
  if (!Array.isArray(board.shots) || board.shots.length === 0) return { error: "board.json 里没有 shots" };
  if (!Number.isInteger(board.round) || board.round < 1) return { error: "board.json 的 round 要写成从 1 开始的整数" };
  const ids = new Set();
  const warnings = [];
  for (const [i, shot] of board.shots.entries()) {
    if (typeof shot.id !== "string" || !/^[A-Za-z0-9][\w-]*$/.test(shot.id)) {
      return { error: `第 ${i + 1} 个镜头的 id 要是字母数字（不以 _ 开头），现在是 ${JSON.stringify(shot.id)}` };
    }
    if (ids.has(shot.id)) return { error: `镜头 id ${shot.id} 重复了` };
    ids.add(shot.id);
    for (const item of shot.media ?? []) {
      if (!item?.src) return { error: `镜头 ${shot.id} 的 media 每项都要有 src` };
      if (!resolveMedia(item.src)) warnings.push(`镜头 ${shot.id} 的草图 ${item.src} 找不到（只能放在 out/、public/ 或作品目录里）`);
    }
  }
  return { board, warnings };
};

const readComments = () => {
  if (!fs.existsSync(commentsFile)) return { nextId: 1, comments: [], approvals: [] };
  return JSON.parse(fs.readFileSync(commentsFile, "utf8"));
};
// 每次都读最新的再改，写临时文件再改名，页面和命令行同时写也不会写出半个文件
const updateComments = (change) => {
  const data = readComments();
  const result = change(data);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${commentsFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, commentsFile);
      break;
    } catch (error) {
      // Windows 上目标文件正被读的时候改名会报 EPERM，等一下再试
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  return result;
};
const now = () => new Date().toISOString();
const shotLabel = (board, target) => {
  if (target === OVERALL) return "整体";
  const shot = board?.shots.find((s) => s.id === target);
  return shot ? `${shot.id}${shot.title ? ` ${shot.title}` : ""}` : `${target}（镜头已删）`;
};

// 命令行：--resolve
if (option("resolve") !== undefined) {
  const ids = option("resolve").split(",").map((s) => Number(s.trim()));
  const reply = option("reply");
  if (!reply) fail("--resolve 要带 --reply=<改了什么>，回复会显示在页面上");
  if (ids.some((id) => !Number.isInteger(id))) fail("--resolve 写留言编号，逗号隔开，比如 --resolve=3,4");
  const { board } = loadBoard();
  updateComments((data) => {
    for (const id of ids) {
      const comment = data.comments.find((c) => c.id === id);
      if (!comment) fail(`没有编号 ${id} 的留言`);
      if (comment.status !== "open") fail(`留言 ${id} 已经是${comment.status === "resolved" ? "已处理" : "撤回"}的了`);
    }
    for (const id of ids) {
      Object.assign(data.comments.find((c) => c.id === id), { status: "resolved", reply, resolvedAt: now(), resolvedRound: board?.round ?? null });
    }
  });
  console.log(`已处理 ${ids.join("、")}：${reply}`);
}

// 命令行：--list（--resolve 之后也列一遍）
if (flag("list") || option("resolve") !== undefined) {
  const { board, error } = loadBoard();
  if (error) console.log(`注意：${error}`);
  const data = readComments();
  const open = data.comments.filter((c) => c.status === "open");
  console.log(`\n${board?.title ?? rel(work)}，第 ${board?.round ?? "?"} 轮`);
  console.log(open.length ? `待处理留言 ${open.length} 条：` : "没有待处理的留言");
  for (const c of open) console.log(`  [${c.id}] ${shotLabel(board, c.target)}（第 ${c.round} 轮）：${c.text}`);
  const last = data.approvals.at(-1);
  if (!last) console.log("还没定稿");
  else if (board && last.round === board.round) console.log(`已定稿：第 ${last.round} 轮，${last.at}${last.note ? `，用户说：${last.note}` : ""}`);
  else console.log(`第 ${last.round} 轮定过稿，之后分镜改到了第 ${board?.round} 轮，要用户重新点定稿`);
  process.exit(0);
}
// 服务器
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};
const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const mtime = (file) => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0);

// 视频要支持 Range，不然浏览器拖不了进度条，有的还不肯循环
const sendFile = (req, res, file) => {
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    // 先攒字节再解码：按块拼字符串的话，一个汉字跨两块就被切坏了
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 64 * 1024) reject(new Error("内容太长"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("不是 JSON"));
      }
    });
  });

// 分镜表和它引用的草图任何一个变了，版本号就变
const boardVersion = () => {
  let version = mtime(boardFile);
  const { board } = loadBoard();
  for (const shot of board?.shots ?? []) for (const item of shot.media ?? []) version = Math.max(version, mtime(resolveMedia(item.src) ?? ""));
  return version;
};

const handle = async (req, res) => {
  // 只认本机地址：防别的网页借 DNS 重绑定读写留言
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? "")) return send(res, 403, { error: "只接受本机访问" });
  if (req.method === "POST" && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: "跨站请求" });
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET") {
      if (url.pathname === "/") return send(res, 200, fs.readFileSync(path.join(HERE, "page.html")), TYPES[".html"]);
      if (["/page.js", "/page.css"].includes(url.pathname)) {
        return send(res, 200, fs.readFileSync(path.join(HERE, url.pathname.slice(1))), TYPES[path.extname(url.pathname)]);
      }
      if (url.pathname === "/api/whoami") return send(res, 200, { app: "codevideo-board", work: rel(work) });
      if (url.pathname === "/api/version") return send(res, 200, { board: boardVersion(), comments: mtime(commentsFile) });
      if (url.pathname === "/api/state") {
        const { board, warnings, error } = loadBoard();
        return send(res, 200, { work: rel(work), board, warnings, error, ...readComments(), board_version: boardVersion(), comments_version: mtime(commentsFile) });
      }
      if (url.pathname === "/file") {
        const file = resolveMedia(url.searchParams.get("path") ?? "");
        return file ? sendFile(req, res, file) : send(res, 404, { error: "找不到，或者不在 out/、public/、作品目录里" });
      }
      return send(res, 404, { error: "没有这个地址" });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const { board } = loadBoard();
      if (url.pathname === "/api/comment") {
        const text = String(body.text ?? "").trim();
        const target = String(body.target ?? "");
        if (!text) return send(res, 400, { error: "留言是空的" });
        if (text.length > 4000) return send(res, 400, { error: "留言太长了，拆成几条吧" });
        if (target !== OVERALL && !board?.shots.some((s) => s.id === target)) return send(res, 400, { error: `没有镜头 ${target}` });
        const comment = updateComments((data) => {
          const c = { id: data.nextId++, target, round: board?.round ?? null, text, status: "open", at: now() };
          data.comments.push(c);
          return c;
        });
        return send(res, 200, comment);
      }
      if (url.pathname === "/api/withdraw") {
        const ok = updateComments((data) => {
          const c = data.comments.find((x) => x.id === Number(body.id));
          if (!c || c.status !== "open") return false;
          Object.assign(c, { status: "withdrawn", withdrawnAt: now() });
          return true;
        });
        return ok ? send(res, 200, { ok }) : send(res, 400, { error: "只有待处理的留言能撤回" });
      }
      if (url.pathname === "/api/approve") {
        if (!board) return send(res, 400, { error: "分镜表现在读不出来，先别定稿" });
        const note = String(body.note ?? "").trim().slice(0, 4000);
        const approval = updateComments((data) => {
          const a = { round: board.round, at: now(), ...(note ? { note } : {}) };
          data.approvals.push(a);
          return a;
        });
        return send(res, 200, approval);
      }
    }
    send(res, 404, { error: "没有这个地址" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};

const openBrowser = (url) => {
  if (flag("no-open")) return;
  const [cmd, cmdArgs] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
};

// 从 3200 起找端口（Studio 是 3100）。端口上已经是同一个作品的评审页就直接打开它
const server = http.createServer(handle);
const listen = (port) => {
  server.once("error", async (error) => {
    if (error.code !== "EADDRINUSE" || port >= 3220) fail(error.message);
    try {
      const other = await fetch(`http://127.0.0.1:${port}/api/whoami`, { signal: AbortSignal.timeout(1000) }).then((r) => r.json());
      if (other.app === "codevideo-board" && other.work === rel(work)) {
        console.log(`这个作品的评审页已经开着：http://127.0.0.1:${port}/`);
        openBrowser(`http://127.0.0.1:${port}/`);
        process.exit(0);
      }
    } catch {
      // 不是评审页，换下一个端口
    }
    listen(port + 1);
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`分镜评审页：${url}`);
    console.log(`分镜表 ${rel(boardFile)}，留言存在 ${rel(commentsFile)}`);
    console.log(`看待处理的留言：npm run board -- ${rel(work)} --list`);
    console.log("按 Ctrl+C 关掉");
    openBrowser(url);
  });
};
listen(3200);
