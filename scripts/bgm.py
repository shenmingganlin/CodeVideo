# 合成一段可以无缝循环的轻电子底噪，给讲解视频垫在配音下面。
#
# 用法：npm run bgm -- <输出目录> [--seconds=32] [--bpm=60] [--style=bed|sparse] [--loudness=-16] [--name=bed]
# 产物：<输出目录>/bed.mp3（--style=sparse 时是 ambient.mp3，--name 可改），中间的 wav 用完就删
#
# 不用现成音乐的原因：素材库是空的，网上的曲子要处理授权。
# bed 只叠正弦和噪声，没有旋律，音量压在配音下面，循环点靠"所有频率都整周期"来保证无缝；
# 和弦 8 秒一换，所以长度向上取整到 8 秒的倍数。sparse 不循环，靠首尾淡入淡出，长度照给的来。

import argparse
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100


def envelope(n, attack, release):
    """0 → 1 → 0，起落都平滑，避免咔哒声"""
    t = np.arange(n) / SR
    total = n / SR
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    r = np.clip((total - t) / max(release, 1e-6), 0, 1)
    return np.minimum(a, r) ** 2


def smooth_noise(n, seed, cutoff=0.02):
    """一阶低通的白噪声，听起来像气流而不是嘶嘶声"""
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(n)
    out = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += cutoff * (noise[i] - acc)
        out[i] = acc
    return out


def note(freq, seconds, cycles):
    """round 到 seconds 内正好整数个周期，循环接缝才不会有相位跳变"""
    f = round(freq * seconds) / seconds
    t = np.arange(cycles) / SR
    return np.sin(2 * np.pi * f * t), f


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def build_sparse(seconds, notes):
    """稀疏音景：低音长鸣铺底，几声带余响的钟音，首尾有气声起伏。适合纯画面、无配音的短片"""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    left = np.zeros(n)
    right = np.zeros(n)

    # 低音长鸣：轻微失谐的两个振荡器互相拍频，动得很慢
    drone_env = smoothstep(t / 2.4) * smoothstep((seconds - t) / 2.8)
    for freq, gain in [(73.42, 0.5), (73.58, 0.34), (110.0, 0.26), (146.83, 0.12)]:
        tone = np.sin(2 * np.pi * freq * t) * gain * drone_env
        left += tone * 0.98
        right += tone * 1.02

    # 钟音：几个分音叠加，指数衰减；错开出现，和画面的动静对上
    for start, freq in notes:
        i0 = int(start * SR)
        dur = min(int(4.2 * SR), n - i0)
        if dur <= 0:
            continue
        lt = np.arange(dur) / SR
        env = np.exp(-lt / 1.35) * (1 - np.exp(-lt / 0.004))
        for k, (mult, gain) in enumerate([(1.0, 1.0), (2.0, 0.32), (3.01, 0.13), (4.16, 0.05)]):
            tone = np.sin(2 * np.pi * freq * mult * lt) * gain * env * 0.26
            spread = 1 + 0.12 * (-1) ** k
            left[i0 : i0 + dur] += tone * spread
            right[i0 : i0 + dur] += tone * (2 - spread)

    # 气声：开头和结尾各起伏一次，给一点呼吸
    air_env = smoothstep(t / 2.8) * smoothstep((seconds - t) / 3.0) * 0.5
    air = smooth_noise(n, 4242, cutoff=0.015) * air_env * 0.05
    left += air
    right += air

    # 简易混响：用指数衰减的噪声脉冲响应做卷积，给钟音一点空间
    ir_len = int(1.4 * SR)
    ir_t = np.arange(ir_len) / SR
    ir = np.random.default_rng(91).standard_normal(ir_len) * np.exp(-ir_t / 0.45)
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(n + ir_len - 1)))
    ir_fft = np.fft.rfft(ir, size)
    left = left * 0.82 + np.fft.irfft(np.fft.rfft(left, size) * ir_fft, size)[:n] * 0.3
    right = right * 0.82 + np.fft.irfft(np.fft.rfft(right, size) * ir_fft, size)[:n] * 0.3

    mix = np.stack([left, right], axis=1)
    mix = np.tanh(mix * 1.1) / 1.1
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.8
    return mix


