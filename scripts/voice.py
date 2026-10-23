# 配音：用免费的 Edge 语音把台词生成音频和逐词时间
#
# 用法：npm run voice -- <作品目录或 voice.json>… [--force]
#       npm run voice -- --voices      列出可用的中文语音
#
# 台词写在作品目录的 voice.json 里：
#   {
#     "voice": "zh-CN-YunxiNeural",                        必填，每个作品按内容挑
#     "rate": "+0%", "pitch": "+0Hz", "volume": "+0%",     可选：语速、音调、音量
#     "lines": [
#       { "id": "intro", "text": "……" },
#       { "id": "ask", "text": "……", "voice": "zh-CN-XiaoxiaoNeural", "rate": "+10%" }
#     ]
#   }
# 每句可以单独覆盖 voice、rate、pitch、volume。其他字段（比如 pauseAfterMs）原样写进清单，留给 Composition 用。
# Edge 语音不支持自定义 SSML，想在句中停顿，就拆成两句。
#
# 产物放在 public/ 下和作品目录对应的位置，比如 src/videos/foo/voice.json → public/videos/foo/voice/：
#   <id>.mp3        每句一个音频
#   manifest.json   每句的时长和逐词时间（Remotion 的 Caption 格式），Composition 里用 loadVoice() 读
# 文字和语音参数都没变的句子不会重新生成，加 --force 全部重新生成。

import argparse
import asyncio
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PUBLIC = ROOT / "public"
VOICE_PARAMS = {"rate": "+0%", "pitch": "+0Hz", "volume": "+0%"}
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
# Edge 的时间单位是 100 纳秒
TICKS_PER_MS = 10_000
# Edge 报的词起点比 mp3 解码后真正出声早：实测停顿后的词晚 72–105ms 才出声
# （FFmpeg 解码，渲染出的视频也一样）。逐词时间统一往后挪这么多，字幕仍会比声音稍早一点
EDGE_LEAD_MS = 70
# 同时请求的句数，太多容易被限流
CONCURRENCY = 4
RETRIES = 3


class VoiceError(Exception):
    pass


def resolve_script(arg: str) -> Path:
    path = (Path.cwd() / arg).resolve()
    if path.is_dir():
        path = path / "voice.json"
    if not path.is_file():
        raise VoiceError(f"找不到台词文件 {arg}（要么是 voice.json，要么是包含它的作品目录）")
    return path


def load_script(path: Path) -> dict:
    try:
        script = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise VoiceError(f"{path.name} 不是合法的 JSON：{err}") from err
    if not isinstance(script.get("voice"), str):
        raise VoiceError(f"{path.name} 缺少 voice，要写明用哪个语音（npm run voice -- --voices 可以列出来）")
    lines = script.get("lines")
    if not isinstance(lines, list) or not lines:
        raise VoiceError(f"{path.name} 里没有台词（lines）")
    seen = set()
    for i, line in enumerate(lines, 1):
        line_id = line.get("id")
        if not isinstance(line_id, str) or not ID_PATTERN.match(line_id):
            raise VoiceError(f"第 {i} 句的 id 要用字母、数字、- 或 _，现在是 {line_id!r}")
        # id 会用作文件名，Windows 不区分大小写，所以按小写查重
        if line_id.lower() in seen:
            raise VoiceError(f"id「{line_id}」重复了")
        seen.add(line_id.lower())
        if not isinstance(line.get("text"), str) or not line["text"].strip():
            raise VoiceError(f"「{line_id}」没有 text")
    return script


def trails_word(ch: str) -> bool:
    # 跟在词后面的标点和符号（Unicode 类别 P*、S*）。
    # 左引号、左括号（Pi、Ps）和货币符号（Sc）属于后一个词，不算
    category = unicodedata.category(ch)
    return category[0] in "PS" and category not in ("Pi", "Ps", "Sc")


def find_word(text: str, word: str, start: int) -> int | None:
    """在原文 start 之后找这个词，返回词尾的位置。Edge 给的词偶尔和原文空格、大小写不同，先精确找，再放宽"""
    pos = text.find(word, start)
    if pos >= 0:
        return pos + len(word)
    chars = [re.escape(ch) for ch in word if not ch.isspace()]
    if not chars:
        return None
    match = re.compile(r"\s*".join(chars), re.IGNORECASE).search(text, start)
    return match.end() if match else None


