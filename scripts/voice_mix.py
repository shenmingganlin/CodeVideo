#!/usr/bin/env python3
"""把配音按帧铺到音乐+音效床上，再统一做响度归一。

用法：
  python scripts/voice_mix.py <作品目录> [--bed <mix.wav>] [--out <fullmix.wav>]
                             [--public public] [--voice-gain 0] [--bed-gain 0]
                             [--lufs -14] [--true-peak -1.5] [--max-limiting 4]

配音位置完全按 src/shared/voice.tsx 里 layoutVoice 的算法算：
  第一句开口 = leadInMs
  下一句开口 = 上一句最后一个词读完 + pauseAfterMs（voice.json 里的句后停顿）
  起点对齐到帧（Math.round），所以和画面用的是同一个帧号。
作品目录里的 timeline.json 提供 fps、leadInMs、gapMs（缺省 500），作品调用 layoutVoice 时也要传这两个值。
要从仓库根目录运行；产物放在 public/ 下和作品目录对应的位置（src/videos/foo → public/videos/foo/audio/）。

增益和响度写在 timeline.json 的 voiceMix 里，重新生成才是同一条混音：
  "voiceMix": {"bedGainDb": -13, "voiceGainDb": 0, "lufs": -14, "truePeakDb": -1.5, "maxLimitingDb": 4}
命令行参数只临时覆盖它们，试好了写回 timeline.json。motioner 建议音乐压在混音下 12–13 LU。

母带照 motioner 的 build_mix.py：线性增益 + 前瞻限幅器，限幅超过 maxLimitingDb 就降目标响度，
不压扁瞬态。不用 ffmpeg loudnorm：配音片的 LRA 常超过它的上限，linear=true 会悄悄退回动态模式，
整条增益忽高忽低，配音间隙的底子被抬起来。
"""

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 48000


def load_build_mix():
    """motioner 技能的 build_mix.py，母带处理用它的 master()。技能目录由 motioner-dir.mjs 找"""
    found = subprocess.run(["node", str(Path(__file__).with_name("motioner-dir.mjs"))],
                           capture_output=True, encoding="utf-8")
    if found.returncode != 0:
        sys.exit("找不到 motioner 技能目录。它是桌面版的账号技能；装在别处时设 MOTIONER_DIR")
    sys.path.insert(0, str(Path(found.stdout.strip()) / "scripts"))
    import build_mix

    if build_mix.SR != SR:
        sys.exit(f"build_mix.py 的采样率是 {build_mix.SR}，这里是 {SR}")
    # 它的 K 计权有个运算优先级错误：Vb 写成 10 ** (G / 20) ** 0.4997，Python 先算右边的 **，
    # 响度表读数偏高 3–6 dB，master() 压出来比目标轻约 3 dB。拿 -20 dBFS 的 997 Hz 正弦
    # （BS.1770 读 -20.0 LUFS）测一下，还偏就换成正确的；技能修好以后这里不再动它
    t = np.arange(SR * 3) / SR
    sine = 0.1 * np.sin(2 * np.pi * 997 * t)
    if abs(build_mix.integrated(np.stack([sine, sine], 1)) + 20) > 0.2:
        build_mix.k_weight = k_weight
    return build_mix


def k_weight(x: np.ndarray) -> np.ndarray:
    """BS.1770 K 计权（高架 + 高通两级），和 build_mix.k_weight 一样，只修了 Vb"""
    from scipy.signal import lfilter

    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / SR)
    Vh = 10 ** (G / 20)
    Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    x = lfilter(b, a, x, axis=0)
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / SR)
    a = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    return lfilter([1, -2, 1], a, x, axis=0)


def decode_stereo(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-acodec", "pcm_s16le",
         "-ac", "2", "-ar", str(SR), "-"],
        capture_output=True,
    )
    if raw.returncode != 0:
        sys.exit(f"解码失败：{path}\n{raw.stderr.decode('utf-8', 'ignore')[-600:]}")
    data = np.frombuffer(raw.stdout, dtype="<i2").astype(np.float32) / 32768.0
    return data.reshape(-1, 2)


