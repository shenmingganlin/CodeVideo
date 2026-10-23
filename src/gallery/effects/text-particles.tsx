import { useLayoutEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { ParticleForm, sampleText, type P3 } from "../../shared/motion/creative";
import { mixColor } from "../../shared/motion/motion";
import { C, FONT, H, Stage, W, type GalleryEffect } from "../kit";

// 满屏散落的粒子沿弯曲的路径飞过来汇聚成字，停住；再沿原路散回去
const FRAMES = 150;
const WORD = "汇聚";
const FONT_CSS = `900 400px "${FONT}"`;
const STEP = 9; // 采样间距（像素），越小粒子越多
const FORM = 2; // 开始汇聚
const DUR = 34; // 每颗粒子飞多少帧
const SPREAD = 20; // 从左到右错开的帧数（再加每颗最多 8 帧的随机延迟）
const BREAK = 78; // 开始散开（反向播放），第 BREAK + SPREAD + 8 + DUR = 140 帧全部散回原处

// 字体加载好以后再用 canvas 采样字形，不然采到的是系统默认字体
const useTargets = () => {
  const [targets, setTargets] = useState<P3[] | null>(null);
  const [handle] = useState(() => delayRender("sample text-particles"));
  useLayoutEffect(() => {
    let done = false;
    document.fonts.load(FONT_CSS, WORD).then(() => {
      if (done) return;
      setTargets(sampleText(WORD, FONT_CSS, W, H, STEP));
      continueRender(handle);
    });
    return () => {
      done = true;
    };
  }, [handle]);
  return targets;
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame() % FRAMES;
  const targets = useTargets();
  if (!targets) return <Stage>{null}</Stage>;
  // 散开用 reverse：第 BREAK 帧还是成形的样子，之后按同样的错开顺序沿原路飞回散落处
  const forming = frame < BREAK;
  const start = forming ? FORM : BREAK;
  const color = (i: number) => mixColor(C.accent, C.cool, (targets[i].x - W * 0.25) / (W * 0.5));
  return (
    <Stage>
      <ParticleForm
        frame={frame}
        start={start}
        dur={DUR}
        targets={targets}
        spread={SPREAD}
        color={color}
        size={4.4}
        width={W}
        height={H}
        seed={11}
        swirl={0.9}
        reverse={!forming}
      />
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 4,
  name: "粒子汇聚成字",
  group: "文字",
  desc: "满屏散落的粒子沿弯曲路径从左到右陆续飞来拼成两个大字，停住后再沿原路散回满屏",
  tech: "ParticleForm + sampleText（字体加载完再用 canvas 采样，间距 9px）；粒子半径 4.4，每颗飞 34 帧、从左到右错开 20 帧，swirl 0.9；散开用 reverse",
  frames: FRAMES,
  component: Scene,
};
export default effect;
