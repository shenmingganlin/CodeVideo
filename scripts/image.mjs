// 生图：调用 OpenAI 兼容的生图接口（当前是「猫肥生图」gpt-image-2.5-sunburst）
//
// 用法：npm run image -- "<提示词>" --out=<路径.png> [选项]
//   --out=…            保存位置，比如 public/videos/foo/bg.png、public/library/images/cat.png。
//                      --n 大于 1 时自动编号：bg-1.png、bg-2.png…
//   --image=…          参考图，有它就走图生图 / 改图（/v1/images/edits），可以写多个
//   --mask=…           局部重绘的蒙版 PNG：透明的地方重画，不透明的地方保留，尺寸要和第一张参考图一样
//   --size=1024x1024   尺寸，常用 1024x1024、1536x1024（横）、1024x1536（竖）、auto
//   --quality=…        low / medium / high / auto
//   --background=…     transparent / opaque / auto。要透明背景时写 transparent，格式要用 png
//   --n=1              张数
// 不写的选项不发给接口，用接口的默认值。
//
// 地址、模型、Key 在 .env 里（照 .env.example 填）。每张图旁边会写一个同名 .json，记下提示词和参数，方便以后重画、查来源

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TIMEOUT_MS = 5 * 60 * 1000;
const OPTIONS = ["size", "quality", "background", "n"];

const fail = (message) => {
  console.error(`\n出错：${message}`);
  process.exit(1);
};

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  fail("找不到 .env。复制 .env.example 为 .env，填上 IMAGE_API_KEY");
}
const { IMAGE_API_BASE: base, IMAGE_API_MODEL: model, IMAGE_API_KEY: key } = process.env;
if (!base || !model || !key) {
  fail(".env 里要有 IMAGE_API_BASE、IMAGE_API_MODEL、IMAGE_API_KEY");
}

const prompts = [];
const flags = { image: [] };
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([a-z]+)=(.*)$/s);
  if (!match) prompts.push(arg);
  else if (match[1] === "image") flags.image.push(match[2]);
  else if (["out", "mask", ...OPTIONS].includes(match[1])) flags[match[1]] = match[2];
  else fail(`不认识的选项 --${match[1]}`);
}
const prompt = prompts.join(" ").trim();
if (!prompt || !flags.out) {
  fail('用法：npm run image -- "<提示词>" --out=<路径.png> [--image=参考图] [--mask=蒙版] [--size=…] [--quality=…] [--background=…] [--n=1]');
}
if (flags.mask && flags.image.length === 0) fail("--mask 要和 --image 一起用");
if (flags.n && !/^[1-9]\d*$/.test(flags.n)) fail("--n 要写正整数");

const out = path.resolve(ROOT, flags.out);
const params = Object.fromEntries(OPTIONS.filter((k) => flags[k]).map((k) => [k, k === "n" ? Number(flags[k]) : flags[k]]));
const editing = flags.image.length > 0;
const endpoint = `${base.replace(/\/+$/, "")}/v1/images/${editing ? "edits" : "generations"}`;

let body;
const headers = { Authorization: `Bearer ${key}` };
if (editing) {
  body = new FormData();
  body.append("model", model);
  body.append("prompt", prompt);
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  const attach = async (field, file) => {
    const data = await fs.readFile(path.resolve(ROOT, file)).catch(() => fail(`读不到图片 ${file}`));
    body.append(field, new Blob([data], { type: "image/png" }), path.basename(file));
  };
  for (const file of flags.image) await attach(flags.image.length > 1 ? "image[]" : "image", file);
  if (flags.mask) await attach("mask", flags.mask);
} else {
  headers["Content-Type"] = "application/json";
  body = JSON.stringify({ model, prompt, ...params });
}

console.log(`${editing ? "改图" : "生图"}：${model}${Object.keys(params).length ? `，${JSON.stringify(params)}` : ""}…`);
const started = Date.now();
let res;
try {
  res = await fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
} catch (err) {
  fail(`请求失败：${err.name === "TimeoutError" ? `超过 ${TIMEOUT_MS / 60000} 分钟没返回` : err.message}`);
}
const text = await res.text();
if (!res.ok) fail(`接口返回 ${res.status}：${text.slice(0, 500)}`);
let images;
try {
  images = JSON.parse(text).data;
} catch {
  fail(`接口返回的不是 JSON：${text.slice(0, 300)}`);
}
if (!Array.isArray(images) || images.length === 0) fail(`接口没有返回图片：${text.slice(0, 300)}`);

await fs.mkdir(path.dirname(out), { recursive: true });
const ext = path.extname(out) || ".png";
const stem = out.slice(0, out.length - path.extname(out).length);
for (const [i, image] of images.entries()) {
  const file = images.length > 1 ? `${stem}-${i + 1}${ext}` : `${stem}${ext}`;
  let data;
  if (image.b64_json) data = Buffer.from(image.b64_json, "base64");
  else if (image.url) data = Buffer.from(await (await fetch(image.url)).arrayBuffer());
  else fail(`第 ${i + 1} 张既没有 b64_json 也没有 url`);
  await fs.writeFile(file, data);
  const record = {
    prompt,
    revisedPrompt: image.revised_prompt,
    model,
    ...params,
    images: flags.image,
    mask: flags.mask,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(`${file.slice(0, file.length - ext.length)}.json`, JSON.stringify(record, null, 2) + "\n");
  console.log(`  → ${path.relative(ROOT, file)}（${(data.length / 1024).toFixed(0)} KB）`);
}
console.log(`  用时 ${((Date.now() - started) / 1000).toFixed(0)} 秒`);
