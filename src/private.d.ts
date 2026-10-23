// Rspack 的 require.context，Root.tsx 用它收集 src/videos/、src/stickers/、src/private/ 下的作品
declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ): {
    keys(): string[];
    (id: string): Promise<{ default: React.FC }>;
  };
};