def align(text: str, words: list[tuple[str, int, int]]) -> tuple[list[dict], list[str]]:
    """把 Edge 返回的逐词时间对回原文，生成 Remotion 的 Caption 列表。

    每个词的 text 是原文里从上一个词结束到这个词结束的那一段，所以前导空格、紧跟的标点都保留着，
    拼起来就是完整原文。对不上原文的词，它的文字会并进下一个词里，返回值里列出这些词。
    """
    captions = []
    missed = []
    cursor = 0
    pending_start = None
    for word, offset, duration in words:
        start_ms = round(offset / TICKS_PER_MS) + EDGE_LEAD_MS
        end = find_word(text, word, cursor)
        if end is None:
            missed.append(word)
            pending_start = start_ms if pending_start is None else pending_start
            continue
        while end < len(text) and trails_word(text[end]):
            end += 1
        if pending_start is not None:
            start_ms = min(start_ms, pending_start)
            pending_start = None
        captions.append({
            "text": text[cursor:end],
            "startMs": start_ms,
            "endMs": round((offset + duration) / TICKS_PER_MS) + EDGE_LEAD_MS,
            "timestampMs": start_ms,
            "confidence": None,
        })
        cursor = end
    if captions and cursor < len(text):
        # 句末没读出来的部分（引号、省略号之类）并到最后一个词
        captions[-1]["text"] += text[cursor:]
    return captions, missed


async def synthesize(text: str, params: dict, mp3: Path) -> list[tuple[str, int, int]]:
    for attempt in range(1, RETRIES + 1):
        try:
            communicate = edge_tts.Communicate(
                text,
                params["voice"],
                rate=params["rate"],
                pitch=params["pitch"],
                volume=params["volume"],
                boundary="WordBoundary",
            )
            audio = bytearray()
            words = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    words.append((chunk["text"], chunk["offset"], chunk["duration"]))
            if not audio:
                raise VoiceError("没有收到音频")
            mp3.write_bytes(audio)
            return words
        except ValueError as err:
            # 参数写错了，重试也没用
            raise VoiceError(f"语音参数不对：{err}。rate、volume 写成 +10% 这样，pitch 写成 +5Hz 这样") from err
        except Exception as err:
            if attempt == RETRIES:
                raise VoiceError(f"Edge 语音请求失败（试了 {RETRIES} 次）：{type(err).__name__} {err}") from err
            await asyncio.sleep(2 * attempt)
    raise AssertionError("unreachable")


def duration_ms(mp3: Path) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
        capture_output=True, text=True, check=True,
    )
    return round(float(result.stdout.strip()) * 1000)


