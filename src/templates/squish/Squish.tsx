import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// 图片的透明留白范围，用 `npm run image-box -- <图>` 量出来。不填就把整张图当成内容
export type ImageBox = {
  width: number; // 图片原始像素宽
  height: number;
  left: number; // 不透明内容在图片里的范围
  top: number;
  right: number;
  bottom: number;
};

type SquishProps = {
  // public/ 下的图片路径
  src: string;
  // 最扁时纵向压到多少
  depth?: number;
  // 压一点，横向撑多少
  stretch?: number;
  // 弹到最高时纵向拉到多少
  peak?: number;
  // 静止时的可见宽度。别超过 232 / (1 + (1 - depth) * stretch)，否则最扁时会顶到画布边
  size?: number;
  // 底边固定在这个高度，原地压扁
  ground?: number;
  // 压住几帧再弹起来
  hold?: number;
  // 图片四周有留白时填，让内容而不是整张图对齐底边和水平中线
  box?: ImageBox;
};

const CANVAS = 240;

// 一个循环的纵向缩放。单独导出：素材不是图片（比如代码画的 SVG）时，直接拿这条曲线用，
// 别再抄一遍，手感才会一致
export const squishScaleAt = (
  frame: number,
  duration: number,
  depth: number,
  peak: number,
  hold: number,
) => {
  const peakAt = Math.max(hold + 2, Math.round(duration / 2));
  // 上下都用 inOut 的正弦，合起来就是一条平滑的正弦往复：
  // 两头不做硬停、也不零速起步，每一帧都在走，压和缩才显得连贯
  const keys: { frame: number; value: number; ease?: (t: number) => number }[] = [
    { frame: 0, value: depth },
    { frame: hold, value: depth },
    { frame: peakAt, value: peak, ease: Easing.inOut(Easing.sin) },
    { frame: duration, value: depth, ease: Easing.inOut(Easing.sin) },
  ];
  for (let i = 1; i < keys.length; i++) {
    const from = keys[i - 1];
    const to = keys[i];
    if (frame <= to.frame) {
      // hold 为 0 时前两个关键帧都在第 0 帧，这一段长度是 0，直接取终点，别除以 0
      const span = to.frame - from.frame;
      const p = span > 0 ? (frame - from.frame) / span : 1;
      return from.value + (to.value - from.value) * (to.ease ?? Easing.linear)(p);
    }
  }
  return depth;
};

// 模板「原地压扁」：一张透明图原地压扁、横向撑宽，再弹回来、纵向略拉长，一个循环压一次。
// 见同目录 template.md
export const Squish: React.FC<SquishProps> = ({
  src,
  depth = 0.45,
  stretch = 0.55,
  peak = 1.1,
  size = 176,
  ground = 228,
  hold = 1,
  box,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scaleY = squishScaleAt(frame, durationInFrames, depth, peak, hold);
  const scaleX = 1 + (1 - scaleY) * stretch;

  // 有包围盒：整张图按比例放大，让「内容」正好 size 宽，再用外边距把四周留白让出去，
  // 内容就落在底边和水平中线上
  const content = box
    ? (() => {
        const scale = size / (box.right - box.left);
        return {
          width: box.width * scale,
          height: box.height * scale,
          // 负的下边距：让图片底边探出容器，内容底边才正好压在 ground 上
          marginBottom: -(box.height - box.bottom) * scale,
          // 内容在图片里偏左 / 偏右时，把图片整体挪回去
          marginLeft: (box.width / 2 - (box.left + box.right) / 2) * scale,
        };
      })()
    : { width: size, height: undefined, marginBottom: 0, marginLeft: 0 };

  return (
    <AbsoluteFill>
      {/* 以底边中点为轴压扁：底边不动，头顶往下塌 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CANVAS,
          height: ground,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          transformOrigin: "50% 100%",
          transform: `scale(${scaleX}, ${scaleY})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: content.width,
            height: content.height,
            marginBottom: content.marginBottom,
            marginLeft: content.marginLeft,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
