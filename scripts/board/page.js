// 分镜评审页的前端：读 /api/state 画出分镜表，留言发给 /api/comment。服务器和数据格式见 scripts/board.mjs
"use strict";

const OVERALL = "_board";
const FIELDS = [["picture", "画面"], ["motion", "动效"], ["camera", "运镜"], ["transition", "转场"], ["sound", "声音"], ["tech", "技术"], ["why", "理由"], ["notes", "备注"]];
const CONCEPT = [["seed", "种子"], ["chapters", "章节"], ["becomes", "变成链"], ["bookend", "首尾呼应"]];
const VIDEO = /\.(mp4|webm)$/i;

let state = null; // 最近一次 /api/state，分镜读不出来时 board 留着上一份
let versions = { board: -1, comments: -1 };
let drafts = {}; // 没发出去的留言，target → 文字，重画和刷新页面都不丢
const openDetails = new Set();

const $ = (selector) => document.querySelector(selector);
const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== ""));
  return el;
};
const text = (v) => (Array.isArray(v) ? v.join("\n") : String(v ?? ""));
const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");
const chip = (v) => h("span", { class: "chip" }, text(v));

const post = async (url, body) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
};
let toastTimer;
const toast = (message) => {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
};
const draftKey = () => `board-drafts:${state.work}`;
const saveDrafts = () => localStorage.setItem(draftKey(), JSON.stringify(drafts));

// 分镜表
const kv = (fields, obj) => {
  const rows = fields.filter(([key]) => has(obj[key]));
  if (rows.length === 0) return null;
  return h("dl", { class: "kv" }, rows.map(([key, label]) => [h("dt", { class: key === "why" ? "why" : null }, label), h("dd", { class: key === "why" ? "why" : null }, text(obj[key]))]));
};
const asks = (list) =>
  has(list) ? h("div", { class: "ask" }, h("b", {}, "想听你的意见："), h("ul", {}, [].concat(list).map((q) => h("li", {}, q)))) : null;

const mediaItem = (item) => {
  const url = `/file?path=${encodeURIComponent(item.src)}&v=${versions.board}`;
  const missing = () => h("div", { class: "missing" }, `草图还没有：${item.src}`);
  let el;
  if (VIDEO.test(item.src)) {
    el = h("video", { src: url, autoplay: true, loop: true, playsinline: true, controls: true });
    el.muted = true;
  } else el = h("img", { src: url, alt: item.caption ?? item.src });
  el.addEventListener("error", () => el.replaceWith(missing()));
  return h("figure", {}, el, has(item.caption) && h("figcaption", {}, item.caption));
};

// 输入框里先写好这条留言会拿到的编号，发之前就知道它叫什么
const refName = (target) => (target === OVERALL ? "整体" : target);
const nextRef = (target) => `${refName(target)}-${(state?.comments ?? []).filter((c) => c.target === target).length + 1}`;
const placeholderFor = (target) =>
  `${target === OVERALL ? "对整体的意见" : "对这个镜头的意见"}，发出去是 ${nextRef(target)}……（Ctrl+Enter 发送）`;

const commentsBlock = (target) => {
  const area = h("textarea", { "data-target": target, placeholder: placeholderFor(target) });
  area.value = drafts[target] ?? "";
  const button = h("button", { class: "primary", type: "button" }, "留言");
  area.addEventListener("input", () => {
    if (area.value) drafts[target] = area.value;
    else delete drafts[target];
    saveDrafts();
  });
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit(target, area, button);
    }
  });
  button.addEventListener("click", () => submit(target, area, button));
  return h("div", { class: "comments" }, h("div", { "data-list": target }), h("div", { class: "composer" }, area, button));
};

const overviewCard = (board) =>
  h(
    "section",
    { class: "card", id: `shot-${OVERALL}` },
    h("h2", {}, board.title ?? "分镜"),
    has(board.summary) && h("p", {}, text(board.summary)),
    board.spec && h("div", { class: "spec" }, Object.entries(board.spec).map(([k, v]) => chip(`${k}：${text(v)}`))),
    board.concept && [h("h3", {}, "概念"), kv(CONCEPT, board.concept)],
    has(board.sound) && [h("h3", {}, "声音"), h("p", { style: "margin:0;white-space:pre-line" }, text(board.sound))],
    has(board.notes) && [h("h3", {}, "备注"), h("p", { style: "margin:0;white-space:pre-line" }, text(board.notes))],
    asks(board.questions),
    commentsBlock(OVERALL),
  );

