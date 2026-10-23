import { AbsoluteFill } from "remotion";
import { SANS_FAMILY } from "../shared/fonts";

// 动效样片库：每个效果一个文件，放在 effects/<名字>.tsx，默认导出一个 GalleryEffect。
// 文件名就是效果的名字（Composition id 是 G-<文件名>），index.tsx 自动收集。
// npm run gallery 把它们渲染成循环小片，拼成网页给用户挑（见 CLAUDE.md"动效样片库"）。
//
// 写样片的规矩：
// - 看的是动效本身，不是风格。配色只用下面这几个中性色，作品里照用户的风格换
// - 必须首尾无缝循环：第 0 帧和第 frames 帧是同一个画面。用 loop(frame, frames) 拿 0–1 的进度，
//   或者让动画在 frames 帧内走完一个来回。npm run gallery 会量接缝，跳了会报
// - 3–5 秒（90–150 帧），一段只演一种效果，画面有明确的焦点
// - 画面只能由帧号算出来（见 CLAUDE.md"画面手法"的硬规则）

export const W = 1920;
export const H = 1080;
export const FPS = 30;

// 中性色：深底、亮前景、一个强调色、一个辅色、一个暗灰
export const C = {
  bg: "#15171C",
  bg2: "#1F232B",
  fg: "#EEF0F3",
  dim: "#5B6270",
  accent: "#F2A93B",
  cool: "#4FB3D9",
} as const;

export const FONT = SANS_FAMILY;

export type GalleryEffect = {
  // 编号固定不变，用户按编号点名；新效果接着往后编，不重排
  no: number;
  name: string; // 中文名，写看得见的效果，比如"格子落水泛涟漪"
  group: string; // 分组：文字、形状、水墨、线条、转场、数据、镜头
  desc: string; // 一句话：画面上发生了什么
  tech: string; // 用了什么：哪个组件、哪个库、关键参数
  frames: number; // 循环长度
  component: React.FC;
};

// 0–1 的循环进度，第 frames 帧回到 0
export const loop = (frame: number, frames: number) =>
  (((frame % frames) + frames) % frames) / frames;

export const Stage: React.FC<{ children: React.ReactNode; bg?: string }> = ({
  children,
  bg = C.bg,
}) => (
  <AbsoluteFill style={{ background: bg, fontFamily: FONT, overflow: "hidden" }}>
    {children}
  </AbsoluteFill>
);