def line_hash(text: str, params: dict) -> str:
    key = json.dumps({"text": text, **params}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


async def build(script_path: Path, force: bool) -> bool:
    script = load_script(script_path)
    try:
        rel = script_path.parent.relative_to(SRC)
    except ValueError:
        raise VoiceError(f"{script_path} 不在 src/ 下面，没法确定产物放在 public/ 的哪里") from None
    out_dir = PUBLIC / rel / "voice"
    static_dir = "/".join((*rel.parts, "voice"))
    manifest_path = out_dir / "manifest.json"

    previous = {}
    if manifest_path.exists() and not force:
        previous = {line["id"]: line for line in json.loads(manifest_path.read_text(encoding="utf-8"))["lines"]}

    defaults = {"voice": script["voice"], **{k: script.get(k, v) for k, v in VOICE_PARAMS.items()}}
    plans = []
    for line in script["lines"]:
        params = {k: line.get(k, v) for k, v in defaults.items()}
        digest = line_hash(line["text"], params)
        old = previous.get(line["id"])
        mp3 = out_dir / f"{line['id']}.mp3"
        cached = old if old and old.get("hash") == digest and "words" in old and mp3.exists() else None
        plans.append((line, params, digest, mp3, cached))

    # 语音名写错时 Edge 不报错，只是不返回音频，所以先对一遍语音列表
    wanted = {params["voice"] for _, params, _, _, cached in plans if cached is None}
    if wanted:
        try:
            known = {voice["ShortName"] for voice in await edge_tts.list_voices()}
        except Exception as err:
            raise VoiceError(f"连不上 Edge 语音服务：{type(err).__name__} {err}") from err
        unknown = sorted(wanted - known)
        if unknown:
            raise VoiceError(f"没有这个语音：{'、'.join(unknown)}。npm run voice -- --voices 可以列出中文语音")

    out_dir.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def make_line(line: dict, params: dict, digest: str, mp3: Path, cached: dict | None):
        if cached is None:
            async with semaphore:
                words = await synthesize(line["text"], params, mp3)
            length = duration_ms(mp3)
        else:
            words = [tuple(word) for word in cached["words"]]
            length = cached["durationMs"]
        # 清单里留着 Edge 的原始逐词时间，对齐方法改了也不用重新请求语音
        captions, missed = align(line["text"], words)
        timing = {"durationMs": length, "captions": captions, "words": words}
        extra = {k: v for k, v in line.items() if k not in ("id", "text", *defaults)}
        entry = {
            "id": line["id"],
            "text": line["text"],
            **extra,
            **params,
            "src": f"{static_dir}/{mp3.name}",
            **timing,
            "hash": digest,
        }
        return entry, cached is None, missed

    results = await asyncio.gather(*(make_line(*plan) for plan in plans))
    entries = [entry for entry, _, _ in results]
    manifest_path.write_text(json.dumps({"lines": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 删掉已经不在台词里的旧音频
    keep = {f"{entry['id']}.mp3" for entry in entries}
    for mp3 in out_dir.glob("*.mp3"):
        if mp3.name not in keep:
            mp3.unlink()

    print(f"{script_path.relative_to(ROOT).as_posix()} → {out_dir.relative_to(ROOT).as_posix()}/")
    ok = True
    for entry, generated, missed in results:
        status = "新生成" if generated else "未改动"
        print(f"  {entry['id']}：{entry['durationMs'] / 1000:.2f} 秒，{len(entry['captions'])} 个词，{status}")
        if not entry["captions"]:
            print("    [不合格] 没拿到逐词时间，字幕会对不上")
            ok = False
        elif entry["captions"][-1]["endMs"] > entry["durationMs"]:
            print("    [注意] 最后一个词的结束时间超过了音频长度")
        if missed:
            print(f"    [注意] 这些词对不上原文，时间并进了下一个词：{'、'.join(missed)}")
    total = sum(entry["durationMs"] for entry in entries) / 1000
    print(f"  共 {len(entries)} 句，{total:.2f} 秒（不含句间停顿）")
    return ok


async def list_voices() -> None:
    voices = await edge_tts.list_voices()
    for voice in sorted(voices, key=lambda v: v["ShortName"]):
        if not voice["Locale"].startswith("zh-"):
            continue
        tags = voice.get("VoiceTag", {})
        personality = "、".join(tags.get("VoicePersonalities", []))
        category = "、".join(c.strip() for c in tags.get("ContentCategories", []))
        gender = "女" if voice["Gender"] == "Female" else "男"
        print(f"{voice['ShortName']:<32}{gender}  {personality}  （{category}）")


async def main() -> int:
    parser = argparse.ArgumentParser(description="用 Edge 语音生成配音和逐词时间")
    parser.add_argument("scripts", nargs="*", help="作品目录或 voice.json")
    parser.add_argument("--force", action="store_true", help="全部重新生成")
    parser.add_argument("--voices", action="store_true", help="列出可用的中文语音")
    args = parser.parse_args()
    if args.voices:
        await list_voices()
        return 0
    if not args.scripts:
        parser.print_usage()
        return 1
    ok = True
    for arg in args.scripts:
        ok = await build(resolve_script(arg), args.force) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    try:
        sys.exit(asyncio.run(main()))
    except (VoiceError, subprocess.CalledProcessError) as err:
        print(f"\n出错：{err}", file=sys.stderr)
        sys.exit(1)