const shotCard = (shot) => {
  const media = shot.media ?? [];
  return h(
    "section",
    { class: "card", id: `shot-${shot.id}` },
    h("div", { class: "head" }, h("h2", {}, `${shot.id}　${shot.title ?? ""}`), has(shot.time) && chip(shot.time), has(shot.beats) && chip(`第 ${text(shot.beats)} 拍`), has(shot.chapter) && chip(shot.chapter)),
    h("div", { class: media.length > 0 ? "shot-body" : "shot-body no-media" }, media.length > 0 && h("div", { class: "media" }, media.map(mediaItem)), kv(FIELDS, shot)),
    asks(shot.questions),
    commentsBlock(shot.id),
  );
};
// 留言
const time = (iso) => new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
// 留言编号由服务器算好（c.ref，比如 s3-2、整体-1）。点它地址栏变成 #c-s3-2，这个链接打开就跳到这条留言
const commentEl = (c, orphan) =>
  h(
    "div",
    { class: `comment ${c.status}${orphan ? " orphan" : ""}`, id: `c-${c.ref}` },
    h(
      "div",
      { class: "meta" },
      h("a", { class: "ref", href: `#c-${c.ref}`, title: "这条留言的编号，在对话里说它就知道是哪条" }, c.ref),
      ...[orphan && `镜头 ${c.target} 已删`, c.round && `第 ${c.round} 轮`, time(c.at), c.status === "resolved" ? "已处理" : "待处理"].filter(Boolean).map((s) => h("span", {}, s)),
      c.status === "open" && h("button", { type: "button", onclick: () => withdraw(c) }, "撤回"),
    ),
    h("div", { class: "text" }, c.text),
    has(c.reply) && h("div", { class: "reply" }, `助手：${c.reply}`),
  );

const fillList = (list, items, orphan) => {
  const key = list.dataset.list;
  const open = items.filter((c) => c.status === "open");
  const done = items.filter((c) => c.status === "resolved");
  const details = done.length > 0 && h("details", { ontoggle: (e) => (e.target.open ? openDetails.add(key) : openDetails.delete(key)) }, h("summary", {}, `已处理 ${done.length} 条`), done.map((c) => commentEl(c, orphan)));
  if (details && openDetails.has(key)) details.open = true;
  list.replaceChildren(...open.map((c) => commentEl(c, orphan)), ...(details ? [details] : []));
};

const renderComments = () => {
  const comments = state.comments.filter((c) => c.status !== "withdrawn");
  const ids = new Set((state.board?.shots ?? []).map((s) => s.id));
  for (const list of document.querySelectorAll("[data-list]")) {
    const key = list.dataset.list;
    const mine = comments.filter((c) => c.target === key);
    // 镜头删掉了，它的留言挂到整体下面，不丢
    const orphans = key === OVERALL ? comments.filter((c) => c.target !== OVERALL && !ids.has(c.target)) : [];
    fillList(list, mine, false);
    if (orphans.length > 0) {
      const extra = h("div", { "data-list": `${OVERALL}-orphans` });
      fillList(extra, orphans, true);
      list.append(extra);
    }
  }
  for (const area of document.querySelectorAll("textarea[data-target]")) area.placeholder = placeholderFor(area.dataset.target);
  renderStrip();
  renderBar();
  focusHash();
};

