#!/usr/bin/env python3
"""从作品的 timeline.json 生成 motioner 的 score.json。

用法：python scripts/make_score.py <作品目录> [--out <score.json>]
作品目录里有 timeline.json，输出默认到 <作品目录>/audio/score.json。

timeline.json 里可以有：
  fps / frames / bpm / beatFrames / key / scale / chords
  chapters:  [{id, verb, from, to, kit?, drop?}]    # from/to 是帧
  sounds:    [{type, frame, frames?, degree?, ...}]  # 原样交给 synth_score.py
  gap_ms / under_mix_lu / reverb_s / fade_out_ms   # 可选，原样带上

章节的 kit 不写就按 id 猜：born→intro，build/chase→groove，block/rule/minus→lift，
energy→montage，coda→outro。章节起止换算成拍，落在整拍上。
"""

import argparse
import json
from pathlib import Path

KIT_BY_ID = {
    "born": "intro",
    "build": "groove",
    "block": "groove",
    "chase": "groove",
    "rule": "intro",
    "minus": "lift",
    "energy": "montage",
    "coda": "outro",
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workdir", type=Path)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    timeline = json.loads((args.workdir / "timeline.json").read_text(encoding="utf-8"))
    fps = timeline["fps"]
    bpm = timeline["bpm"]
    beat_frames = timeline.get("beatFrames", 60 * fps / bpm)
    beat0 = timeline.get("beat0Frame", 0)

    sections = []
    for chapter in timeline["chapters"]:
        start = (chapter["from"] - beat0) / beat_frames
        end = (chapter["to"] - beat0) / beat_frames
        if abs(start - round(start)) > 1e-6 or abs(end - round(end)) > 1e-6:
            raise SystemExit(
                f"章节 {chapter['id']} 没有落在整拍上：{start}–{end}。"
                "先改 timeline.json 的 from/to。"
            )
        section = {
            "from": int(round(start)),
            "to": int(round(end)),
            "kit": chapter.get("kit") or KIT_BY_ID.get(chapter["id"], "groove"),
        }
        if chapter.get("drop"):
            section["drop"] = True
        sections.append(section)

    score = {
        "fps": fps,
        "frames": timeline["frames"],
        "bpm": bpm,
        "beat0_frame": beat0,
        "key": timeline.get("key", "A"),
        "scale": timeline.get("scale", "minor"),
        "chords": timeline.get("chords", ["i", "VI", "III", "VII"]),
        "seed": timeline.get("seed", 7),
        "sections": sections,
        "sfx": timeline.get("sounds", []),
    }
    for key in ("gap_ms", "under_mix_lu", "reverb_s", "fade_out_ms", "master", "sfx_bus"):
        if key in timeline:
            score[key] = timeline[key]

    out = args.out or (args.workdir / "audio" / "score.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(score, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out}：{len(sections)} 段，{len(score['sfx'])} 个音效事件")


if __name__ == "__main__":
    main()