def build(seconds, bpm):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    left = np.zeros(n)
    right = np.zeros(n)

    # 铺底和弦：每 8 秒换一次，两个和弦之间用余弦包络交叉淡化
    chords = [
        [110.0, 164.81, 220.0, 277.18],  # A 大三和弦
        [98.0, 146.83, 196.0, 246.94],  # G 大三和弦，往下走一点
    ]
    seg = 8.0
    for index, start in enumerate(np.arange(0, seconds, seg)):
        chord = chords[index % len(chords)]
        start_n = int(start * SR)
        length = int(seg * SR)
        env = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(length) / length)
        env = env**0.6
        for k, freq in enumerate(chord):
            wave, _ = note(freq, seconds, length)
            gain = 0.32 / (k + 1)
            # 左右略微失谐，声场宽一点
            tone = wave * env * gain
            left[start_n : start_n + length] += tone * (1 + 0.06 * (-1) ** k)
            right[start_n : start_n + length] += tone * (1 - 0.06 * (-1) ** k)

    # 慢速呼吸感：8 秒一个周期，整段正好 4 个
    breathe = 0.82 + 0.18 * np.sin(2 * np.pi * t / 8.0)
    left *= breathe
    right *= breathe

    # 每拍一个很轻的低频点，像心跳，不抢戏
    beat = 60.0 / bpm
    beat_n = int(beat * SR)
    dot = np.sin(2 * np.pi * 58.0 * np.arange(int(0.35 * SR)) / SR)
    dot *= np.exp(-np.arange(dot.size) / (0.09 * SR))
    dot *= envelope(dot.size, 0.004, 0.02) * 0.13
    for start in range(0, n - dot.size, beat_n):
        left[start : start + dot.size] += dot
        right[start : start + dot.size] += dot

    # 半拍一个气声，给一点流动感，包络首尾归零，接缝没有咔哒
    tick_n = int(0.07 * SR)
    tick_env = envelope(tick_n, 0.008, 0.03)
    for index, start in enumerate(range(0, n - tick_n, int(beat_n / 2))):
        if index % 2 == 0:
            continue
        tick = smooth_noise(tick_n, 1000 + index, cutoff=0.12) * tick_env * 0.5
        pan = 0.5 + 0.5 * np.sin(index)
        left[start : start + tick_n] += tick * (1 - pan) * 0.1
        right[start : start + tick_n] += tick * pan * 0.1

    # 整体压一下再归一化，留足给配音的余量
    mix = np.stack([left, right], axis=1)
    mix = np.tanh(mix * 1.2) / 1.2
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.7
    return mix


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("out", help="输出目录，比如 public/videos/foo/bgm")
    parser.add_argument("--seconds", type=float, default=32.0)
    parser.add_argument("--bpm", type=float, default=60.0)
    parser.add_argument(
        "--style",
        choices=["bed", "sparse"],
        default="bed",
        help="bed：可循环的轻电子底噪；sparse：长鸣加钟音的稀疏音景（适合无配音的短片）",
    )
    parser.add_argument("--name", help="文件名（不带后缀），默认 bed 或 ambient")
    parser.add_argument("--loudness", type=float, help="转成 mp3 时用 loudnorm 归一到的 LUFS，不填就保持原始电平")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = args.name or ("ambient" if args.style == "sparse" else "bed")
    wav = out_dir / f"{name}.wav"
    mp3 = out_dir / f"{name}.mp3"

    if args.style == "sparse":
        # 钟音落在全长的 6%、38%、70% 处，正好对应画面上三个动作
        notes = [
            (args.seconds * 0.06, 293.66),  # D4
            (args.seconds * 0.38, 392.0),  # G4
            (args.seconds * 0.70, 440.0),  # A4
        ]
        mix = build_sparse(args.seconds, notes)
    else:
        # 和弦和呼吸都是 8 秒一轮，不是整轮的话最后一段和弦放不下，循环也接不上
        seconds = max(8.0, np.ceil(args.seconds / 8.0) * 8.0)
        if seconds != args.seconds:
            print(f"bed 的和弦 8 秒一换，长度取整到 {seconds:g} 秒（要的是 {args.seconds:g} 秒）")
            args.seconds = seconds
        mix = build(args.seconds, args.bpm)

    # 16 bit PCM 立体声
    pcm = (mix * 32767).astype("<i2")
    with wave.open(str(wav), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())

    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav)]
    if args.loudness is not None:
        command += [
            "-af",
            f"loudnorm=I={args.loudness}:TP=-1.5:LRA=9",
        ]
    command += ["-codec:a", "libmp3lame", "-b:a", "192k", str(mp3)]
    subprocess.run(command, check=True)
    print(f"{mp3}（{args.seconds:g} 秒，{args.style}）")
    wav.unlink()


if __name__ == "__main__":
    main()