def place_lines(manifest: dict, fps: float, lead_in_ms: float, gap_ms: float = 500) -> list[tuple[dict, int, float]]:
    speak_at = lead_in_ms
    placed = []
    for line in manifest["lines"]:
        first = line["captions"][0]
        last = line["captions"][-1]
        # Math.round 是 .5 往上进，Python 的 round() 是 .5 取偶，正好 .5 时会差一帧
        start_frame = max(0, math.floor((speak_at - first["startMs"]) / 1000 * fps + 0.5))
        start_ms = start_frame / fps * 1000
        placed.append((line, start_frame, start_ms))
        speak_at = start_ms + last["endMs"] + line.get("pauseAfterMs", gap_ms)
    return placed


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workdir", type=Path)
    ap.add_argument("--bed", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--public", type=Path, default=Path("public"))
    # 不写的项取 timeline.json 的 voiceMix，再不写取括号里的默认值
    ap.add_argument("--voice-gain", type=float, help="配音增益，dB（voiceGainDb，0）")
    ap.add_argument("--bed-gain", type=float, help="音乐音效床增益，dB（bedGainDb，0）")
    ap.add_argument("--lufs", type=float, help="目标响度（lufs，-14）")
    ap.add_argument("--true-peak", type=float, help="true peak 上限，dBTP（truePeakDb，-1.5）")
    ap.add_argument("--max-limiting", type=float, help="限幅最多压几 dB，超过就降目标响度（maxLimitingDb，4）")
    args = ap.parse_args()

    workdir = args.workdir
    timeline = json.loads((workdir / "timeline.json").read_text(encoding="utf-8"))
    saved = timeline.get("voiceMix", {})
    setting = lambda arg, key, default: arg if arg is not None else saved.get(key, default)  # noqa: E731
    voice_gain = setting(args.voice_gain, "voiceGainDb", 0.0)
    bed_gain = setting(args.bed_gain, "bedGainDb", 0.0)
    lufs = setting(args.lufs, "lufs", -14.0)
    true_peak = setting(args.true_peak, "truePeakDb", -1.5)
    max_limiting = setting(args.max_limiting, "maxLimitingDb", 4.0)
    build_mix = load_build_mix()
    fps = timeline["fps"]
    # 产物位置和 voice.py、manim.mjs 一样：src/<rel> → public/<rel>，src/private/foo 就到 public/private/foo
    try:
        rel = workdir.resolve().relative_to(Path("src").resolve())
    except ValueError:
        sys.exit(f"{workdir} 不在 src/ 下面，没法确定产物放在 public/ 的哪里")
    public_dir = args.public / rel
    # 没有配音的片子也走这里做母带：build_mix.py 自己的响度读数偏高（见 load_build_mix），mix.wav 偏轻
    manifest_path = public_dir / "voice" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"lines": []}
    if not manifest["lines"]:
        print("  没有配音，只做母带")
    bed_path = args.bed or workdir / "audio" / "mix.wav"
    out_path = args.out or (public_dir / "audio" / "fullmix.wav")

    # leadInMs、gapMs 要和作品里传给 layoutVoice 的一样，所以都从 timeline.json 读（gapMs 缺省 500）
    placed = place_lines(manifest, fps, timeline.get("leadInMs", 500), timeline.get("gapMs", 500))
    frames = timeline["frames"]
    total = int(round(frames / fps * SR))

    bed = decode_stereo(bed_path)
    bed_bus = np.zeros((max(total, len(bed)), 2))
    bed_bus[: len(bed)] = bed * (10 ** (bed_gain / 20))

    voice_bus = np.zeros_like(bed_bus)
    for line, start_frame, _ in placed:
        clip = decode_stereo(args.public / line["src"])
        at = int(round(start_frame / fps * SR))
        end = min(len(voice_bus), at + len(clip))
        voice_bus[at:end] += clip[: end - at] * (10 ** (voice_gain / 20))
        print(f"  {line['id']:<9} 第 {start_frame:>4} 帧")

    bed_bus = bed_bus[:total]
    voice_bus = voice_bus[:total]

    def rms_db(x: np.ndarray) -> float:
        rms = float(np.sqrt(np.mean(x**2)))
        return 20 * np.log10(max(rms, 1e-9))

    if placed:
        print(f"  配音 RMS {rms_db(voice_bus):.1f} dBFS，音效床 RMS {rms_db(bed_bus):.1f} dBFS，"
              f"相差 {rms_db(voice_bus) - rms_db(bed_bus):.1f} dB（音效床增益 {bed_gain:+g} dB，配音 {voice_gain:+g} dB）")

    audio = bed_bus + voice_bus
    before = build_mix.integrated(audio)
    mastered, worst, _, goal = build_mix.master(audio, lufs, true_peak, max_limiting)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    build_mix.write_wav(out_path, mastered)
    print(f"\n{out_path}")
    print(f"  {before:.1f} LUFS → {build_mix.integrated(mastered):.1f} LUFS，"
          f"true peak {20 * np.log10(build_mix.true_peak(mastered)):.1f} dBTP，最多限幅 {-worst:.1f} dB")
    if goal < lufs - 0.5:
        print(f"  [注意] 限幅要超过 {max_limiting:g} dB 才到 {lufs:g} LUFS，目标降到 {goal:.1f}："
              "瞬态比底子高太多，可以接受（平台会再归一），也可以压一下音效床或调高配音")


if __name__ == "__main__":
    main()
