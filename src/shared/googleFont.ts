/**
 * 按需加载 Google Fonts。
 *
 * 不能在模块顶层调 `loadFont()`：`Root.tsx` 会 import 全部作品，只要有一个作品在顶层拉字体，
 * 渲染**别的**作品时也会去拉——Google Fonts 一断网（或者代理没开），整个渲染进程直接崩掉。
 * 这个包装让字体在第一次真正渲染到该作品时才加载，加载一次之后复用。
 */
export const lazyFont = <T>(load: () => T): (() => T) => {
  let cached: T | null = null;
  return () => (cached ??= load());
};