// 地址带 #c-s3-2 时跳到那条留言：收起的"已处理"先展开，滚过去闪一下。轮询重画后不再重复滚
let focusedHash = null;
const focusHash = () => {
  const hash = decodeURIComponent(location.hash);
  if (!hash.startsWith("#c-") || hash === focusedHash) return;
  const el = document.getElementById(hash.slice(1));
  if (!el) return;
  focusedHash = hash;
  const details = el.closest("details");
  if (details && !details.open) details.open = true;
  el.scrollIntoView({ block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
};
window.addEventListener("hashchange", () => {
  focusedHash = null;
  focusHash();
});

const openCount = (target) => state.comments.filter((c) => c.status === "open" && (target === undefined || c.target === target)).length;

const renderStrip = () => {
  const shots = state.board?.shots ?? [];
  $("#strip").replaceChildren(
    ...[{ id: OVERALL, label: "整体" }, ...shots.map((s) => ({ id: s.id, label: `${s.id}${s.time ? ` ${s.time}` : ""}` }))].map(({ id, label }) => {
      const n = openCount(id);
      return h("a", { href: `#shot-${id}` }, label, n > 0 && h("span", { class: "n" }, n));
    }),
  );
};

const renderBar = () => {
  const board = state.board;
  $("#title").textContent = board?.title ?? "分镜评审";
  document.title = `${board?.title ?? "分镜"}·分镜评审`;
  $("#round").textContent = board ? `第 ${board.round} 轮` : "";
  const n = openCount();
  const count = $("#open-count");
  count.textContent = n > 0 ? `${n} 条留言待处理，留完回对话里说一声"看留言"` : "没有待处理的留言";
  count.className = n > 0 ? "has" : "";
  const last = state.approvals.at(-1);
  const approved = board && last && last.round === board.round;
  const tag = $("#approved");
  tag.textContent = approved ? `已定稿（${time(last.at)}）` : last ? `第 ${last.round} 轮定过稿，之后改过` : "";
  tag.className = approved ? "ok" : "";
  const button = $("#approve");
  button.disabled = !board || approved;
  button.textContent = approved ? "已定稿" : "这一轮定稿";
};

const renderBanner = () => {
  const banner = $("#banner");
  if (state.error) {
    banner.className = "";
    banner.textContent = state.board ? `${state.error}\n下面显示的是上一份能读的分镜。` : state.error;
  } else if (has(state.warnings)) {
    banner.className = "warn";
    banner.textContent = state.warnings.join("\n");
  }
  banner.hidden = !state.error && !has(state.warnings);
};

// 整页重画：记住焦点在哪个输入框、光标在哪，画完放回去
const renderAll = () => {
  const active = document.activeElement?.dataset?.target;
  const selection = active ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const board = state.board;
  $("#main").replaceChildren(...(board ? [overviewCard(board), ...board.shots.map(shotCard)] : [h("p", { class: "hint" }, "还没有分镜。")]));
  renderBanner();
  renderComments();
  if (active) {
    const area = document.querySelector(`textarea[data-target="${CSS.escape(active)}"]`);
    if (area) {
      area.focus({ preventScroll: true });
      area.setSelectionRange(...selection);
    }
  }
};
// 操作
const submit = async (target, area, button) => {
  const value = area.value.trim();
  if (!value) return;
  button.disabled = true;
  try {
    const saved = await post("/api/comment", { target, text: value });
    area.value = "";
    delete drafts[target];
    saveDrafts();
    await refresh();
    toast(`留言 ${saved.ref} 存好了。都留完了回对话里说一声"看留言"`);
  } catch (error) {
    toast(`没存上：${error.message}`);
  } finally {
    button.disabled = false;
  }
};

const withdraw = async (c) => {
  if (!confirm(`撤回 ${c.ref} 这条留言？`)) return;
  try {
    await post("/api/withdraw", { id: c.id });
    await refresh();
  } catch (error) {
    toast(`没撤回：${error.message}`);
  }
};

// 定稿：点按钮在页面上展开一块确认区，不用浏览器的 confirm/prompt。
// 以前用 prompt 问备注，点"取消"（以为是"不写备注"）就整个没定上，页面上又什么都不说（踩过：用户点了定稿，approvals 是空的）
const openApprove = () => {
  const panel = $("#approve-panel");
  const open = state.comments.filter((c) => c.status === "open");
  $("#approve-round").textContent = `第 ${state.board.round} 轮`;
  const warn = $("#approve-warn");
  warn.hidden = open.length === 0;
  warn.textContent = `还有 ${open.length} 条留言没处理（${open.map((c) => c.ref).join("、")}），定稿后它们就不改了。`;
  $("#approve-error").hidden = true;
  panel.hidden = false;
  $("#approve-note").focus();
};
$("#approve").addEventListener("click", openApprove);
$("#approve-cancel").addEventListener("click", () => ($("#approve-panel").hidden = true));
$("#approve-ok").addEventListener("click", async () => {
  const ok = $("#approve-ok");
  ok.disabled = true;
  try {
    const a = await post("/api/approve", { note: $("#approve-note").value });
    $("#approve-note").value = "";
    $("#approve-panel").hidden = true;
    await refresh();
    toast(`第 ${a.round} 轮定稿了。回对话里说一声"定稿了"`);
  } catch (error) {
    // 出错就留在确认区里写明白，不只闪一下
    const el = $("#approve-error");
    el.textContent = `没定上：${error.message}`;
    el.hidden = false;
  } finally {
    ok.disabled = false;
  }
});

// 轮询：分镜或草图变了整页重画，只有留言变了只重画留言
const refresh = async () => {
  const next = await fetch("/api/state").then((r) => r.json());
  const first = state === null;
  const boardChanged = next.board_version !== versions.board || next.error !== state?.error;
  if (first) drafts = JSON.parse(localStorage.getItem(`board-drafts:${next.work}`) ?? "{}");
  state = { ...next, board: next.board ?? state?.board ?? null };
  const commentsChanged = next.comments_version !== versions.comments;
  versions = { board: next.board_version, comments: next.comments_version };
  if (boardChanged) {
    renderAll();
    if (first && location.hash && !location.hash.startsWith("#c-")) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    else if (!first && next.board) toast(`分镜更新了：第 ${next.board.round} 轮`);
  } else if (commentsChanged) renderComments();
};

const poll = async () => {
  try {
    const v = await fetch("/api/version").then((r) => r.json());
    $("#offline").hidden = true;
    if (v.board !== versions.board || v.comments !== versions.comments) await refresh();
  } catch {
    $("#offline").hidden = false;
  }
  setTimeout(poll, 1500);
};

refresh().then(poll, (error) => {
  $("#main").replaceChildren(h("p", { class: "hint" }, `读不到分镜：${error.message}`));
  setTimeout(poll, 1500);
});
